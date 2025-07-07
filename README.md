# Google Researcher MCP Server

[![Tests](https://github.com/zoharbabin/google-research-mcp/actions/workflows/test.yml/badge.svg)](https://github.com/zoharbabin/google-research-mcp/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/zoharbabin/google-research-mcp/graph/badge.svg?token=YOUR_CODECOV_TOKEN)](https://codecov.io/gh/zoharbabin/google-research-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> **Empower AI assistants with robust, persistent, and secure web research capabilities.**
>
> This server implements the [Model Context Protocol (MCP)](https://github.com/zoharbabin/google-research-mcp), providing a suite of tools for Google Search, content scraping, and Gemini AI analysis. It's designed for performance and reliability, featuring a persistent caching system, comprehensive timeout handling, and enterprise-grade security.

<img width="499" alt="image" src="https://github.com/user-attachments/assets/e369b537-3043-4f80-b7f2-410512ebc1b4" />

## Table of Contents

- [Why Use This Server?](#why-use-this-server)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation & Setup](#installation--setup)
  - [Running the Server](#running-the-server)
- [Usage](#usage)
  - [Available Tools](#available-tools)
  - [Client Integration](#client-integration)
  - [Management API](#management-api)
- [Security](#security)
  - [OAuth 2.1 Authorization](#oauth-21-authorization)
  - [Available Scopes](#available-scopes)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Why Use This Server?

- **Extend AI Capabilities**: Grant AI assistants access to real-time web information and powerful analytical tools.
- **Maximize Performance**: Drastically reduce latency for repeated queries with a sophisticated two-layer persistent cache (in-memory and disk).
- **Reduce Costs**: Minimize expensive API calls to Google Search and Gemini by caching results.
- **Ensure Reliability**: Prevent failures and ensure consistent performance with comprehensive timeout handling and graceful degradation.
- **Flexible & Secure Integration**: Connect any MCP-compatible client via STDIO or HTTP+SSE, with enterprise-grade OAuth 2.1 for secure API access.
- **Open & Extensible**: MIT licensed, fully open-source, and designed for easy modification and extension.

## Features

- **Core Research Tools**:
  - `google_search`: Find information using the Google Search API.
  - `scrape_page`: Extract content from websites and YouTube videos.
  - `analyze_with_gemini`: Process text using Google's powerful Gemini AI models.
  - `research_topic`: A composite tool that combines search, scraping, and analysis into a single, efficient operation.
- **Advanced Caching System**:
  - **Two-Layer Cache**: Combines a fast in-memory cache for immediate access with a persistent disk-based cache for durability.
  - **Custom Namespaces**: Organizes cached data by tool, preventing collisions and simplifying management.
  - **Manual & Automated Persistence**: Offers both automatic, time-based cache saving and manual persistence via a secure API endpoint.
- **Robust Performance & Reliability**:
  - **Comprehensive Timeouts**: Protects against network issues and slow responses from external APIs.
  - **Graceful Degradation**: Ensures the server remains responsive even if a tool or dependency fails.
  - **Dual Transport Protocols**: Supports both `STDIO` for local process communication and `HTTP+SSE` for web-based clients.
- **Enterprise-Grade Security**:
  - **OAuth 2.1 Protection**: Secures all HTTP endpoints with modern, industry-standard authorization.
  - **Granular Scopes**: Provides fine-grained control over access to tools and administrative functions.
- **Monitoring & Management**:
  - **Administrative API**: Exposes endpoints for monitoring cache statistics, managing the cache, and inspecting the event store.

## System Architecture

The server is built on a layered architecture designed for clarity, separation of concerns, and extensibility.

```mermaid
graph TD
    subgraph "Client"
        A[MCP Client]
    end

    subgraph "Transport Layer"
        B[STDIO]
        C[HTTP-SSE]
    end

    subgraph "Core Logic"
        D{MCP Request Router}
        E[Tool Executor]
    end

    subgraph "Tools"
        F[google_search]
        G[scrape_page]
        H[analyze_with_gemini]
        I[research_topic]
    end

    subgraph "Support Systems"
        J[Persistent Cache]
        K[Event Store]
        L[OAuth Middleware]
    end

    A -- Connects via --> B
    A -- Connects via --> C
    B -- Forwards to --> D
    C -- Forwards to --> D
    D -- Routes to --> E
    E -- Invokes --> F
    E -- Invokes --> G
    E -- Invokes --> H
    E -- Invokes --> I
    F & G & H & I -- Uses --> J
    D -- Uses --> K
    C -- Protected by --> L

    style J fill:#f9f,stroke:#333,stroke-width:2px
    style K fill:#ccf,stroke:#333,stroke-width:2px
    style L fill:#f99,stroke:#333,stroke-width:2px
```

For a more detailed explanation, see the [**Full Architecture Guide**](./docs/architecture/architecture.md).

## Getting Started

### Prerequisites

- **Node.js**: Version 18.0.0 or higher.
- **API Keys**:
  - [Google Custom Search API Key](https://developers.google.com/custom-search/v1/introduction)
  - [Google Custom Search Engine ID](https://programmablesearchengine.google.com/)
  - [Google Gemini API Key](https://ai.google.dev/)
- **OAuth 2.1 Provider** (for HTTP transport): An external authorization server (e.g., Auth0, Okta) to issue JWTs.

### Installation & Setup

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/zoharbabin/google-research-mcp.git
    cd google-researcher-mcp
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    Create a `.env` file by copying the example and filling in your credentials.
    ```bash
    cp .env.example .env
    ```
    Now, open `.env` in your editor and add your API keys and OAuth configuration. See the comments in `.env.example` for detailed explanations of each variable.

### Running the Server

-   **Development Mode**:
    For development with automatic reloading on file changes, use:
    ```bash
    npm run dev
    ```
    This command uses `tsx` to watch for changes and restart the server.

-   **Production Mode**:
    First, build the TypeScript project into JavaScript, then start the server:
    ```bash
    npm run build
    npm start
    ```

Upon successful startup, you will see confirmation that the transports are ready:
```
✅ stdio transport ready
🌐 SSE server listening on http://127.0.0.1:3000/mcp
```

## Usage

### Available Tools

The server provides a suite of powerful tools for research and analysis. Each tool is designed with detailed descriptions and annotations to be easily understood and utilized by AI models.

| Tool | Title | Description & Parameters |
| :--- | :--- | :--- |
| **`google_search`** | **Google Web Search** | **Description:** Searches the web using the Google Custom Search API to find relevant web pages and resources. Ideal for finding current information, discovering authoritative sources, and locating specific documents. Results are cached for 30 minutes.<br><br>**Parameters:**<br> - `query` (string, required): The search query. Use specific, targeted keywords for best results.<br> - `num_results` (number, optional, default: 5): The number of search results to return (1-10). |
| **`scrape_page`** | **Web Page & YouTube Content Extractor** | **Description:** Extracts text content from web pages and YouTube videos. It intelligently filters out noise and can automatically retrieve video transcripts. Results are cached for 1 hour.<br><br>**Parameters:**<br> - `url` (string, required): The URL of the web page or YouTube video to scrape. |
| **`analyze_with_gemini`** | **Gemini AI Text Analysis** | **Description:** Processes and analyzes text content using Google's Gemini AI models. It can summarize, answer questions, and generate insights from provided text. Large texts are automatically truncated. Results are cached for 15 minutes.<br><br>**Parameters:**<br> - `text` (string, required): The text content to analyze.<br> - `model` (string, optional, default: "gemini-2.0-flash-001"): The Gemini model to use (e.g., `gemini-2.0-flash-001`, `gemini-pro`). |
| **`research_topic`** | **Comprehensive Topic Research Workflow** | **Description:** A powerful composite tool that automates the entire research process: it searches for a topic, scrapes the content from multiple sources, and synthesizes the findings with Gemini AI. It's designed for resilience and provides comprehensive analysis.<br><br>**Parameters:**<br> - `query` (string, required): The research topic or question.<br> - `num_results` (number, optional, default: 3): The number of sources to research (recommended: 2-5). |

### Client Integration

#### STDIO Client (Local Process)
Ideal for local tools and CLI applications.

```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/server.js"]
});
const client = new Client({ name: "test-client" });
await client.connect(transport);

const result = await client.callTool({
  name: "google_search",
  arguments: { query: "Model Context Protocol" }
});
console.log(result.content[0].text);
```

#### HTTP+SSE Client (Web Application)
Suitable for web-based clients. Requires a valid OAuth 2.1 Bearer token.

```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// The client MUST obtain a valid OAuth 2.1 Bearer token from your
// configured external Authorization Server before making requests.
const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3000/mcp"),
  {
    getAuthorization: async () => `Bearer YOUR_ACCESS_TOKEN`
  }
);
const client = new Client({ name: "test-client" });
await client.connect(transport);

const result = await client.callTool({
  name: "google_search",
  arguments: { query: "Model Context Protocol" }
});
console.log(result.content[0].text);
```

### Management API

The server provides several administrative endpoints for monitoring and control. Access to these endpoints is protected by OAuth scopes.

| Method | Endpoint                 | Description                             | Required Scope               |
|--------|--------------------------|-----------------------------------------|------------------------------|
| `GET`  | `/mcp/cache-stats`       | View cache performance statistics.      | `mcp:admin:cache:read`       |
| `GET`  | `/mcp/event-store-stats` | View event store usage statistics.      | `mcp:admin:event-store:read` |
| `POST` | `/mcp/cache-invalidate`  | Clear specific cache entries.           | `mcp:admin:cache:invalidate` |
| `POST` | `/mcp/cache-persist`     | Force the cache to be saved to disk.    | `mcp:admin:cache:persist`    |
| `GET`  | `/mcp/oauth-scopes`      | Get documentation for all OAuth scopes. | Public                       |
| `GET`  | `/mcp/oauth-config`      | View the server's OAuth configuration.  | `mcp:admin:config:read`      |
| `GET`  | `/mcp/oauth-token-info`  | View details of the provided token.     | Requires authentication      |

## Security

### OAuth 2.1 Authorization

The server implements OAuth 2.1 authorization for all HTTP-based communication, ensuring that only authenticated and authorized clients can access its capabilities.

- **Protection**: All endpoints under `/mcp/` (except for public documentation endpoints) are protected.
- **Token Validation**: The server validates JWTs (JSON Web Tokens) against the configured JWKS (JSON Web Key Set) URI from your authorization server.
- **Scope Enforcement**: Each tool and administrative action is mapped to a specific OAuth scope, providing granular control over permissions.

For a complete guide on setting up OAuth, see the [**Security Configuration Guide**](./docs/plans/security-improvements-implementation-guide.md).

### Available Scopes

#### Tool Execution Scopes
- `mcp:tool:google_search:execute`
- `mcp:tool:scrape_page:execute`
- `mcp:tool:analyze_with_gemini:execute`
- `mcp:tool:research_topic:execute`

#### Administrative Scopes
- `mcp:admin:cache:read`
- `mcp:admin:cache:invalidate`
- `mcp:admin:cache:persist`
- `mcp:admin:event-store:read`
- `mcp:admin:config:read`

## Testing

The project maintains a high standard of quality through a combination of end-to-end and focused component tests.

| Script                | Description                                                              |
| --------------------- | ------------------------------------------------------------------------ |
| `npm test`            | Runs all focused component tests (`*.spec.ts`) using Jest.               |
| `npm run test:e2e`    | Executes the full end-to-end test suite for both STDIO and SSE transports. |
| `npm run test:coverage` | Generates a detailed code coverage report.                               |

For more details on the testing philosophy and structure, see the [**Testing Guide**](./docs/testing-guide.md).

## Troubleshooting

| Method | Endpoint                 | Description                             | Required Scope               |
|--------|--------------------------|-----------------------------------------|------------------------------|
| `GET`  | `/mcp/cache-stats`       | View cache performance statistics.      | `mcp:admin:cache:read`       |
| `GET`  | `/mcp/event-store-stats` | View event store usage statistics.      | `mcp:admin:event-store:read` |
| `POST` | `/mcp/cache-invalidate`  | Clear specific cache entries.           | `mcp:admin:cache:invalidate` |
| `POST` | `/mcp/cache-persist`     | Force the cache to be saved to disk.    | `mcp:admin:cache:persist`    |
| `GET`  | `/mcp/oauth-scopes`      | Get documentation for all OAuth scopes. | Public                       |
| `GET`  | `/mcp/oauth-config`      | View the server's OAuth configuration.  | `mcp:admin:config:read`      |
| `GET`  | `/mcp/oauth-token-info`  | View details of the provided token.     | Requires authentication      |


## Contributing

We welcome contributions of all kinds! This project is open-source under the MIT license and we believe in the power of community collaboration.

- ⭐ **Star** this repo if you find it useful.
- 🍴 **Fork** it to create your own version.
- 💡 **Report issues** if you find bugs or have suggestions for improvements.
- 🚀 **Submit PRs** for bug fixes, new features, or documentation enhancements.

To contribute code, please follow our [**Contribution Guidelines**](./docs/CONTRIBUTING.md).

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
