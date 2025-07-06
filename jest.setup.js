// jest.setup.js
import { jest, afterAll, afterEach, beforeEach, beforeAll } from '@jest/globals';
import { cleanupStaleLocks, cleanupAllTestStorage, cleanupOpenHandles } from './src/shared/testCleanup.js';

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Check if Jest is running in verbose mode
const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v');

// Global cleanup before all tests
beforeAll(async () => {
  // Clean up any stale locks from previous test runs
  await cleanupStaleLocks();
  await cleanupAllTestStorage();
});

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

// After every test, clear timers and cleanup any test resources
afterEach(async () => {
  jest.clearAllTimers();
  
  // Clean up any locks that may have been created during the test
  await cleanupStaleLocks();
});

// After every test suite, clean up all resources
afterAll(async () => {
  // Restore original console methods first
  console.log = originalConsoleLog;
  console.error = originalConsoleError;

  // Minimal cleanup to avoid hangs
  try {
    // Basic cleanup without the problematic enhanced cleanup
    await cleanupStaleLocks();
    await cleanupAllTestStorage();
    
    // --- Timer Cleanup ---
    // Clear any remaining fake timers
    jest.clearAllTimers();
    // Ensure we switch back to real timers for any subsequent operations
    jest.useRealTimers();
    
  } catch (error) {
    console.warn('Jest afterAll: Cleanup error:', error.message);
  }
}, 10000); // 10 second timeout for afterAll hook