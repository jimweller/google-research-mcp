# TODO: Google Researcher MCP — Future Improvements

> **Updated:** 2026-02-07 | **Current version:** 6.0.0
>
> This file tracks future improvements and technical debt. The server is production-ready as-is. For release history, see [CHANGELOG.md](docs/CHANGELOG.md).

## Table of Contents

- [P0 — Critical / Security](#p0--critical--security)
- [P1 — MCP Standard Compliance](#p1--mcp-standard-compliance)
- [P2 — Architecture & Code Quality](#p2--architecture--code-quality)
- [P3 — Missing MCP Primitives](#p3--missing-mcp-primitives)
- [P4 — Feature Roadmap](#p4--feature-roadmap)
- [P5 — Performance & Observability](#p5--performance--observability)
- [P6 — Developer Experience](#p6--developer-experience)

---

## P0 — Critical / Security (Completed)

All P0 items have been addressed.

- **0.1** — Admin key fallback removed; admin endpoints disabled when `CACHE_ADMIN_KEY` is unset
- **0.2** — SDK upgraded to ^1.26.0 (security fix GHSA-345p-7cg4-v4c7 + Zod ^3.25.0)
- **0.3** — Encryption now throws `EncryptionError` instead of silently falling back to plaintext
- **0.4** — SSRF protection added (`src/shared/urlValidator.ts`): blocks private IPs, metadata endpoints, non-HTTP protocols
- **0.5** — EventEmitter leak fixed: proper listener cleanup in `dispose()`, process listener tracking
- **0.6** — Log sanitization added to redact API keys from URLs in log output (Google Custom Search API requires keys in URL)

---

## P1 — MCP Standard Compliance

The MCP spec has moved from **2025-03-26** to **2025-11-25**. These items bring the project into compliance.

### 1.1 — Migrate SSE transport to Streamable HTTP
- **Status:** The old `SSEServerTransport` is **deprecated** in the SDK since v1.21.1
- **New model:** Single endpoint (e.g., `/mcp`) accepting both POST and GET, returning `application/json` or `text/event-stream`
- **Session management:** via `MCP-Session-Id` header (capitalization changed)
- **New requirement:** `MCP-Protocol-Version: 2025-11-25` header on all HTTP requests after initialization
- **New features unlocked:** SSE priming events, polling model, resumability via `Last-Event-ID`
- **Backward compat:** Can support both old and new transports during migration

### 1.2 — Add `title` and `icons` fields to all tools
- Spec 2025-11-25 adds optional `title` (display name) and `icons` (array) to tools, resources, and prompts
- Improves client UI rendering

### 1.3 — Add `outputSchema` to tools (structured output)
- Tools can now define a JSON Schema for their output
- Enables `structuredContent` field in results alongside `content`
- Allows clients to programmatically parse tool results

### 1.4 — Support `resource_link` content type in tool results
- New content type that returns a URI link to a resource rather than embedding full content
- Useful for `search_and_scrape` to reference cached results

### 1.5 — Add content annotations
- Tool result content blocks now support `audience` (`"user"` / `"assistant"`), `priority` (0.0-1.0), and `lastModified`
- Helps clients intelligently include/exclude content

### 1.6 — Update Zod dependency for SDK compatibility
- SDK 1.23.0+ peer-requires `zod ^3.25 || ^4.0`
- Current project uses `zod ^3.24.3`
- **Action:** Upgrade Zod

### 1.7 — Declare proper capabilities in server initialization
- Current capabilities declaration is incomplete
- Should declare: `tools.listChanged`, and (once implemented) `resources`, `prompts`

### 1.8 — Support `_meta` field on tool definitions
- SDK 1.18.0 added `_meta` support on tool definitions for extension metadata

---

## P2 — Architecture & Code Quality

### 2.1 — Split `server.ts` into modules
- **Problem:** `src/server.ts` is 1200+ lines handling: MCP config, cache init, HTTP routing, OAuth, tool registration, event handling
- **Suggested structure:**
  ```
  src/
    server.ts           → slim entry point / wiring
    config.ts           → constants, TTLs, env var validation
    tools/
      googleSearch.ts
      scrapePage.ts
      searchAndScrape.ts
    transports/
      stdio.ts
      http.ts
    middleware/
      oauth.ts
      adminAuth.ts
  ```

### 2.2 — Eliminate global mutable state
- **File:** `src/server.ts` (~lines 77-84)
- Global instances (`globalCacheInstance`, `eventStoreInstance`, `transcriptExtractorInstance`, etc.) create coupling and test difficulties
- **Fix:** Use a factory/context pattern or dependency injection container

### 2.3 — Fix CommonJS `require()` in ES module
- **File:** `src/server.ts` (~line 58)
- `require('fs').existsSync(...)` breaks module system consistency
- **Fix:** Use `import fs from 'fs'` and `fs.existsSync()`

### 2.4 — Fix async initialization race condition in PersistentCache
- **File:** `src/cache/persistentCache.ts` (~lines 104-171)
- Constructor calls async `initialize()` without awaiting it
- `getOrCompute()` polls with `setInterval` to wait for initialization
- **Fix:** Use proper async factory method or initialization promise

### 2.5 — Remove commented-out debug logs
- **File:** `src/cache/persistentCache.ts` — dozens of commented `console.log` lines
- **Fix:** Delete them; use a proper logging framework with log levels

### 2.6 — ~~Consolidate YouTube transcript libraries~~ (Completed)
- Resolved: unused libraries removed. Only `@danielxceron/youtube-transcript` remains.

### 2.7 — Fix unsafe type casts
- `(data.items || []).map((i: any) => i.link)` — `src/server.ts` ~line 225
- `const msg = message as any` — `src/shared/eventStoreEncryption.ts` ~lines 103-104
- **Fix:** Add proper type guards and API response interfaces

### 2.8 — Add proper error typing
- `error.message` accessed without null check throughout `src/server.ts`
- **Fix:** Use `error instanceof Error ? error.message : String(error)` pattern

### 2.9 — Extract hardcoded constants
- TTLs, timeouts, content limits, and other magic numbers scattered across `server.ts`
- **Fix:** Create `src/config.ts` with documented constants:
  - Search TTL: 30 min, Scrape TTL: 1 hour
  - HTTP timeout: 10s, Scrape timeout: 15s, Research timeout: 45s
  - Content limits: 50KB scrape, 300KB research combined

### 2.10 — Pin dependency versions
- All deps use `^` ranges — risk of surprise breakage
- **Fix:** Use exact versions or a lockfile strategy

---

## P3 — Missing MCP Primitives

The MCP spec defines three core primitives. This project only implements **Tools**. Resources and Prompts should be added.

### 3.1 — Implement Resources primitive
MCP Resources provide read-only contextual data to clients. Suggested resources:

| Resource URI | Description |
|---|---|
| `search://recent` | List of recent search queries and results |
| `search://results/{query}` | Cached results for a specific query (URI template) |
| `research://cache/{topic}` | Cached research analysis |
| `config://server` | Server configuration (non-sensitive) |
| `stats://cache` | Cache hit/miss statistics |
| `stats://events` | Event store statistics |

**Also implement:**
- `resources/list` and `resources/read` handlers
- Resource templates with parameter completion
- `resources/subscribe` for change notifications
- `notifications/resources/updated` when cache refreshes

### 3.2 — Implement Prompts primitive
MCP Prompts provide reusable workflow templates. Suggested prompts:

| Prompt | Arguments | Description |
|---|---|---|
| `comprehensive-research` | `topic`, `depth` | Full search+scrape+analyze workflow with configurable depth |
| `competitor-analysis` | `company`, `industry` | Compare companies using search + analysis |
| `news-briefing` | `topic`, `timeframe` | Recent news summary |
| `fact-check` | `claim` | Verify a claim using multiple sources |
| `literature-review` | `topic`, `num_sources` | Academic-style source review |
| `summarize-url` | `url` | Scrape and summarize a single page |

**Each prompt should include:**
- System message with role instructions
- Few-shot examples
- Argument descriptions with completion hints

### 3.3 — Implement Notifications
- Declare `listChanged: true` in capabilities for tools, resources, prompts
- Send `notifications/tools/list_changed` if tools are added/removed dynamically
- Send `notifications/resources/updated` when cached research refreshes
- Send `notifications/resources/list_changed` when new resources appear

---

## P4 — Feature Roadmap

### Search Capabilities

#### 4.1 — Google Image Search
- Add `google_image_search` tool using Google Custom Search API with `searchType=image`
- Return image URLs, thumbnails, dimensions, source pages

#### 4.2 — Google News Search
- Add `google_news_search` tool using Google Custom Search with `sort=date` and news-specific parameters
- Support freshness filters: 24h, 7d, 30d, custom date range

#### 4.3 — Search filtering options
- Add parameters to `google_search`: `dateRestrict`, `siteSearch`, `exactTerms`, `excludeTerms`, `language`, `region`
- Support safe search levels

#### 4.4 — Alternative search engine support
- Pluggable search backend architecture
- Add support for: Brave Search API, Exa API, Tavily API
- Fallback chain: if primary engine fails, try next

### Content Processing

#### 4.5 — Document parsing
- Support PDF text extraction
- Support DOCX/PPTX parsing
- Extract tables and structured data

#### 4.6 — Language detection and translation
- Detect source language of scraped content
- Optional translation to user's preferred language

#### 4.7 — Content deduplication
- `search_and_scrape` currently concatenates results without deduplication
- Add similarity detection to remove redundant content

#### 4.8 — Result quality scoring
- Score scraped content by relevance, freshness, authority
- Prioritize higher-quality sources in `search_and_scrape`

### Research Workflows

#### 4.9 — Multi-step research agent
- Support iterative research: search → analyze gaps → search again → synthesize
- Track research session state across multiple tool calls

#### 4.10 — Citation and source tracking
- Return structured citations with all research results
- Include source URL, title, date, author when available
- Format citations in standard styles (APA, MLA)

#### 4.11 — Research comparison tool
- New `compare_topics` tool that researches two topics and produces a structured comparison

### Infrastructure

#### 4.12 — Rate limiting per client
- Add per-client rate limiting for all external API calls
- Configurable limits per tool
- Return `429` with `Retry-After` header

#### 4.13 — Circuit breaker for external APIs
- Implement circuit breaker pattern for Google Search and scraping
- Prevent cascading failures when external services are down

#### 4.14 — Health check endpoint
- `GET /health` returning server status, cache health, API reachability
- Include uptime, version, connected clients

#### 4.15 — Distributed caching support
- Optional Redis backend for multi-instance deployments
- Interface already exists (`IPersistenceManager`) — implement Redis adapter

---

## P5 — Performance & Observability

### 5.1 — ~~Structured logging~~ (Completed)
- Implemented zero-dependency logger in `src/shared/logger.ts` — JSON in production, human-readable in dev, silent in test.

### 5.2 — Request tracing
- Assign trace IDs to multi-step operations (especially `search_and_scrape`)
- Log trace ID through search → scrape → analyze pipeline

### 5.3 — Per-tool execution metrics
- Track per-tool: call count, success rate, p50/p95/p99 latency, cache hit rate
- Expose via `stats://tools` resource and/or admin API

### 5.4 — Fix synchronous shutdown I/O
- **File:** `src/cache/persistentCache.ts` (~lines 809-898)
- `persistSync()` uses `writeFileSync`/`mkdirSync`, blocking the event loop
- **Fix:** Use async persistence with a shutdown grace period

### 5.5 — Optimize cache key generation
- **File:** `src/cache/cache.ts` (~line 88)
- `JSON.stringify(args)` + SHA-256 hash on every call
- **Fix:** Consider caching hash results or using a faster hashing algorithm for non-crypto use

### 5.6 — Content size management
- Scraped content concatenates title, headings, paragraphs, and body without deduplication
- Can result in duplicate text consuming cache and token budget
- **Fix:** Deduplicate before caching

---

## P6 — Developer Experience

### 6.1 — Migrate test framework to Vitest
- Project uses Jest with `--experimental-vm-modules` flag for ESM support
- The MCP SDK itself migrated to Vitest in v1.23.0
- `vitest.config.ts` already exists in the project but is unused
- Vitest has native ESM support without experimental flags

### 6.2 — Add integration test for Streamable HTTP transport
- Current E2E tests cover STDIO and old SSE
- Need tests for the new Streamable HTTP transport after migration

### 6.3 — Add `npx` / `docker` quickstart
- Competitors like Brave Search MCP offer zero-config `npx` startup
- Add Docker image and `npx google-researcher-mcp` support

### 6.4 — Configuration file support
- Support `google-researcher-mcp.config.json` or `.env` file
- Reduce required env var count for basic usage

### 6.5 — MCP Inspector compatibility
- Test with the official MCP Inspector tool
- Ensure all tools, resources, prompts are discoverable and testable

### 6.6 — Improve environment variable validation
- **File:** `src/server.ts` (~lines 746-755)
- Only checks existence of API keys, not format validity
- **Fix:** Validate key format/length before startup; fail fast with helpful errors

---

## Migration Priority Order

| Phase | Items | Theme |
|---|---|---|
| **Phase 1** | P0 (all), P1.1, P1.6 | Security fixes + SDK upgrade + transport migration |
| **Phase 2** | P2.1, P2.2, P2.9, P2.5, P2.6 | Architecture cleanup |
| **Phase 3** | P1.2-P1.5, P3.1, P3.2 | MCP spec compliance + Resources & Prompts |
| **Phase 4** | P4.1-P4.3, P4.7, P4.10 | Search capabilities + content quality |
| **Phase 5** | P5.1-P5.3, P6.1, P4.12-P4.14 | Observability + infrastructure |
| **Phase 6** | P4.4-P4.6, P4.8-P4.9, P4.11, P4.15 | Advanced features |
