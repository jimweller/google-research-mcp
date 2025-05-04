# MCP Server Improvement Plan (v1.2 - Incorporating Spec Updates)

**Date:** April 22, 2025
**Version:** 1.2

## 1. Introduction

This document outlines planned enhancements and necessary updates for the `google-researcher-mcp` server. It incorporates requirements from the **MCP Specification Revision 2025-03-26**, the need to update to **MCP SDK v1.11.0**, and previously identified functional improvements.

## 2. Proposed Prioritization

Compliance with the latest specification and SDK updates is now the highest priority, especially regarding authorization and transport changes.

1.  **Highest Priority (Spec Compliance & Core Updates):**
    *   Update MCP SDK to v1.11.0 (#3.1)
    *   Update HTTP Transport Implementation (#3.2)
    *   Implement Foundational OAuth 2.1 Authorization for HTTP (#3.3 - Core Flow, Token Validation)
    *   Implement Tool Annotations (#3.5)
    *   Verify JSON-RPC Batch Request Handling (#3.4)
2.  **High Priority (Security & Robustness Enhancements):**
    *   Implement JWKS Caching & Key Rotation Handling (#3.3)
    *   Implement Robust Error Handling for AS Communication (#3.3)
    *   Implement Handling Failed Sources (#4.4)
    *   Implement Recency Filtering (Basic Search Param) (#4.5)
    *   Source Attribution & Verification (#4.1)
3.  **Medium Priority (Recommended Features & Control):**
    *   Controlling Research Depth & Focus (#4.2)
    *   Recency Weighting (Analysis Param) (#4.5)
4.  **Lower Priority / Future Feature:**
    *   Structured Data Extraction (#4.3)

## 3. Spec Compliance & SDK Update (Revision 2025-03-26 / SDK v1.11.0)

### 3.1. Update MCP SDK

*   **Task:** Update `@modelcontextprotocol/sdk` dependency to `^1.11.0` in `package.json`.
*   **Action:** Run `npm install`. Review SDK release notes/documentation for breaking changes. Address any compilation errors or necessary code adjustments resulting from the update, paying close attention to transport, server, and tool definition APIs.
*   **Benefit:** Ensures compatibility with the latest protocol features and potentially includes helper utilities for new requirements.

### 3.2. Update HTTP Transport Implementation

*   **Task:** Refactor the HTTP server setup in `src/server.ts` to use the new **Streamable HTTP transport** classes provided by SDK v1.11.0, replacing the previous implementation.
*   **Action:** Identify the new SDK classes for streamable HTTP transport. Adapt the existing Express setup (`app.post('/mcp')`, session handling, event store integration) to work with the new transport mechanism. Verify that request handling, response streaming, and session resumption (`PersistentEventStore`) function correctly.
*   **Benefit:** Compliance with the current MCP specification for HTTP communication. Likely incorporates improvements in efficiency or reliability from the SDK.
*   **Reference:** [Spec: Streamable HTTP Transport](/specification/2025-03-26/basic/transports#streamable-http)

### 3.3. Implement OAuth 2.1 Resource Server Components for HTTP Transport

* **Task:** Implement the Resource Server (RS) components required for OAuth 2.1 integration, delegating authentication and token issuance to an external Authorization Server (AS).
* **Action:**
    1. **Choose Library:** Select and integrate a robust Node.js OAuth 2.1 token validation library (e.g., `jose`, `jsonwebtoken`).
    2. **Token Validation Middleware:** Implement Express middleware applied to *all* protected MCP HTTP routes (`/mcp` POST/GET/DELETE). This middleware MUST:
        * Extract the Bearer token from the `Authorization` header.
        * Validate the token (signature, expiration, issuer, audience) against the external AS's public keys.
        * Implement JWKS fetching and caching from the external AS's published JWKS URI.
        * Return HTTP 401 for missing/invalid/expired tokens.
        * Return HTTP 403 if token scopes are insufficient for the requested operation.
    3. **External AS Configuration:** Implement configuration options for:
        * AS's `issuer` URL (e.g., `https://auth.example.com`)
        * JWKS URI discovery (typically via the AS's metadata endpoint)
        * Expected `audience` identifier for the MCP server
    4. **Scope Definition:** Define and document the required scopes for different operations (e.g., `mcp:tool:google_search:execute`).
    5. **HTTPS:** Ensure *all* relevant endpoints are served over HTTPS in production.
* **Benefit:** Provides standardized, robust security for MCP interactions over HTTP while significantly reducing security burden by delegating authentication to established external systems.
* **Reference:** [Spec: Authorization](/specification/2025-03-26/basic/authorization), [Security Implementation Guide Section 2: OAuth 2.1 Delegation Strategy](docs/plans/security-improvements-implementation-guide.md#2-oauth-21-delegation-strategy), [Security Implementation Guide Section 3: Token Validation Middleware](docs/plans/security-improvements-implementation-guide.md#3-token-validation-middleware).

### 3.4. Verify JSON-RPC Batch Request Handling

*   **Task:** Ensure the server correctly handles JSON-RPC batch requests according to the specification.
*   **Action:** Review the request handling logic within the updated SDK's Streamable HTTP and STDIO transports. If the SDK doesn't handle it automatically, modify the server's core request processing loop to:
    *   Detect if the incoming request body is an array (batch) or object (single).
    *   If it's a batch, iterate through each request object in the array.
    *   Process each request individually.
    *   Collect the responses for each request (respecting `id` for non-notifications).
    *   Return an array containing the corresponding responses. Ensure notifications within a batch do not generate a response entry in the output array.
*   **Benefit:** Compliance with JSON-RPC 2.0 batching specification. Allows clients to optimize communication by sending multiple requests at once.
*   **Reference:** [JSON-RPC 2.0 Specification - Batch](https://www.jsonrpc.org/specification#batch)

### 3.5. Implement Tool Annotations

*   **Task:** Add descriptive annotations to all registered tools.
*   **Action:** Review the updated SDK's interface for `server.tool()`. Add an `annotations` property (or similar, based on the SDK) to each tool definition in `src/server.ts`. Examples:
    *   `google_search`: `{ readOnly: true }`
    *   `scrape_page`: `{ readOnly: true }` (Note: SSRF risk exists, but the tool *intent* is read-only)
    *   `analyze_with_gemini`: `{ readOnly: true }`
    *   `research_topic`: `{ readOnly: true }`
    *   *If tools that modify data were added, they'd need appropriate annotations like `{ destructive: true }` or `{ modifiesFileSystem: true }`.*
*   **Benefit:** Provides clients with metadata about tool behavior, enabling better UI/UX (e.g., warning before destructive actions) and potentially informing permission requests. Compliance with the latest spec.
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
*   **Testing:** Update E2E and unit/integration tests thoroughly for *all* changes (spec compliance and features). Add specific tests for OAuth flows, batch handling, annotations, and new tool parameters/responses.
*   **Documentation:** **Crucially**, update `README.md`, `docs/architecture/architecture.md`, and especially `docs/plans/security-improvements-implementation-guide.md` to reflect the new OAuth 2.1 authorization model, transport changes, and new features.
*   **Error Handling:** Implement specific JSON-RPC errors for OAuth failures (invalid token, insufficient scope, etc.) and batch processing issues.
*   **Security Implementation:** Ensure implementation strictly follows the Resource Server (RS) approach detailed in `docs/plans/security-improvements-implementation-guide.md`, focusing on token validation middleware, JWKS caching, and scope enforcement.

## 6. Next Steps

1.  **Implement Highest Priority:** Focus on SDK update, transport refactoring, core OAuth flow implementation (Auth Code + PKCE, token validation middleware), tool annotations, and batch verification.
2.  **Implement High Priority:** Add JWKS caching, robust error handling for AS communication, failed source reporting, basic recency filter, and source attribution.
3.  **Ensure Security Guide Alignment:** Verify all implementation details align with the Resource Server (RS) approach in the security guide.
4.  **Implement Medium Priority:** Add optional OAuth features (DynReg, Client Creds), depth/focus controls, recency analysis weighting.
5.  **Implement Lower Priority:** Develop the structured data extraction tool.
6.  **Continuous Testing & Documentation:** Test and document each phase thoroughly.