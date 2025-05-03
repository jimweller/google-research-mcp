// jest.setup.js
import { jest, afterAll, afterEach, beforeEach } from '@jest/globals';

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

// After every test suite, clear timers again and restore console
afterAll(() => {
  jest.clearAllTimers();
  jest.useRealTimers(); // Ensure we switch back to real timers
  
  // Restore original console methods after all tests in a suite
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});