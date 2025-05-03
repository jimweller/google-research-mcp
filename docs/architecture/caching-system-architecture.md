# Caching System Architecture

This document provides a detailed overview of the caching system architecture, including the PersistentCache, persistence strategies, event store, and how these components interact.

## Table of Contents

1. [Overview](#overview)
2. [Core Components](#core-components)
3. [PersistentCache](#persistentcache)
4. [Persistence Strategies](#persistence-strategies)
5. [Persistence Manager](#persistence-manager)
6. [Event Store Integration](#event-store-integration)
7. [Data Flow](#data-flow)
8. [Error Handling](#error-handling)
9. [Shutdown Procedures](#shutdown-procedures)
10. [Security Considerations](#security-considerations)

## Overview

The caching system provides a robust, configurable solution for storing and retrieving data with persistence capabilities. It extends a basic in-memory cache with disk persistence, allowing data to survive application restarts while maintaining high performance. The system is designed with flexibility in mind, supporting various persistence strategies to balance performance and durability based on specific use cases.

> **Note**: For information about caching behavior across different transport mechanisms (STDIO and HTTP+SSE), see [Transport-Specific Caching Considerations](../transport-caching-considerations.md).

Key features include:
- In-memory cache for high-performance access
- Configurable disk persistence strategies
- Namespace-based organization of cached data
- Automatic recovery after restarts
- Graceful shutdown handling
- Support for stale-while-revalidate pattern
- Comprehensive error handling

## Core Components

The caching system consists of several key components that work together:

```
                                  +----------------+
                                  | Client         |
                                  | Application    |
                                  +-------+--------+
                                          |
                                          v
+----------------+              +-------------------+
| Persistence    |<------------>| PersistentCache   |<--------+
| Strategies     |              | (extends Cache)   |         |
+----------------+              +-------------------+         |
| - Periodic     |                       |                    |
| - WriteThrough |                       v                    |
| - OnShutdown   |              +-------------------+         |
| - Hybrid       |              | Persistence       |         |
+----------------+              | Manager           |         |
                               +-------------------+         |
                                       |                    |
                                       v                    |
                               +-------------------+        |
                               | File System       |        |
                               +-------------------+        |
                                       ^                    |
                                       |                    |
                               +-------------------+        |
                               | Event Persistence |        |
                               | Manager           |        |
                               +-------------------+        |
                                       ^                    |
                                       |                    |
                               +-------------------+        |
                               | PersistentEvent   |<-------+
                               | Store             |
                               +-------------------+
```

For a more detailed diagram, see the Mermaid source in `docs/diagrams/caching-system-architecture.md`.

1. **PersistentCache**: The main cache implementation that extends the in-memory Cache with persistence capabilities
2. **Persistence Strategies**: Configurable approaches for when and how to persist data
3. **Persistence Manager**: Handles the low-level details of storing and retrieving cache entries
4. **Event Store**: A separate but integrated system for storing and retrieving event data

## PersistentCache

The `PersistentCache` class is the primary interface for the caching system. It extends the in-memory `Cache` class with persistence capabilities.

### Key Features

- **Namespace-based Organization**: Cache entries are organized by namespaces, allowing for logical grouping and selective persistence
- **TTL Support**: Entries automatically expire after a configurable time-to-live
- **Stale-While-Revalidate**: Supports serving stale content while refreshing in the background
- **Eager Loading**: Optional loading of all entries on startup for improved performance
- **LRU Eviction**: Automatically removes least recently used entries when the cache reaches its maximum size
- **Dirty Flag**: Tracks whether changes in memory need to be persisted to disk (`isDirty`).

### Configuration Options

The `PersistentCache` can be configured with various options:

```typescript
interface PersistentCacheOptions {
  defaultTTL?: number;           // Default time-to-live in milliseconds
  maxSize?: number;              // Maximum number of entries
  storagePath?: string;          // Path to store persistent cache files (use absolute paths for consistency)
  persistenceStrategy?: PersistenceStrategy; // Strategy for when to persist entries
  eagerLoading?: boolean;        // Whether to load all entries on startup
  persistentNamespaces?: string[]; // Namespaces to persist to disk
  encryptedNamespaces?: string[]; // Namespaces that should be encrypted
  encryptionKey?: string;        // Encryption key for sensitive data
}
```

**Important Note on Storage Paths**: To ensure consistent cache sharing between different transport mechanisms (like STDIO and SSE) which might operate with different working directories, it is crucial to use a consistent, absolute path for the `storagePath`.
  - **Default Behavior**: If `storagePath` is not explicitly provided in the options, `PersistentCache` now defaults to an absolute path derived from the module's location (`path.resolve(__dirname, '..', 'storage', 'persistent_cache')`). This prevents issues caused by using `process.cwd()`.
  - **Recommendation**: While the default is now safer, explicitly providing an absolute `storagePath` during cache initialization remains the recommended practice for clarity and control.

### Core Methods

- **getOrCompute**: Retrieves a value from the cache or computes it if not present
- **invalidate**: Removes an entry from both memory and disk
- **clear**: Removes all entries from both memory and disk
- **persistToDisk**: Manually triggers persistence of all entries
- **loadFromDisk**: Loads all entries from disk into memory
- **dispose**: Cleans up resources and persists data before shutdown

## Persistence Strategies

Persistence strategies determine when and how cache entries are persisted to disk. Different strategies can be used for different use cases, balancing performance and durability.

### Base Strategy

All strategies extend the `BasePersistenceStrategy` class, which provides common functionality:

```typescript
abstract class BasePersistenceStrategy implements PersistenceStrategy {
  protected persistentNamespaces: Set<string>;
  
  abstract shouldPersistOnSet(namespace: string, key: string, entry: CacheEntry<any>): boolean;
  abstract shouldPersistOnGet(namespace: string, key: string, entry: CacheEntry<any>): boolean;
  abstract getPersistenceInterval(): number | null;
  
  async onShutdown(): Promise<void> {
    // Default implementation does nothing
  }
}
```

### Available Strategies

1. **PeriodicPersistenceStrategy**: Persists entries at regular intervals
   - Never persists immediately on set or get operations
   - Balances performance and durability
   - Best for large caches with high write frequency

2. **WriteThroughPersistenceStrategy**: Persists entries immediately when set
   - Always persists on set, never on get
   - Provides maximum durability at the cost of performance
   - Best for critical data that must never be lost

3. **OnShutdownPersistenceStrategy**: Persists entries only during shutdown
   - Never persists on set or get operations
   - Maximizes performance at the cost of durability
   - Best for non-critical data or development environments

4. **HybridPersistenceStrategy**: Combines immediate persistence for critical namespaces with periodic persistence for others
   - Persists critical namespaces immediately on set
   - Periodically persists all other namespaces
   - Provides a balance of performance and durability
   - Best for mixed workloads with varying durability requirements

### Strategy Selection

The appropriate strategy depends on the specific requirements:

| Strategy | Durability | Performance | Use Case |
|----------|------------|-------------|----------|
| Periodic | Medium | High | Large caches, high write frequency |
| Write-Through | High | Low | Critical data, infrequent writes |
| On-Shutdown | Low | Very High | Non-critical data, development |
| Hybrid | Mixed | Mixed | Mixed workloads |

## Persistence Manager

The `PersistenceManager` handles the low-level details of storing and retrieving cache entries from the filesystem. It provides a clean abstraction over the filesystem operations, allowing the cache to focus on higher-level concerns.

### Key Features

- **Namespace-based Organization**: Organizes cache entries by namespace on disk
- **Atomic Writes**: Uses a temporary file and rename pattern to prevent corruption
- **Error Handling**: Gracefully handles filesystem errors
- **Metadata Tracking**: Maintains metadata about the cache for monitoring and debugging

### File Structure

The persistence manager organizes files on disk as follows:

```
storage/
└── persistent_cache/
    ├── metadata.json
    └── namespaces/
        ├── namespace1/
        │   ├── [hashed_key1].json
        │   └── [hashed_key2].json
        └── namespace2/
            ├── [hashed_key3].json
            └── [hashed_key4].json
```

- **metadata.json**: Contains cache statistics and version information
- **namespaces/**: Directory containing subdirectories for each namespace
- **[namespace]/**: Directory containing cache entries for a specific namespace
- **[hashed_key].json**: Individual cache entry file, named using a SHA-256 hash of the original arguments. Hashing ensures consistent file naming and avoids issues with special characters in keys.

### Entry Format

Each cache entry is stored as a JSON file with the following structure:

```json
{
  "key": "original_key",
  "value": "cached_value",
  "metadata": {
    "createdAt": 1650000000000,
    "expiresAt": 1650001000000,
    "staleUntil": 1650001600000,
    "size": 123,
    "contentType": "application/json"
  }
}
```

## Event Store Integration

The caching system integrates with an event store system that provides similar persistence capabilities but is specialized for storing and retrieving event data. For a detailed explanation of the event store architecture, see [Event Store Architecture](./event-store-architecture.md).

### PersistentEventStore

The `PersistentEventStore` implements the `EventStore` interface from the MCP SDK and provides:

- In-memory storage with disk persistence
- Configurable event limits and expiration
- Stream-level and global event management
- Optional encryption for sensitive data
- Access control for multi-tenant scenarios
- Audit logging for compliance

```typescript
export class PersistentEventStore implements EventStore {
  private memoryStore: Map<string, EventData>;
  private persistenceManager: EventPersistenceManager;
  private options: PersistentEventStoreOptions;
  // ...
  
  async storeEvent(streamId: string, message: JSONRPCMessage, userId?: string): Promise<string> {
    // Generate event ID
    // Store in memory
    // Enforce limits
    // Persist critical events immediately
    // ...
  }
  
  async replayEventsAfter(lastEventId: string, options: { send: Function, userId?: string }): Promise<string> {
    // Find events after the last event
    // Send them to the client
    // ...
  }
}
```

### EventPersistenceManager

Similar to the `PersistenceManager` for the cache, the `EventPersistenceManager` handles the low-level details of storing and retrieving events from the filesystem:

```typescript
export class EventPersistenceManager {
  private storagePath: string;
  private criticalStreamIds: string[];
  private persistenceInterval: number;
  // ...
  
  async persistEvents(events: Map<string, EventData>): Promise<void> {
    // Group events by stream ID
    // Write each event to its own file
    // ...
  }
  
  async loadEvents(): Promise<Map<string, EventData>> {
    // Read all events from disk
    // Organize by event ID
    // ...
  }
}
```

### Integration Points

The caching system and event store share similar architectural patterns:

1. **Dual-Layer Storage**: Both maintain in-memory data with disk persistence for performance and durability
2. **Persistence Management**: Both use a dedicated persistence manager for filesystem operations
3. **Configurable Persistence**: Both support configurable persistence strategies to balance performance and durability
4. **Graceful Shutdown**: Both handle graceful shutdown and error recovery to ensure data integrity
5. **Namespace/Stream Organization**: Both organize data into logical groups (namespaces for cache, streams for events)
6. **TTL Support**: Both support automatic expiration of entries based on configurable TTL values

## Data Flow

The caching system implements several key data flows that illustrate how the components interact during different operations. For a visual representation, see the sequence diagram in `docs/diagrams/cache-sequence-diagram.md`.

### Cache Operations

1. **Cache Hit Flow** (Fresh Entry):
   ```
   Client → PersistentCache → In-Memory Cache → PersistentCache → Client
   ```
   - Application requests data via `getOrCompute`
   - Cache checks in-memory store using the full key (namespace:key)
   - Entry is found and is not expired
   - If persistence on get is enabled (based on strategy), persist the entry
   - Return the value to the client immediately

2. **Cache Hit Flow** (Stale Entry with Revalidation):
   ```
   Client → PersistentCache → In-Memory Cache → PersistentCache → Client
                           └→ Background Revalidation → Client → PersistentCache
   ```
   - Application requests data via `getOrCompute`
   - Cache checks in-memory store
   - Entry is found but is stale (expired but within stale window)
   - Return the stale value to the client immediately
   - Trigger background revalidation to compute a fresh value
   - When computation completes, update the cache without blocking the client

3. **Cache Miss Flow** (Disk Retrieval):
   ```
   Client → PersistentCache → In-Memory Cache → PersistentCache → Persistence Manager → File System → PersistentCache → Client
   ```
   - Application requests data via `getOrCompute`
   - Cache checks in-memory store
   - Entry is not found or is expired
   - If not using eager loading, check disk store via persistence manager
   - Entry is found on disk and is not expired
   - Load entry into memory cache
   - Return the value to the client

4. **Cache Miss Flow** (Computation):
   ```
   Client → PersistentCache → In-Memory Cache → PersistentCache → Client (compute) → PersistentCache → In-Memory Cache → PersistentCache → Client
                                                                                                     └→ Persistence Strategy → Persistence Manager → File System
   ```
   - Application requests data via `getOrCompute`
   - Cache checks in-memory store
   - Entry is not found or is expired
   - If not using eager loading, check disk store
   - Entry is not found on disk or is expired
   - Call the compute function provided by the client
   - Store the computed value in memory
   - If persistence on set is enabled (based on strategy), persist the entry
   - Otherwise, mark the cache as dirty for periodic persistence
   - Return the computed value to the client

### Persistence Operations

1. **Immediate Persistence**:
   ```
   PersistentCache → Persistence Strategy → Persistence Manager → File System
   ```
   - Triggered by set/get operations based on the persistence strategy
   - Strategy determines if the entry should be persisted immediately
   - Persistence manager serializes the entry with metadata
   - Entry is written to a temporary file
   - Temporary file is renamed to the final filename (atomic operation)

2. **Periodic Persistence**:
   ```
   Timer → PersistentCache → Persistence Manager → File System
   ```
   - Timer fires based on the persistence interval from the strategy
   - If the cache is marked as dirty, all entries are persisted
   - Persistence manager groups entries by namespace for efficiency
   - Entries are written to disk in parallel
   - Cache is marked as clean after successful persistence

3. **Shutdown Persistence**:
   ```
   Shutdown Signal → PersistentCache → Persistence Manager → File System
   ```
   - Application initiates shutdown or receives termination signal
   - Shutdown handlers are triggered
   - Persistence timers are stopped
   - If the cache is dirty, all entries are persisted synchronously
   - Resources are released after persistence completes

## Error Handling

The caching system implements comprehensive error handling to ensure robustness:

### Cache-Level Error Handling

- **Initialization Errors**: If errors occur during initialization, the cache continues with an empty state
- **Persistence Errors**: Errors during persistence are logged but don't interrupt the application
- **Computation Errors**: Errors during value computation are propagated to the caller
- **Background Revalidation Errors**: Errors during background revalidation are logged but don't affect the main request flow

### Persistence Manager Error Handling

- **Directory Creation Errors**: If storage directories can't be created, errors are logged and propagated
- **File Read Errors**: If a file can't be read, the entry is considered not found
- **File Write Errors**: If a file can't be written, errors are logged and propagated
- **Atomic Write Failures**: If an atomic write fails, the temporary file is cleaned up

### Special Error Cases

- **EPIPE Errors**: Special handling for broken pipe errors, which can occur when the parent process terminates unexpectedly
- **Shutdown Errors**: Errors during shutdown are logged but don't prevent the process from exiting

## Shutdown Procedures

The caching system implements careful shutdown procedures to ensure data durability:

### Graceful Shutdown

1. **Signal Handlers**: Registers handlers for SIGINT, SIGTERM, SIGHUP, and normal exit
2. **Timer Cleanup**: Stops all persistence timers
3. **Synchronous Persistence**: Performs a synchronous persistence operation to ensure all data is written to disk
4. **Resource Cleanup**: Releases all resources

The SIGHUP handler is particularly important for child processes (like those created for STDIO transport) that might receive this signal when their parent process terminates. This ensures proper cache persistence even in these scenarios.

### Synchronous Persistence

During shutdown, the cache uses synchronous filesystem operations to ensure all data is persisted before the process exits:

```typescript
private persistSync(): void {
  if (!this.isDirty) {
    return;
  }
  
  try {
    // Use synchronous file operations to ensure data is written before exit
    // ...
  } catch (error) {
    console.error('Error persisting cache synchronously:', error);
  }
}
```

## Security Considerations

### Data Encryption

The caching system supports encryption for sensitive data:

- **Encrypted Namespaces**: Specific namespaces can be marked for encryption
- **Encryption Key**: A key can be provided for encrypting and decrypting data
- **Event Store Encryption**: The event store also supports encryption for sensitive events

### Access Control

The event store implements access control for multi-tenant scenarios:

- **Stream-Level Access Control**: Access can be restricted at the stream level
- **User-Based Authorization**: Authorization is based on user IDs
- **Audit Logging**: All access attempts are logged for compliance

### Data Sanitization

Sensitive data is sanitized before storage:

- **Message Sanitization**: JSON-RPC messages are sanitized to remove sensitive fields
- **Error Message Sanitization**: Error messages are sanitized to prevent information leakage

## Transport-Specific Considerations

When using the caching system with multiple transport mechanisms (like STDIO and SSE), special attention should be paid to ensure consistent behavior:

### Storage Path Configuration

- **Issue**: Different transports might operate with different working directories, causing them to use different storage paths if relative paths are used.
- **Solution**: Always use absolute paths for storage locations to ensure all transports share the same cache.

### Process Lifecycle Management

- **STDIO Transport**: Since this transport creates a new process for each client connection, proper shutdown handling is critical to ensure cache persistence.
- **SSE Transport**: This transport typically runs in a long-lived server process, allowing for more consistent cache behavior across multiple client connections.

### Implementation Example

```typescript
// In server.ts
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Get the directory name in ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use absolute path for cache storage
const globalCache = new PersistentCache({
  // ...other options
  storagePath: path.resolve(__dirname, '..', 'storage', 'persistent_cache'),
});
```

This approach ensures that both STDIO and SSE transports use the same storage location regardless of their working directory.

## Conclusion

The caching system architecture provides a flexible, robust solution for caching with persistence. By separating concerns between the cache, persistence strategies, and persistence manager, the system can be easily configured for different use cases with varying performance and durability requirements.

### Key Benefits

1. **Performance with Durability**: The dual-layer approach (in-memory + disk) provides the performance benefits of in-memory caching with the durability of disk persistence.

2. **Configurable Persistence**: The strategy pattern allows for fine-tuning the balance between performance and durability based on specific requirements.

3. **Namespace Organization**: The namespace-based organization provides logical separation of cached data and allows for selective persistence.

4. **Graceful Recovery**: The system can recover from crashes and restarts by reloading data from disk.

5. **Stale-While-Revalidate**: The support for serving stale content while refreshing in the background improves perceived performance.

6. **Comprehensive Error Handling**: The system handles errors at multiple levels to ensure robustness.

7. **Graceful Shutdown**: The shutdown procedures ensure data durability even during abnormal termination.

### Design Patterns Used

The architecture leverages several design patterns:

- **Strategy Pattern**: For configurable persistence strategies
- **Decorator Pattern**: PersistentCache extends the base Cache functionality
- **Repository Pattern**: Persistence manager abstracts storage details
- **Observer Pattern**: For event-based communication during persistence
- **Factory Pattern**: For creating appropriate cache entries and strategies

The integration with the event store system demonstrates how similar architectural patterns can be applied to different domains while sharing common infrastructure for persistence, error handling, and shutdown procedures. This approach promotes code reuse and consistency across the system.

### Future Considerations

As the system evolves, several enhancements could be considered:

1. **Distributed Caching**: Extending the architecture to support distributed caching across multiple nodes
2. **Additional Storage Backends**: Supporting alternative storage backends beyond the filesystem
3. **Cache Invalidation Patterns**: Implementing more sophisticated cache invalidation strategies
4. **Monitoring and Telemetry**: Enhancing the statistics and monitoring capabilities
5. **Compression**: Adding support for compressing cached data to reduce storage requirements

By maintaining the clean separation of concerns established in the current architecture, these enhancements can be incorporated without significant restructuring of the existing system.