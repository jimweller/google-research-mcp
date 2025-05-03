# Transport-Specific Caching Considerations

This document provides important information about caching behavior across different transport mechanisms in the Google Researcher MCP Server.

## Overview

The Google Researcher MCP Server supports multiple transport mechanisms:

1. **STDIO Transport**: Communication via standard input/output streams
2. **HTTP+SSE Transport**: Web-based communication with Server-Sent Events

Each transport has different characteristics that can affect caching behavior if not properly configured.

## Potential Issues

Without proper configuration, the following issues can occur:

- **Different Cache Storage Locations**: If relative paths based on `process.cwd()` (current working directory) are used for storage, different transports might use different cache locations. For example, an STDIO server launched by an IDE might have a different working directory than the main HTTP server process. This prevents cache sharing.
- **Incomplete Cache Persistence**: Short-lived processes, like those often created for STDIO transport connections, might terminate before periodic cache persistence completes, leading to data loss.

## Best Practices

To ensure consistent caching behavior across all transport mechanisms:

### 1. Use Absolute Paths for Storage Locations

Always use absolute paths for cache and event store storage locations. The `PersistentCache` class now defaults to an absolute path derived from its module location if no `storagePath` is provided, mitigating issues with differing working directories between transports. However, explicitly setting the path remains the recommended approach:

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

### 2. Implement Robust Shutdown Handling

Ensure proper cache persistence during process termination by handling all relevant signals:

- **SIGINT**: Ctrl+C termination.
- **SIGTERM**: Normal termination signal (e.g., from process managers).
- **SIGHUP**: Signal often sent when a controlling terminal is closed or a parent process exits. This is crucial for STDIO transport, as the parent (e.g., an IDE extension) might terminate, and we need the child server process to save its cache before exiting.
- **Normal exit**: `process.exit()` called or the main script finishes.

The `PersistentCache` class implements handlers for all these scenarios to ensure data is properly persisted before the process exits, using synchronous writes during shutdown for maximum reliability.

## Implementation Details

For detailed information about the caching system implementation, see:

- [Caching System Architecture](./architecture/caching-system-architecture.md)
- [Event Store Architecture](./architecture/event-store-architecture.md)

## Benefits of These Improvements

- **Consistent Cache Sharing**: All transports use the same cache storage, improving hit rates
- **Reduced API Calls**: Better caching means fewer calls to external services
- **Improved Performance**: Faster responses for all clients regardless of transport
- **Better Resource Utilization**: Reduced redundant computations and network requests
