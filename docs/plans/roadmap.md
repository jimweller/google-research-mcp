# Project Roadmap & Implementation Status

**Date:** July 6, 2025
**Version:** 3.0
**Status:** Core Implementation Complete. Focus on Production Hardening.

## 1. Executive Summary

This document provides a comprehensive overview of the `google-researcher-mcp` server's development status and a forward-looking roadmap. The project has successfully implemented its foundational features, including compliance with MCP SDK v1.11.0 and a robust OAuth 2.1 security model.

The focus has now shifted from initial implementation to production hardening, addressing critical security gaps, and implementing key functional enhancements required for a public release. This roadmap supersedes the previous `mcp_server_improvement_plan.md` and `security-improvements-implementation-guide.md` documents.

## 2. Implementation Status

### ✅ Completed Features

- **MCP Core Compliance:**
    - MCP SDK v1.11.0 integration
    - Streamable HTTP & Stdio Transports
    - JSON-RPC Batch Request Handling (via SDK)
    - Tool Annotations (`readOnly: true`)
- **Security & Authorization:**
    - OAuth 2.1 Resource Server (RS) model with Bearer Token validation
    - Dynamic JWKS fetching and multi-layer caching for signature verification
    - Granular, scope-based access control (`mcp:tool:*`, `mcp:admin:*`)
    - Secure management endpoints protected by OAuth scopes
    - CORS middleware configured for secure cross-origin requests
- **Core Infrastructure:**
    - Persistent Event Store for session management and resumption
    - Multi-namespace, persistent caching system for performance and resilience
    - YouTube transcript extraction in `scrape_page` tool

### ⚠️ Immediate Priorities (Production Hardening)

This section outlines the critical tasks that must be completed before the server is considered production-ready.

| Priority | Task                               | Status      | Risk   | Details                                                              |
| :---     | :---                               | :---        | :---   | :---                                                                 |
| **P1**   | **SSRF Mitigation**                | ✅ **Done** | **High** | Protocol checks, private IP blocking (configurable via `ALLOW_PRIVATE_IPS`), domain allowlist (`ALLOWED_DOMAINS`), redirect validation, cloud metadata blocking. |
| **P1**   | **Production Secrets Management**  | 🚨 **Open** | **High** | Move from `.env` to a secure secret management system (e.g., Vault). |
| **P1**   | **Rate Limiting**                  | 🚨 **Open** | **Medium** | Implement per-user/IP rate limiting to prevent abuse and DoS attacks.    |
| **P2**   | **Enhanced Input Validation**      | ⚠️ **Open** | **Medium** | Go beyond basic Zod schemas to implement stricter input sanitization.  |
| **P2**   | **Structured Logging & Monitoring** | ⚠️ **Open** | **Low**  | Transition from `console.log` to structured (JSON) logging.          |

## 3. Future Enhancements Roadmap

This section outlines planned functional improvements and new features.

### Phase 1: Core Tool Enhancements

| Task                               | Description                                                                                             | Priority |
| :---                               | :---                                                                                                    | :---     |
| **Source Attribution**             | Add an option to `research_topic` to return source URLs for verification.                               | **High**   |
| **Failed Source Handling**         | Gracefully handle and report failed scrapes within the `research_topic` tool.                           | **High**   |
| **Recency Filtering**              | Add a parameter to `google_search` to filter results by time (e.g., last week, last month).             | **Medium** |
| **Advanced Research Controls**     | Add `depth` and `focus` parameters to `research_topic` to control the scope and detail of research.     | **Medium** |

### Phase 2: New Capabilities

| Task                               | Description                                                                                             | Priority |
| :---                               | :---                                                                                                    | :---     |
| **Structured Data Extraction**     | Create a new tool, `extract_structured_data`, to pull specific information from text based on a schema. | **Medium** |
| **Event Store Encryption**         | Evaluate and implement application-level encryption for sensitive data in the event store.              | **Low**    |
| **Dependency Vulnerability Mgmt**  | Establish a formal process for regularly scanning and updating dependencies (`npm audit`, Dependabot).  | **Low**    |

## 4. Detailed Implementation Plans

### 4.1. SSRF Mitigation for `scrape_page` (P1 - Critical)

The `scrape_page` tool currently accepts any URL, creating a significant Server-Side Request Forgery (SSRF) vulnerability.

**Mitigation Steps:**
1.  **URL Validation:** Rigorously parse and validate the structure of the input URL.
2.  **Protocol Restriction:** Only allow `http:` and `https:` protocols.
3.  **IP-based Blocking:**
    -   Resolve the URL's domain to an IP address.
    -   Block requests to private, reserved, and loopback IP ranges (e.g., `127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`).
4.  **Domain Allow-listing (Optional but Recommended):** Maintain a configurable list of trusted domains that can be scraped.
5.  **Disable Redirects:** Configure the HTTP client to prevent following redirects, which could bypass initial checks.

### 4.2. Production Secrets Management (P1 - High)

Storing secrets in `.env` files is not suitable for production.

**Action Items:**
1.  **Select a Secrets Manager:** Evaluate and choose a secrets management solution (e.g., HashiCorp Vault, AWS/GCP Secrets Manager).
2.  **Abstract Secret Loading:** Create a module that abstracts the loading of secrets, supporting both `.env` for development and the chosen manager for production.
3.  **Implement Rotation Policy:** Establish a policy and process for regularly rotating all secrets.

### 4.3. Rate Limiting (P1 - Medium)

The server currently has no protection against high-volume requests.

**Implementation Plan:**
1.  **Use `express-rate-limit`:** Integrate the `express-rate-limit` middleware.
2.  **Keying Strategy:**
    -   For authenticated requests, key the limit on the user's identifier from the OAuth token (`req.oauth.sub`).
    -   For unauthenticated requests (if any), fall back to the IP address (`req.ip`).
3.  **Configuration:** Make rate limits configurable via environment variables.