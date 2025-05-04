# MCP Server Security Improvements Implementation Guide (Revision 2025-03-26)

**Version:** 2.0
**Date:** 2025-03-26
**Status:** Proposed

## Table of Contents

1.  [Executive Summary](#1-executive-summary)
2.  [OAuth 2.1 Delegation Strategy](#2-oauth-21-delegation-strategy)
3.  [Token Validation Middleware](#3-token-validation-middleware)
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

Crucially, this server will operate **strictly as an OAuth 2.1 Resource Server (RS)**. It will **delegate** user authentication and authorization token issuance to a trusted external Identity Provider (IdP) / Authorization Server (AS). This approach significantly reduces the security burden on the MCP server itself by leveraging established, robust external systems for identity management. Implementation will prioritize the development and testing of OAuth 2.1 Bearer token validation middleware, followed by addressing other key risks like SSRF, secrets management, CORS, rate limiting, encryption, and enhanced logging.

---

## 2. OAuth 2.1 Delegation Strategy

The core security strategy for the MCP server's HTTP transport relies on OAuth 2.1 delegation.

*   **Role:** The `google-researcher-mcp` server acts **only** as a Resource Server (RS).
*   **Delegation:** User authentication and access token issuance are handled entirely by an external, trusted Authorization Server (AS) / Identity Provider (IdP). The MCP server **will not** implement AS endpoints like `/authorize` or `/token`.
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

A critical component is the middleware responsible for validating incoming OAuth 2.1 Bearer tokens on protected HTTP endpoints.

**Requirements:**

1.  **Extraction:** Extract the Bearer token from the `Authorization` header.
2.  **Signature Validation & Key Management:**
    *   Verify the token's signature using the public keys of the trusted external AS.
    *   Fetch the AS's JSON Web Key Set (JWKS) from its published JWKS URI (discovered as per Section 2).
    *   **JWKS Caching:** Implement a robust caching strategy for the JWKS response to avoid excessive fetching. Cache keys based on the JWKS URI. Respect HTTP caching headers (`Cache-Control`, `Expires`) from the AS if provided. Have a reasonable default TTL (e.g., 1 hour) and a mechanism for proactive refresh or retry on validation failure.
    *   **Key Identification (`kid`):** If the JWT header includes a `kid` (Key ID), use it to select the specific key from the cached JWKS for validation. If no `kid` is present, attempt validation against all keys in the set.
    *   **Cache Invalidation & Key Rotation:** When signature validation fails with a specific `kid`, attempt to refresh the JWKS from the AS immediately. If the `kid` is not found in the refreshed JWKS, the token is invalid. If a new key set is fetched, update the cache. This helps handle key rotation gracefully.
3.  **Issuer Validation:** Ensure the `iss` (issuer) claim in the token exactly matches the configured, trusted AS issuer URL.
4.  **Audience Validation:** Ensure the `aud` (audience) claim contains *at least one* value that exactly matches the configured audience identifier(s) expected by the MCP server. If the `aud` claim is an array, check each element.
5.  **Expiry Validation:** Ensure the token is within its validity period by checking `exp` (expiration time) and `nbf` (not before time, if present) claims against the current time (allowing for minor clock skew).
6.  **Scope Validation:** Check if the token's `scope` claim contains the specific permissions required for the requested endpoint/action (see Section 4).
7.  **Error Handling:** Return appropriate HTTP status codes (`401 Unauthorized` for missing/invalid/expired tokens, `403 Forbidden` for valid tokens lacking required scopes).
8.  **Session Integration:** After successful validation, the authenticated user's identity (e.g., the `sub` claim from the token payload) MUST be securely associated with the MCP session state managed by the Streamable HTTP transport layer (e.g., `PersistentEventStore`). This ensures that subsequent actions within the same session are correctly attributed to the authenticated user. This might involve storing the validated claims or a user identifier within the session context accessible by the request handlers.

**Testing Strategy (TDD Approach):**

*   **Unit Tests (Middleware Logic):**
    *   Valid token with correct scope -> Success (e.g., 200 OK, middleware passes control).
    *   Missing `Authorization` header -> Fail (401).
    *   Non-Bearer token format -> Fail (401).
    *   Malformed JWT -> Fail (401).
    *   Token signed by untrusted key/algorithm -> Fail (401).
    *   Expired token (`exp` claim) -> Fail (401).
    *   Token used before `nbf` claim -> Fail (401).
    *   Incorrect issuer (`iss` claim) -> Fail (401).
    *   Incorrect/missing audience (`aud` claim) -> Fail (401).
    *   Valid token but missing required scope -> Fail (403).
    *   Valid token with sufficient scope -> Success.
    *   Valid token with multiple scopes, checking subset/superset requirements.
*   **JWKS Handling Tests:**
    *   Successful JWKS fetching and key selection using `kid`.
    *   JWKS caching logic (cache hit, cache miss, TTL expiry).
    *   Handling JWKS fetch failures (network error, invalid response).
    *   **Key Rotation Scenario:** Test successful validation after JWKS refresh due to unknown `kid`.
*   **Mocking Strategy:**
    *   Mock the external AS's JWKS endpoint (`/.well-known/jwks.json`) and potentially the metadata endpoint. Use libraries like `nock` or Jest's mocking capabilities to simulate different AS responses (valid keys, rotated keys, errors).
    *   Generate test JWTs using a library (`jose`, `jsonwebtoken`) with various claims and sign them with known private keys corresponding to the mocked public keys in the JWKS.
*   **Integration Tests:**
    *   Set up a lightweight test AS (e.g., using `node-oidc-provider` or a similar library in a test environment) or use a dedicated test instance of the actual external AS.
    *   Run tests where a test client obtains a real token from the test AS and uses it to call the protected MCP server endpoints. Verify end-to-end validation success and failure scenarios.

**3.1 Error Handling Strategy (AS/JWKS Issues)**

Robust handling of potential issues during communication with the external AS is crucial.

*   **AS Unavailability / JWKS Fetch Failure:**
    *   **Initial Fetch:** If the JWKS cannot be fetched on startup or first request, the server cannot validate tokens and should likely fail startup or return `503 Service Unavailable` for initial requests needing validation, logging the error clearly.
    *   **Runtime Fetch Failure (e.g., during refresh):** If a JWKS refresh fails during runtime (e.g., due to temporary network issues or AS downtime):
        *   **Stale Cache:** Continue using the currently cached JWKS keys for a limited grace period (configurable, e.g., 5-15 minutes) while attempting background retries. Log warnings about using stale keys.
        *   **Retry Mechanism:** Implement an exponential backoff retry strategy for fetching the JWKS.
        *   **Fallback / Failure:** If retries consistently fail beyond the grace period, the server must assume the AS is unavailable. Subsequent token validations should fail (`401 Unauthorized` or potentially `503 Service Unavailable` if the failure is widespread), logging the persistent error. Avoid indefinite blocking.
*   **Client Error Messages:**
    *   Standard `401 Unauthorized` should be returned for most token validation failures (invalid signature, expired, bad issuer/audience). Include a `WWW-Authenticate` header if appropriate (e.g., `Bearer error="invalid_token", error_description="Token validation failed"`).
    *   Use `403 Forbidden` specifically when the token is valid but lacks the required scopes. Include details about required scopes if permissible (`Bearer error="insufficient_scope", error_description="Requires scope 'X'"`).
    *   Use `503 Service Unavailable` only if the MCP server itself cannot perform validation due to persistent inability to contact the AS or fetch essential configuration like the JWKS.
*   **Logging:** Log all JWKS fetch attempts, successes, failures (with reasons), cache hits/misses, and fallback mechanism activations clearly for diagnostics.

**Pseudo-code / Library Example (Conceptual - using Node.js with `jose`):**

```typescript
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Request, Response, NextFunction } from 'express'; // Assuming Express

const AS_ISSUER_URL = process.env.EXTERNAL_AS_ISSUER_URL;
const MCP_SERVER_AUDIENCE = process.env.MCP_SERVER_AUDIENCE;
const JWKS_URL = new URL(`${AS_ISSUER_URL}/.well-known/jwks.json`); // Or from discovery

const JWKS = createRemoteJWKSet(JWKS_URL);

async function validateToken(token: string) {
  try {
    const { payload, protectedHeader } = await jwtVerify(token, JWKS, {
      issuer: AS_ISSUER_URL,
      audience: MCP_SERVER_AUDIENCE,
      // algorithms: ['RS256'], // Specify expected algorithms
    });
    return payload; // Contains claims like sub, scope, etc.
  } catch (error) {
    console.error('Token validation failed:', error);
    return null;
  }
}

export function requireScope(requiredScope: string | string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return res.status(401).send('Unauthorized: Missing or invalid Bearer token');
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    const payload = await validateToken(token);

    if (!payload) {
      return res.status(401).send('Unauthorized: Invalid or expired token');
    }

    // Scope check
    const scopes = (payload.scope as string || '').split(' ');
    const hasScope = Array.isArray(requiredScope)
      ? requiredScope.every(scope => scopes.includes(scope))
      : scopes.includes(requiredScope);

    if (!hasScope) {
      return res.status(403).send(`Forbidden: Insufficient scope. Requires: ${requiredScope}`);
    }

    // Attach validated user info/claims to request for downstream use if needed
    // req.user = { id: payload.sub, scopes: scopes };

    next(); // Token is valid and has required scope(s)
  };
}

// Example Usage (Express route)
// app.post('/tools/google_search/execute',
//   requireScope('mcp:tool:google_search:execute'),
//   handleGoogleSearchRequest
// );
// app.post('/admin/cache/invalidate',
//   requireScope(['mcp:admin:cache:invalidate', 'admin']), // Example requiring multiple scopes
//   handleCacheInvalidateRequest
// );
```
**3.2 Performance Impact Assessment**

Implementing OAuth 2.1 token validation introduces some performance overhead that should be considered and monitored:

*   **JWKS Fetching Latency:** Initial fetching or refreshing of the JWKS involves network requests to the external AS. This latency is largely mitigated by the JWKS caching strategy (Requirement 2c), but the initial fetch and periodic refreshes will incur network overhead. Cache TTLs should balance freshness with performance.
*   **Cryptographic Operations:** Validating the JWT signature involves cryptographic computations (e.g., RSA or ECDSA verification). While modern libraries and CPUs handle this efficiently, it adds a small CPU cost to each validated request compared to unauthenticated requests.
*   **Library Overhead:** The chosen validation library itself will have some baseline processing overhead.
*   **Monitoring:** It is recommended to monitor the performance impact, specifically the latency added by the validation middleware, especially under load. This can help identify bottlenecks, such as inefficient JWKS caching or excessive validation times. Metrics like P95 or P99 latency for requests passing through the middleware are valuable.

While generally manageable, understanding these factors is important for capacity planning and performance tuning.

---

## 4. Scope Definition

OAuth scopes define granular permissions. The following scopes are proposed for the `google-researcher-mcp` server:

*   **Tool Execution:**
    *   `mcp:tool:google_search:execute`
    *   `mcp:tool:scrape_page:execute`
    *   `mcp:tool:analyze_with_gemini:execute`
    *   `mcp:tool:research_topic:execute`
    *   *(Add scopes for any future tools)*
*   **Admin / Management:**
    *   `mcp:admin:cache:read` (For viewing cache status/keys)
    *   `mcp:admin:cache:invalidate` (For clearing cache entries)
    *   `mcp:admin:config:read` (For viewing configuration)
    *   `mcp:admin:logs:read` (For accessing server logs via an endpoint)
    *   `admin` (A potential broader admin scope, use with caution)

The external AS is responsible for issuing tokens containing the appropriate scopes based on user roles or client permissions. The MCP server's validation middleware enforces these scopes at the endpoint level.

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

*   **OAuth 2.0 Authorization Server Metadata (RFC 8414):** Defines a standard way for an AS to publish its endpoints (authorization, token, JWKS URI, etc.) and capabilities. The MCP server (RS) *may* use the AS's metadata discovery endpoint (e.g., `/.well-known/openid-configuration` or `/.well-known/oauth-authorization-server`) primarily to find the `jwks_uri`.
*   **OAuth 2.0 Dynamic Client Registration (RFC 7591):** Allows clients to register with an AS programmatically. This is **not** relevant to the MCP server acting as an RS.
*   **Proof Key for Code Exchange (PKCE) (RFC 7636):** A security extension for the Authorization Code Grant, mandatory in OAuth 2.1. PKCE prevents authorization code interception attacks and is handled **entirely between the client and the external AS**. The MCP server (RS) is not involved in the PKCE exchange.

The MCP server, as an RS, primarily needs to know the AS's `issuer` URL and its `jwks_uri` to validate tokens.

---

## 7. Transport, Batching, and Annotations

*   **Transport:** OAuth 2.1 Bearer token validation applies specifically to the **HTTP transport**. Stdio transport security relies on the inherent security of the local machine environment.
*   **Batching:** For batched HTTP requests, the Bearer token validation MUST be performed **once** for the incoming batch request. If valid, all operations within the batch are processed under the authority granted by the token.
*   **Annotations:** Security annotations within the MCP protocol definition are complementary. They can provide fine-grained policy hints but do not replace the fundamental transport-level security provided by OAuth 2.1.

---

## 8. High Risk Findings & Mitigation

### 8.1 Server-Side Request Forgery (SSRF) - `scrape_page` Tool

*   **Risk:** The `scrape_page` tool takes a URL as input. A malicious user could provide URLs pointing to internal network resources or cloud metadata services.
*   **Mitigation:**
    *   **Strict Allowlist:** Maintain a strict, configurable allowlist of permitted domain names or IP address ranges for scraping. Deny all others.
    *   **Input Validation:** Validate the URL format rigorously.
    *   **Network Segregation:** Run the scraping process in a restricted network environment if possible.
    *   **Disable Redirects:** Configure the HTTP client used for scraping to disable following redirects by default, or limit redirect depth and scope.
    *   **TDD:** Test cases for allowed URLs, disallowed private/internal IPs (e.g., `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback addresses (`127.0.0.1`, `::1`), link-local addresses (`169.254.0.0/16`), common cloud metadata service IPs (e.g., `169.254.169.254`), `file://` protocol attempts, and other non-HTTP schemes.

### 8.2 Secure Management Endpoints (HTTP)

*   **Risk:** Unauthenticated or improperly authorized access to administrative endpoints (e.g., cache management, configuration viewing).
*   **Mitigation:**
    *   **Mandatory OAuth 2.1:** All HTTP management endpoints **MUST** be protected by the OAuth 2.1 Token Validation Middleware (Section 3).
    *   **Scope Enforcement:** Each management endpoint MUST require specific, granular admin scopes (e.g., `mcp:admin:cache:invalidate`, `mcp:admin:config:read`). Access should be denied if the validated token lacks the required scope(s).
    *   **Remove Static Keys:** Eliminate reliance on static API keys (like `CACHE_ADMIN_KEY`) for securing HTTP endpoints. These are superseded by OAuth.
    *   **IP Whitelisting (Optional Layer):** As an *additional* defense-in-depth measure, configure IP address whitelisting for management endpoints, restricting access to known administrative IPs *in addition* to OAuth validation.
    *   **TDD:** Test cases for accessing admin endpoints with valid admin tokens (correct scope), valid user tokens (wrong scope -> 403), invalid tokens (-> 401), no token (-> 401), and requests from allowed/disallowed IPs (if IP whitelisting is used).

### 8.3 Secure API Key & Secret Management

*   **Risk:** Exposure of sensitive credentials like external service API keys (Google Search, Gemini) or the OAuth client secret used by the *client* (not the RS) to communicate with the external AS.
*   **Mitigation:**
    *   **Secrets Manager:** Store all secrets (external API keys, potentially database credentials, etc.) in a dedicated secrets management system (e.g., HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager, environment variables loaded securely). **Do not** hardcode secrets in source code or configuration files.
    *   **Environment Variables:** Use environment variables for configuration, loaded securely at runtime.
    *   **Least Privilege:** Ensure API keys have the minimum necessary permissions.
    *   **Rotation:** Implement regular rotation policies for all secrets and keys.
    *   **Access Control:** Strictly limit access to the secrets management system.
    *   **RS Perspective:** The MCP server acting as an RS typically does *not* need a client secret for token validation (it uses the AS's public keys). Secret management primarily applies to keys *used by* the MCP server to call *other* services.
    *   **TDD:** While direct testing of external secret managers is complex, test that the application correctly loads configuration/secrets from environment variables or the expected source, and fails gracefully if secrets are missing.

---

## 9. Medium Risk Findings & Mitigation

### 9.1 Cross-Origin Resource Sharing (CORS)

*   **Risk:** Browsers may block web-based clients from calling the MCP server API due to CORS policy restrictions. Improperly configured CORS can expose the API to unintended origins.
*   **Mitigation:**
    *   **Configure CORS Middleware:** Implement CORS middleware (e.g., `cors` package in Node.js).
    *   **Restrict Origins:** Configure a strict allowlist of permitted client origins (`Access-Control-Allow-Origin`). Avoid using wildcard (`*`) in production unless the API is truly public.
    *   **Allow Methods/Headers:** Explicitly allow necessary HTTP methods (`GET`, `POST`, `OPTIONS`, etc.) via `Access-Control-Allow-Methods`.
    *   **Allow `Authorization` Header:** Crucially, ensure the `Authorization` header is included in `Access-Control-Allow-Headers` to permit Bearer tokens to be sent.
    *   **Handle Preflight Requests:** Ensure the server correctly handles `OPTIONS` preflight requests.
    *   **TDD:** Test CORS headers for requests from allowed origins, disallowed origins, and preflight (`OPTIONS`) requests. Verify `Authorization` is in `Access-Control-Allow-Headers`.

### 9.2 Event Store Encryption

*   **Risk:** Sensitive data persisted in the event store (if used) could be exposed if the storage medium is compromised.
*   **Mitigation:**
    *   **Encryption at Rest:** Ensure the underlying storage system (filesystem, database) provides encryption at rest.
    *   **Application-Level Encryption (Optional):** For highly sensitive event payloads, consider application-level encryption *before* persisting events, using strong algorithms and secure key management (leveraging the secrets management system). This adds complexity but provides stronger protection.
    *   **TDD:** If implementing application-level encryption, test the encryption/decryption process thoroughly, including key handling and error scenarios.

### 9.3 Rate Limiting

*   **Risk:** Denial-of-service (DoS) attacks or resource exhaustion due to excessive requests from a single client or IP address.
*   **Mitigation:**
    *   **Implement Rate Limiting Middleware:** Use robust rate-limiting middleware (e.g., `express-rate-limit` in Node.js).
    *   **Keying Strategy:**
        *   **Authenticated Requests:** Key rate limits primarily off the validated user identifier (`sub` claim) or client identifier (`client_id` or `azp` claim) extracted from the OAuth token. This provides fairer limiting per user/client.
        *   **Unauthenticated Requests / Fallback:** Use the source IP address as a secondary or fallback key.
    *   **Configurable Limits:** Make limits (e.g., requests per minute per user/IP) configurable.
    *   **Appropriate Response:** Return `429 Too Many Requests` status code when limits are exceeded.
    *   **TDD:** Test that rate limits are enforced correctly for different keys (user ID, IP), that headers like `Retry-After` are set, and that legitimate traffic below the limit is unaffected.

---

## 10. Low Risk Findings & Mitigation

### 10.1 Dependency Vulnerability Management

*   **Risk:** Using outdated or vulnerable third-party libraries.
*   **Mitigation:**
    *   **Regular Scanning:** Use tools like `npm audit`, `yarn audit`, Snyk, Dependabot to regularly scan for known vulnerabilities.
    *   **Update Strategy:** Keep dependencies updated, prioritizing security patches.
    *   **CI/CD Integration:** Integrate vulnerability scanning into the CI/CD pipeline to catch issues early.

### 10.2 Input Validation

*   **Risk:** Malformed or malicious input causing errors or potential exploits (beyond SSRF).
*   **Mitigation:**
    *   **Validate All Inputs:** Rigorously validate all inputs from clients and external sources (tool arguments, configuration values).
    *   **Use Libraries:** Leverage validation libraries (e.g., Zod, Joi, class-validator) to define and enforce schemas.
    *   **Type Checking:** Utilize TypeScript or static analysis for type safety.
    *   **TDD:** Write tests for valid and invalid input scenarios for all endpoints and tool parameters.

### 10.3 Enhanced Logging & Monitoring

*   **Risk:** Insufficient logging makes diagnosing issues and detecting security incidents difficult.
*   **Mitigation:**
    *   **Structured Logging:** Implement structured logging (e.g., JSON format).
    *   **Key Events:** Log critical events:
        *   Application start/stop.
        *   Incoming requests (method, path, source IP, user agent).
        *   **OAuth Token Validation:** Log successes and failures. For failures, log the specific reason (e.g., expired, invalid signature, invalid issuer, invalid audience, missing scope, JWKS fetch error). **Do not log the token itself.**
        *   **Successful Validation Details:** Log the validated user identifier (`sub` claim), client identifier (`client_id` or `azp` if available), and the granted scopes for successfully authenticated requests.
        *   **JWKS Management:** Log JWKS fetching events (attempts, success, failure), cache updates, and key rotation handling.
        *   Tool execution start/end/errors.
        *   Cache hits/misses/invalidations.
        *   Errors and exceptions (with stack traces).
        *   Rate limit events.
        *   CORS errors.
    *   **Avoid Logging Secrets:** Ensure sensitive data (passwords, full tokens, API keys) is **never** logged. Log token validation *results*, not the token itself.
    *   **Centralized Logging:** Ship logs to a centralized logging system (e.g., ELK stack, Splunk, Datadog) for analysis and alerting.
    *   **Monitoring:** Monitor key metrics (request latency, error rates, resource utilization) and set up alerts for anomalies.

### 10.4 Least Privilege Principle

*   **Risk:** Components or processes running with more permissions than necessary.
*   **Mitigation:**
    *   **Service Accounts:** Run the MCP server process under a dedicated, non-privileged user account.
    *   **File Permissions:** Ensure appropriate file system permissions for application files and data directories.
    *   **OAuth Scopes:** Enforce granular scopes via OAuth (as detailed above).
    *   **External Keys:** Ensure API keys used by the server have the minimum required permissions for their respective services.

---

## 11. Implementation Roadmap (TDD Focused)

Prioritize implementation based on risk and dependencies. Employ Test-Driven Development (TDD) throughout.

1.  **[P0] OAuth 2.1 Token Validation Middleware (HTTP):**
    *   **TDD:** Write tests covering all validation scenarios (valid, invalid, expired, scope checks, errors - see Section 3).
    *   Implement middleware using a robust JWT/JOSE library.
    *   Integrate JWKS fetching from the external AS.
    *   Configure required environment variables (Issuer URL, Audience).
    *   Apply middleware to *all* relevant HTTP endpoints (tools, admin).
2.  **[P0] Secure Management Endpoints:**
    *   **TDD:** Write tests ensuring admin endpoints require specific OAuth scopes (Section 8.2).
    *   Apply `requireScope` middleware (from Step 1) with appropriate admin scopes.
    *   Remove any legacy static key checks for HTTP endpoints.
    *   (Optional) Implement and test IP whitelisting as an additional layer.
3.  **[P1] Secrets Management:**
    *   **TDD:** Test configuration loading from environment variables/secrets manager.
    *   Integrate with chosen secrets management solution.
    *   Ensure no secrets are hardcoded.
    *   Update deployment process to inject secrets securely.
4.  **[P1] SSRF Mitigation (`scrape_page`):**
    *   **TDD:** Write tests for URL validation and allowlist/denylist logic (Section 8.1).
    *   Implement strict URL validation and domain/IP allowlisting.
5.  **[P1] CORS Configuration:**
    *   **TDD:** Write tests for CORS headers and preflight requests (Section 9.1).
    *   Implement/configure CORS middleware, ensuring `Authorization` header is allowed.
6.  **[P2] Rate Limiting:**
    *   **TDD:** Write tests for rate limiting logic based on token claims and IP (Section 9.3).
    *   Implement/configure rate limiting middleware.
7.  **[P2] Enhanced Logging:**
    *   Implement structured logging.
    *   Add detailed logs for OAuth validation, scope checks, and other key events (Section 10.3).
    *   Ensure no secrets are logged.
    *   Integrate with centralized logging system.
8.  **[P2] Input Validation:**
    *   **TDD:** Add/improve input validation tests for all tool parameters and API inputs.
    *   Implement schema validation using appropriate libraries.
9.  **[P3] Event Store Encryption (If Applicable):**
    *   Assess need for application-level encryption.
    *   **TDD:** If implementing, test encryption/decryption logic.
    *   Implement encryption or ensure storage-level encryption is active.
10. **[P3] Dependency Vulnerability Management:**
    *   Integrate automated scanning (e.g., `npm audit`, Dependabot) into CI/CD.
    *   Establish process for reviewing and applying updates.

**Note:** Implementing AS-specific features (e.g., `/authorize`, `/token` endpoints) is **out of scope** for this server.

---

## 12. Potential Challenges

*   **External AS Integration:** Configuring trust, understanding the specific AS's behavior (claim names, discovery endpoint quirks), and managing communication issues (e.g., JWKS fetching failures).
*   **Choosing/Configuring Libraries:** Selecting appropriate, well-maintained libraries for JWT validation (`jose`, `jsonwebtoken`, etc.) and configuring them correctly (algorithms, clock skew tolerance).
*   **Scope Definition & Management:** Defining a clear, consistent set of scopes and coordinating with the external AS and client developers.
*   **Token Expiry/Refresh (RS Perspective):** The RS simply validates tokens. Clients are responsible for handling expiry and obtaining new tokens. The challenge is ensuring clients implement this correctly. Clear documentation for client developers is key.
*   **JWKS Key Rotation:** Handling rotation of the AS's signing keys gracefully requires robust JWKS fetching, caching (with appropriate TTLs and refresh-on-failure logic), and `kid` handling (see Section 3).
*   **Testing Complexity:** Mocking the external AS (JWKS endpoint, metadata) and JWT validation effectively for TDD requires careful setup (see Section 3 Testing Strategy).

---

## 13. Troubleshooting

*   **`401 Unauthorized` Errors:**
    *   Check if `Authorization: Bearer <token>` header is present and correctly formatted.
    *   Verify the token hasn't expired (`exp` claim).
    *   Verify the token signature using the AS's *current* public keys (check JWKS endpoint).
    *   Verify the `iss` claim matches the configured AS issuer URL.
    *   Verify the `aud` claim includes the MCP server's audience identifier.
    *   Check for clock skew between RS and AS.
    *   Check server logs for specific validation error details.
*   **`403 Forbidden` Errors:**
    *   Token is valid, but lacks the required scope(s) for the endpoint.
    *   Verify the `scope` claim in the decoded token.
    *   Check the `requireScope` middleware configuration for the specific route.
    *   Confirm with the AS administrator that the user/client should have the required scope.
*   **JWKS Fetching Issues:**
    *   Verify network connectivity from the MCP server to the AS's JWKS URI.
    *   Check if the JWKS URI is correct (often found via the AS's discovery endpoint).
    *   Check for firewall rules blocking access.
*   **CORS Errors (in Client Browser):**
    *   Check the server's CORS configuration (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`). Ensure `Authorization` is allowed in headers.
    *   Verify the client's origin is in the allowed list.
    *   Check browser console for specific CORS error messages.

---

## 14. References

*   **OAuth 2.1:** (Draft specification - combines and updates core RFCs) - [https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-07](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-07) (Note: Check for latest draft version)
*   **OAuth 2.0 Core (Foundation):** RFC 6749 - [https://tools.ietf.org/html/rfc6749](https://tools.ietf.org/html/rfc6749)
*   **OAuth 2.0 Bearer Token Usage:** RFC 6750 - [https://tools.ietf.org/html/rfc6750](https://tools.ietf.org/html/rfc6750)
*   **Proof Key for Code Exchange (PKCE):** RFC 7636 - [https://tools.ietf.org/html/rfc7636](https://tools.ietf.org/html/rfc7636)
*   **JSON Web Token (JWT):** RFC 7519 - [https://tools.ietf.org/html/rfc7519](https://tools.ietf.org/html/rfc7519)
*   **JSON Web Key (JWK):** RFC 7517 - [https://tools.ietf.org/html/rfc7517](https://tools.ietf.org/html/rfc7517)
*   **JSON Web Signature (JWS):** RFC 7515 - [https://tools.ietf.org/html/rfc7515](https://tools.ietf.org/html/rfc7515)
*   **OAuth 2.0 Authorization Server Metadata:** RFC 8414 - [https://tools.ietf.org/html/rfc8414](https://tools.ietf.org/html/rfc8414)
*   **OAuth 2.0 Dynamic Client Registration:** RFC 7591 - [https://tools.ietf.org/html/rfc7591](https://tools.ietf.org/html/rfc7591)
*   **OWASP Top 10:** [https://owasp.org/www-project-top-ten/](https://owasp.org/www-project-top-ten/)
*   **OWASP Server-Side Request Forgery Prevention Cheat Sheet:** [https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)