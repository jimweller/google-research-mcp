# GitHub Actions Workflows

This repository uses GitHub Actions for CI/CD automation.

## Workflows

### CI/CD Pipeline (`ci.yml`)
- **Trigger**: Push to `main`/`develop`, Pull Requests
- **Node.js Versions**: 20.x, 22.x (matrix)
- **Jobs**: Test Suite, Lint, Security Audit, Performance Tests, Publish Readiness

### Release (`release.yml`)
- **Trigger**: GitHub release published
- **Purpose**: Automated NPM publishing with SLSA attestation
- **Features**: Version validation, provenance, release notes update

### Pre-release (`prerelease.yml`)
- **Trigger**: Push to `release/*`, `beta/*`, `rc/*` branches
- **Purpose**: Publish pre-release versions to npm with appropriate tags

### Monitor (`monitor.yml`)
- **Trigger**: Every 6 hours (scheduled) + manual
- **Purpose**: Check npm package health, installation, size, vulnerabilities

### Rollback (`rollback.yml`)
- **Trigger**: Manual only
- **Purpose**: Emergency rollback of npm package to a previous version

## Required Secrets

| Secret | Used In | Purpose |
|--------|---------|---------|
| `NPM_TOKEN` | release, prerelease, rollback | NPM publishing authentication |
| `GOOGLE_CUSTOM_SEARCH_API_KEY` | ci (E2E tests) | Google Custom Search API |
| `GOOGLE_CUSTOM_SEARCH_ID` | ci (E2E tests) | Google Custom Search Engine ID |
| `GOOGLE_GEMINI_API_KEY` | ci (E2E tests) | Google Gemini AI API key |

`GITHUB_TOKEN` is provided automatically by GitHub Actions.

## Release Process

1. Create a GitHub release with a tag matching `package.json` version (e.g., `v1.2.0`)
2. Release workflow runs: tests, builds, publishes to npm, creates SLSA attestation
3. Release notes are updated with install instructions

## Troubleshooting

- **Missing secrets**: E2E tests require API keys configured in repository settings
- **Version mismatch**: `package.json` version must match the release tag (without `v` prefix)
- **Security audit warnings**: Transitive dependency vulnerabilities are reported but don't block CI
- **Node 18 not supported**: The `@danielxceron/youtube-transcript` package requires Node >= 20 for ESM/CJS interop
