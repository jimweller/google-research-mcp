# Deep Dive: Caching System Architecture

This document provides a detailed technical explanation of the server's caching system. It is intended for developers who need to understand, modify, or extend its functionality.

For a higher-level view, please see the main [**Architecture Guide**](./architecture.md).

## Table of Contents

1.  [**Architectural Goals**](#architectural-goals)
2.  [**Component Diagram**](#component-diagram)
3.  [**Core Components**](#core-components)
    -   [`PersistentCache`](#persistentcache)
    -   [`PersistenceManager`](#persistencemanager)
    -   [Persistence Strategies](#persistence-strategies)
4.  [**Data Flow and Logic**](#data-flow-and-logic)
    -   [Cache Hit vs. Miss](#cache-hit-vs-miss)
    -   [Persistence Operations](#persistence-operations)
5.  [**Configuration and Usage**](#configuration-and-usage)
6.  [**Error Handling and Shutdown**](#error-handling-and-shutdown)

---

## Architectural Goals

The caching system is designed to meet several key objectives:
-   **Performance**: Provide fast, in-memory access to frequently requested data.
-   **Durability**: Persist cached data to disk to survive server restarts.
-   **Configurability**: Allow developers to balance performance and durability using different persistence strategies.
-   **Scalability**: Handle a large number of cache entries efficiently with LRU eviction.
-   **Resilience**: Prevent data corruption through atomic writes and handle filesystem errors gracefully.

## Component Diagram

The system is composed of three main components that work in concert:

```mermaid
graph TD
    subgraph "Application Layer"
        A[Tool Executor]
    end

    subgraph "Caching System"
        B(PersistentCache)
        C{Persistence Strategy}
        D[PersistenceManager]
    end

    subgraph "Storage Layer"
        E[In-Memory Cache (Map)]
        F[Filesystem]
    end

    A -- Calls getOrCompute() --> B
    B -- Uses --> E
    B -- Consults --> C
    B -- Delegates I/O to --> D
    C -- Influences when B calls D --> B
    D -- Reads/Writes --> F

    style B fill:#cce6ff,stroke:#333,stroke-width:2px
    style C fill:#fff2cc,stroke:#333,stroke-width:2px
    style D fill:#e6ffcc,stroke:#333,stroke-width:2px
```

## Core Components

### `PersistentCache`
-   **File**: [`src/cache/persistentCache.ts`](../src/cache/persistentCache.ts)
-   **Description**: The primary public-facing class. It orchestrates the entire caching process, extending a base in-memory `Cache` with persistence capabilities.
-   **Key Responsibilities**:
    -   Managing the in-memory cache (a `Map` of cache entries).
    -   Implementing the core `getOrCompute` logic.
    -   Interacting with the `PersistenceManager` to load and save data.
    -   Consulting the `PersistenceStrategy` to decide when to persist data.
    -   Handling TTL (Time-To-Live), LRU (Least Recently Used) eviction, and the stale-while-revalidate pattern.
    -   Managing a "dirty" flag to track if the in-memory cache has changes that need to be written to disk.

### `PersistenceManager`
-   **File**: [`src/cache/persistenceManager.ts`](../src/cache/persistenceManager.ts)
-   **Description**: An abstraction layer over the physical storage (currently, the filesystem). It handles all the low-level details of reading and writing cache entries.
-   **Key Responsibilities**:
    -   Organizing cache entries into separate directories by **namespace**.
    -   **Hashing** cache keys (using SHA-256) to create safe and unique filenames.
    -   Performing **atomic writes**: It writes to a temporary file first and then renames it, which prevents data corruption if the process crashes mid-write.
    -   Loading entries from disk into memory.

### Persistence Strategies
-   **File**: [`src/cache/persistenceStrategies.ts`](../src/cache/persistenceStrategies.ts)
-   **Description**: A set of classes implementing the **Strategy Pattern**. They provide a pluggable way to define *when* the `PersistentCache` should write data to disk.
-   **Available Strategies**:
    1.  **`PeriodicPersistenceStrategy`**: Persists all dirty entries at a regular interval (e.g., every 5 minutes). Good for high-write scenarios.
    2.  **`WriteThroughPersistenceStrategy`**: Persists an entry *immediately* whenever it is set or modified. Maximizes durability but has a higher performance cost per write.
    3.  **`OnShutdownPersistenceStrategy`**: Only persists the cache when the server is shutting down. Offers the best performance but risks data loss on a crash.
    4.  **`HybridPersistenceStrategy`**: A mix of `WriteThrough` for specified "critical" namespaces and `Periodic` for all others.

## Data Flow and Logic

### Cache Hit vs. Miss

The core logic resides in the `getOrCompute` method:

1.  **Check In-Memory**: The cache first checks its internal `Map` for a valid, non-expired entry. If found, it's returned immediately (a **cache hit**).
2.  **Check Stale-While-Revalidate**: If the entry is found but has expired (but is still within the `staleTTL` window), the stale data is returned immediately for performance, and a background promise is launched to compute the fresh value.
3.  **Check Disk**: If the entry is not in memory, the `PersistenceManager` is asked to load it from the filesystem (a **disk hit**). If found, it's loaded into memory and returned.
4.  **Compute**: If the entry is not found anywhere (a **cache miss**), the `computeFn` provided by the caller is executed.
5.  **Store**: The newly computed result is stored in the in-memory cache.
6.  **Persist (Maybe)**: The `PersistenceStrategy` is consulted. If the strategy dictates (e.g., `WriteThrough`), the `PersistenceManager` is immediately called to save the new entry to disk. Otherwise, the cache's `isDirty` flag is simply set to `true`.

### Persistence Operations

-   **Periodic**: A `setInterval` timer in `PersistentCache` periodically checks the `isDirty` flag. If true, it calls `persistToDisk()`.
-   **Immediate**: The `shouldPersistOnSet()` method of the strategy returns `true`, causing `persistToDisk()` to be called within the `getOrCompute` flow.
-   **Shutdown**: A global shutdown handler calls `dispose()` on the cache instance, which triggers a final, synchronous `persistToDisk()` operation.

## Configuration and Usage

The `PersistentCache` is instantiated as a **global singleton** in `src/server.ts` to ensure all parts of the application share the same cache instance.

```typescript
// Simplified example from src/server.ts
const globalCache = new PersistentCache({
  defaultTTL: 30 * 60 * 1000, // 30 minutes
  maxSize: 5000,
  storagePath: path.resolve(__dirname, '..', 'storage', 'persistent_cache'),
  persistenceStrategy: new PeriodicPersistenceStrategy({
    persistenceInterval: 5 * 60 * 1000 // 5 minutes
  }),
  eagerLoading: true, // Load all data from disk on startup
});
```

## Error Handling and Shutdown

-   **Filesystem Errors**: All I/O operations within the `PersistenceManager` are wrapped in `try...catch` blocks. Errors are logged but generally do not crash the application, allowing the cache to continue operating in-memory.
-   **Graceful Shutdown**: The `PersistentCache` listens for `SIGINT`, `SIGTERM`, and `SIGHUP` signals. Upon receiving one, it triggers a final, synchronous persistence of any dirty data to disk, ensuring maximum data durability before the process exits. This is critical for ensuring consistency, especially for short-lived STDIO processes.