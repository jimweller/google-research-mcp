// e2e_sse_mcp_client_test.mjs
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { MCPEndToEndTest } from "./e2e_test_base.mjs";

// Create and run the SSE-based test
const sseTest = new MCPEndToEndTest("SSE", "mcp-sse-test");

// Create the SSE transport
const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3000/mcp"),
  { timeout: 30000 } // Increase timeout to 30 seconds
);

try {
  // Connect to the server with proper initialization handling
  console.log(`Connecting to MCP server via ${sseTest.transportType}...`);
  
  try {
    await sseTest.connect(transport);
    // Success message is inside connect()
  } catch (connectError) {
    if (connectError.message && connectError.message.includes("already initialized")) {
      console.log("⚠️ Server already initialized, continuing with tests...");
    } else {
      throw connectError; // Re-throw if it's a different error
    }
  }

  // Add a small delay to allow server transport state to settle after connection
  console.log("Waiting briefly after connection...");
  await new Promise(resolve => setTimeout(resolve, 1000)); // Increased to 1000ms delay

  // Run all tests
  console.log("Running SSE tests...");
  await sseTest.runAllTests();
  
  // Clean up resources
  await sseTest.cleanup();
  
  process.exit(0);
} catch (error) {
  console.error("❌ Test failed:", error);
  process.exit(1);
}