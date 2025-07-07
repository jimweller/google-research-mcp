# Architecture Guide: Google Researcher MCP Server

This document provides a comprehensive overview of the Google Researcher MCP Server's architecture. It's intended for developers, system administrators, and anyone interested in understanding how the server is built, how it operates, and how to extend it.

## Table of Contents

1.  [**High-Level Overview**](#high-level-overview)
2.  [**Core Architectural Principles**](#core-architectural-principles)
3.  [**System Architecture Diagram**](#system-architecture-diagram)
4.  [**Component Deep-Dive**](#component-deep-dive)
    -   [Transport Layer (STDIO & HTTP/SSE)](#transport-layer)
    -   [Security Layer (OAuth 2.1)](#security-layer)
    -   [MCP Core (Request Handling)](#mcp-core)
    -   [Tools Layer (Capabilities)](#tools-layer)
    -   [Caching System](#caching-system)
    -   [Event Store](#event-store)
5.  [**Data and Control Flow**](#data-and-control-flow)
6.  [**Extensibility and Customization**](#extensibility-and-customization)
7.  [**Deployment and Scaling**](#deployment-and-scaling)

---

## High-Level Overview

The Google Researcher MCP Server is a backend service that implements the [Model Context Protocol (MCP)](https://github.com/zoharbabin/google-research-mcp). Its primary purpose is to empower AI assistants and other clients with a powerful suite of research-oriented tools:

-   **`google_search`**: Executes queries against the Google Search API.
-   **`scrape_page`**: Extracts text content from web pages and YouTube videos.
-   **`analyze_with_gemini`**: Performs advanced text analysis using Google's Gemini models.
-   **`research_topic`**: A composite tool that orchestrates the other three for a complete research workflow.

To deliver these capabilities reliably and efficiently, the server is built with production-grade features, including a two-layer persistent cache, robust timeout and error handling, and enterprise-grade security for its web-facing endpoints.

## Core Architectural Principles

-   **Separation of Concerns**: Each component has a distinct responsibility, from transport handling to tool execution. This makes the system easier to understand, maintain, and extend.
-   **Modularity and Extensibility**: The server is designed to be easily extended with new tools, caching strategies, or even transport methods.
-   **Performance and Efficiency**: A sophisticated caching system minimizes latency and reduces reliance on expensive external API calls.
-   **Reliability and Resilience**: Comprehensive timeout handling and graceful degradation ensure the server remains stable and responsive, even when external services are slow or fail.
-   **Security by Default**: All web-facing endpoints are protected by an industry-standard OAuth 2.1 authorization layer.

## System Architecture Diagram

The server employs a layered architecture that clearly defines the flow of data and control from the client to the external services.

```mermaid
graph TD
    subgraph "Clients"
        A[MCP Client (CLI/Web/IDE)]
    end

    subgraph "Transport & Security"
        B[STDIO Transport]
        C[HTTP/SSE Transport]
        L[OAuth 2.1 Middleware]
    end

    subgraph "Core Application"
        D{MCP Request Router}
        E[Tool Executor]
        J[Persistent Cache]
        K[Persistent Event Store]
    end

    subgraph "Tools"
        F[google_search]
        G[scrape_page]
        H[analyze_with_gemini]
        I[research_topic]
    end

    subgraph "External Services"
        M[Google Search API]
        N[Web Pages / YouTube]
        O[Google Gemini API]
    end

    A -- Connects via --> B
    A -- Connects via --> C

    C -- Protected by --> L
    L -- Forwards valid requests to --> D
    B -- Forwards to --> D

    D -- Routes to --> E
    E -- Invokes --> F
    E -- Invokes --> G
    E -- Invokes --> H
    E -- Invokes --> I

    F -- Calls --> M
    G -- Calls --> N
    H -- Calls --> O

    F & G & H & I -- Use for caching --> J
    D -- Uses for session resumption --> K

    style J fill:#e6f2ff,stroke:#333,stroke-width:2px
    style K fill:#e6ffe6,stroke:#333,stroke-width:2px
    style L fill:#ffebcc,stroke:#333,stroke-width:2px
```

## Component Deep-Dive

### Transport Layer

The server supports two distinct communication protocols to accommodate different client environments.

#### STDIO Transport
-   **File**: [`src/server.ts`](../src/server.ts)
-   **Description**: A simple, direct communication channel using standard input and output. The client runs the server as a child process and communicates over its `stdin` and `stdout` streams.
-   **Use Case**: Ideal for local integrations, such as CLI tools or IDE extensions (e.g., Roo Code) running on the same machine.
-   **Security**: Inherits the security context of the parent process; no additional authentication is applied.

#### HTTP/SSE Transport
-   **File**: [`src/server.ts`](../src/server.ts)
-   **Description**: A web-based transport using an Express.js server. It accepts POST requests at the `/mcp` endpoint and streams responses back using [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events).
-   **Use Case**: For web applications and remote clients that communicate over a network.
-   **Features**: Supports session management and reliable message delivery via the [Persistent Event Store](#event-store).

### Security Layer

-   **File**: [`src/shared/oauthMiddleware.ts`](../src/shared/oauthMiddleware.ts)
-   **Description**: All HTTP-based endpoints (both for MCP and management) are protected by an OAuth 2.1 authorization layer. This middleware intercepts incoming requests and validates the `Authorization: Bearer <token>` header.
-   **Process**:
    1.  Extracts the JWT from the header.
    2.  Fetches the JSON Web Key Set (JWKS) from the configured authorization server's URL.
    3.  Verifies the token's signature against the appropriate public key.
    4.  Validates standard claims (issuer, audience, expiration).
    5.  Attaches the decoded token payload to the request object for downstream use.
-   **Scope Enforcement**: A secondary middleware, `requireScopes`, ensures that the validated token contains the specific permissions (scopes) required for the requested tool or management action.

For a complete guide on configuration, see the [**Security Implementation Guide**](../docs/plans/security-improvements-implementation-guide.md).

### MCP Core

-   **Library**: `@modelcontextprotocol/sdk`
-   **Description**: The heart of the server, responsible for implementing the MCP specification. It parses incoming JSON-RPC 2.0 requests, routes them to the appropriate registered tool handler, and formats the responses.

### Tools Layer

-   **File**: [`src/server.ts`](../src/server.ts)
-   **Description**: This layer contains the concrete implementation of the server's capabilities. Each tool is registered with the MCP Core and is responsible for a specific action. All tools are designed to be stateless and rely on the caching system for performance.
-   **Timeout Handling**: Each tool that interacts with an external network has a built-in timeout to prevent it from hanging indefinitely. This is a critical component of the server's reliability.

### Caching System

-   **Directory**: [`src/cache/`](../src/cache/)
-   **Description**: A two-layer caching system designed to minimize latency and reduce API costs.
    -   **Layer 1: In-Memory Cache**: A fast, in-memory LRU cache for immediate access to frequently used data.
    -   **Layer 2: Disk-Based Persistent Cache**: A file-system-based cache that persists data across server restarts.
-   **Key Features**:
    -   **Namespaces**: Caches for different tools are kept separate.
    -   **Stale-While-Revalidate**: Can return stale data instantly while fetching a fresh version in the background.
    -   **Promise Coalescing**: Prevents "cache stampede" by ensuring that for a given cache key, the underlying computation is only executed once.
-   **Further Reading**: [**Caching System Architecture**](./caching-system-architecture.md)

### Event Store

-   **Directory**: [`src/shared/`](../src/shared/)
-   **Description**: The event store is crucial for the reliability of the HTTP/SSE transport. It records every message sent from the server to a client. If a client disconnects and later reconnects, the event store can "replay" any missed messages, ensuring a seamless user experience.
-   **Key Features**:
    -   **Persistence**: Like the cache, it persists events to disk.
    -   **Stream-Based**: Events are organized by session ID.
    -   **Security**: Includes optional hooks for event encryption and access control.
-   **Further Reading**: [**Event Store Architecture**](./event-store-architecture.md)

## Data and Control Flow

1.  A **Client** establishes a connection via either **STDIO** or **HTTP/SSE**.
2.  For HTTP, the **OAuth Middleware** validates the client's Bearer token.
3.  The client sends a **JSON-RPC request** to call a tool (e.g., `google_search`).
4.  The **MCP Request Router** receives the request and passes it to the **Tool Executor**.
5.  The **Tool Executor** invokes the `google_search` function.
6.  The function first checks the **Persistent Cache** for a valid, non-expired result for the given query.
7.  If a valid result is found, it's returned immediately.
8.  If not, the tool calls the external **Google Search API**.
9.  The result is stored in the **Persistent Cache** and then returned to the client.
10. For SSE clients, the response is also recorded in the **Persistent Event Store**.

## Extensibility and Customization

### Adding a New Tool
1.  **Implement the Logic**: Write a function that performs the desired action.
2.  **Integrate Caching**: Wrap the core logic with `globalCache.getOrCompute()` to ensure it's performant.
3.  **Register the Tool**: In `configureToolsAndResources`, call `server.tool()` with the tool's name, its Zod schema for input validation, and the handler function.
4.  **(HTTP only) Add a Scope**: Define a new OAuth scope for your tool in `src/shared/oauthScopes.ts` and protect its execution with `requireScopes`.

### Swapping Backends
The `PersistenceManager` for both the cache and event store can be replaced with custom implementations (e.g., to use a Redis or database backend instead of the filesystem) by creating a new class that conforms to the `IPersistenceManager` interface.

## Deployment and Scaling

-   **Configuration**: All critical parameters (API keys, cache settings, OAuth details) are configured via environment variables. See `.env.example` for a complete list.
-   **Process Management**: For production, it is recommended to use a process manager like [PM2](https://pm2.keymetrics.io/) to handle automatic restarts and logging.
-   **Containerization**: A `Dockerfile` can be used to package the server for consistent deployment in containerized environments like Docker or Kubernetes.
-   **Scaling**: For horizontal scaling (running multiple instances of the server), the default file-system-based cache and event store must be replaced with a shared backend (e.g., Redis, a shared file system) to ensure data consistency across all instances.
