// jest.setup.js
import { jest, afterAll, afterEach, beforeEach } from '@jest/globals';
// Import instances for cleanup
import {
  stdioTransportInstance,
  httpTransportInstance,
  globalCacheInstance,
  eventStoreInstance
} from './src/server.js'; // Assuming server.js is the compiled output

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Check if Jest is running in verbose mode
const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v');

// Mock console methods before each test suite
beforeEach(() => {
  if (!isVerbose) {
    // Suppress console output if not in verbose mode
    console.log = jest.fn();
    console.error = jest.fn();
  } else {
    // Restore original console methods if in verbose mode
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  }
});

// Make all tests use fake timers
jest.useFakeTimers();

// After every test, clear timers
afterEach(() => {
  jest.clearAllTimers();
});

// After every test suite, clear timers, restore console, and clean up server resources
afterAll(async () => {
  // Restore original console methods first
  console.log = originalConsoleLog;
  console.error = originalConsoleError;

  // --- Resource Cleanup ---
  // Use try-catch for each cleanup step to ensure all attempts are made
  
  // 1. Close Transports
  try {
    if (stdioTransportInstance && typeof stdioTransportInstance.close === 'function') {
      await stdioTransportInstance.close();
      if (process.env.NODE_ENV !== 'test') {
        console.log('Jest afterAll: STDIO transport closed.');
      }
    }
  } catch (error) {
    console.error('Jest afterAll: Error closing STDIO transport:', error);
  }
  
  try {
    if (httpTransportInstance && typeof httpTransportInstance.close === 'function') {
      await httpTransportInstance.close();
      if (process.env.NODE_ENV !== 'test') {
        console.log('Jest afterAll: HTTP transport closed.');
      }
    }
  } catch (error) {
    console.error('Jest afterAll: Error closing HTTP transport:', error);
  }

  // 2. Dispose Cache
  try {
    if (globalCacheInstance && typeof globalCacheInstance.dispose === 'function') {
      await globalCacheInstance.dispose();
      if (process.env.NODE_ENV !== 'test') {
        console.log('Jest afterAll: Global cache disposed.');
      }
    }
  } catch (error) {
    console.error('Jest afterAll: Error disposing global cache:', error);
  }

  // 3. Dispose Event Store
  try {
    if (eventStoreInstance && typeof eventStoreInstance.dispose === 'function') {
      await eventStoreInstance.dispose();
      if (process.env.NODE_ENV !== 'test') {
        console.log('Jest afterAll: Event store disposed.');
      }
    }
  } catch (error) {
    console.error('Jest afterAll: Error disposing event store:', error);
  }
  
  // --- Timer Cleanup ---
  // Clear any remaining fake timers
  jest.clearAllTimers();
  // Ensure we switch back to real timers for any subsequent operations
  jest.useRealTimers();
});