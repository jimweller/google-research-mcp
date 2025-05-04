# Google Researcher MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> Empower AI assistants with web research capabilities through Google Search, content scraping, and Gemini AI analysis.

This server implements the [Model Context Protocol (MCP)](https://github.com/google-research/model-context-protocol), allowing AI clients to perform research tasks with persistent caching for improved performance and reduced API costs.

## Quick Start

```bash
# Clone and install
git clone <repository-url>
cd <repository-directory>
npm install

# Configure environment variables (copy .env.example to .env and fill in)
cp .env.example .env
# (Edit .env with your API keys)

# Run in development mode (auto-reloads on changes)
npm run dev

# Or build and run for production
# npm run build
# npm start
```

## Table of Contents

- [Features](#features)
- [Why Use This?](#why-use-this)
- [Installation](#installation)
- [Usage](#usage)
- [Architecture](#architecture)
- [Client Integration](#client-integration)
- [Tests](#tests)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Research Tools**
  - `google_search`: Find information via Google Search API
  - `scrape_page`: Extract content from websites and YouTube videos
  - `analyze_with_gemini`: Process text using Google's Gemini AI
  - `research_topic`: Combine search, scraping, and analysis in one operation

- **Performance & Reliability**
  - Persistent caching system (memory + disk)
  - Session resumption for web clients
  - Multiple transport options (STDIO, HTTP+SSE)
  - Management API endpoints for monitoring and control

## Why Use This?

- **Extend AI Capabilities**: Give AI assistants access to real-time web information
- **Save Money**: Reduce API calls through sophisticated caching
- **Improve Performance**: Get faster responses for repeated queries
- **Flexible Integration**: Works with any MCP-compatible client
- **Open Source**: MIT licensed, free to use and modify

## Installation

### Requirements

- Node.js v18+
- API Keys:
  - [Google Custom Search API key](https://developers.google.com/custom-search/v1/introduction)
  - [Google Custom Search Engine ID](https://programmablesearchengine.google.com/)
  - [Google Gemini API key](https://ai.google.dev/)

### Setup

1. **Clone and install:**
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   npm install
   ```

2. **Configure environment:**
   
   Copy the example environment file and fill in your API keys:
   ```bash
   cp .env.example .env
   # Now edit the .env file with your actual keys
   ```
   The server automatically loads variables from the `.env` file if it exists. See `.env.example` for details on required and optional variables.

3. **Run the server:**

   *   **Development:** For development with automatic reloading on file changes:
       ```bash
       npm run dev
       ```
   *   **Production:** Build the project and run the compiled JavaScript:
       ```bash
       npm run build
       npm start
       ```

4. **Verify:**
   The server should show:
   ```
   ✅ stdio transport ready
   🌐 SSE server listening on http://127.0.0.1:3000/mcp
   ```

## Usage

### Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `google_search` | Search the web | `query` (string), `num_results` (number, default: 5) |
| `scrape_page` | Extract content from URLs | `url` (string) |
| `analyze_with_gemini` | Process text with AI | `text` (string), `model` (string, default: "gemini-2.0-flash-001") |
| `research_topic` | Combined research workflow | `query` (string), `num_results` (number, default: 3) |

### Management Endpoints

- `GET /mcp/cache-stats`: View cache statistics
- `GET /mcp/event-store-stats`: View event store statistics
- `POST /mcp/cache-invalidate`: Clear cache entries (requires API key)
- `POST /mcp/cache-persist`: Force cache persistence

## Architecture

The server uses a layered architecture with:

1. **Transport Layer**: STDIO and HTTP+SSE communication
2. **MCP Core**: Request handling and routing
3. **Tools Layer**: Research capabilities implementation
4. **Support Systems**: Caching and event store

For detailed information, see the [Architecture Guide](./docs/architecture/architecture.md).

## Client Integration

### STDIO Client (Direct Process)

```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Create client
const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/server.js"]
});
const client = new Client({ name: "test-client" });
await client.connect(transport);

// Call a tool
const result = await client.callTool({
  name: "google_search",
  arguments: { query: "MCP protocol" }
});
console.log(result.content[0].text);
```

### HTTP+SSE Client (Web)

```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Create client
const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3000/mcp")
);
const client = new Client({ name: "test-client" });
await client.connect(transport);

// Call a tool
const result = await client.callTool({
  name: "google_search",
  arguments: { query: "MCP protocol" }
});
console.log(result.content[0].text);
```

### Using with Roo Code

[Roo Code](https://docs.roocode.com/) (VS Code extension) can use this server directly:

1. Enable MCP Servers in Roo Code settings
2. Create `.roo/mcp.json` in your project:
  ```json
   {
    "mcpServers": {
      "google-researcher-mcp": {
        "command": "node",
        "args": ["~/Documents/Cline/MCP/google-researcher-mcp/dist/server.js"],
        "cwd": "~/Documents/Cline/MCP/google-researcher-mcp/dist/",
        "env": {
          "GOOGLE_CUSTOM_SEARCH_API_KEY": "${env:GOOGLE_CUSTOM_SEARCH_API_KEY}",
          "GOOGLE_CUSTOM_SEARCH_ID": "${env:GOOGLE_CUSTOM_SEARCH_ID}",
          "GOOGLE_GEMINI_API_KEY": "${env:GOOGLE_GEMINI_API_KEY}"
        },
        "alwaysAllow": [
          "google_search",
          "scrape_page",
          "analyze_with_gemini",
          "research_topic"
        ],
        "disabled": false
      }
    }
  }
  ```  
3. Start the server and use Roo Code to ask research questions

## Tests

The project uses a focused testing approach that combines end-to-end validation with targeted unit/integration tests.

### Test Scripts

| Script | Description |
|--------|-------------|
| `npm test` | Runs Jest tests for internal components |
| `npm run test:e2e` | Runs both STDIO and SSE end-to-end tests |
| `npm run test:e2e:stdio` | Runs only the STDIO end-to-end test |
| `npm run test:e2e:sse` | Runs only the SSE end-to-end test |
| `npm run test:coverage` | Generates detailed coverage reports |

### Testing Approach

Our testing strategy has two main components:

1. **End-to-End Tests**: Validate the server's overall functionality through its MCP interface:
   - `e2e_stdio_mcp_client_test.mjs`: Tests the server using STDIO transport
   - `e2e_sse_mcp_client_test.mjs`: Tests the server using HTTP+SSE transport

2. **Focused Component Tests**: Jest tests for the stateful logic unique to this server:
   - **Cache System**: Unit and integration tests for the in-memory cache, persistence manager, and persistence strategies
   - **Event Store**: Unit and integration tests for the event store and event persistence manager

This approach provides comprehensive validation while keeping tests simple, focused, and fast.

## Contributing

We welcome contributions! This project is open source under the MIT license.

- **Star** this repo if you find it useful
- **Fork** it to create your own version
- **Submit PRs** for bug fixes or new features
- **Report issues** if you find bugs or have suggestions

To contribute code:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
