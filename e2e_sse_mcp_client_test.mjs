// e2e_sse_mcp_client_test.mjs
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { MCPEndToEndTest } from "./e2e_test_base.mjs";

// Create and run the SSE-based test
const sseTest = new MCPEndToEndTest("SSE", "mcp-sse-test");

// Create the SSE transport
const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3000/mcp")
);

try {
  // Connect to the server
  await sseTest.connect(transport);
  
  // Run all tests
  await sseTest.runAllTests();
  
  // Clean up resources
  await sseTest.cleanup();
  
  process.exit(0);
} catch (error) {
  console.error("❌ Test failed:", error);
  process.exit(1);
}