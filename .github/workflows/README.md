# GitHub Actions Workflows

This repository uses GitHub Actions for CI/CD automation. The workflows are designed to ensure code quality, run comprehensive tests, and automate releases.

## Workflows Overview

### 1. CI/CD Pipeline (`ci.yml`)
- **Trigger**: Push to `main`/`develop` branches, Pull Requests
- **Purpose**: Continuous integration with comprehensive testing
- **Node.js Versions**: 18.x, 20.x, 22.x (matrix testing)
- **Jobs**: Test Suite, Lint & Format Check, Security Audit, Performance Tests, Publish Readiness

### 2. Release (`release.yml`)
- **Trigger**: GitHub release published
- **Purpose**: Automated NPM publishing with SLSA attestation
- **Features**: Version validation, NPM publishing, SLSA provenance, release notes update

### 3. Other Workflows
- `ci-cd.yml`: Additional CI/CD configurations
- `monitor.yml`: Monitoring and alerting
- `prerelease.yml`: Pre-release testing
- `rollback.yml`: Rollback procedures

## Required Secrets

Configure these secrets in your GitHub repository settings:

### NPM Publishing
- `NPM_TOKEN`: NPM authentication token for publishing packages

### API Keys (for E2E testing)
- `GOOGLE_CUSTOM_SEARCH_API_KEY`: Google Custom Search API key
- `GOOGLE_CUSTOM_SEARCH_ID`: Google Custom Search Engine ID  
- `GOOGLE_GEMINI_API_KEY`: Google Gemini AI API key
- `YOUTUBE_API_KEY`: YouTube Data API key (optional, for YouTube transcript testing)

### Additional Testing
- `GEMINI_API_KEY`: Alternative Gemini API key for integration tests
- `GOOGLE_SEARCH_API_KEY`: Google Search API key
- `GOOGLE_SEARCH_ENGINE_ID`: Google Search Engine ID

## Workflow Features

### SLSA Attestation
- **Optimization**: Attests only critical files (`dist/server.js`, `dist/server.d.ts`, `package.json`)
- **Performance**: Reduced from full `dist/**/*` to specific files for faster processing
- **Security**: Provides software supply chain security

### Test Strategy
- **Unit Tests**: Fast, isolated component testing
- **Integration Tests**: API and service integration validation
- **E2E Tests**: End-to-end functionality testing (stdio, SSE, YouTube)
- **Performance Tests**: Timeout and speed validation

### Release Process
1. Create GitHub release with tag (e.g., `v1.2.0`)
2. Release workflow triggers automatically
3. Runs optimized test suite
4. Validates version consistency
5. Builds and publishes to NPM
6. Creates SLSA attestation
7. Updates release notes with installation instructions

## Troubleshooting

### Common Issues
1. **Missing Secrets**: Ensure all required secrets are configured
2. **Version Mismatch**: `package.json` version must match release tag
3. **Test Failures**: All tests must pass before publishing
4. **SLSA Attestation Slow**: Now optimized to attest specific files only

### Performance Optimizations Applied
- Removed redundant E2E tests from release workflow
- Optimized SLSA attestation to specific files
- Fixed test masking that prevented proper error reporting
- Streamlined release process for faster execution