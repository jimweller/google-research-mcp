// e2e_batch_request_test.mjs
import assert from "assert";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { MCPEndToEndTest } from "./e2e_test_base.mjs";

/**
 * Extended test class for batch request testing
 */
class BatchRequestTest extends MCPEndToEndTest {
  constructor() {
    super("SSE", "mcp-batch-test");
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
   * Test batch requests with notifications (no response expected)
   */
  async testBatchWithNotifications() {
    console.log("Testing batch requests with notifications...");
    
    // Create a batch with a regular request and a notification
    // Note: The SDK doesn't directly expose a way to send notifications,
    // but we can test that the server correctly processes multiple requests
    const results = await Promise.all([
      this.client.callTool({
        name: "google_search",
        arguments: { query: "example.org", num_results: 1 }
      }),
      this.client.ping() // This is a simple request that doesn't return content
    ]);
    
    // Verify results
    assert(results.length === 2, "Should receive 2 results");
    assert(results[0].content && results[0].content.length > 0, "First result should have content");
    
    console.log("✨ Batch requests with notifications OK");
  }

  /**
   * Run all batch request tests
   */
  async runBatchTests() {
    console.log("Running batch request tests...");
    
    // First run the standard tests to ensure basic functionality works
    await this.listTools();
    
    // Then run the batch-specific tests
    await this.testBatchRequests();
    await this.testBatchWithNotifications();
    
    console.log("🎉 All batch request tests passed!");
  }
}

// Create and run the batch request test
const batchTest = new BatchRequestTest();

// Create the SSE transport
// Use the default port 3000 that the server is configured to use
const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3000/mcp"),
  {
    timeout: 60000, // Increase timeout to 60 seconds
    headers: {
      'Accept': 'text/event-stream'
    }
  }
);

// Add more debugging
console.log("Transport created with 60 second timeout and Accept: text/event-stream header");

try {
  // Connect to the server
  try {
    console.log("Connecting to MCP server at http://localhost:3000/mcp...");
    await batchTest.connect(transport);
    console.log("Successfully connected to the server");
  } catch (error) {
    // If the server is already initialized, we can still proceed with the tests
    if (error.message && error.message.includes("Server already initialized")) {
      console.log("Server already initialized, proceeding with tests...");
      
      // Create a session ID manually
      const sessionId = `batch-test-${Date.now()}`;
      console.log(`Using manual session ID: ${sessionId}`);
      
      // Set headers for all requests
      transport.headers = {
        'Accept': 'text/event-stream',
        'Content-Type': 'application/json',
        'Mcp-Session-Id': sessionId
      };
      
      batchTest.client = {
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
  
  // Run batch tests
  await batchTest.runBatchTests();
  
  // Clean up resources
  await batchTest.cleanup();
  
  process.exit(0);
} catch (error) {
  console.error("❌ Test failed:", error);
  console.error("Error details:", error.message);
  console.error("Error name:", error.name);
  console.error("Error code:", error.code);
  if (error.cause) {
    console.error("Caused by:", error.cause);
  }
  
  // Print more details about the transport state
  if (transport) {
    console.error("Transport state:", {
      connected: transport.connected,
      sessionId: transport.sessionId,
      baseUrl: transport.baseUrl ? transport.baseUrl.toString() : 'undefined'
    });
  }
  
  process.exit(1);
}