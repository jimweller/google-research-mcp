// e2e_combined_test.mjs
import assert from "assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * Combined test for all MCP functionality
 */
class CombinedTest {
  constructor(transportType, clientName) {
    this.transportType = transportType;
    this.clientName = clientName;
    this.client = null;
    this.transport = null;
  }

  /**
   * Check required environment variables
   */
  checkEnvironmentVariables() {
    for (const k of [
      "GOOGLE_CUSTOM_SEARCH_API_KEY",
      "GOOGLE_CUSTOM_SEARCH_ID",
      "GOOGLE_GEMINI_API_KEY"
    ]) {
      if (!process.env[k]) {
        console.error(`❌ Missing env ${k}`);
        process.exit(1);
      }
    }
    console.log("✅ All required env vars are set");
  }

  /**
   * Connect to the MCP server using the provided transport
   */
  async connect(transport) {
    this.transport = transport;
    this.client = new Client({ name: this.clientName, version: "1.0.0" });
    await this.client.connect(this.transport);
    console.log(`✅ Connected over ${this.transportType}!`);
  }

  /**
   * List and verify available tools
   */
  async listTools() {
    const { tools } = await this.client.listTools();
    assert.deepStrictEqual(
      tools.map((t) => t.name).sort(),
      ["google_search", "scrape_page", "analyze_with_gemini", "research_topic"].sort()
    );
    console.log("✨ tools/list OK");
  }

  /**
   * Test Google search functionality
   */
  async testGoogleSearch() {
    const {
      content: [{ text: url }]
    } = await this.client.callTool({
      name: "google_search",
      arguments: { query: "example.com", num_results: 1 }
    });
    assert(url.startsWith("http"));
    console.log("✨ google_search OK:", url);
    return url;
  }

  /**
   * Test page scraping functionality
   */
  async testScrapePage(url) {
    const {
      content: [{ text: scraped }]
    } = await this.client.callTool({
      name: "scrape_page",
      arguments: { url }
    });
    assert(scraped.length > 50);
    console.log("✨ scrape_page OK");
    return scraped;
  }

  /**
   * Test Gemini analysis functionality
   */
  async testAnalyzeWithGemini() {
    const {
      content: [{ text: analysis }]
    } = await this.client.callTool({
      name: "analyze_with_gemini",
      arguments: { text: "AI is transforming the world." }
    });
    assert(analysis.length > 0);
    console.log("✨ analyze_with_gemini OK");
    return analysis;
  }

  /**
   * Test batch requests with multiple operations
   */
  async testBatchRequests() {
    console.log("Testing batch requests with multiple operations...");
    
    // Create a batch of requests
    const results = await Promise.all([
      this.client.callTool({
        name: "google_search",
        arguments: { query: "example.com", num_results: 1 }
      }),
      this.client.callTool({
        name: "analyze_with_gemini",
        arguments: { text: "AI is transforming the world." }
      })
    ]);
    
    // Verify results
    assert(results.length === 2, "Should receive 2 results");
    
    // Check that we got some content back from both requests
    assert(results[0].content && results[0].content.length > 0, "First result should have content");
    assert(results[1].content && results[1].content.length > 0, "Second result should have content");
    
    console.log("First result content:", results[0].content);
    console.log("Second result content:", results[1].content);
    
    console.log("✨ Batch requests with multiple operations OK");
  }

  /**
   * Clean up resources before exiting
   */
  async cleanup() {
    if (this.transport && typeof this.transport.close === 'function') {
      await this.transport.close();
      console.log("✅ Transport closed properly");
    } else {
      console.log("⚠️ No close method found on transport");
    }

    // Allow any remaining operations to complete before exiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    this.checkEnvironmentVariables();
    
    await this.listTools();
    const url = await this.testGoogleSearch();
    await this.testScrapePage(url);
    await this.testAnalyzeWithGemini();
    await this.testBatchRequests();
    
    console.log(`🎉 All ${this.transportType}-based end-to-end tests passed!`);
  }
}

// Create and run the combined test
const combinedTest = new CombinedTest("SSE", "mcp-combined-test");

// Create the transport with a longer timeout
const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3000/mcp"),
  { timeout: 30000 } // 30 seconds timeout
);

try {
  // Connect to the server
  try {
    console.log("Connecting to MCP server at http://localhost:3000/mcp...");
    await combinedTest.connect(transport);
    console.log("Successfully connected to the server");
  } catch (error) {
    // If the server is already initialized, we can still proceed with the tests
    if (error.message && error.message.includes("Server already initialized")) {
      console.log("Server already initialized, proceeding with tests...");
      combinedTest.client = {
        callTool: async (args) => {
          return transport.send({
            jsonrpc: "2.0",
            method: "callTool",
            params: args,
            id: Math.floor(Math.random() * 1000)
          });
        },
        listTools: async () => {
          return transport.send({
            jsonrpc: "2.0",
            method: "listTools",
            id: Math.floor(Math.random() * 1000)
          });
        },
        ping: async () => {
          return transport.send({
            jsonrpc: "2.0",
            method: "ping",
            id: Math.floor(Math.random() * 1000)
          });
        }
      };
    } else {
      console.error("Failed to connect to the server:", error.message);
      console.error("Please ensure the server is running on port 3000");
      throw error;
    }
  }
  
  // Run all tests
  await combinedTest.runAllTests();
  
  // Clean up resources
  await combinedTest.cleanup();
  
  process.exit(0);
} catch (error) {
  console.error("❌ Test failed:", error);
  console.error("Error details:", error.message);
  if (error.cause) {
    console.error("Caused by:", error.cause);
  }
  process.exit(1);
}