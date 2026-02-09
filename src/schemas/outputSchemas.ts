/**
 * Output Schemas for MCP Tools
 *
 * Defines structured output schemas for all tools to enable
 * type-safe structured responses per MCP spec.
 *
 * Note: Schemas are exported as raw Zod shapes (not wrapped in z.object())
 * because the MCP SDK expects this format for inputSchema/outputSchema.
 */

import { z } from 'zod';

// ── Google Search Output ───────────────────────────────────────────────────

/**
 * Structured output schema for google_search tool
 */
export const googleSearchOutputSchema = {
  /** Array of URLs found by the search */
  urls: z.array(z.string().url()).describe('List of URLs returned by the search'),
  /** The original search query */
  query: z.string().describe('The search query that was executed'),
  /** Number of results returned */
  resultCount: z.number().int().min(0).describe('Number of URLs found'),
};

/** Inferred type for google_search structured output */
export type GoogleSearchOutput = {
  urls: string[];
  query: string;
  resultCount: number;
};

// ── Scrape Page Output ─────────────────────────────────────────────────────

/**
 * Structured output schema for scrape_page tool
 */
export const scrapePageOutputSchema = {
  /** The URL that was scraped */
  url: z.string().url().describe('The URL that was scraped'),
  /** Extracted text content */
  content: z.string().describe('The extracted text content from the page'),
  /** Type of content extracted */
  contentType: z.enum(['html', 'youtube', 'pdf', 'docx', 'pptx']).describe('The type of content that was extracted'),
  /** Content length in characters */
  contentLength: z.number().int().min(0).describe('Length of the extracted content in characters'),
  /** Whether content was truncated */
  truncated: z.boolean().describe('Whether the content was truncated due to size limits'),
  /** Document metadata (for document types) */
  metadata: z.object({
    title: z.string().optional().describe('Document title if available'),
    pageCount: z.number().int().optional().describe('Number of pages/slides'),
  }).optional().describe('Additional metadata for documents'),
};

/** Inferred type for scrape_page structured output */
export type ScrapePageOutput = {
  url: string;
  content: string;
  contentType: 'html' | 'youtube' | 'pdf' | 'docx' | 'pptx';
  contentLength: number;
  truncated: boolean;
  metadata?: {
    title?: string;
    pageCount?: number;
  };
};

// ── Search and Scrape Output ───────────────────────────────────────────────

/**
 * Structured output schema for search_and_scrape tool
 */
export const searchAndScrapeOutputSchema = {
  /** The original search query */
  query: z.string().describe('The search query that was executed'),
  /** Sources that were successfully scraped */
  sources: z.array(z.object({
    url: z.string().url().describe('URL of the source'),
    success: z.boolean().describe('Whether scraping succeeded'),
    contentLength: z.number().int().optional().describe('Length of content if successful'),
  })).describe('List of sources that were processed'),
  /** Combined content from all sources */
  combinedContent: z.string().describe('Combined and optionally deduplicated content from all sources'),
  /** Summary statistics */
  summary: z.object({
    urlsSearched: z.number().int().describe('Number of URLs found by search'),
    urlsScraped: z.number().int().describe('Number of URLs successfully scraped'),
    processingTimeMs: z.number().int().describe('Total processing time in milliseconds'),
    duplicatesRemoved: z.number().int().optional().describe('Number of duplicate paragraphs removed'),
    reductionPercent: z.number().optional().describe('Percentage reduction from deduplication'),
  }).describe('Summary statistics for the operation'),
};

/** Inferred type for search_and_scrape structured output */
export type SearchAndScrapeOutput = {
  query: string;
  sources: Array<{
    url: string;
    success: boolean;
    contentLength?: number;
  }>;
  combinedContent: string;
  summary: {
    urlsSearched: number;
    urlsScraped: number;
    processingTimeMs: number;
    duplicatesRemoved?: number;
    reductionPercent?: number;
  };
};
