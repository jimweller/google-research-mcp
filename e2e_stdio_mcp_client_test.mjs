// e2e_stdio_mcp_client_test.mjs
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { MCPEndToEndTest } from "./e2e_test_base.mjs";

// Create and run the stdio-based test
const stdioTest = new MCPEndToEndTest("stdio", "mcp-stdio-test");

// Create the stdio transport
const transport = new StdioClientTransport({
  command: "node",
  args: ["--no-warnings", "dist/server.js"],
  // Pass environment variables, adding MCP_TEST_MODE for stdio test
  env: { ...process.env, MCP_TEST_MODE: 'stdio' }
});

try {
  // Connect to the server
  await stdioTest.connect(transport);
  
  // Run all tests
  await stdioTest.runAllTests();
  
  // Clean up resources
  await stdioTest.cleanup();
  
  process.exit(0);
} catch (error) {
  console.error("❌ Test failed:", error);
  process.exit(1);
}