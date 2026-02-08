# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security
- **SDK Upgrade**: Upgraded `@modelcontextprotocol/sdk` from 1.11.0 to ^1.26.0, fixing cross-client data leak (GHSA-345p-7cg4-v4c7)
- **SSRF Protection**: Added URL validation to block private IPs, metadata endpoints, and non-HTTP protocols in `scrape_page`
- **Admin Key Hardening**: Removed hardcoded admin key fallback; admin endpoints are disabled when `CACHE_ADMIN_KEY` is unset
- **Encryption Safety**: Encryption failures now throw `EncryptionError` instead of silently falling back to plaintext
- **Log Sanitization**: API keys are redacted from log output

### Fixed
- **YouTube Transcripts**: Upgraded `@danielxceron/youtube-transcript` to ^1.2.6 to fix `playerCaptionsTracklistRenderer` extraction errors
- **EventEmitter Leak**: Fixed process listener cleanup in `PersistentCache.dispose()` to prevent `MaxListenersExceededWarning`
- **Jest Worker Exit**: Guarded STDIO transport initialization in test environments to prevent worker hang
- **Flaky E2E Test**: Stabilized "Full research_topic workflow integration" test by removing dependency on Gemini response keywords

### Changed
- **Zod Upgrade**: Upgraded Zod to ^3.25.0 for SDK compatibility
- **Dead Code Removal**: Removed unused npm dependencies (`youtube-transcript-api`, `youtube-transcript-ts`), deleted orphaned files (`inMemoryEventStore.ts`, `e2e_combined_test.mjs`)

### Documentation
- Fixed duplicate Troubleshooting section in README, replaced with actual troubleshooting content
- Fixed broken links in architecture docs and testing guide
- Updated TODO.md to reflect completed P0 security items
- Replaced placeholder emails in CONTRIBUTING.md and CODE_OF_CONDUCT.md with GitHub security advisory links
- Removed references to non-existent lint/format scripts in CONTRIBUTING.md

## [1.2.1] - 2025-07-15

### Fixed
- **Critical Scraping Issue**: Resolved a critical bug where `scrape_page` and `research_topic` tools were returning placeholder test content instead of actual scraped web data.
  - **Root Cause**: Removed problematic fallback mechanism that was adding dummy test content when scraped text was shorter than 100 characters.
  - **Impact**: Both tools now consistently return real web content, dramatically improving data quality and user experience.
  - **Verification**: Comprehensive testing confirmed tools now extract actual content from web pages and GitHub discussions.
- **Cache Cleanup**: Cleared all cached placeholder responses to ensure fresh, real content delivery.
- **Build System**: Rebuilt entire project with clean artifacts to ensure fix propagation.

### Improved
- **Testing**: All 244 unit tests and end-to-end tests pass successfully, confirming system integrity.
- **Performance**: Maintained high performance while ensuring data authenticity.


## [1.2.0] - 2025-01-09

### Added
- **Robust YouTube Transcript Extraction**: Implemented a highly resilient YouTube transcript extraction system with comprehensive error handling and automatic retries.
  - **Advanced Error Classification**: The system can now identify 10 distinct error types (e.g., `TRANSCRIPT_DISABLED`, `VIDEO_UNAVAILABLE`, `RATE_LIMITED`), providing clear and actionable feedback.
  - **Exponential Backoff**: A sophisticated retry mechanism with exponential backoff is now in place for transient errors, significantly improving reliability.
  - **Enhanced Logging**: Added detailed logging for the entire transcript extraction process to simplify troubleshooting.
- **Production-Ready Controls**: Introduced environment variables to control and fine-tune the behavior of the YouTube transcript system in production.

### Changed
- **`scrape_page` Tool**: The `scrape_page` tool has been enhanced to seamlessly handle YouTube URLs, leveraging the new transcript extraction system. It now returns detailed error messages for failed transcript extractions.

### Fixed
- **Performance**: Optimized the YouTube transcript extraction process, resulting in a **91% improvement** in end-to-end test performance and an **80% reduction** in log volume.

### Documentation
- Created detailed [Technical Documentation](youtube-transcript-extraction.md) for the new YouTube transcript extraction system.
- Added a comprehensive [API Reference](api-scrape-page.md) for the `scrape_page` tool, including examples of error responses.

## [1.1.0] - 2025-07-06

### Added
- **Complete CI/CD Pipeline:** Implemented a comprehensive CI/CD pipeline using GitHub Actions for fully automated testing, building, and multi-environment publishing (development, pre-release, production) to the npm registry.
- **Automated Package Publishing:** A robust system for managing package versions, including:
  - Development builds with timestamp-based versioning.
  - Pre-release channels for beta and release candidates (RCs).
  - Fully automated production release workflows.
  - Health monitoring and emergency rollback capabilities.
- **Enhanced Tool Descriptions:** Implemented a comprehensive metadata system for all tools to improve discoverability and usability for LLMs, developers, and users. This includes:
  - **Detailed Descriptions:** Each tool now has a multi-line description explaining its purpose, best practices, and use cases.
  - **Parameter Documentation:** Every tool parameter is documented with its type, description, constraints, and usage examples.
  - **Rich Annotations:** Tools are now annotated with a human-readable title, category (`search`, `extraction`, `analysis`, `composite`), complexity, and workflow guidance.
  - **Self-Documenting Code:** The rich metadata serves as living documentation, ensuring that tool information is always up-to-date.
- **Enhanced Testing Infrastructure:** Improved overall test reliability with comprehensive timeout and resilience testing, and more robust E2E test scripts.

### Changed
- **Package Configuration:** Significantly enhanced [`package.json`](package.json:1) for npm publishing, including proper file inclusion/exclusion with [`.npmignore`](.npmignore:1) and automated TypeScript declaration file generation (`.d.ts`).
- **README.md:** Updated the "Available Tools" section with a new, detailed table generated from the enhanced tool metadata, providing a clear and comprehensive overview of the server's capabilities.

### Fixed
- **Unit Test Environment:** Resolved issues with environment variables in unit tests, ensuring consistent and reliable test execution.

### Security
- **NPM Provenance:** Enabled build attestations for published npm packages to guarantee package integrity and provenance.
- **Secure Token Management:** Implemented secure handling of `NPM_TOKEN` in CI/CD workflows.
- **Vulnerability Scanning:** Integrated automated vulnerability scanning into the pipeline to proactively identify and address security risks.

### Documentation
- Comprehensive documentation review and enhancement for public release readiness.

## [1.0.0] - 2025-07-06

### Added
- **Timeout Protection & Reliability:** Implemented comprehensive timeout handling for all external API calls (`google_search`, `scrape_page`, `analyze_with_gemini`) to enhance stability and prevent connection errors.
- **Graceful Degradation:** The `research_topic` tool now continues processing even if some sources fail, ensuring more resilient outcomes.
- **Resource Limiting:** Enforced content size limits to prevent resource exhaustion during scraping and analysis.
- **Comprehensive Timeout Test Suite:** A new end-to-end test suite (`tests/e2e/comprehensive_timeout_test.js`) validates all timeout and error handling mechanisms.
- **OAuth Endpoints:** Added public endpoints for OAuth configuration (`/mcp/oauth-config`) and scope documentation (`/mcp/oauth-scopes`), and an authenticated endpoint to inspect tokens (`/mcp/oauth-token-info`).
- **OAuth Testing:** Added extensive unit tests for the OAuth middleware and scope validation logic.

### Changed
- **Security Model:** Implemented a mandatory OAuth 2.1 Bearer token validation for all protected HTTP endpoints, replacing legacy static API keys. The system uses `jsonwebtoken` and `jwks-rsa` for robust, standard-compliant token verification.
- **Server Architecture:** Refactored the server to use global singleton instances for the `PersistentCache` and `PersistentEventStore`, ensuring data consistency across all transports and sessions.
- **Test Infrastructure:** Reorganized all end-to-end tests into a dedicated `tests/e2e/` directory for improved clarity.
- **Test Hygiene:** Disabled internal timers during test runs (`NODE_ENV === 'test'`) to prevent open handles and improve test stability.
- **Dependencies:** Updated to `@modelcontextprotocol/sdk` version `1.11.0` and added `jsonwebtoken` and `jwks-rsa` for security.
- **Build Process:** Converted all remaining JavaScript files in `src/` to TypeScript and simplified the build process.

### Removed
- **Static API Key Checks:** Removed the insecure `CACHE_ADMIN_KEY` check for management endpoints. Access is now controlled exclusively by granular OAuth scopes.

### Documentation
- **Complete Overhaul:** Updated all major documentation files, including the `README.md`, `CONTRIBUTING.md`, and architecture documents, to reflect the current implementation, security model, and best practices.
- **New Guides:** Created detailed guides for testing, security configuration, and system architecture.
- **Changelog:** Created and formatted this `CHANGELOG.md` to track all notable changes.