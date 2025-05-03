# Event Store Architecture for MCP Server

This document explains the Event Store architecture used in this Model Context Protocol (MCP) server project. It's designed for developers new to the project or the concept of event stores.

## What is an Event Store and Why Do We Need It?

Imagine you're using a web application, and your internet connection drops briefly. When it reconnects, wouldn't it be great if the application picked up exactly where you left off, without losing any data or context? That's where an Event Store comes in, specifically for our server's **Server-Sent Events (SSE)** communication method.

*   **Server-Sent Events (SSE):** A technology allowing a server to push updates to a client over a single HTTP connection. Think of it like a one-way notification stream from the server. [Learn more about SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events).
*   **Event Store:** In our context, the Event Store is like a short-term memory for the server. When the server sends messages (events) to a client via SSE, it also saves a copy of these events in the Event Store.
*   **Session Resumability:** If the client disconnects and then reconnects (providing the ID of the last event it received), the server can look up that event in the Event Store and "replay" all the events that happened *after* it. This allows the client to seamlessly resume its session.

## Our Implementation: `PersistentEventStore`

While a simple in-memory store works for basic cases, it loses all data if the server restarts. For a robust, production-ready solution, we implemented the `PersistentEventStore`.

**Key Goals:**

*   **Durability:** Events survive server restarts.
*   **Reliability:** Sessions can be reliably resumed.
*   **Scalability:** Prevents the server from running out of memory due to too many stored events.
*   **Security:** Protects potentially sensitive event data.
*   **Observability:** Allows monitoring the store's health and performance.

**Core Components:**

1.  **`PersistentEventStore` (`src/shared/persistentEventStore.ts`):**
    *   The main class implementing the `EventStore` interface required by the MCP SDK.
    *   Manages an in-memory cache (`Map`) for fast access to recent events.
    *   Coordinates with the `EventPersistenceManager` to save and load events from disk.
    *   Handles event limits, expiration (TTL), encryption, access control, and audit logging.
    *   Provides methods like `storeEvent` (saves an event) and `replayEventsAfter` (resends missed events).

2.  **`EventPersistenceManager` (`src/shared/eventPersistenceManager.ts`):**
    *   Responsible for the low-level details of writing events to and reading events from the file system.
    *   Organizes events into directories based on their `streamId` (session ID).
    *   Writes each event as a separate JSON file (e.g., `storage/event_store/<streamId>/<eventId>.json`).
    *   Uses atomic writes (writing to a temporary file first) to prevent data corruption.
    *   Handles periodic saving of the in-memory cache to disk.

3.  **`EventStoreEncryption` (`src/shared/eventStoreEncryption.ts`):**
    *   Provides optional encryption for event data before it's written to disk.
    *   Uses `aes-256-gcm` by default, a standard strong encryption algorithm. [Learn about AES-GCM](https://en.wikipedia.org/wiki/Galois/Counter_Mode).
    *   Requires a secure `keyProvider` function to supply the encryption key (keys should *never* be hardcoded!).

4.  **Type Definitions (`src/shared/types/eventStore.ts`):**
    *   Defines the structure of data and configuration options (like `EventData`, `PersistentEventStoreOptions`, `EncryptionOptions`).

**How it Works (Simplified Flow):**

1.  **Store Event:**
    *   Client sends a request, server processes it.
    *   Server sends a response message (event) back to the client via SSE.
    *   `PersistentEventStore.storeEvent` is called:
    *   A unique `eventId` is generated in the format `streamId_timestamp_randomString`. This format allows chronological sorting.
    *   The message is optionally sanitized (sensitive data removed) and encrypted.
    *   The `EventData` (streamId, timestamp, message, metadata) is stored in the in-memory `Map`.
        *   Limits (max events per stream, max total events) are checked, and old events are removed if necessary.
        *   If the stream is marked as "critical" or if it's time for periodic persistence, `EventPersistenceManager` writes the event to a JSON file on disk (`storage/event_store/...`).
        *   An audit log event might be recorded.
    *   The `eventId` is returned.

2.  **Replay Events (Client Reconnects):**
    *   Client reconnects, providing the `lastEventId` it received before disconnecting.
    *   `PersistentEventStore.replayEventsAfter` is called:
        *   Checks if the user has permission for this stream (if access control is enabled).
        *   Tries to find `lastEventId` in the in-memory `Map`.
        *   If not found in memory, asks `EventPersistenceManager` to load it from disk.
        *   If `lastEventId` is found (in memory or disk):
        *   Finds all subsequent events for that `streamId` in memory, sorting them chronologically by timestamp.
        *   Decrypts each subsequent event message (if needed).
        *   Sends the decrypted messages back to the client using the provided `send` function.
        *   An audit log event might be recorded.

**Key Features Explained:**

*   **Persistence:** Events are saved to files in the `storage/event_store/` directory. This allows session resumption even after the server restarts. The `EventPersistenceManager` handles writing and reading these files.
*   **Event Limits (`maxEventsPerStream`, `maxTotalEvents`):** Prevents the store from using too much memory or disk space by automatically removing the oldest events when limits are exceeded. Configured in `src/server.ts`.
*   **Event TTL (`eventTTL`):** Automatically removes events older than a configured duration (e.g., 24 hours), keeping the store tidy. Managed by `PersistentEventStore.cleanup`.
*   **Encryption (`encryption` options):** Protects event data stored on disk. Requires careful key management. Implemented in `EventStoreEncryption`.
*   **Access Control (`accessControl` options):** Ensures users can only replay events from streams they are authorized to access. Useful in multi-tenant setups. Checked in `PersistentEventStore.replayEventsAfter`.
*   **Audit Logging (`auditLog` options):** Records significant actions (storing, replaying, deleting events) for security and compliance. Handled within `PersistentEventStore` methods.
*   **Data Sanitization (`sanitizeMessage` in `src/shared/eventStoreEncryption.ts`):** Removes potentially sensitive information (like passwords or API keys) from messages *before* they are stored or encrypted.

## Integration into the Server

The `PersistentEventStore` is configured and integrated within the HTTP+SSE transport setup in `src/server.ts`:

```typescript
// src/server.ts (Simplified)

import { PersistentEventStore } from "./shared/persistentEventStore.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Inside the /mcp POST endpoint handler for new sessions

const eventStore = new PersistentEventStore({
    storagePath: path.join(process.cwd(), 'storage', 'event_store'), // Where to save files
    maxEventsPerStream: 1000,        // Limit per session
    eventTTL: 24 * 60 * 60 * 1000,   // Expire after 24 hours
    persistenceInterval: 5 * 60 * 1000, // Save to disk every 5 mins
    eagerLoading: true,              // Load existing events on startup
    // encryption: { enabled: true, ... }, // Optional encryption config
    // accessControl: { enabled: true, ... }, // Optional access control config
    // auditLog: { enabled: true, ... }, // Optional audit log config
});

const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    eventStore, // Pass the configured store to the transport
    onsessioninitialized: (sid) => {
        // Keep track of active sessions
    }
});

// Connect transport to an McpServer instance
```

The server also includes a **graceful shutdown** handler (`process.on('SIGINT', ...)` in `src/server.ts`) which ensures that the `eventStore.dispose()` method is called. This method triggers a final persistence of all in-memory events to disk before the server exits, preventing data loss.

## Monitoring

You can check the status and performance of the event store by accessing the `/mcp/event-store-stats` endpoint on the running server.

---

This architecture provides a robust and reliable way to handle session resumability for SSE clients, balancing performance (in-memory cache) with durability (disk persistence) and security.