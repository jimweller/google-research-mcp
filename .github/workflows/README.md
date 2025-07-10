# Environment Configuration Template for CI/CD
# This file documents the environment variables and secrets needed for the CI/CD pipeline

# Required Environment Variables:
# - NODE_ENV: Set to 'test' for all test runs
# - CI: Automatically set by GitHub Actions
# - GITHUB_TOKEN: Automatically provided by GitHub Actions

# Optional Environment Variables for Enhanced Testing:
# - YOUTUBE_API_KEY: YouTube Data API key for enhanced transcript testing (if available)
# - GEMINI_API_KEY: Google Gemini API key for AI analysis testing (if available)
# - GOOGLE_SEARCH_API_KEY: Google Custom Search API key (if available)
# - GOOGLE_SEARCH_ENGINE_ID: Google Custom Search Engine ID (if available)

# Secrets Configuration (Repository Settings > Secrets and variables > Actions):
# 
# For comprehensive testing with external APIs (optional):
# - YOUTUBE_API_KEY: YouTube Data API key
# - GEMINI_API_KEY: Google Gemini API key  
# - GOOGLE_SEARCH_API_KEY: Google Custom Search API key
# - GOOGLE_SEARCH_ENGINE_ID: Google Custom Search Engine ID
# - CODECOV_TOKEN: Codecov token for coverage reporting

# Note: All tests are designed to work without these API keys by:
# 1. Using mock data for unit tests
# 2. Gracefully handling API unavailability in integration tests
# 3. Providing fallback behavior in E2E tests

# Security Best Practices:
# - Never commit real API keys to the repository
# - Use GitHub Secrets for sensitive data
# - All API keys should be optional for basic functionality
# - Tests should degrade gracefully when APIs are unavailable