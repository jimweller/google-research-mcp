# Project Roadmap & Implementation Status

**Date:** February 7, 2026
**Version:** 6.0
**Status:** All planned features implemented. Production-ready.

## 1. Executive Summary

This document tracks the development status of the `google-researcher-mcp` server. All foundational features, security hardening, production infrastructure, and feature enhancements are complete.

## 2. Tools

The server provides three tools:

| Tool | Purpose |
|:---|:---|
| `google_search` | Query Google Custom Search API, return URLs. Supports `time_range` recency filtering. |
| `scrape_page` | Extract text from a single URL. Supports web pages and YouTube transcripts. |
| `search_and_scrape` | Composite: search Google + scrape top results in parallel. Returns combined raw content with source attribution. |

## 3. Completed

- MCP SDK v1.26+ with Streamable HTTP & Stdio transports
- JSON-RPC batch request handling, tool annotations (`readOnly: true`)
- OAuth 2.1 Resource Server with JWKS, scope-based access control, CORS
- Persistent Event Store and multi-namespace caching system
- YouTube transcript extraction with 10 error types, retry logic, exponential backoff
- SSRF protection: protocol checks, private IP blocking (`ALLOW_PRIVATE_IPS`), domain allowlist (`ALLOWED_DOMAINS`), redirect validation, cloud metadata blocking
- Crawlee hardening: `persistStorage: false`, `useSessionPool: false`, `maxRequestRetries: 0`, non-HTML response guard
- npx execution: `bin` field, shebang injection via `postbuild`
- Docker: multi-stage `node:20-alpine` image, non-root user, `--env-file` runtime secrets
- CI/CD: unit tests, E2E (stdio + SSE + YouTube), security audit (`npm audit --audit-level=high`), Docker build verification, shebang/bin checks
- Graceful degradation in `search_and_scrape` via `Promise.allSettled` with error reporting
- **Structured Logging**: Zero-dependency logger (`src/shared/logger.ts`) — JSON in production, human-readable in dev, silent in test.
- **Enhanced Input Validation**: Stricter Zod schemas — `.min()`, `.max()` on all tool parameters.
- **Rate Limiting**: `express-rate-limit` middleware on HTTP transport. Keyed on `oauth.sub` or IP. Configurable via `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS`.
- **Recency Filtering**: `time_range` parameter on `google_search` — `day`, `week`, `month`, `year` mapped to Google `dateRestrict`.
- **Source Attribution**: `include_sources` parameter on `search_and_scrape` — appends numbered source URL list.
- **Event Store Encryption**: Wired `EVENT_STORE_ENCRYPTION_KEY` env var to existing AES-256-GCM encryption infrastructure.
- **Tool simplification (v6.0)**: Removed `analyze_with_gemini`, `extract_structured_data`, and `@google/genai` dependency. Renamed `research_topic` to `search_and_scrape` (stripped Gemini analysis, returns raw content). Rationale: the host LLM already has analysis capabilities — delegating to a second LLM is redundant and adds confusion.

## 4. Remaining Work

No remaining work items. The project is feature-complete per the current roadmap. For future improvement ideas, see [TODO.md](../../TODO.md).

### Future Considerations

| Priority | Task | Description |
|:---|:---|:---|
| **Low** | **Production Secrets Management** | Move from `.env` to a secrets manager (Vault, AWS/GCP Secrets Manager) if deployed as a hosted service. Not applicable for MCP-only usage. |
