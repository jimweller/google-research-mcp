# MCP Server Improvement Plan (v1.2 - Incorporating Spec Updates)

**Date:** April 22, 2025
**Version:** 1.2

## 1. Introduction

This document outlines planned enhancements and necessary updates for the `google-researcher-mcp` server. It incorporates requirements from the **MCP Specification Revision 2025-03-26**, the need to update to **MCP SDK v1.11.0**, and previously identified functional improvements.

## 2. Proposed Prioritization

Compliance with the latest specification and SDK updates is now the highest priority, especially regarding authorization and transport changes.

1.  **Completed (Spec Compliance & Core Updates):**
    *   ✅ Update MCP SDK to v1.11.0 (#3.1)
    *   ✅ Update HTTP Transport Implementation (#3.2)
    *   ✅ Implement Foundational OAuth 2.1 Authorization for HTTP (#3.3 - Core Flow, Token Validation, JWKS Caching)
    *   ✅ Implement Tool Annotations (#3.5)
    *   ✅ Verify JSON-RPC Batch Request Handling (#3.4 - Handled by SDK Transport)
2.  **Highest Priority (Security & Robustness Enhancements):**
    *   Implement Robust Error Handling for AS Communication (#3.3 - Refinement)
    *   Implement Secrets Management Strategy (#P1-3 in Security Guide)
    *   Implement SSRF Mitigation for `scrape_page` (#P1-4 in Security Guide)
    *   Configure CORS Middleware (#P1-5 in Security Guide)
    *   Implement Handling Failed Sources (#4.4 / #P1-6)
    *   Implement Basic Recency Filtering (`google_search`) (#4.5 / #P1-7)
    *   Implement Source Attribution & Verification (#4.1 / #P1-8)
    *   Perform Security Testing (#P1-9)
    *   Update Security Documentation (#P1-10 - In Progress)
3.  **Medium Priority (Enhanced Features & Control):**
    *   Implement Rate Limiting (#P2-1)
    *   Implement Enhanced Logging (#P2-2)
    *   Enhance Input Validation Across Tools (#P2-3)
    *   Controlling Research Depth & Focus (#4.2 / #P2-4)
    *   Recency Weighting (Analysis Param) (#4.5 / #P2-5)
    *   Feature & Enhancement Testing (#P2-6)
    *   Update Documentation for New Features (#P2-7)
4.  **Lower Priority / Future Features:**
    *   Structured Data Extraction (#4.3 / #P3-1)
    *   Event Store Encryption (#P3-2)
    *   Dependency Vulnerability Management Process (#P3-3)
    *   Review Least Privilege Principle (#P3-4)
    *   Future Feature Testing (#P3-5)
    *   Update Documentation for Future Features (#P3-6)

## 3. Spec Compliance & SDK Update (Revision 2025-03-26 / SDK v1.11.0) - COMPLETED

### 3.1. Update MCP SDK

*   **Status:** ✅ **Completed**
*   **Task:** Update `@modelcontextprotocol/sdk` dependency to `^1.11.0` in `package.json`.
*   **Action:** Dependency updated. Code adjusted for compatibility.
*   **Benefit:** Ensures compatibility with the latest protocol features and potentially includes helper utilities for new requirements.

### 3.2. Update HTTP Transport Implementation

*   **Status:** ✅ **Completed**
*   **Task:** Refactor the HTTP server setup in `src/server.ts` to use the new **Streamable HTTP transport** classes provided by SDK v1.11.0.
*   **Action:** Server refactored to use `StreamableHTTPServerTransport`. Express setup adapted. Session resumption via `PersistentEventStore` maintained.
*   **Benefit:** Compliance with the current MCP specification for HTTP communication. Likely incorporates improvements in efficiency or reliability from the SDK.
*   **Reference:** [Spec: Streamable HTTP Transport](/specification/2025-03-26/basic/transports#streamable-http)

### 3.3. Implement OAuth 2.1 Resource Server Components for HTTP Transport

* **Status:** ✅ **Completed** (Core implementation)
* **Task:** Implement the Resource Server (RS) components required for OAuth 2.1 integration.
* **Action:**
    1. **Library Used:** `jsonwebtoken` for verification, `jwks-rsa` for JWKS fetching/caching.
    2. **Token Validation Middleware:** Implemented in `src/shared/oauthMiddleware.ts`. Applied to protected HTTP routes in `src/server.ts`. Handles token extraction, signature validation, claim validation (iss, aud, exp, nbf), scope checking, and returns 401/403 errors.
    3. **JWKS Handling:** Implemented fetching and multi-layer caching (via `jwks-rsa` and `PersistentCache`).
    4. **External AS Configuration:** Server requires `OAUTH_ISSUER_URL` and `OAUTH_AUDIENCE` environment variables.
    5. **Scope Definition:** Scopes defined in `src/shared/oauthScopes.ts` and enforced via `requireScopes` middleware.
    6. **HTTPS:** Enforcement included in middleware for production.
* **Benefit:** Provides standardized, robust security for MCP interactions over HTTP.
* **Reference:** [Spec: Authorization](/specification/2025-03-26/basic/authorization), [Security Implementation Guide Section 3: Token Validation Middleware](docs/plans/security-improvements-implementation-guide.md#3-token-validation-middleware).
* **Note:** Robust error handling for AS communication (item #2.1) requires further refinement/testing.

### 3.4. Verify JSON-RPC Batch Request Handling

*   **Status:** ✅ **Completed** (Handled by SDK Transport)
*   **Task:** Ensure the server correctly handles JSON-RPC batch requests according to the specification.
*   **Action:** The `@modelcontextprotocol/sdk` v1.11.0 `StreamableHTTPServerTransport` and `StdioServerTransport` handle JSON-RPC batching internally. Server code delegates request handling directly to the transport instance.
*   **Benefit:** Compliance with JSON-RPC 2.0 batching specification. Allows clients to optimize communication by sending multiple requests at once.
*   **Reference:** [JSON-RPC 2.0 Specification - Batch](https://www.jsonrpc.org/specification#batch)

### 3.5. Implement Tool Annotations

*   **Status:** ✅ **Completed**
*   **Task:** Add descriptive annotations to all registered tools.
*   **Action:** Tool definitions in `src/server.ts` updated to include `annotations: { readOnly: true }` as appropriate for the current set of tools.
*   **Benefit:** Provides clients with metadata about tool behavior. Compliance with the latest spec.
*   **Reference:** [Spec Changes](#key-changes) (points to PR #185)

## 4. Functional Enhancements (from v1.1 Plan)

*(These items remain largely the same but are re-prioritized relative to spec compliance)*

### 4.1. Source Attribution & Verification

*   **Capability:** Allow clients to optionally request source URLs.
*   **Proposed Changes:** Add `include_sources: z.boolean().optional().default(false)` to `research_topic`. Return `metadata: { sources: string[] }` in response if true.
*   **Benefit:** Increases trustworthiness and verifiability.

### 4.2. Controlling Research Depth & Focus

*   **Capability:** Add parameters to `research_topic` for scope/detail control.
*   **Proposed Changes:** Add optional `focus` and `depth` enum parameters. Requires implementation logic to adjust search/scrape/analysis based on values.
*   **Benefit:** More targeted research, token/time savings.

### 4.3. Structured Data Extraction

*   **Capability:** Add a dedicated tool `extract_structured_data`.
*   **Proposed Changes:** New tool schema: `source_text: z.string()`, `target_schema: z.object({}).passthrough()`, `extraction_instructions: z.string().optional()`.
*   **Benefit:** Enables reliable extraction for programmatic use.

### 4.4. Handling Failed Sources

*   **Capability:** Report failed scrapes in `research_topic` and allow partial processing.
*   **Proposed Changes:** Add `report_failed_sources: z.boolean().optional().default(false)` and `on_source_failure: z.enum(["fail_request", "proceed_partial"]).optional().default("proceed_partial")`. Return `metadata: { failed_sources: {url: string, error: string}[] }` if reporting enabled. Use `Promise.allSettled`.
*   **Benefit:** Increases transparency and robustness.

### 4.5. Recency Filtering & Weighting

*   **Capability:** Filter search results by recency; optionally prioritize recent info in analysis.
*   **Proposed Changes:** Add `recency_filter` enum to `google_search`. Add `prioritize_recency_in_analysis: z.boolean().optional().default(false)` to `research_topic`. Map filter to Google Search API param. Modify analysis prompt if prioritizing.
*   **Benefit:** Provides more relevant, up-to-date information.

## 5. General Implementation Considerations

*   **Schema Updates:** Update all relevant Zod schemas.
*   **Testing:** E2E tests updated. Unit/integration tests for OAuth components added (`oauthMiddleware.spec.ts`, `oauthScopes.spec.ts`). Further testing needed for P1/P2 security features.
*   **Documentation:** `README.md`, `docs/architecture/architecture.md`, `docs/plans/security-improvements-implementation-guide.md`, `docs/testing-guide.md`, `docs/transport-caching-considerations.md` updated to reflect OAuth implementation. Further updates needed for P1/P2 features.
*   **Error Handling:** Basic OAuth error responses implemented in middleware. Further refinement may be needed.
*   **Security Implementation:** Core OAuth RS implementation completed, aligning with the security guide.

## 6. Next Steps (Revised Priorities)

With the foundational spec compliance and core OAuth implementation complete, the focus shifts to the remaining security enhancements and feature additions:

1.  **Complete P1 Security Tasks:**
    *   Refine AS communication error handling (#3.3).
    *   Implement Secrets Management Strategy (#P1-3).
    *   Implement SSRF Mitigation (#P1-4).
    *   Configure CORS Middleware (#P1-5).
    *   Implement Failed Source Handling (#4.4 / #P1-6).
    *   Implement Recency Filtering (#4.5 / #P1-7).
    *   Implement Source Attribution (#4.1 / #P1-8).
    *   Perform dedicated Security Testing (#P1-9).
    *   Finalize Security Documentation (#P1-10).
2.  **Implement P2 Enhanced Features:**
    *   Rate Limiting, Enhanced Logging, Input Validation, Research Controls, etc. (#P2-1 to #P2-7).
3.  **Implement P3 Future Features:**
    *   Structured Data Extraction, Event Store Encryption, etc. (#P3-1 to #P3-6).
4.  **Continuous Testing & Documentation:** Continue updating tests and documentation alongside implementation.