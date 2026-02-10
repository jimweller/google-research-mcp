/**
 * Smithery Entry Point
 *
 * This file provides a Smithery-compatible entry point with hardcoded tool metadata
 * for the scanning phase, and dynamic imports for actual runtime.
 *
 * The scanning phase uses createSandboxServer() which returns a mock server with
 * tool definitions that don't require bundling heavy dependencies.
 *
 * @see https://smithery.ai/docs/build
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Configuration schema for Smithery
 */
export const configSchema = z.object({
  GOOGLE_CUSTOM_SEARCH_API_KEY: z.string().describe("Google Custom Search API key from console.cloud.google.com"),
  GOOGLE_CUSTOM_SEARCH_ID: z.string().describe("Google Programmable Search Engine ID from programmablesearchengine.google.com"),
});

/**
 * Sandbox server for Smithery capability scanning.
 * This returns a lightweight mock server with tool definitions but no heavy dependencies.
 */
export function createSandboxServer() {
  const server = new McpServer({
    name: "google-researcher-mcp",
    version: "6.0.0",
  });

  // Register tools with their schemas for scanning (no actual implementation needed)
  server.tool(
    "google_search",
    "Search the web using Google Custom Search API. Returns a list of URLs with titles and snippets.",
    {
      query: z.string().describe("The search query string"),
      num_results: z.number().min(1).max(10).default(5).optional().describe("Number of results (1-10)"),
      site_search: z.string().optional().describe("Limit results to a specific site"),
      time_range: z.enum(["day", "week", "month", "year"]).optional().describe("Time range filter"),
    },
    async () => ({ content: [{ type: "text", text: "sandbox" }] })
  );

  server.tool(
    "scrape_page",
    "Extract text content from a URL. Handles web pages, YouTube videos, and documents (PDF, DOCX, PPTX).",
    {
      url: z.string().describe("The URL to scrape"),
      max_length: z.number().optional().describe("Maximum content length"),
      mode: z.enum(["full", "preview"]).default("full").optional().describe("Output mode"),
    },
    async () => ({ content: [{ type: "text", text: "sandbox" }] })
  );

  server.tool(
    "search_and_scrape",
    "Search Google AND retrieve content from top results in one call. Returns combined, deduplicated content.",
    {
      query: z.string().describe("Research question or topic"),
      num_results: z.number().min(1).max(10).default(3).optional().describe("Number of sources (1-10)"),
      max_length_per_source: z.number().optional().describe("Max content per source"),
      total_max_length: z.number().optional().describe("Max total content"),
    },
    async () => ({ content: [{ type: "text", text: "sandbox" }] })
  );

  server.tool(
    "google_image_search",
    "Search for images using Google Custom Search API. Returns image URLs, thumbnails, and dimensions.",
    {
      query: z.string().describe("Image search query"),
      num_results: z.number().min(1).max(10).default(5).optional().describe("Number of results"),
      size: z.enum(["huge", "icon", "large", "medium", "small", "xlarge", "xxlarge"]).optional(),
      type: z.enum(["clipart", "face", "lineart", "stock", "photo", "animated"]).optional(),
    },
    async () => ({ content: [{ type: "text", text: "sandbox" }] })
  );

  server.tool(
    "google_news_search",
    "Search for recent news articles with freshness filters and date sorting.",
    {
      query: z.string().describe("News search query"),
      num_results: z.number().min(1).max(10).default(5).optional(),
      freshness: z.enum(["hour", "day", "week", "month", "year"]).default("week").optional(),
      sort_by: z.enum(["relevance", "date"]).default("relevance").optional(),
    },
    async () => ({ content: [{ type: "text", text: "sandbox" }] })
  );

  server.tool(
    "academic_search",
    "Search academic papers using Google Custom Search API. Returns papers with citations.",
    {
      query: z.string().describe("Academic paper search query"),
      num_results: z.number().min(1).max(10).default(5).optional(),
      year_from: z.number().min(1900).max(2030).optional(),
      year_to: z.number().min(1900).max(2030).optional(),
      source: z.enum(["all", "arxiv", "pubmed", "ieee", "nature", "springer"]).default("all").optional(),
    },
    async () => ({ content: [{ type: "text", text: "sandbox" }] })
  );

  server.tool(
    "patent_search",
    "Search patents using Google Custom Search API (site:patents.google.com).",
    {
      query: z.string().describe("Patent search query"),
      num_results: z.number().min(1).max(10).default(5).optional(),
      patent_office: z.enum(["all", "US", "EP", "WO", "JP", "CN", "KR"]).optional(),
      search_type: z.enum(["prior_art", "specific", "landscape"]).default("prior_art").optional(),
    },
    async () => ({ content: [{ type: "text", text: "sandbox" }] })
  );

  server.tool(
    "sequential_search",
    "Track multi-step research progress across multiple API calls.",
    {
      searchStep: z.string().describe("Description of current search/finding"),
      stepNumber: z.number().min(1).describe("Current step number"),
      nextStepNeeded: z.boolean().describe("Whether more steps are needed"),
      totalStepsEstimate: z.number().min(1).max(50).default(5).optional(),
    },
    async () => ({ content: [{ type: "text", text: "sandbox" }] })
  );

  return server.server;
}

/**
 * Create server for actual runtime with user config.
 */
export default async function createServer({ config }: { config: z.infer<typeof configSchema> }) {
  // Set environment variables from config
  process.env.GOOGLE_CUSTOM_SEARCH_API_KEY = config.GOOGLE_CUSTOM_SEARCH_API_KEY;
  process.env.GOOGLE_CUSTOM_SEARCH_ID = config.GOOGLE_CUSTOM_SEARCH_ID;

  // Dynamic import the actual server implementation at runtime
  const serverModule = await import("./server.js");
  return serverModule.createSmitheryServer();
}
