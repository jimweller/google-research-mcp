# Testing Guide for Google Researcher MCP Server

This document provides detailed information about the testing architecture, strategies, and best practices for the Google Researcher MCP Server project.

## Table of Contents

- [Testing Architecture](#testing-architecture)
- [Types of Tests](#types-of-tests)
- [Running Tests](#running-tests)
- [Mocking Strategies](#mocking-strategies)
- [Writing New Tests](#writing-new-tests)
- [Troubleshooting](#troubleshooting)

## Testing Architecture

### Jest Configuration

The project uses Jest as its testing framework with TypeScript support through ts-jest. The configuration is defined in `jest.config.js`:

- **Preset**: `ts-jest/presets/default-esm` for ESM support
- **Environment**: Node.js
- **Test Match**: `['<rootDir>/src/**/*.spec.ts']` to find all test files
- **Setup Files**: `['<rootDir>/jest.setup.js']` for additional configuration

Additional setup files:
- `jest.setup.js`: Configures Jest's fake timers (see [Time Mocking](#time-mocking)) and suppresses console output during default test runs (see [Running Tests](#running-tests)). Note that core components like the cache and event store also disable internal timers (e.g., for periodic persistence) when `process.env.NODE_ENV === 'test'` to prevent open handles during test execution.

### Test Directory Structure

Tests are organized into two primary locations: unit/integration tests alongside the source code they validate, and end-to-end tests in a dedicated `tests/` directory.

#### Unit & Integration Tests (`src/`)

These tests are co-located with the source code to ensure they are tightly coupled with the component they are testing.

```
src/
├── cache/
│   ├── cache.ts
│   └── cache.spec.ts            # Unit tests for Cache class
├── shared/
│   ├── persistentEventStore.ts
│   └── persistentEventStore.spec.ts  # Unit tests for event store
```

#### End-to-End Tests (`tests/e2e/`)

All end-to-end tests are located in the `tests/e2e/` directory. This provides a clear separation between component-level tests and system-level validation.

```
tests/
└── e2e/
    ├── comprehensive_timeout_test.js    # E2E test for timeout handling and reliability
    ├── e2e_stdio_mcp_client_test.mjs    # E2E test for STDIO transport
    └── e2e_sse_mcp_client_test.mjs      # E2E test for SSE transport
```

### Test File Naming Conventions

- **Unit/Integration Tests**: `*.spec.ts`, located in the same directory as the module being tested.
- **End-to-End Tests**: `*.{js,mjs}`, located in the `tests/e2e/` directory.

## Types of Tests

### Unit Tests

Unit tests verify the functionality of individual components in isolation, using mocks for dependencies.

#### Cache System Tests

These tests verify:
- Core cache functionality (get, set, compute, invalidate)
- TTL handling and expiration
- LRU eviction when size limits are reached
- Statistics tracking
- Different persistence strategies:
  - Periodic persistence
  - Write-through persistence
  - Hybrid persistence

**Files:**
- `src/cache/cache.spec.ts`: Tests for the base Cache class
- `src/cache/persistenceStrategies.spec.ts`: Tests for different persistence strategies

#### Event Store Tests

These tests verify:
- Core event storage and retrieval
- Event persistence and loading
- Stream and global limits enforcement
- Event expiration based on TTL

**Files:**
- `src/shared/persistentEventStore.spec.ts`: Tests for the PersistentEventStore class with mocked dependencies

### Integration Tests

Integration tests verify the interaction between components, often using real file system operations.

#### Cache Integration Tests

These tests verify:
- Persistence manager file operations
- Persistent cache initialization and disk operations
- Cache entry loading and saving

**Files:**
- `src/cache/persistenceManager.spec.ts`: Tests for file system operations
- `src/cache/persistentCache.spec.ts`: Tests for the persistent cache with real persistence manager

#### Event Store Integration Tests

These tests verify:
- Event persistence manager file operations
- Event loading and saving

**Files:**
- `src/shared/eventPersistenceManager.spec.ts`: Tests for event persistence file operations

### End-to-End Tests

End-to-end tests verify the complete system functionality from client connection to tool execution. **Note:** These tests interact with external services and may require specific environment variables (like API keys) to be configured. Refer to `.env.example` for required variables.

#### STDIO Client Test (`tests/e2e/e2e_stdio_mcp_client_test.mjs`)

Tests the MCP server with a direct process STDIO connection, covering:
- Client connection and tool discovery.
- Execution of all primary tools (`google_search`, `scrape_page`, `analyze_with_gemini`, `research_topic`).
- Core functionality like YouTube transcript handling.

#### SSE Client Test (`tests/e2e/e2e_sse_mcp_client_test.mjs`)

Tests the MCP server with an HTTP+SSE connection, validating the same functionality as the STDIO test but over the network transport.

#### Comprehensive Timeout Test Suite (`tests/e2e/comprehensive_timeout_test.js`)

This is a critical test suite focused on verifying the server's reliability and resilience, specifically addressing the timeout fixes. It validates:
- **Individual Timeouts:** Ensures that timeouts for Google Search, web scraping, and Gemini analysis trigger correctly.
- **Graceful Degradation:** Uses `Promise.allSettled` to confirm that the `research_topic` tool can complete successfully even if some operations fail.
- **Content Size Limits:** Verifies that the server correctly handles and truncates large content to prevent resource exhaustion.
- **Error Recovery:** Checks for clear error logging and proper fallback mechanisms.
- **Stress Testing:** Includes tests for concurrent operations and problematic (e.g., slow) URLs to ensure the system remains stable.

For a detailed summary of the results and fixes verified by this suite, see the **[Timeout Fixes Verification Report](./testing/timeout-fixes-verification-report.md)**.

## Running Tests

### Running All Tests

```bash
npm test
```

This command runs all unit and integration tests using Jest. By default, it suppresses console logs unless a test fails and does not generate a coverage report.

### Running Tests with Coverage

```bash
npm run test:coverage
```

This command runs tests and generates a coverage report.

### Running Tests with Verbose Output

```bash
npm run test:verbose
```

This command runs tests with detailed output, including console logs for passing tests.

### Running End-to-End Tests

```bash
# Run all end-to-end tests in the tests/e2e/ directory
npm run test:e2e

# Run only the STDIO end-to-end test
npm run test:e2e:stdio

# Run only the SSE end-to-end test
npm run test:e2e:sse

# Run the comprehensive timeout test suite
npm run test:e2e:timeout
```

These commands execute the various end-to-end test suites to validate the server's functionality, reliability, and transport methods.

### Running Specific Tests

```bash
# Run tests matching a pattern
npm test -- -t "should store and retrieve events"

# Run tests in a specific file
npm test -- src/cache/cache.spec.ts
```

## Mocking Strategies

Mocking involves replacing parts of the system (like external services or modules) with controlled replacements (mocks). This helps isolate the component being tested and makes tests faster and more reliable.

### File System Mocking

For unit tests, mock the file system to avoid actual disk I/O:

```typescript
// Mock the fs/promises module
jest.mock('fs/promises', () => ({
  __esModule: true,
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('{"mock":"data"}'),
  // ... other mocked methods ...
}));
```

For integration tests, use temporary directories:

```typescript
// Create a temporary directory for testing
tempDir = path.join(process.cwd(), 'storage', 'test', `cache_test_${Date.now()}`);
await fs.mkdir(tempDir, { recursive: true });

// Clean up after the test
await fs.rm(tempDir, { recursive: true, force: true });
```

### Time Mocking

For time-dependent tests (like checking cache expiration), Jest's fake timers are used. Fake timers allow you to control the passage of time within your tests, making them deterministic and fast, without waiting for real time to pass.

```typescript
// Enable fake timers
jest.useFakeTimers();

// Advance time
jest.advanceTimersByTime(ttl - 1);

// Clean up
jest.useRealTimers();
```

### Encryption and Authorization Mocking

For security feature tests, mock implementations are provided:

```typescript
// Mock key provider
const mockKeyProvider = async () => {
  return crypto.scryptSync('test-secret', 'salt', 32);
};

// Mock authorizer
const mockAuthorizer = async (streamId: string, userId?: string) => {
  return streamId === 'stream1' && userId === 'user1';
};
```

### OAuth 2.1 Middleware Testing

Testing the OAuth middleware (`src/shared/oauthMiddleware.ts`) involves:
- **Mocking the Authorization Server (AS):** Using tools like `nock` or Jest mocks to simulate the external AS's JWKS endpoint (`/.well-known/jwks.json`).
- **Generating Test JWTs:** Creating JWTs with various claims (valid, expired, wrong issuer/audience, different scopes) signed with keys corresponding to the mocked JWKS. Libraries like `jose` or `jsonwebtoken` can be used.
- **Unit Testing Middleware Logic:** Verifying token extraction, signature validation, claim checks (issuer, audience, expiry), and scope enforcement. Testing correct `401`/`403` responses for various error conditions.
- **Testing JWKS Handling:** Validating JWKS fetching, caching, and key rotation scenarios.

Refer to the [Security Improvements Guide](../plans/security-improvements-implementation-guide.md#3-token-validation-middleware) for a detailed testing strategy.

**Files:**
- `src/shared/oauthMiddleware.spec.ts`: Tests for the OAuth middleware components.
- `src/shared/oauthScopes.spec.ts`: Tests for scope definition and validation logic.

## Writing New Tests

### Unit Test Example

```typescript
describe('Cache', () => {
  let cache: Cache;
  let mockNow: number;

  beforeEach(() => {
    // Create a new cache instance before each test
    cache = new Cache({ defaultTTL: 1000, maxSize: 5 });
    
    // Mock the now() method to control time
    mockNow = Date.now();
    jest.spyOn(cache as any, 'now').mockImplementation(() => mockNow);
  });

  afterEach(() => {
    // Clean up after each test
    cache.dispose();
    jest.restoreAllMocks();
  });

  it('should store and retrieve values', async () => {
    const computeFn = jest.fn<() => Promise<string>>().mockResolvedValue('computed value');
    
    // First call should compute
    const result1 = await cache.getOrCompute('test', { id: 1 }, computeFn);
    expect(result1).toBe('computed value');
    expect(computeFn).toHaveBeenCalledTimes(1);
    
    // Second call should use cache
    const result2 = await cache.getOrCompute('test', { id: 1 }, computeFn);
    expect(result2).toBe('computed value');
    expect(computeFn).toHaveBeenCalledTimes(1); // Still only called once
  });
});
```

### End-to-End Test Example

```javascript
// Test google_search tool
const {
  content: [{ text: url }]
} = await client.callTool({
  name: "google_search",
  arguments: { query: "example.com", num_results: 1 }
});
assert(url.startsWith("http"));
console.log("✨ google_search OK:", url);
```

### Best Practices

1. **Isolation**: Each test should be independent and not rely on the state from other tests
2. **Cleanup**: Always clean up resources in `afterEach` or `afterAll` blocks
3. **Mock External Dependencies**: Use mocks for external services, file systems, etc.
4. **Clear Assertions**: Make assertions specific and descriptive
5. **Test Edge Cases**: Include tests for error conditions and edge cases
6. **Avoid Test Interdependence**: Don't create tests that depend on the order of execution

## Troubleshooting

### Common Issues

#### Open Handles

If tests fail with warnings about open handles:
- Check for unclosed file handles
- Ensure all timers are cleared with `jest.useRealTimers()`
- Verify that event listeners are removed
- Run tests with `npm run test:fix` (which uses `--no-cache`) to help identify the issue

#### Flaky Tests

For tests that pass inconsistently:
- Avoid relying on exact timing
- Use Jest's fake timers instead of real timeouts
- Ensure proper cleanup between tests
- Add more specific assertions to identify the failure point

#### Slow Tests

If tests are running too slowly:
- Mock expensive operations
- Use more focused test files
- Run specific tests instead of the entire suite during development

### Debugging Techniques

1. **Console Logging**: Add temporary `console.log` statements
2. **Jest --verbose**: Run tests with `npm run test:verbose`
3. **Inspect Mocks**: Use `mockFn.mock.calls` to inspect how mocks were called
4. **Breakpoints**: Use the Node.js debugger with `--inspect-brk`

```bash
node --inspect-brk node_modules/.bin/jest --runInBand path/to/test.js
```

Then connect with Chrome DevTools or VS Code debugger.
