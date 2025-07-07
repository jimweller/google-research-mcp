# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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