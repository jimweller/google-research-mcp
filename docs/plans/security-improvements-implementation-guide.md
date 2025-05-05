# MCP Server Security Improvements Implementation Guide (Revision 2025-05-04)

**Version:** 2.1
**Date:** 2025-05-04
**Status:** Implemented (Phase 1/2 Core Security)

## Table of Contents

1.  [Executive Summary](#1-executive-summary)
2.  [OAuth 2.1 Delegation Strategy](#2-oauth-21-delegation-strategy)
3.  [Token Validation Middleware](#3-token-validation-middleware)
    *   3.1 Error Handling Strategy (AS/JWKS Issues)
    *   3.2 Performance Impact Assessment
4.  [Scope Definition](#4-scope-definition)
5.  [Client Responsibilities](#5-client-responsibilities)
6.  [Metadata, DCR, and PKCE Clarification](#6-metadata-dcr-and-pkce-clarification)
7.  [Transport, Batching, and Annotations](#7-transport-batching-and-annotations)
8.  [High Risk Findings & Mitigation](#8-high-risk-findings--mitigation)
    *   8.1 Server-Side Request Forgery (SSRF)
    *   8.2 Secure Management Endpoints (HTTP)
    *   8.3 Secure API Key & Secret Management
9.  [Medium Risk Findings & Mitigation](#9-medium-risk-findings--mitigation)
    *   9.1 Cross-Origin Resource Sharing (CORS)
    *   9.2 Event Store Encryption
    *   9.3 Rate Limiting
10. [Low Risk Findings & Mitigation](#10-low-risk-findings--mitigation)
    *   10.1 Dependency Vulnerability Management
    *   10.2 Input Validation
    *   10.3 Enhanced Logging & Monitoring
    *   10.4 Least Privilege Principle
11. [Implementation Roadmap (TDD Focused)](#11-implementation-roadmap-tdd-focused)
12. [Potential Challenges](#12-potential-challenges)
13. [Troubleshooting](#13-troubleshooting)
14. [References](#14-references)

---

## 1. Executive Summary

This document outlines the implementation plan for critical security improvements to the `google-researcher-mcp` server, aligning with the MCP Specification (Revision 2025-03-26). The primary focus is the mandatory adoption of **OAuth 2.1 (Authorization Code Grant + PKCE)** for securing all HTTP transport interactions.

Crucially, this server operates **strictly as an OAuth 2.1 Resource Server (RS)**. It **delegates** user authentication and authorization token issuance to a trusted external Identity Provider (IdP) / Authorization Server (AS). This approach significantly reduces the security burden on the MCP server itself by leveraging established, robust external systems for identity management. Implementation prioritized the development and testing of OAuth 2.1 Bearer token validation middleware, followed by addressing other key risks like SSRF, secrets management, CORS, rate limiting, encryption, and enhanced logging. **This document reflects the state after the implementation of core OAuth features.**

---

## 2. OAuth 2.1 Delegation Strategy

The core security strategy for the MCP server's HTTP transport relies on OAuth 2.1 delegation.

*   **Role:** The `google-researcher-mcp` server acts **only** as a Resource Server (RS).
*   **Delegation:** User authentication and access token issuance are handled entirely by an external, trusted Authorization Server (AS) / Identity Provider (IdP). The MCP server **does not** implement AS endpoints like `/authorize` or `/token`.
*   **Trust & Configuration:** The MCP server must be configured to trust the designated external AS. This involves:
    *   Knowing the AS's `issuer` URL (e.g., `https://auth.example.com`).
    *   Discovering the AS's JWKS URI, typically via the AS's OAuth 2.0 Authorization Server Metadata endpoint (RFC 8414) (e.g., `https://auth.example.com/.well-known/oauth-authorization-server`) or OpenID Connect Discovery endpoint (`/.well-known/openid-configuration`).
    *   Knowing the expected `audience` identifier for the MCP server (e.g., `https://mcp.example.com/api` or a specific client ID).
*   **Flow:**
    1.  **Client Authentication:** The client application authenticates the user with the external AS using the Authorization Code Grant with PKCE.
    2.  **Token Issuance:** The external AS issues an Access Token (typically a JWT) to the client upon successful authentication and authorization.
    3.  **Client Request:** The client includes the obtained Access Token as a Bearer token in the `Authorization` header of its HTTP requests to the MCP server.
    4.  **MCP Server Validation:** The MCP server receives the request, extracts the Bearer token, and validates it using the Token Validation Middleware (see Section 3). This includes checking the signature against the AS's public keys, issuer, audience, expiry, and required scopes.
    5.  **Access Control:** If the token is valid and contains the necessary scopes, the MCP server processes the request. Otherwise, it returns a `401 Unauthorized` or `403 Forbidden` error.

---

## 3. Token Validation Middleware

A critical component is the middleware responsible for validating incoming OAuth 2.1 Bearer tokens on protected HTTP endpoints, implemented in `src/shared/oauthMiddleware.ts`.

**Implementation Details:**

1.  **Extraction:** Extracts the Bearer token from the `Authorization` header. Handles missing or malformed headers.
2.  **Signature Validation & Key Management:**
    *   Uses the `jwks-rsa` library to fetch the AS's JSON Web Key Set (JWKS) from its published JWKS URI.
    *   **JWKS Caching:** Leverages `jwks-rsa`'s built-in caching (`cache: true`) and rate limiting. Additionally, the `getSigningKey` function uses the server's `PersistentCache` (`src/cache/persistentCache.ts`) with a configurable TTL (`jwksCacheTtl`, default 1 hour) and stale-while-revalidate logic to further optimize JWKS fetching and provide resilience against temporary AS unavailability.
    *   **Key Identification (`kid`):** Uses the `kid` (Key ID) from the JWT header to select the specific key from the JWKS for validation via `jwksRsaClient.getSigningKey`.
    *   **Key Rotation:** `jwks-rsa` handles fetching updated keys if the `kid` is not found in its cache. The `PersistentCache` layer adds further resilience.
    *   Uses the `jsonwebtoken` library (`jwt.verify`) to verify the token signature against the fetched public key. Supports standard algorithms (RS256, ES256, etc.).
3.  **Issuer Validation:** Ensures the `iss` (issuer) claim in the token exactly matches the configured, trusted AS `issuerUrl`.
4.  **Audience Validation:** Ensures the `aud` (audience) claim contains the configured `audience` identifier expected by the MCP server.
5.  **Expiry Validation:** Ensures the token is within its validity period by checking `exp` (expiration time) and `nbf` (not before time, if present) claims against the current time. Allows ignoring expiration for testing via `allowExpiredTokens` option.
6.  **Scope Validation:** The `requireScopes` middleware function uses the `hasRequiredScopes` helper (`src/shared/oauthScopes.ts`) to check if the token's `scope` claim (parsed into an array) contains the specific permissions required for the requested endpoint/action (see Section 4).
7.  **Error Handling:** Returns appropriate HTTP status codes (`401 Unauthorized` for missing/invalid/expired tokens, `403 Forbidden` for valid tokens lacking required scopes) using a custom `OAuthTokenError` class. Specific error codes (`missing_token`, `invalid_token`, `expired_token`, `insufficient_scope`) are included in the JSON response body.
8.  **Session Integration:** After successful validation, the middleware attaches the decoded token payload and extracted scopes to the Express `Request` object as `req.oauth` for use by downstream handlers.
9.  **HTTPS Enforcement:** Enforces HTTPS in production environments by checking `x-forwarded-proto` or `req.protocol`.

**Testing Strategy (TDD Approach):**

*   Unit tests (`src/shared/oauthMiddleware.spec.ts`) cover middleware logic, including various token validation scenarios (valid, invalid, expired, scope checks), JWKS handling mocks, and error conditions.
*   Integration tests (`e2e_*.mjs`) verify end-to-end functionality with protected endpoints.

**3.1 Error Handling Strategy (AS/JWKS Issues)**

The implemented middleware handles AS/JWKS communication issues as follows:

*   **JWKS Fetch Failure:**
    *   The `jwks-rsa` library handles retries and caching internally.
    *   The `PersistentCache` layer in `getSigningKey` provides an additional caching layer with stale-while-revalidate, allowing the server to potentially use a slightly stale key for a short period if the AS is temporarily unreachable during a refresh attempt, while logging errors.
    *   If `jwks-rsa` or the cache ultimately fails to provide a valid signing key after retries/cache checks, `getSigningKey` throws an `OAuthTokenError`, leading to a `401 Unauthorized` response with `error: 'invalid_token'` and `error_description: 'Unable to verify token signature'`.
*   **Client Error Messages:**
    *   `401 Unauthorized` is returned for token validation failures (missing token, invalid format, bad signature, expired, bad issuer/audience, JWKS issues). The response body includes `error` (e.g., `invalid_token`, `expired_token`) and `error_description`.
    *   `403 Forbidden` is returned when the token is valid but lacks required scopes. The response body includes `error: 'insufficient_scope'`, `error_description`, and the required `scope`.
    *   `503 Service Unavailable` is generally *not* returned by the middleware itself, as failures usually result in a `401`. Persistent AS unavailability would manifest as consistent `401` errors due to inability to verify signatures.
*   **Logging:** Errors during token validation and key fetching are logged via `console.error` within the middleware. Enhanced structured logging (Task P2-2) should be implemented to capture these errors more effectively.

**3.2 Performance Impact Assessment**

*   **JWKS Fetching Latency:** Mitigated by the multi-layer caching (in-memory via `jwks-rsa`, persistent via `PersistentCache`). Initial fetch and refreshes still incur network latency.
*   **Cryptographic Operations:** `jsonwebtoken.verify` adds minor CPU overhead per request.
*   **Library Overhead:** Minimal overhead from `jsonwebtoken`, `jwks-rsa`, and custom middleware logic.
*   **Monitoring:** Latency of requests passing through `oauthMiddleware` and `requireScopes` should be monitored.

---

## 4. Scope Definition

OAuth scopes define granular permissions. The following scopes are implemented in `src/shared/oauthScopes.ts`:

*   **Tool Execution (`TOOL_SCOPES`):**
    *   `mcp:tool:google_search:execute`
    *   `mcp:tool:scrape_page:execute`
    *   `mcp:tool:analyze_with_gemini:execute`
    *   `mcp:tool:research_topic:execute`
*   **Administrative (`ADMIN_SCOPES`):**
    *   `mcp:admin:cache:read`
    *   `mcp:admin:cache:invalidate`
    *   `mcp:admin:cache:persist`
    *   `mcp:admin:event-store:read`
    *   `mcp:admin:event-store:manage` *(Defined but potentially not yet used by endpoints)*
    *   `mcp:admin:config:read` *(Defined but potentially not yet used by endpoints)*
    *   `mcp:admin:config:write` *(Defined but potentially not yet used by endpoints)*
    *   `mcp:admin:logs:read` *(Defined but potentially not yet used by endpoints)*
*   **Composite (`COMPOSITE_SCOPES`):**
    *   `mcp:admin` (Grants all `mcp:admin:*` scopes)
    *   `mcp:tool` (Grants all `mcp:tool:*:execute` scopes)

The external AS issues tokens containing appropriate scopes. The MCP server's `requireScopes` middleware enforces these at the endpoint level based on the `ENDPOINT_REQUIRED_SCOPES` mapping (or direct usage).

---

## 5. Client Responsibilities

Clients interacting with the MCP server via HTTP **must**:

1.  **Integrate with the designated external AS/IdP.**
2.  Implement the **OAuth 2.1 Authorization Code Grant with PKCE** flow to obtain Access Tokens.
3.  Securely store their client credentials (if applicable, for interacting with the AS).
4.  Include the obtained Access Token as a **Bearer token** in the `Authorization` header of every request to protected MCP server endpoints.
5.  Handle token expiry and implement logic to refresh or re-obtain tokens as needed (typically by re-initiating the Authorization Code flow).

---

## 6. Metadata, DCR, and PKCE Clarification

These OAuth concepts relate primarily to the client-AS interaction:

*   **OAuth 2.0 Authorization Server Metadata (RFC 8414):** Defines a standard way for an AS to publish its endpoints (authorization, token, JWKS URI, etc.) and capabilities. The MCP server (RS) uses the AS's metadata discovery endpoint primarily to find the `jwks_uri`.
*   **OAuth 2.0 Dynamic Client Registration (RFC 7591):** Allows clients to register with an AS programmatically. This is **not** relevant to the MCP server acting as an RS.
*   **Proof Key for Code Exchange (PKCE) (RFC 7636):** A security extension for the Authorization Code Grant, mandatory in OAuth 2.1. PKCE prevents authorization code interception attacks and is handled **entirely between the client and the external AS**. The MCP server (RS) is not involved in the PKCE exchange.

The MCP server, as an RS, primarily needs to know the AS's `issuer` URL and its `jwks_uri` to validate tokens.

---

## 7. Transport, Batching, and Annotations

*   **Transport:** OAuth 2.1 Bearer token validation applies specifically to the **HTTP transport**. Stdio transport security relies on the inherent security of the local machine environment.
*   **Batching:** For batched HTTP requests (`POST /mcp` with an array body), the Bearer token validation is performed **once** for the incoming batch request by the `StreamableHTTPServerTransport`. If valid, all operations within the batch are processed under the authority granted by the token. Individual operations within the batch do not undergo separate token validation.
*   **Annotations:** Security annotations within the MCP protocol definition are complementary. They can provide fine-grained policy hints but do not replace the fundamental transport-level security provided by OAuth 2.1.

---

## 8. High Risk Findings & Mitigation

### 8.1 Server-Side Request Forgery (SSRF) - `scrape_page` Tool

*   **Risk:** The `scrape_page` tool takes a URL as input. A malicious user could provide URLs pointing to internal network resources or cloud metadata services.
*   **Mitigation:** *(Status: Requires Implementation/Verification - Task P1-4)*
    *   **Strict Allowlist:** Implement a strict, configurable allowlist of permitted domain names or IP address ranges for scraping. Deny all others.
    *   **Input Validation:** Validate the URL format rigorously.
    *   **Network Segregation:** Run the scraping process in a restricted network environment if possible.
    *   **Disable Redirects:** Configure the HTTP client used for scraping to disable following redirects by default, or limit redirect depth and scope.
    *   **TDD:** Test cases for allowed URLs, disallowed private/internal IPs, loopback addresses, link-local addresses, cloud metadata service IPs, `file://` protocol attempts, and other non-HTTP schemes.

### 8.2 Secure Management Endpoints (HTTP)

*   **Risk:** Unauthenticated or improperly authorized access to administrative endpoints.
*   **Mitigation:** *(Status: Implemented - Task P0-7)*
    *   **Mandatory OAuth 2.1:** All HTTP management endpoints (`/mcp/cache-stats`, `/mcp/event-store-stats`, `/mcp/cache-invalidate`, `/mcp/cache-persist`, `/mcp/oauth-token-info`) are protected by the OAuth 2.1 Token Validation Middleware (`oauthMiddleware` and `requireScopes` in `server.ts`).
    *   **Scope Enforcement:** Each management endpoint requires specific admin scopes (e.g., `mcp:admin:cache:read` for `/mcp/cache-stats`). Access is denied (403) if the validated token lacks the required scope(s).
    *   **Static Keys Removed:** Reliance on static API keys (like `CACHE_ADMIN_KEY`) for securing HTTP endpoints has been removed.
    *   **IP Whitelisting (Optional Layer):** Not currently implemented, but could be added as an additional defense-in-depth measure.
    *   **TDD:** Tests cover access to admin endpoints with valid/invalid tokens and correct/incorrect scopes.

### 8.3 Secure API Key & Secret Management

*   **Risk:** Exposure of sensitive credentials like external service API keys (Google Search, Gemini).
*   **Mitigation:** *(Status: Requires Implementation/Verification - Task P1-3)*
    *   **Secrets Manager:** Store all secrets in a dedicated secrets management system (e.g., environment variables loaded securely via `.env` files or system environment, Vault, AWS/GCP Secrets Manager). **Do not** hardcode secrets.
    *   **Environment Variables:** Use environment variables for configuration, loaded securely at runtime (currently uses `dotenv`).
    *   **Least Privilege:** Ensure API keys have the minimum necessary permissions.
    *   **Rotation:** Implement regular rotation policies for all secrets and keys.
    *   **Access Control:** Strictly limit access to the secrets management system.
    *   **TDD:** Test that the application correctly loads configuration/secrets from environment variables or the expected source, and fails gracefully if secrets are missing.

---

## 9. Medium Risk Findings & Mitigation

### 9.1 Cross-Origin Resource Sharing (CORS)

*   **Risk:** Browsers may block web-based clients from calling the MCP server API due to CORS policy restrictions. Improperly configured CORS can expose the API to unintended origins.
*   **Mitigation:** *(Status: Requires Implementation/Verification - Task P1-5)*
    *   **Configure CORS Middleware:** Implement CORS middleware (e.g., `cors` package in Node.js).
    *   **Restrict Origins:** Configure a strict allowlist of permitted client origins (`Access-Control-Allow-Origin`) via environment variable `ALLOWED_ORIGINS`. Avoid using wildcard (`*`) in production unless the API is truly public.
    *   **Allow Methods/Headers:** Explicitly allow necessary HTTP methods (`GET`, `POST`, `DELETE`, `OPTIONS`) via `Access-Control-Allow-Methods`.
    *   **Allow `Authorization` Header:** Ensure the `Authorization` header is included in `Access-Control-Allow-Headers`.
    *   **Handle Preflight Requests:** Ensure the server correctly handles `OPTIONS` preflight requests.
    *   **TDD:** Test CORS headers for requests from allowed origins, disallowed origins, and preflight (`OPTIONS`) requests. Verify `Authorization` is in `Access-Control-Allow-Headers`.

### 9.2 Event Store Encryption

*   **Risk:** Sensitive data persisted in the event store could be exposed if the storage medium is compromised.
*   **Mitigation:** *(Status: Requires Assessment/Implementation - Task P3-2)*
    *   **Encryption at Rest:** Ensure the underlying storage system (filesystem) provides encryption at rest (OS-level or disk encryption).
    *   **Application-Level Encryption (Optional):** Assess sensitivity of event data. If needed, implement application-level encryption *before* persisting events using `src/shared/eventStoreEncryption.ts` (requires secure key management).
    *   **TDD:** If implementing application-level encryption, test the encryption/decryption process thoroughly.

### 9.3 Rate Limiting

*   **Risk:** Denial-of-service (DoS) attacks or resource exhaustion due to excessive requests.
*   **Mitigation:** *(Status: Requires Implementation - Task P2-1)*
    *   **Implement Rate Limiting Middleware:** Use robust rate-limiting middleware (e.g., `express-rate-limit`).
    *   **Keying Strategy:** Key limits primarily off the validated user identifier (`sub` claim) or client identifier from the OAuth token. Fallback to IP address.
    *   **Configurable Limits:** Make limits configurable.
    *   **Appropriate Response:** Return `429 Too Many Requests`.
    *   **TDD:** Test rate limits are enforced correctly.

---

## 10. Low Risk Findings & Mitigation

### 10.1 Dependency Vulnerability Management

*   **Risk:** Using outdated or vulnerable third-party libraries.
*   **Mitigation:** *(Status: Requires Implementation - Task P3-3)*
    *   **Regular Scanning:** Use `npm audit`, Dependabot.
    *   **Update Strategy:** Keep dependencies updated.
    *   **CI/CD Integration:** Integrate scanning into CI/CD.

### 10.2 Input Validation

*   **Risk:** Malformed or malicious input causing errors or potential exploits.
*   **Mitigation:** *(Status: Requires Implementation - Task P2-3)*
    *   **Validate All Inputs:** Rigorously validate tool arguments and API inputs.
    *   **Use Libraries:** Leverage validation libraries (e.g., Zod).
    *   **Type Checking:** Utilize TypeScript.
    *   **TDD:** Write tests for valid and invalid input scenarios.

### 10.3 Enhanced Logging & Monitoring

*   **Risk:** Insufficient logging makes diagnosing issues and detecting security incidents difficult.
*   **Mitigation:** *(Status: Requires Implementation - Task P2-1)*
    *   **Structured Logging:** Implement structured logging (e.g., JSON format).
    *   **Key Events:** Log critical events including detailed OAuth validation results (success/failure reasons, validated identity, scopes - **never log the token itself**), JWKS management, tool execution, errors, rate limits.
    *   **Avoid Logging Secrets:** Ensure sensitive data is never logged.
    *   **Centralized Logging:** Ship logs to a centralized system.
    *   **Monitoring:** Monitor key metrics.

### 10.4 Least Privilege Principle

*   **Risk:** Components or processes running with more permissions than necessary.
*   **Mitigation:** *(Status: Requires Review/Implementation - Task P3-4)*
    *   **Service Accounts:** Run the MCP server process under a dedicated, non-privileged user account.
    *   **File Permissions:** Ensure appropriate file system permissions.
    *   **OAuth Scopes:** Enforce granular scopes via OAuth.
    *   **External Keys:** Ensure API keys used by the server have minimum required permissions.

---

## 11. Implementation Roadmap (TDD Focused)

This reflects the *completed* and *remaining* tasks based on the current state.

**Phase 1: Foundation (Completed)**
*   ✅ **[P0-1]** Update MCP SDK to v1.11.0
*   ✅ **[P0-2]** Implement Streamable HTTP Transport
*   ✅ **[P0-3]** Implement Foundational OAuth 2.1 RS Middleware
*   ✅ **[P0-4]** Define & Document OAuth Scopes
*   ✅ **[P0-5]** Implement Batch Request Handling (via SDK/Transport)
*   ✅ **[P0-6]** Add Tool Annotations (via SDK)
*   ✅ **[P0-7]** Secure Management Endpoints with OAuth Scopes
*   ✅ **[P0-8]** Foundational Unit & Integration Tests (Initial coverage)
*   ✅ **[P0-9]** Update Core Documentation (README, Initial Architecture)

**Phase 2: Core Security (Partially Complete / In Progress)**
*   ✅ **[P1-1]** Implement JWKS Caching & Key Rotation Handling (via `jwks-rsa` and `PersistentCache`)
*   ✅ **[P1-2]** Implement Robust Error Handling for AS Communication (Basic handling implemented)
*   ⏳ **[P1-3]** Implement Secrets Management Strategy *(Requires Verification/Refinement)*
*   ⏳ **[P1-4]** Implement SSRF Mitigation for `scrape_page` *(Requires Implementation)*
*   ⏳ **[P1-5]** Configure CORS Middleware *(Requires Implementation)*
*   ⏳ **[P1-6]** Implement Handling Failed Sources (`research_topic`) *(Requires Implementation)*
*   ⏳ **[P1-7]** Implement Basic Recency Filtering (`google_search`) *(Requires Implementation)*
*   ⏳ **[P1-8]** Implement Source Attribution & Verification (`research_topic`) *(Requires Implementation)*
*   ⏳ **[P1-9]** Security Testing *(Requires Implementation)*
*   ⏳ **[P1-10]** Update Security Documentation *(This task - In Progress)*

**Phase 3: Enhanced Features (Planned)**
*   ⏳ **[P2-1]** Implement Rate Limiting
*   ⏳ **[P2-2]** Implement Enhanced Logging
*   ⏳ **[P2-3]** Enhance Input Validation Across Tools
*   ⏳ **[P2-4]** Implement Research Depth & Focus Controls (`research_topic`)
*   ⏳ **[P2-5]** Implement Recency Weighting (`research_topic`)
*   ⏳ **[P2-6]** Feature & Enhancement Testing
*   ⏳ **[P2-7]** Update Documentation for New Features & Enhancements

**Phase 4: Optimization & Future Features (Planned)**
*   ⏳ **[P3-1]** Implement Structured Data Extraction Tool (`extract_structured_data`)
*   ⏳ **[P3-2]** Implement Event Store Encryption (If Applicable)
*   ⏳ **[P3-3]** Implement Dependency Vulnerability Management Process
*   ⏳ **[P3-4]** Review & Apply Least Privilege Principle
*   ⏳ **[P3-5]** Future Feature Testing
*   ⏳ **[P3-6]** Update Documentation for Future Features & Processes

---

## 12. Potential Challenges

*   **External AS Integration:** Dependency on the external AS's reliability and adherence to standards.
*   **Scope Management:** Ensuring clients request and are granted appropriate scopes.
*   **Client Implementation:** Ensuring clients correctly handle token acquisition, storage, and refresh.
*   **Performance Tuning:** Balancing security checks with performance, especially JWKS caching and validation overhead.

---

## 13. Troubleshooting

*   **`401 Unauthorized` Errors:**
    *   Check `Authorization: Bearer <token>` header.
    *   Check token expiry (`exp`).
    *   Check token signature (using AS public keys).
    *   Check `iss` claim matches configured `issuerUrl`.
    *   Check `aud` claim includes configured `audience`.
    *   Check server logs for specific error codes: `missing_token`, `invalid_token` (format/signature/claims issue), `expired_token`. Check `error_description` for more details (e.g., "Unable to verify token signature" might indicate JWKS issues).
*   **`403 Forbidden` Errors:**
    *   Token is valid, but lacks required scope(s).
    *   Check `scope` claim in the token.
    *   Check endpoint's `requireScopes` configuration.
    *   Response body includes `error: 'insufficient_scope'` and required `scope`.
*   **JWKS Fetching Issues:**
    *   Verify network connectivity to AS JWKS URI.
    *   Check JWKS URI configuration.
    *   Check server logs for errors from `jwks-rsa` or `getSigningKey`.
*   **CORS Errors (in Client Browser):**
    *   Check server CORS middleware configuration (`ALLOWED_ORIGINS`).
    *   Verify `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers` (must include `Authorization`), `Access-Control-Allow-Methods`.
    *   Check browser console for specific errors.

---

## 14. References

*   **OAuth 2.1:** (Draft specification) - [https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-07](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-07) (Check latest draft)
*   **OAuth 2.0 Core:** RFC 6749 - [https://tools.ietf.org/html/rfc6749](https://tools.ietf.org/html/rfc6749)
*   **OAuth 2.0 Bearer Token Usage:** RFC 6750 - [https://tools.ietf.org/html/rfc6750](https://tools.ietf.org/html/rfc6750)
*   **PKCE:** RFC 7636 - [https://tools.ietf.org/html/rfc7636](https://tools.ietf.org/html/rfc7636)
*   **JWT:** RFC 7519 - [https://tools.ietf.org/html/rfc7519](https://tools.ietf.org/html/rfc7519)
*   **JWK:** RFC 7517 - [https://tools.ietf.org/html/rfc7517](https://tools.ietf.org/html/rfc7517)
*   **JWS:** RFC 7515 - [https://tools.ietf.org/html/rfc7515](https://tools.ietf.org/html/rfc7515)
*   **OAuth 2.0 AS Metadata:** RFC 8414 - [https://tools.ietf.org/html/rfc8414](https://tools.ietf.org/html/rfc8414)
*   **OWASP Top 10:** [https://owasp.org/www-project-top-ten/](https://owasp.org/www-project-top-ten/)
*   **OWASP SSRF Prevention Cheat Sheet:** [https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
*   **`jsonwebtoken` library:** [https://github.com/auth0/node-jsonwebtoken](https://github.com/auth0/node-jsonwebtoken)
*   **`jwks-rsa` library:** [https://github.com/auth0/node-jwks-rsa](https://github.com/auth0/node-jwks-rsa)