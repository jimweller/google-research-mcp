// e2e_test_base.mjs
import assert from "assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

/**
 * Base class for MCP end-to-end tests
 * Provides shared functionality for both stdio and SSE transport tests
 */
export class MCPEndToEndTest {
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
   * @param {Object} transport - The transport instance to use
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
      ["google_search", "scrape_page", "analyze_with_gemini", "research_topic", "extract_structured_data"].sort()
    );
    console.log("✨ tools/list OK");
  }

  /**
   * Test Google search functionality
   * @returns {string} The URL from the search result
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
   * @param {string} url - The URL to scrape
   * @returns {string} The scraped content
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
   * @param {string} text - The text to analyze
   * @returns {string} The analysis result
   */
  async testAnalyzeWithGemini(text = "AI is transforming the world.") {
    const {
      content: [{ text: analysis }]
    } = await this.client.callTool({
      name: "analyze_with_gemini",
      arguments: { text }
    });
    assert(analysis.length > 0);
    console.log("✨ analyze_with_gemini OK");
    return analysis;
  }

  /**
   * Test research topic functionality
   * @returns {string} The research summary
   */
  async testResearchTopic() {
    const {
      content: [{ text: summary }]
    } = await this.client.callTool({
      name: "research_topic",
      arguments: {
        query: "How do you integrate YouTube and Gemini API?",
        num_results: 3
      }
    });
    assert(summary.length > 0);
    console.log("✨ research_topic OK");
    return summary;
  }

  /**
   * Test YouTube transcript functionality
   * @returns {string} The transcript content
   */
  async testYouTubeTranscript() {
    const {
      content: [{ text: transcript }]
    } = await this.client.callTool({
      name: "scrape_page",
      arguments: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
    });
    assert(transcript.length > 20 && !transcript.includes("<html"));
    console.log("✨ YouTube transcript OK");
    return transcript;
  }

  /**
   * Test transcript analysis functionality
   * @param {string} transcript - The transcript to analyze
   */
  async testTranscriptAnalysis(transcript) {
    const {
      content: [{ text: ta }]
    } = await this.client.callTool({
      name: "analyze_with_gemini",
      arguments: { text: transcript.slice(0, 200) }
    });
    assert(ta.length > 0);
    console.log("✨ Transcript analysis OK");
    return ta;
  }

  /**
   * Run all tests in sequence
   */
  async runAllTests() {
    this.checkEnvironmentVariables();
    
    // Run all test steps
    await this.listTools();
    const url = await this.testGoogleSearch();
    await this.testScrapePage(url);
    await this.testAnalyzeWithGemini();
    await this.testResearchTopic();
    const transcript = await this.testYouTubeTranscript();
    await this.testTranscriptAnalysis(transcript);
    
    console.log(`🎉 All ${this.transportType}-based end-to-end tests passed!`);
  }

  /**
   * Clean up resources before exiting
   */
  async cleanup() {
    console.log(`🧹 Starting cleanup for ${this.transportType} transport...`);
    
    let closedGracefully = false;
    if (this.transport && typeof this.transport.close === 'function') {
      try {
        console.log("Closing transport...");
        await Promise.race([
          this.transport.close(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Transport close timeout')), 5000))
        ]);
        console.log("✅ Transport closed gracefully.");
        closedGracefully = true;
      } catch (closeError) {
        console.warn("⚠️ Error during transport.close():", closeError.message);
      }
    } else {
      console.log("⚠️ No close method found on transport or transport not set.");
    }

    // Handle SSE transport cleanup
    if (this.transportType === 'SSE' && this.transport) {
      try {
        console.log("Performing SSE-specific cleanup...");
        // Force close any remaining connections
        if (this.transport.eventSource && this.transport.eventSource.close) {
          this.transport.eventSource.close();
          console.log("✅ SSE EventSource closed.");
        }
        // Cleanup any pending requests
        if (this.transport.abortController) {
          this.transport.abortController.abort();
          console.log("✅ SSE requests aborted.");
        }
      } catch (sseError) {
        console.warn("⚠️ Error during SSE cleanup:", sseError.message);
      }
    }

    // Force kill stdio child process if it exists and wasn't closed gracefully
    // Check specifically for stdio transport and the existence of the child process property
    if (this.transportType === 'stdio' && this.transport && this.transport.childProcess) {
      if (!this.transport.childProcess.killed) {
        try {
          console.log(`Attempting to forcefully kill stdio child process (PID: ${this.transport.childProcess.pid})...`);
          // Use SIGKILL for forceful termination
          const killed = process.kill(this.transport.childProcess.pid, 'SIGKILL');
          if (killed) {
            console.log("✅ Stdio child process killed successfully.");
          } else {
             console.warn("⚠️ Failed to kill stdio child process (process.kill returned false).");
          }
        } catch (killError) {
          // Ignore error if process already exited
          if (killError.code !== 'ESRCH') {
            console.error("❌ Error killing stdio child process:", killError);
          } else {
            console.log("ℹ️ Stdio child process likely already exited.");
          }
        }
      } else {
         console.log("ℹ️ Stdio child process was already killed (likely by transport.close).");
      }
    }

    // Allow any remaining operations or process termination to complete
    console.log("Allowing final cleanup to settle...");
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log("✅ Cleanup completed.");
  }
}