# Google Researcher MCP Server: Architecture Guide

This document provides a comprehensive yet accessible overview of the Google Researcher Model Context Protocol (MCP) server architecture. Whether you're new to the project or an experienced developer, this guide will help you understand how the system works and how to extend it.

## Table of Contents

1. [Introduction](#1-introduction)
2. [MCP Fundamentals](#2-mcp-fundamentals)
3. [System Architecture](#3-system-architecture)
4. [Core Components](#4-core-components)
   - [Transport Layer](#transport-layer)
   - [MCP Server Core](#mcp-server-core)
   - [Tools Layer](#tools-layer)
   - [Caching System](#caching-system)
   - [Event Store](#event-store)
   - [Management API](#management-api)
5. [Getting Started](#5-getting-started)
6. [Extending the Server](#6-extending-the-server)
7. [Glossary](#7-glossary)

## 1. Introduction

### What is this Project?

This project implements a [Model Context Protocol (MCP)](https://github.com/google-research/model-context-protocol) server that provides AI assistants with research capabilities. Think of it as a backend service that allows AI models to:

- **Search the web** using Google's Custom Search API
- **Extract content** from websites and YouTube videos
- **Analyze text** using Google's Gemini AI models

Two key features make this server production-ready:

1. **Persistent Caching System**: Stores results of expensive operations (API calls, web scraping) to improve performance and reduce costs.

2. **Persistent Event Store**: Enables reliable session resumption for web clients, ensuring they don't miss messages if their connection drops.

### Who is this Guide For?

- **Newcomers**: If you're new to the project or MCP, this guide will help you understand the core concepts.
- **Developers**: If you need to modify or extend the server, you'll find detailed explanations of each component.
- **DevOps Engineers**: If you're deploying the server, you'll find information on configuration and scaling.

## 2. MCP Fundamentals

Before diving into the specifics, let's understand the basic concepts of the Model Context Protocol.

### What is MCP?

[Model Context Protocol (MCP)](https://github.com/google-research/model-context-protocol) is a specification that allows AI models to interact with external capabilities in a structured way. It defines how AI clients can request actions from servers and receive responses.

### Key Concepts

- **MCP Server**: A backend service that provides capabilities to AI clients. This project is an MCP server.
- **MCP Client**: An AI model or application that uses the server's capabilities. Examples include AI assistants in IDEs like [Roo Code](https://docs.roocode.com/).
- **Transport**: The communication method between client and server. This project supports:
  - **STDIO**: Direct communication via standard input/output (simple, used for local integration)
  - **HTTP+SSE**: Web-based communication with [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) for streaming responses
- **Tools**: Actions the server can perform for clients (e.g., `google_search`, `scrape_page`)
- **Resources**: Data the client can read from the server (e.g., `session_transcripts`)
- **JSON-RPC**: The message format used for communication, following the [JSON-RPC 2.0 specification](https://www.jsonrpc.org/specification)

## 3. System Architecture

The server follows a layered architecture that separates different concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Applications                     │
│   (AI Assistants, Test Scripts, Management Tools, etc.)      │
└───────────────────────────────┬─────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────┐
│                      Transport Layer                         │
│                                                              │
│  ┌─────────────────────┐      ┌───────────────────────────┐ │
│  │   STDIO Transport   │      │   HTTP+SSE Transport      │ │
│  │                     │      │   (Express Server)        │ │
│  └─────────────────────┘      └───────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────┐
│                     MCP Server Core                          │
│                                                              │
│   Handles JSON-RPC parsing, routing, and session management  │
└───────────────────────────────┬─────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────┐
│                       Tools Layer                            │
│                                                              │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────────┐   │
│  │google_search│ │ scrape_page  │ │ analyze_with_gemini │   │
│  └─────────────┘ └──────────────┘ └─────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              research_topic (composite)             │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────────────────────────┬─────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────┐
│                    Support Systems                           │
│                                                              │
│  ┌─────────────────────┐      ┌───────────────────────────┐ │
│  │   Caching System    │      │      Event Store          │ │
│  │   (Performance)     │      │   (Session Resumption)    │ │
│  └─────────────────────┘      └───────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Management API Endpoints               │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────────────────────────┬─────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────┐
│                    External Services                         │
│                                                              │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────────┐   │
│  │Google Search│ │Web Scraping  │ │    Gemini API       │   │
│  │    API      │ │(Crawlee)     │ │                     │   │
│  └─────────────┘ └──────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 4. Core Components

### Transport Layer

The server supports two communication methods:

#### STDIO Transport (`src/server.ts`)

- **What it is**: Communication via standard input/output streams
- **How it works**: The server reads JSON-RPC requests from stdin and writes responses to stdout
- **When to use it**: For local integration where the client runs the server as a child process
- **Key code**:
  ```typescript
  // src/server.ts
  const stdioServer = new McpServer({
    name: "google-researcher-mcp-stdio",
    version: "1.0.0"
  });
  configureToolsAndResources(stdioServer);
  const stdioTransport = new StdioServerTransport();
  await stdioServer.connect(stdioTransport);
  ```

#### HTTP + SSE Transport (`src/server.ts`)

- **What it is**: Communication via HTTP requests and [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- **How it works**: 
  - Uses Express to handle HTTP requests
  - Creates a new session for each client with its own MCP server instance
  - Uses SSE for streaming responses back to clients
  - Supports session resumption via the Event Store
- **When to use it**: For web clients or any client preferring HTTP
- **Key code**:
  ```typescript
  // src/server.ts (simplified)
  app.post("/mcp", async (req, res) => {
    // Check for session ID
    const sidHeader = req.headers["mcp-session-id"];
    let transport = sidHeader ? sessions[sidHeader] : undefined;
    
    // Create new session if needed
    if (!transport && isInitializeRequest(req.body)) {
      const eventStore = new PersistentEventStore({...});
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore
      });
      const sessionServer = new McpServer({...});
      configureToolsAndResources(sessionServer);
      await sessionServer.connect(transport);
    }
    
    // Handle request
    await transport.handleRequest(req, res, req.body);
  });
  ```

### MCP Server Core

- **What it is**: The core implementation of the MCP protocol
- **How it works**:
  - Parses JSON-RPC requests
  - Routes requests to the appropriate tool or resource handler
  - Formats responses according to the JSON-RPC 2.0 specification
- **Key components**:
  - `McpServer` class from `@modelcontextprotocol/sdk/server/mcp.js`
  - Tool registration via `server.tool(name, schema, handler)`
  - Resource registration via `server.resource(name, template, handler)`

### Tools Layer

The server provides several tools for AI clients:

#### `google_search` (`src/server.ts`)

- **What it does**: Searches the web using Google's Custom Search API
- **Parameters**: `query` (string), `num_results` (number, default: 5)
- **Returns**: Array of URLs as text content items
- **Implementation**: Uses `fetch` to call the Google Custom Search API
- **Caching**: Results are cached for 30 minutes with stale-while-revalidate for another 30 minutes

#### `scrape_page` (`src/server.ts`)

- **What it does**: Extracts text content from web pages or YouTube video transcripts
- **Parameters**: `url` (string, must be a valid URL)
- **Returns**: The page content as a text content item
- **Implementation**: 
  - For YouTube URLs: Uses `youtube-transcript` library
  - For other URLs: Uses `CheerioCrawler` from `crawlee` library
- **Caching**: Results are cached for 1 hour with stale-while-revalidate for up to 24 hours

#### `analyze_with_gemini` (`src/server.ts`)

- **What it does**: Analyzes text using Google's Gemini AI models
- **Parameters**: `text` (string), `model` (string, default: "gemini-2.0-flash-001")
- **Returns**: The AI analysis result as a text content item
- **Implementation**: Uses `@google/genai` library
- **Caching**: Results are cached for 15 minutes with stale-while-revalidate for 5 more minutes

#### `research_topic` (Composite Tool) (`src/server.ts`)

- **What it does**: Combines search, scraping, and analysis into a single operation
- **Parameters**: `query` (string), `num_results` (number, default: 3)
- **Implementation**:
  1. Calls `googleSearchFn` to get URLs
  2. Calls `scrapePageFn` for each URL (in parallel)
  3. Combines the scraped content
  4. Calls `analyzeWithGeminiFn` on the combined content
- **Caching**: Leverages the caching of the underlying tools

### Caching System

The caching system (`src/cache/`) is designed to improve performance and reduce costs by storing the results of expensive operations.

> **Detailed Architecture**: For an in-depth look at the caching system, see the [Caching System Architecture](./caching-system-architecture.md) document.
> **Note**: For information about caching behavior across different transport mechanisms, see [Transport-Specific Caching Considerations](../transport-caching-considerations.md).

#### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PersistentCache                          │
│                                                             │
│  ┌─────────────────────┐      ┌───────────────────────────┐ │
│  │   In-Memory Cache   │      │   Namespace Cache         │ │
│  │   (Fast Access)     │      │   (Organized for Disk)    │ │
│  └─────────────────────┘      └───────────────────────────┘ │
│                                                             │
│  ┌─────────────────────┐      ┌───────────────────────────┐ │
│  │ Persistence Manager │      │   Persistence Strategy    │ │
│  │   (Disk I/O)        │      │   (When to Persist)       │ │
│  └─────────────────────┘      └───────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Key Components

1. **Core Cache** (`src/cache/cache.ts`):
   - In-memory storage with TTL expiration
   - LRU (Least Recently Used) eviction
   - Promise coalescing to prevent [cache stampedes](https://en.wikipedia.org/wiki/Cache_stampede)
   - [Stale-while-revalidate](https://web.dev/stale-while-revalidate/) pattern

2. **Persistence Manager** (`src/cache/persistenceManager.ts`):
   - Handles saving/loading cache entries to/from disk
   - Uses atomic writes to prevent data corruption
   - Organizes entries by namespace

3. **Persistence Strategies** (`src/cache/persistenceStrategies.ts`):
   - Define when to persist cache entries
   - Options include periodic, write-through, on-shutdown, or hybrid

4. **Persistent Cache** (`src/cache/persistentCache.ts`):
   - Main class that orchestrates the other components
   - Provides the `getOrCompute` method used by tools
   - Handles graceful shutdown persistence

#### How It Works

1. Tool calls `globalCache.getOrCompute(namespace, args, computeFn, options)`
2. Cache checks if the result is already in memory or on disk
3. If found and not expired, returns the cached result
4. If found but stale (and stale-while-revalidate enabled), returns the stale result and triggers a background refresh
5. If not found or expired, executes the `computeFn` to get a fresh result
6. Stores the result in memory and (based on the persistence strategy) on disk
7. Returns the result to the tool

### Event Store

The Event Store (`src/shared/`) enables session resumption for clients using the HTTP+SSE transport.

> **Detailed Architecture**: For an in-depth look at the event store, see the [Event Store Architecture](./event-store-architecture.md) document.

#### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   PersistentEventStore                      │
│                                                             │
│  ┌─────────────────────┐      ┌───────────────────────────┐ │
│  │   In-Memory Store   │      │   Event Persistence Mgr   │ │
│  │   (Fast Access)     │      │   (Disk I/O)              │ │
│  └─────────────────────┘      └───────────────────────────┘ │
│                                                             │
│  ┌─────────────────────┐      ┌───────────────────────────┐ │
│  │ Event Encryption    │      │   Access Control & Audit  │ │
│  │   (Optional)        │      │   (Optional)              │ │
│  └─────────────────────┘      └───────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Key Components

1. **Persistent Event Store** (`src/shared/persistentEventStore.ts`):
   - Implements the `EventStore` interface required by the SSE transport
   - Manages in-memory storage of events
   - Handles event limits, TTL, encryption, access control

2. **Event Persistence Manager** (`src/shared/eventPersistenceManager.ts`):
   - Handles saving/loading events to/from disk
   - Uses atomic writes to prevent data corruption
   - Organizes events by stream ID (session ID)

3. **Event Store Encryption** (`src/shared/eventStoreEncryption.ts`):
   - Optional encryption for events stored on disk
   - Uses AES-256-GCM encryption
   - Includes message sanitization to remove sensitive data

#### How It Works

1. **Storing Events**:
   - When the server sends a message to a client, it calls `eventStore.storeEvent(streamId, message)`
   - The event is stored in memory and (based on configuration) on disk
   - A unique event ID is generated and returned

2. **Replaying Events**:
   - When a client reconnects, it provides the ID of the last event it received
   - The server calls `eventStore.replayEventsAfter(lastEventId, options)`
   - The Event Store finds all events for that session that occurred after the last event
   - These events are sent to the client, allowing it to catch up on missed messages

### Management API

The server provides HTTP endpoints for monitoring and managing the cache and event store:

- `GET /mcp/cache-stats`: Returns cache statistics (size, hits, misses, etc.)
- `GET /mcp/event-store-stats`: Returns event store statistics
- `POST /mcp/cache-invalidate`: Invalidates specific cache entries or clears the entire cache
- `POST /mcp/cache-persist` / `GET /mcp/cache-persist`: Forces immediate persistence of cache entries

## 5. Getting Started

### Prerequisites

- **Node.js**: Version 18 or later
- **API Keys**:
  - [Google Custom Search API key](https://developers.google.com/custom-search/v1/introduction)
  - [Google Custom Search Engine ID](https://programmablesearchengine.google.com/)
  - [Google Gemini API key](https://ai.google.dev/)

### Installation

1. Clone the repository and install dependencies:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   npm install
   ```

2. Set up environment variables:
   - Copy `.env.example` to `.env`.
   - Fill in your API keys and other required values in the `.env` file.
   ```bash
   # Example (do not commit your actual .env file!)
   GOOGLE_CUSTOM_SEARCH_API_KEY="your-key"
   GOOGLE_CUSTOM_SEARCH_ID="your-id"
   GOOGLE_GEMINI_API_KEY="your-key"
   ```

3. Build the project:
   ```bash
   npx tsc
   ```

4. Run the server:
   ```bash
   node dist/server.js
   ```

5. Test the server:
   ```bash
   # Test STDIO transport
   node e2e_stdio_mcp_client_test.mjs
   
   # Test SSE transport
   node e2e_sse_mcp_client_test.mjs
   
   # Or run both tests with npm
   npm run test:e2e
   ```

## 6. Extending the Server

### Adding a New Tool

1. Define your tool's logic in `src/server.ts` or a separate module:
   ```typescript
   const myNewToolFn = async ({ param1, param2 }) => {
     // Your logic here
     // Use globalCache.getOrCompute to cache the result of expensive operations
     return globalCache.getOrCompute(
       'myNewTool', // Unique namespace for this tool's cache
       { param1, param2 }, // Arguments that define the specific request
       async () => { // Function to compute the result if not cached
         // Expensive operation (e.g., API call, complex calculation) here
         const result = `Computed result for ${param1}, ${param2}`;
         return [{ type: "text", text: result }];
       },
       { ttl: 15 * 60 * 1000 } // Cache options (e.g., time-to-live)
     );
   };
   ```

2. Register your tool in the `configureToolsAndResources` function:
   ```typescript
   server.tool(
     "my_new_tool",
     { param1: z.string(), param2: z.number().default(10) },
     async ({ param1, param2 }) => ({ content: await myNewToolFn({ param1, param2 }) })
   );
   ```

### Modifying the Caching System

- **Change Cache Parameters**: Modify the `PersistentCache` constructor options in `src/server.ts`:
  ```typescript
  const globalCache = new PersistentCache({
    defaultTTL: 10 * 60 * 1000, // 10 minutes default TTL
    maxSize: 2000, // Maximum 2000 entries
    persistenceStrategy: new WriteThroughPersistenceStrategy()
  });
  ```

- **Use a Different Storage Backend**: Create a new class implementing `IPersistenceManager` and update the `PersistentCache` constructor.

### Improving the Event Store

- **Implement Access Control**: Provide an `authorizer` function in the `PersistentEventStore` options:
  ```typescript
  const eventStore = new PersistentEventStore({
    // ...other options
    accessControl: {
      enabled: true,
      authorizer: async (streamId, userId) => {
        // Check if userId has access to streamId
        return true; // or false
      }
    }
  });
  ```

- **Use a Different Storage Backend**: Create a new implementation of the event persistence logic using a database or message queue instead of the filesystem.

### Deployment Considerations

- **Environment Variables**: Use secure methods for managing API keys
- **Process Management**: Use tools like [PM2](https://pm2.keymetrics.io/) to run the server as a service
- **Containerization**: Use [Docker](https://www.docker.com/) for consistent deployment
- **Scaling**: For horizontal scaling, implement shared backends for the cache and event store

## 7. Glossary

- **MCP**: Model Context Protocol - A specification for AI models to interact with external capabilities
- **Tool**: An action that an MCP server can perform for a client (e.g., `google_search`)
- **Resource**: Data that an MCP client can read from a server (e.g., `session_transcripts`)
- **Transport**: The communication method between client and server (STDIO or HTTP+SSE)
- **SSE**: Server-Sent Events - A technology for streaming updates from server to client
- **TTL**: Time-To-Live - How long a cache entry remains valid
- **LRU**: Least Recently Used - An eviction policy that removes the least recently accessed entries
- **Stale-While-Revalidate**: A pattern that serves stale content while refreshing it in the background
- **Cache Stampede**: When multiple requests for the same uncached key arrive simultaneously
- **Atomic Write**: A technique to prevent data corruption by writing to a temporary file first
