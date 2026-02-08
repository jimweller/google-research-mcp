// NOTE: Complex batch processing logic involving SDK transport/sessions
// is verified by the E2E test `e2e_batch_request_test.mjs`.
// These unit tests focus only on specific server-side checks
// related to batch requests (e.g., empty batches, missing session IDs).

import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Express } from 'express';
import { createTestStoragePaths, ensureTestStorageDirs, cleanupTestStorage, setupTestEnv, cleanupTestEnv, createTestInstances, disposeTestInstances, cleanupProcessListeners, TestStoragePaths, TestInstances } from './test-helpers.js';

// Mock the transport layer to avoid session/network issues in unit tests
const mockHandleRequest = jest.fn();

// Mock the StreamableHTTPServerTransport class
jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => {
  return {
    StreamableHTTPServerTransport: jest.fn().mockImplementation(() => {
      return {
        handleRequest: mockHandleRequest,
        onclose: jest.fn(),
        onsessioninitialized: jest.fn() // Simplified mock
      };
    })
  };
});

// Now import the server module after the mocks are set up
import { createAppAndHttpTransport } from './server.js'; // Import the renamed function
import supertest from 'supertest';

// Test basic batch request validation handled directly by the server
describe('JSON-RPC Batch Request Handling (Server-Side Checks)', () => {
  let app: Express;
  let testCache: TestInstances['cache'];
  let testEventStore: TestInstances['eventStore'];
  const paths = createTestStoragePaths('batch-spec', import.meta.url);

  beforeAll(async () => {
    // Use real timers for this test suite to avoid hanging
    jest.useRealTimers();

    // Setup test environment variables to prevent process.exit(1) in createAppAndHttpTransport
    setupTestEnv();

    // Ensure test storage directory exists
    await ensureTestStorageDirs(paths);

    // Create test-specific cache and event store instances
    const instances = createTestInstances(paths);
    testCache = instances.cache;
    testEventStore = instances.eventStore;

    // Create app instance using the test instances
    // Note: OAuth options are not needed for these specific tests
    const { app: createdApp } = await createAppAndHttpTransport(testCache, testEventStore);
    app = createdApp;
  });

  afterAll(async () => {
    await disposeTestInstances({ cache: testCache, eventStore: testEventStore });
    await cleanupTestStorage(paths);
    cleanupTestEnv();
    cleanupProcessListeners();
  });

  it('should handle empty batch requests with a 400 error', async () => {
    // Use the app instance created in beforeAll
    const request = supertest(app);

    const response = await request
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send([]);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      jsonrpc: "2.0",
      error: { code: -32600, message: "Invalid Request: Empty batch" },
      id: null
    });
  });

  it('should reject batch requests without a valid session ID', async () => {
    // Use the app instance created in beforeAll
    const request = supertest(app);

    const batchRequest = [
      { jsonrpc: "2.0", method: "callTool", params: { name: "google_search", arguments: { query: "test" } }, id: 1 }
    ];

    const response = await request
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('Mcp-Session-Id', 'invalid-session-id')
      .send(batchRequest);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: No valid session ID provided" },
      id: null
    });
    expect(mockHandleRequest).not.toHaveBeenCalled();
  });
  // Removed tests related to successful batch processing via transport,
  // as that logic is covered by e2e_batch_request_test.mjs
});