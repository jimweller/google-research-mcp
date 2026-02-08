/**
 * Shared test utilities for server spec files.
 *
 * Provides helpers for storage paths, environment variables,
 * PersistentCache / PersistentEventStore creation, disposal,
 * and process-listener cleanup.
 *
 * NOTE: jest.mock() calls cannot be shared — they must remain
 * inline in each test file due to Jest's hoisting behaviour.
 */

import { PersistentCache, HybridPersistenceStrategy } from './cache/index.js';
import { PersistentEventStore } from './shared/persistentEventStore.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// ── Storage paths ──────────────────────────────────────────────

export interface TestStoragePaths {
  storageDir: string;
  cachePath: string;
  eventPath: string;
  requestQueuesPath: string;
}

/**
 * Creates unique, timestamped storage paths for a test suite.
 * Call `await fs.mkdir(paths.storageDir, { recursive: true })` in
 * `beforeAll` to create them on disk.
 */
export function createTestStoragePaths(
  suiteName: string,
  callerUrl: string,
): TestStoragePaths {
  const callerDir = path.dirname(fileURLToPath(callerUrl));
  const storageDir = path.resolve(
    callerDir,
    '..',
    'storage',
    'test_temp',
    `${suiteName}-${Date.now()}`,
  );
  return {
    storageDir,
    cachePath: path.join(storageDir, 'cache'),
    eventPath: path.join(storageDir, 'events'),
    requestQueuesPath: path.join(storageDir, 'request_queues'),
  };
}

/**
 * Ensures the storage directories exist on disk.
 */
export async function ensureTestStorageDirs(paths: TestStoragePaths): Promise<void> {
  await fs.mkdir(paths.storageDir, { recursive: true });
}

/**
 * Removes the storage directory tree.
 */
export async function cleanupTestStorage(paths: TestStoragePaths): Promise<void> {
  try {
    await fs.rm(paths.storageDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors in tests
  }
}

// ── Environment variables ──────────────────────────────────────

const TEST_ENV_VARS: Record<string, string> = {
  GOOGLE_CUSTOM_SEARCH_API_KEY: 'test-api-key',
  GOOGLE_CUSTOM_SEARCH_ID: 'test-search-id',
  GOOGLE_GEMINI_API_KEY: 'test-gemini-key',
};

/**
 * Sets the minimum required environment variables for server tests.
 * Optionally accepts extra key/value pairs.
 */
export function setupTestEnv(extra?: Record<string, string>): void {
  Object.assign(process.env, TEST_ENV_VARS, extra);
}

/**
 * Removes the environment variables set by `setupTestEnv`.
 */
export function cleanupTestEnv(): void {
  for (const key of Object.keys(TEST_ENV_VARS)) {
    delete process.env[key];
  }
}

// ── PersistentCache / PersistentEventStore factories ───────────

export interface TestInstances {
  cache: PersistentCache;
  eventStore: PersistentEventStore;
}

/**
 * Creates lightweight PersistentCache + PersistentEventStore instances
 * suitable for unit tests (no eager loading, simple persistence strategy).
 */
export function createTestInstances(paths: TestStoragePaths): TestInstances {
  return {
    cache: new PersistentCache({
      storagePath: paths.cachePath,
      persistenceStrategy: new HybridPersistenceStrategy([], 5000, []),
      eagerLoading: false,
    }),
    eventStore: new PersistentEventStore({
      storagePath: paths.eventPath,
      eagerLoading: false,
    }),
  };
}

/**
 * Safely disposes cache and event store instances. Ignores errors.
 */
export async function disposeTestInstances(
  instances: Partial<TestInstances>,
): Promise<void> {
  if (instances.cache) {
    try { await instances.cache.dispose(); } catch { /* ignore */ }
  }
  if (instances.eventStore) {
    try { await instances.eventStore.dispose(); } catch { /* ignore */ }
  }
}

// ── Process listener cleanup ───────────────────────────────────

/**
 * Removes all process listeners that PersistentCache registers.
 * Call in afterAll / afterEach / beforeEach to prevent leaks.
 */
export function cleanupProcessListeners(): void {
  ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(sig =>
    process.removeAllListeners(sig),
  );
  process.removeAllListeners('exit');
  process.removeAllListeners('uncaughtException');
}
