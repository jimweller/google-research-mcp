# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased-0.1] - 2025-05-04

### Security
- **Implemented OAuth 2.1 Resource Server for HTTP Transport:**
    - Added mandatory Bearer token validation for all protected HTTP endpoints (`/mcp`, management APIs). Clients must now obtain tokens from an external Authorization Server (AS).
    - Integrated `jsonwebtoken` for token verification and `jwks-rsa` for fetching/caching the AS's JSON Web Key Set (JWKS).
    - Implemented multi-layer JWKS caching (`jwks-rsa` internal cache + server's `PersistentCache`) for performance and resilience.
    - Validates standard JWT claims (`iss`, `aud`, `exp`, `nbf`) against configured AS details (`OAUTH_ISSUER_URL`, `OAUTH_AUDIENCE`).
    - Defined and enforced granular OAuth scopes (e.g., `mcp:tool:google_search:execute`, `mcp:admin:cache:read`) via `requireScopes` middleware. See `src/shared/oauthScopes.ts` for full list.
    - Added HTTPS enforcement in the middleware for production environments.
    - Removed legacy static API key checks for HTTP management endpoints (now secured by OAuth scopes).
    - *Files*: `src/shared/oauthMiddleware.ts`, `src/shared/oauthScopes.ts`, `src/server.ts`
    - *Docs*: `docs/plans/security-improvements-implementation-guide.md`
    - *Related Issues*: #3, #4, #7 (GitHub Issues)

### Added
- **OAuth Endpoints:**
    - `GET /mcp/oauth-config`: New public endpoint to view server OAuth configuration (enabled status, issuer, audience).
    - `GET /mcp/oauth-scopes`: New public endpoint serving markdown documentation for all defined OAuth scopes.
    - `GET /mcp/oauth-token-info`: New authenticated endpoint to view details (subject, issuer, scopes, expiry) of the provided valid Bearer token.
    - *Files*: `src/server.ts`, `src/shared/oauthScopesDocumentation.js`
- **OAuth Testing:**
    - Added unit tests for OAuth middleware logic (`oauthMiddleware.spec.ts`).
    - Added unit tests for OAuth scope definitions and validation helpers (`oauthScopes.spec.ts`).
    - *Files*: `src/shared/oauthMiddleware.spec.ts`, `src/shared/oauthScopes.spec.ts`

### Changed
- **Server Architecture:**
    - Refactored `src/server.ts` initialization to use global singleton instances for `PersistentCache` and `PersistentEventStore`, ensuring consistency across transports and sessions.
    - Updated HTTP transport setup to use `StreamableHTTPServerTransport` from MCP SDK v1.11.0.
    - *Files*: `src/server.ts`
- **Testing & Test Hygiene:**
    - Disabled internal timers (e.g., periodic persistence/cleanup in `PersistentCache`, `PersistentEventStore`) during tests (`NODE_ENV === 'test'`) to prevent open handles and improve test stability.
    - Reduced console logging noise from cache and event store components during test runs.
    - *Files*: `src/cache/cache.ts`, `src/cache/persistentCache.ts`, `src/shared/eventPersistenceManager.ts`, `src/shared/persistentEventStore.ts`, `jest.setup.js`
- **Dependencies:**
    - Updated MCP SDK to `^1.11.0` (Assumed prerequisite for transport changes).
    - Added `jsonwebtoken`, `jwks-rsa` dependencies for OAuth validation.
    - *Files*: `package.json`, `package-lock.json`
- **Configuration:**
    - Server now requires `OAUTH_ISSUER_URL` and `OAUTH_AUDIENCE` environment variables when using HTTP transport security.
    - *Files*: `.env.example` (implicitly), `src/server.ts`

### Removed
- Removed static API key check (`CACHE_ADMIN_KEY`) previously used for HTTP management endpoints (`/mcp/cache-invalidate`, `/mcp/cache-persist`). Access is now controlled solely via OAuth scopes (`mcp:admin:cache:invalidate`, `mcp:admin:cache:persist`).
    - *Files*: `src/server.ts`

### Documentation
- Created this `docs/CHANGELOG.md` file.
- Updated `README.md`: Added OAuth security section, listed new management endpoints, revised HTTP client example to include token requirement note, clarified Roo Code example regarding OAuth.
- Updated `docs/plans/security-improvements-implementation-guide.md`: Revised significantly to reflect the actual implemented OAuth RS strategy, middleware details, JWKS handling, scope definitions, and updated implementation status.
- Updated `docs/architecture/architecture.md`: Added OAuth security layer to HTTP transport description, updated server initialization description for global instances, added new OAuth endpoints to Management API list.
- Updated `docs/testing-guide.md`: Added note on disabling internal timers in tests, added section describing OAuth testing strategy (mocking AS, test JWTs, scope checks).
- Updated `docs/transport-caching-considerations.md`: Added note clarifying the differing security models between HTTP (OAuth) and STDIO (local trust) transports.
- Updated `docs/plans/mcp_server_improvement_plan.md`: Marked core OAuth and related SDK/transport update tasks as complete, revised priorities and next steps.
- *Related Issues*: #9, #19 (GitHub Issues)