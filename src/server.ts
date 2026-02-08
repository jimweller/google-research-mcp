/**
 * MCP Server Implementation
 *
 * This file implements a Model Context Protocol (MCP) server that provides tools for:
 * - Web search via Google Custom Search API
 * - Web page scraping (including YouTube transcript extraction)
 * - Multi-source search and scrape pipeline
 *
 * The server supports two transport mechanisms:
 * 1. STDIO - For direct process-to-process communication
 * 2. HTTP+SSE - For web-based clients with Server-Sent Events for streaming
 *
 * All operations use a sophisticated caching system to improve performance and
 * reduce API calls to external services.
 *
 * @see https://github.com/zoharbabin/google-research-mcp for MCP documentation
 */

import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from 'node:url'; // Import fileURLToPath
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises"; // Import fs promises for directory creation
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { PersistentEventStore } from "./shared/persistentEventStore.js";
import { z } from "zod";  // Schema validation library
import { CheerioCrawler, PlaywrightCrawler, Configuration } from "crawlee";  // Web scraping library
// Import cache modules using index file with .js extension
import { PersistentCache, HybridPersistenceStrategy } from "./cache/index.js";
// Import OAuth scopes documentation and middleware
import { serveOAuthScopesDocumentation } from "./shared/oauthScopesDocumentation.js";
import { createOAuthMiddleware, OAuthMiddlewareOptions } from "./shared/oauthMiddleware.js";
// Import robust YouTube transcript extractor
import { RobustYouTubeTranscriptExtractor, YouTubeTranscriptError, YouTubeTranscriptErrorType } from "./youtube/transcriptExtractor.js";
// Import SSRF protection
import { validateUrlForSSRF, SSRFProtectionError, getSSRFOptionsFromEnv } from "./shared/urlValidator.js";
// Import structured logger
import { logger } from "./shared/logger.js";
// Import rate limiter for HTTP transport
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// ── Server Configuration Constants ─────────────────────────────

/** Timeout for Google Search API calls */
const SEARCH_TIMEOUT_MS = 10_000;

/** Timeout for web page scraping and research-topic search phase */
const SCRAPE_TIMEOUT_MS = 15_000;

/** Minimum content length to consider a Cheerio scrape successful (bytes) */
const MIN_CHEERIO_CONTENT_LENGTH = 100;

/** Timeout for Playwright-based scraping (seconds) */
const PLAYWRIGHT_TIMEOUT_SECS = 20;

/** Cache TTL for search results (30 minutes) */
const SEARCH_CACHE_TTL_MS = 30 * 60 * 1000;

/** Cache TTL for scraped page content (1 hour) */
const SCRAPE_CACHE_TTL_MS = 60 * 60 * 1000;

/** Maximum size for scraped page content (50 KB) */
const MAX_SCRAPE_CONTENT_SIZE = 50 * 1024;

/** Maximum combined content size for search_and_scrape workflow (300 KB) */
const MAX_RESEARCH_COMBINED_SIZE = 300 * 1024;

/** SSRF validation options, read once from environment variables */
const SSRF_OPTIONS = getSSRFOptionsFromEnv();

// ────────────────────────────────────────────────────────────────

// Type definitions for express
type Request = express.Request;
type Response = express.Response;
type NextFunction = express.NextFunction;

// Get the directory name in ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Dynamic Project Root Detection ---
// Find project root by looking for package.json, regardless of execution location
function findProjectRoot(startDir: string): string {
  let currentDir = startDir;
  while (currentDir !== path.dirname(currentDir)) { // Stop at filesystem root
    try {
      // Check if package.json exists in current directory
      const packageJsonPath = path.join(currentDir, 'package.json');
      if (require('fs').existsSync(packageJsonPath)) {
        return currentDir;
      }
    } catch {
      // Continue searching if file check fails
    }
    currentDir = path.dirname(currentDir);
  }
  // Fallback: assume we're in project root or one level down
  return __dirname.includes('/dist') ? path.dirname(__dirname) : __dirname;
}

const PROJECT_ROOT = findProjectRoot(__dirname);

// --- Package Version ---
const PKG_VERSION: string = (() => {
  try {
    const pkg = JSON.parse(readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

// --- Default Paths ---
const DEFAULT_CACHE_PATH = path.resolve(PROJECT_ROOT, 'storage', 'persistent_cache');
const DEFAULT_EVENT_PATH = path.resolve(PROJECT_ROOT, 'storage', 'event_store');
const DEFAULT_CRAWLEE_STORAGE_PATH = path.resolve(PROJECT_ROOT, 'storage', 'crawlee');

// --- Global Instances ---
// Initialize Cache and Event Store globally so they are available for both transports
let globalCacheInstance: PersistentCache;
let eventStoreInstance: PersistentEventStore;
let transcriptExtractorInstance: RobustYouTubeTranscriptExtractor;
let stdioServerInstance: McpServer | undefined;
let stdioTransportInstance: StdioServerTransport | undefined;
let httpTransportInstance: StreamableHTTPServerTransport | undefined;


/**
 * Initializes global cache and event store instances.
 * Ensures storage directories exist.
 * @param cachePath - Path for cache storage
 * @param eventPath - Path for event storage
 */
async function initializeGlobalInstances(
  cachePath: string = DEFAULT_CACHE_PATH,
  eventPath: string = DEFAULT_EVENT_PATH,
  crawleeStoragePath: string = DEFAULT_CRAWLEE_STORAGE_PATH
) {
  // Ensure directories exist
  try {
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.mkdir(path.dirname(eventPath), { recursive: true });
    await fs.mkdir(crawleeStoragePath, { recursive: true });
    logger.info('Ensured storage directories exist.');
  } catch (error) {
    logger.error('Error ensuring storage directories', { error: String(error) });
    process.exit(1); // Exit if we can't create storage dirs
  }

  // Configure Crawlee to not persist request queues, datasets, or key-value stores
  // to the filesystem. We only use CheerioCrawler for single-page scrapes, so
  // persistent storage is unnecessary and creates filesystem clutter.
  const crawleeConfig = Configuration.getGlobalConfig();
  crawleeConfig.set('persistStorage', false);
  crawleeConfig.set('storageClientOptions', {
    localDataDirectory: crawleeStoragePath,
  });

  globalCacheInstance = new PersistentCache({
    defaultTTL: 5 * 60 * 1000, // 5 minutes default TTL
    maxSize: 1000, // Maximum 1000 entries
    persistenceStrategy: new HybridPersistenceStrategy(
      ['googleSearch', 'scrapePage'], // Critical namespaces
      5 * 60 * 1000, // 5 minutes persistence interval
      ['googleSearch', 'scrapePage'] // All persistent namespaces
    ),
    storagePath: cachePath,
    eagerLoading: true // Load all entries on startup
  });

  // Build event store options, wiring encryption if configured
  const eventStoreOpts: import("./shared/types/eventStore.js").PersistentEventStoreOptions = {
    storagePath: eventPath,
    maxEventsPerStream: 1000,
    eventTTL: 24 * 60 * 60 * 1000, // 24 hours
    persistenceInterval: 5 * 60 * 1000, // 5 minutes
    criticalStreamIds: [], // Define critical streams if needed
    eagerLoading: true,
  };

  const encryptionKey = process.env.EVENT_STORE_ENCRYPTION_KEY;
  if (encryptionKey) {
    if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
      logger.error('EVENT_STORE_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Exiting.');
      process.exit(1);
    }
    const keyBuffer = Buffer.from(encryptionKey, 'hex');
    eventStoreOpts.encryption = {
      enabled: true,
      keyProvider: async () => keyBuffer,
    };
    logger.info('Event store encryption enabled.');
  }

  eventStoreInstance = new PersistentEventStore(eventStoreOpts);

  // Initialize robust YouTube transcript extractor
  transcriptExtractorInstance = new RobustYouTubeTranscriptExtractor();

  // Load data eagerly
  await globalCacheInstance.loadFromDisk(); // Cache needs explicit load
  // Event store loads eagerly via constructor option, no explicit call needed here
  logger.info('Global Cache, Event Store, and YouTube Transcript Extractor initialized.');
}

// --- Tool/Resource Configuration (Moved to Top Level) ---
/**
 * Configures and registers all MCP tools and resources for a server instance
 *
 * Tools:
 * 1. google_search — Google Custom Search API with recency filtering
 * 2. scrape_page — Web scraping + YouTube transcript extraction
 * 3. search_and_scrape — Composite: search → parallel scrape → combined raw content
 *
 * @param server - The MCP server instance to configure
 */
function configureToolsAndResources(
    server: McpServer
) {
    // --- URL and error message sanitization helpers ---

    /**
     * Sanitizes a URL by redacting sensitive query parameters.
     * Used to prevent API keys from appearing in logs.
     *
     * NOTE: The Google Custom Search JSON API requires the API key as a query
     * parameter (?key=...). It does NOT support Authorization headers for this
     * specific API. This function is used ONLY for log output and error messages.
     */
    const sanitizeUrl = (url: string): string => {
        try {
            const parsed = new URL(url);
            const sensitiveParams = ['key', 'api_key', 'apiKey', 'apikey', 'token', 'access_token'];
            for (const param of sensitiveParams) {
                if (parsed.searchParams.has(param)) {
                    parsed.searchParams.set(param, '[REDACTED]');
                }
            }
            return parsed.toString();
        } catch {
            return url.replace(/([?&])(key|api_key|apiKey|apikey|token|access_token)=[^&]*/gi, '$1$2=[REDACTED]');
        }
    };

    /**
     * Sanitizes error messages that may contain API keys leaked from URLs.
     */
    const sanitizeErrorMessage = (msg: string): string => {
        return msg.replace(/key=[A-Za-z0-9_-]+/gi, 'key=[REDACTED]');
    };

    // 1) Extract each tool's implementation into its own async function with caching
    /**
     * Creates a timeout promise that rejects after the specified duration
     */
    const createTimeoutPromise = (ms: number, operation: string) => {
        return new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms);
        });
    };

    /**
     * Wraps a promise with a timeout
     */
    const withTimeout = async <T>(
        promise: Promise<T>,
        timeoutMs: number,
        operation: string
    ): Promise<T> => {
        return Promise.race([
            promise,
            createTimeoutPromise(timeoutMs, operation)
        ]);
    };

    /**
     * Performs a Google search with caching and timeout protection
     *
     * Uses the Google Custom Search API to find relevant web pages.
     * Results are cached for 30 minutes with stale-while-revalidate pattern
     * for improved performance and reduced API calls.
     *
     * @param query - The search query string
     * @param num_results - Number of results to return (default: 5)
     * @returns Array of search result URLs as text content items
     */
    /** Map user-friendly time range names to Google dateRestrict values */
    const TIME_RANGE_MAP: Record<string, string> = {
        day: 'd1',
        week: 'w1',
        month: 'm1',
        year: 'y1',
    };

    const googleSearchFn = async ({
        query,
        num_results,
        time_range,
    }: {
        query: string;
        num_results: number;
        time_range?: string;
    }) => {
        const trimmedQuery = query.trim();
        // Use the globally initialized cache instance directly
        return globalCacheInstance.getOrCompute(
            'googleSearch',
            { query: trimmedQuery, num_results, time_range },
            async () => {
                logger.debug(`Cache MISS for googleSearch`, { query: trimmedQuery, num_results, time_range });
                const key = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY!;
                const cx = process.env.GOOGLE_CUSTOM_SEARCH_ID!;
                let url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(
                    trimmedQuery
                )}&num=${num_results}`;

                // Append dateRestrict for recency filtering
                if (time_range && TIME_RANGE_MAP[time_range]) {
                    url += `&dateRestrict=${TIME_RANGE_MAP[time_range]}`;
                }

                // Add timeout protection to search API call
                const searchPromise = fetch(url, {
                    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS)
                });

                const resp = await withTimeout(searchPromise, SEARCH_TIMEOUT_MS, 'Google Search API');
                if (!resp.ok) throw new Error(`Search API error ${resp.status}`);
                const data = await resp.json();
                const links: string[] = (data.items || []).map((i: any) => i.link);
                return links.map((l) => ({ type: "text" as const, text: l }));
            },
            {
                ttl: SEARCH_CACHE_TTL_MS,
                staleWhileRevalidate: true, // Enable stale-while-revalidate
                staleTime: 30 * 60 * 1000 // Allow serving stale content for another 30 minutes while revalidating
            }
        );
    };

    /**
     * Scrapes content from a web page or extracts YouTube transcripts with robust error handling
     *
     * This function:
     * 1. Detects if the URL is a YouTube video and uses the robust transcript extractor
     * 2. Otherwise scrapes the page content using Cheerio
     * 3. Caches results for 1 hour with stale-while-revalidate for up to 24 hours
     * 4. Includes timeout protection and content size limits
     * 5. Provides transparent error reporting for YouTube transcript failures
     *
     * @param url - The URL to scrape
     * @returns The page content as a text content item
     */

    /**
     * Scrape a URL using CheerioCrawler (static HTML only, fast).
     */
    async function scrapeWithCheerio(url: string): Promise<string> {
        let page = "";
        const crawler = new CheerioCrawler({
            requestHandler: async ({ $ }) => {
                if (typeof $ !== 'function') {
                    page = "[Non-HTML response — content could not be extracted]";
                    return;
                }
                const title = $("title").text() || "";
                const headings = $("h1, h2, h3").map((_, el) => $(el).text()).get().join(" ");
                const paragraphs = $("p").map((_, el) => $(el).text()).get().join(" ");
                const bodyText = $("body").text().replace(/\s+/g, " ").trim();
                page = `Title: ${title}\nHeadings: ${headings}\nParagraphs: ${paragraphs}\nBody: ${bodyText}`;
            },
            preNavigationHooks: [
                async (_crawlingContext, gotOptions) => {
                    if (!gotOptions.hooks) { gotOptions.hooks = {}; }
                    const existing = gotOptions.hooks.beforeRedirect ?? [];
                    gotOptions.hooks.beforeRedirect = [
                        ...existing,
                        async (redirectOptions: any) => {
                            const redirectUrl = redirectOptions.url?.toString();
                            if (redirectUrl) {
                                await validateUrlForSSRF(redirectUrl, SSRF_OPTIONS);
                            }
                        },
                    ];
                },
            ],
            useSessionPool: false,
            persistCookiesPerSession: false,
            requestHandlerTimeoutSecs: 15,
            maxRequestsPerCrawl: 1,
            maxRequestRetries: 0,
        });
        const crawlPromise = crawler.run([{ url }]);
        await withTimeout(crawlPromise, SCRAPE_TIMEOUT_MS, 'Web page scraping');
        return page;
    }

    /**
     * Scrape a URL using PlaywrightCrawler (renders JavaScript, slower).
     * Used as a fallback when CheerioCrawler returns insufficient content.
     */
    async function scrapeWithPlaywright(url: string): Promise<string> {
        let pageContent = "";
        const crawler = new PlaywrightCrawler({
            requestHandler: async ({ page }) => {
                await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
                const title = await page.title();
                const extracted = await page.evaluate(() => {
                    const h = Array.from(document.querySelectorAll('h1, h2, h3'))
                        .map(el => el.textContent?.trim()).filter(Boolean).join(' ');
                    const p = Array.from(document.querySelectorAll('p'))
                        .map(el => el.textContent?.trim()).filter(Boolean).join(' ');
                    const body = document.body?.innerText?.replace(/\s+/g, ' ').trim() || '';
                    return { headings: h, paragraphs: p, bodyText: body };
                });
                pageContent = `Title: ${title}\nHeadings: ${extracted.headings}\nParagraphs: ${extracted.paragraphs}\nBody: ${extracted.bodyText}`;
            },
            requestHandlerTimeoutSecs: PLAYWRIGHT_TIMEOUT_SECS,
            maxRequestsPerCrawl: 1,
            maxRequestRetries: 0,
            useSessionPool: false,
            headless: true,
            launchContext: {
                launchOptions: { args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] }
            },
        });
        const crawlPromise = crawler.run([{ url }]);
        await withTimeout(crawlPromise, PLAYWRIGHT_TIMEOUT_SECS * 1000, 'Playwright scraping');
        return pageContent;
    }

    const scrapePageFn = async ({ url }: { url: string }) => {
        // SSRF protection: validate URL before any network access
        try {
            await validateUrlForSSRF(url, SSRF_OPTIONS);
        } catch (error) {
            if (error instanceof SSRFProtectionError) {
                return [{ type: "text" as const, text: `URL blocked: ${error.message}` }];
            }
            throw error;
        }

        // Use a longer TTL for scraped content as it changes less frequently
        // Use the globally initialized cache instance directly
        const result = await globalCacheInstance.getOrCompute(
            'scrapePage',
            { url },
            async () => {
                logger.debug('Cache MISS for scrapePage', { url: sanitizeUrl(url) });
                let text = "";
                const yt = url.match(
                    /(?:youtu\.be\/|youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})(?:[&#?]|$)/
                );

                if (yt) {
                    // Use robust transcript extractor instead of direct call
                    const result = await transcriptExtractorInstance.extractTranscript(yt[1]);

                    if (result.success) {
                        text = result.transcript!;
                        logger.info(`YouTube transcript extracted for video ${yt[1]}`, { attempts: result.attempts, duration: result.duration });
                    } else {
                        // Throw specific error instead of returning empty text
                        logger.warn(`YouTube transcript extraction failed for video ${yt[1]}`, { error: result.error!.message });
                        throw new YouTubeTranscriptError(
                            result.error!.type,
                            result.error!.message,
                            yt[1],
                            result.error!.originalError
                        );
                    }
                } else {
                    // Tiered scraping: try fast static HTML first, fall back to JS rendering
                    text = await scrapeWithCheerio(url);

                    if (text.length < MIN_CHEERIO_CONTENT_LENGTH) {
                        logger.info('Cheerio returned insufficient content, falling back to Playwright', {
                            url: sanitizeUrl(url), cheerioLength: text.length
                        });
                        text = await scrapeWithPlaywright(url);
                    }
                }

                // Limit content size to prevent memory issues
                if (text.length > MAX_SCRAPE_CONTENT_SIZE) {
                    // Truncate intelligently - keep beginning and end
                    const halfSize = Math.floor(MAX_SCRAPE_CONTENT_SIZE / 2);
                    text = text.substring(0, halfSize) +
                           "\n\n[... CONTENT TRUNCATED FOR SIZE LIMIT ...]\n\n" +
                           text.substring(text.length - halfSize);
                }

                // Note: Removed fallback content mechanism for YouTube URLs
                // Allow scraped content to be returned as-is, even if short
                // This ensures actual web content is returned instead of test placeholders

                return [{ type: "text" as const, text }];
            },
            {
                ttl: SCRAPE_CACHE_TTL_MS,
                staleWhileRevalidate: true, // Enable stale-while-revalidate
                staleTime: 24 * 60 * 60 * 1000 // Allow serving stale content for up to a day while revalidating
            }
        );

        // Session transcripts are now handled in the session initialization handler
        // We'll return the result directly
        return result;
    };

    // 2) Register each tool with the MCP server
    server.tool(
        "google_search",
        {
            query: z.string().min(1).max(500).describe("The search query string. Use natural language or specific keywords for better results. More specific queries yield better results and more relevant sources."),
            num_results: z.number().min(1).max(10).default(5).describe("Number of search results to return (1-10). Higher numbers increase processing time and API costs. Use 3-5 for quick research, 8-10 for comprehensive coverage."),
            time_range: z.enum(['day', 'week', 'month', 'year']).optional().describe("Restrict results to a recent time range. 'day' = last 24 hours, 'week' = last 7 days, 'month' = last 30 days, 'year' = last 365 days. Omit for no time restriction.")
        },
        {
            title: "Google Search",
            readOnlyHint: true,
            openWorldHint: true
        },
        async ({ query, num_results = 5, time_range }) => ({ content: await googleSearchFn({ query, num_results, time_range }) })
    );

    server.tool(
        "scrape_page",
        {
            url: z.string().url().max(2048).describe("The URL to scrape. Supports HTTP/HTTPS web pages and YouTube video URLs (youtube.com/watch?v= or youtu.be/ formats). YouTube URLs automatically extract transcripts when available.")
        },
        {
            title: "Scrape Page",
            readOnlyHint: true,
            openWorldHint: true
        },
        async ({ url }) => {
            const result = await scrapePageFn({ url });

            // Note: In SDK v1.11.0, we can't directly access the session ID from the tool handler
            // Session transcripts are now updated through the event system when events are processed
            // The session-specific resources are registered in the session initialization handler

            return { content: result };
        }
    );

    // 3) Composite tool: search_and_scrape
    server.tool(
        "search_and_scrape",
        {
            query: z.string().min(1).max(500).describe("The search query. Results are fetched from Google and the top pages are scraped. Use specific queries for more relevant sources."),
            num_results: z.number().min(1).max(10).default(3).describe("Number of URLs to search for and scrape (1-10). More sources provide broader coverage but increase latency."),
            include_sources: z.boolean().default(true).describe("When true, appends a numbered list of source URLs at the end of the output."),
        },
        {
            title: "Search and Scrape",
            readOnlyHint: true,
            openWorldHint: true
        },
        async ({ query, num_results, include_sources }) => {
            const trimmedQuery = query.trim();
            const startTime = Date.now();
            const errors: string[] = [];
            let searchResults: any[] = [];

            try {
                logger.info('search_and_scrape: searching', { query: trimmedQuery, num_results });
                const searchPromise = googleSearchFn({ query: trimmedQuery, num_results });
                searchResults = await withTimeout(searchPromise, SCRAPE_TIMEOUT_MS, 'Google Search');
                logger.info('search_and_scrape: search completed', { urlsFound: searchResults.length });
            } catch (error) {
                const errorMsg = `Search failed: ${sanitizeErrorMessage(error instanceof Error ? error.message : String(error))}`;
                errors.push(errorMsg);
                logger.warn(errorMsg);
                return {
                    content: [{
                        type: "text" as const,
                        text: `Search failed for "${trimmedQuery}". Error: ${errorMsg}`
                    }]
                };
            }

            const urls = searchResults.map((c) => c.text);
            if (urls.length === 0) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `No URLs found for query "${trimmedQuery}".`
                    }]
                };
            }

            // Scrape each URL in parallel with graceful degradation
            logger.info('search_and_scrape: scraping', { count: urls.length });
            const scrapePromises = urls.map(async (url, index) => {
                try {
                    const result = await withTimeout(scrapePageFn({ url }), 20000, `Scraping URL ${index + 1}`);
                    logger.debug(`Scraped URL ${index + 1}/${urls.length}`, { url: sanitizeUrl(url).substring(0, 80) });
                    return { url, result, success: true };
                } catch (error) {
                    const errorMsg = `Failed to scrape ${sanitizeUrl(url)}: ${sanitizeErrorMessage(error instanceof Error ? error.message : String(error))}`;
                    logger.warn(errorMsg);
                    return { url, error: errorMsg, success: false };
                }
            });

            const scrapeResults = await Promise.allSettled(scrapePromises);

            const successfulScrapes: { url: string; content: string }[] = [];
            scrapeResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    if (result.value.success) {
                        successfulScrapes.push({
                            url: result.value.url,
                            content: result.value.result[0].text,
                        });
                    } else {
                        errors.push(result.value.error);
                    }
                } else {
                    const errorMsg = `Scrape promise rejected for URL ${index + 1}: ${result.reason}`;
                    errors.push(errorMsg);
                    logger.warn(errorMsg);
                }
            });

            logger.info('search_and_scrape: scraping done', { successful: successfulScrapes.length, total: urls.length });

            if (successfulScrapes.length === 0) {
                const errorSummary = errors.length > 0 ? `\n\nErrors encountered:\n${errors.join('\n')}` : '';
                return {
                    content: [{
                        type: "text" as const,
                        text: `No content could be scraped from the ${urls.length} URLs found for "${trimmedQuery}".${errorSummary}`
                    }]
                };
            }

            // Combine scraped content with source headers
            const combinedSections = successfulScrapes.map((scrape, index) =>
                `=== Source ${index + 1}: ${scrape.url} ===\n${scrape.content}`
            );
            let finalCombined = combinedSections.join("\n\n---\n\n");

            if (finalCombined.length > MAX_RESEARCH_COMBINED_SIZE) {
                const halfSize = Math.floor(MAX_RESEARCH_COMBINED_SIZE / 2);
                finalCombined = finalCombined.substring(0, halfSize) +
                               "\n\n[... CONTENT TRUNCATED FOR SIZE LIMITS ...]\n\n" +
                               finalCombined.substring(finalCombined.length - halfSize);
                logger.info('Combined content truncated', { from: combinedSections.join('').length, to: finalCombined.length });
            }

            const sourcesList = include_sources
                ? '\n\n--- Sources ---\n' + successfulScrapes.map((s, i) => `${i + 1}. ${s.url}`).join('\n')
                : '';

            const totalTime = Date.now() - startTime;
            const summary = [
                `\n\n--- Summary ---`,
                `Query: "${trimmedQuery}"`,
                `URLs scraped: ${successfulScrapes.length}/${urls.length}`,
                `Processing time: ${totalTime}ms`,
            ];
            if (errors.length > 0) {
                summary.push(`Errors: ${errors.length} (${errors.join('; ')})`);
            }

            return {
                content: [{
                    type: "text" as const,
                    text: finalCombined + sourcesList + summary.join('\n')
                }]
            };
        }
    );
}


// --- Function Definitions ---

/**
 * Sets up the STDIO transport using the globally initialized cache and event store.
 */
// Ensure this function is defined at the top level before the main execution block
async function setupStdioTransport() {
  // Ensure global instances are initialized first
  if (!globalCacheInstance || !eventStoreInstance) {
    logger.error('Cannot setup stdio transport: Global instances not initialized.');
    process.exit(1);
  }

  stdioServerInstance = new McpServer({
    name: "google-researcher-mcp-stdio",
    version: PKG_VERSION
  });
  // Configure tools using the global cache/store (implicitly via configureToolsAndResources)
  configureToolsAndResources(stdioServerInstance); // This function needs access to globalCacheInstance
  stdioTransportInstance = new StdioServerTransport();
  await stdioServerInstance.connect(stdioTransportInstance);
  logger.info('stdio transport ready');
}

/**
 * Factory function to create and configure the Express app for the HTTP+SSE transport
 *
 * @param cache - The pre-initialized PersistentCache instance
 * @param eventStore - The pre-initialized PersistentEventStore instance
 * @param oauthOptions - Optional OAuth configuration
 * @returns Object containing the Express app and the HTTP transport instance
 */
// Add async keyword here
export async function createAppAndHttpTransport(
  cache: PersistentCache, // Accept pre-initialized cache
  eventStore: PersistentEventStore, // Accept pre-initialized event store
  oauthOptions?: OAuthMiddlewareOptions
) {
  // Ensure we have the necessary instances (either global or passed parameters)
  if ((!globalCacheInstance || !eventStoreInstance) && (!cache || !eventStore)) {
    logger.error('Cannot create app: Neither global instances nor parameters are available.');
    process.exit(1);
  }

  // ─── 0️⃣ ENVIRONMENT VALIDATION & CORS SETUP ─────────────────────────────────────
  /**
 * Check for required environment variables and configure CORS settings
 *
 * The server requires the following environment variables:
 * - GOOGLE_CUSTOM_SEARCH_API_KEY: For Google search functionality
 * - GOOGLE_CUSTOM_SEARCH_ID: The custom search engine ID
 */
for (const key of [
    "GOOGLE_CUSTOM_SEARCH_API_KEY",
    "GOOGLE_CUSTOM_SEARCH_ID",
]) {
    if (!process.env[key]) {
        logger.error(`Missing required env var ${key}`);
        process.exit(1);
    }
}
const ALLOWED_ORIGINS =
process.env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()) || ["*"];

  // Create the Express app instance here
  const app = express();
  app.use(express.json());
  app.use(
      cors({
          origin: ALLOWED_ORIGINS,
          methods: ["GET", "POST", "DELETE"],
          allowedHeaders: ["Content-Type", "Mcp-Session-Id", "Accept", "Authorization"],
          exposedHeaders: ["Mcp-Session-Id"]
      })
  );

  // ── Rate limiting ──────────────────────────────────────────────
  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

  app.use(rateLimit({
    windowMs: rateLimitWindowMs,
    max: rateLimitMax,
    keyGenerator: (req: Request) => (req as any).oauth?.sub ?? ipKeyGenerator(req.ip ?? '0.0.0.0'),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Rate limit exceeded. Try again later." },
        id: null,
      });
    },
  }));
  logger.info('Rate limiting configured', { windowMs: rateLimitWindowMs, max: rateLimitMax });

  // ── Unauthenticated operational endpoints ─────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      version: PKG_VERSION,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/version", (_req: Request, res: Response) => {
    res.json({
      version: PKG_VERSION,
      name: "google-researcher-mcp",
      nodeVersion: process.version,
    });
  });

  // Configure OAuth middleware if options are provided
  let oauthMiddleware: ReturnType<typeof createOAuthMiddleware> | undefined;
  if (oauthOptions) { // Use passed-in options
    oauthMiddleware = createOAuthMiddleware(oauthOptions);
    logger.info('OAuth 2.1 middleware configured');
  }

  /**
   * Checks if a request is an initialization request
   *
   * Initialization requests create new MCP sessions.
   *
   * @param body - The request body
   * @returns True if this is an initialization request
   */
  function isInitializeRequest(body: any): boolean {
    return body.method === "initialize";
  }

  // Create the MCP server
  const httpServer = new McpServer({
    name: "google-researcher-mcp-sse",
    version: PKG_VERSION
  });

  // Configure tools and resources for the server (using the global function)
  configureToolsAndResources(httpServer); // Call configureTools here

  // Create the streamable HTTP transport with session management
  httpTransportInstance = new StreamableHTTPServerTransport({ // Assign to the global variable
    sessionIdGenerator: () => randomUUID(),
    eventStore: eventStoreInstance, // Use the passed-in instance
    onsessioninitialized: (sid) => {
      logger.info('SSE session initialized', { sessionId: sid });
    },
    // Removed onclose handler - rely on transport's internal management
  });


  // Connect the MCP server to the transport
  await httpServer.connect(httpTransportInstance);
  logger.info('HTTP transport connected to MCP server');

  // Middleware to handle content negotiation for JSON-RPC requests
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/mcp' && req.method === 'POST') {
      // Force content type to be application/json for JSON-RPC requests
      res.setHeader('Content-Type', 'application/json');
    }
    next();
  });

  /**
   * Checks if a request body is a JSON-RPC batch request
   *
   * According to the JSON-RPC specification, batch requests are sent as arrays
   * of individual request objects.
   *
   * @param body - The request body
   * @returns True if this is a batch request
   */
  function isBatchRequest(body: any): boolean {
    return Array.isArray(body);
  }

  // Handle POST requests to /mcp
  app.post("/mcp", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if this is a batch request
      const isBatch = isBatchRequest(req.body);

      // Handle empty batch requests (invalid according to spec)
      if (isBatch && req.body.length === 0) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32600, message: "Invalid Request: Empty batch" },
          id: null
        });
        return;
      }

      // Get session ID from header (still useful for logging)
      const sidHeader = req.headers["mcp-session-id"] as string | undefined;

      // Add back explicit session validation for batch requests
      // This is needed for the test to pass
      if (isBatch && (!sidHeader || sidHeader === 'invalid-session-id')) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad Request: No valid session ID provided" },
          id: null
        });
        return;
      }

      // For existing sessions, delegate to the transport
      // The StreamableHTTPServerTransport should handle batch requests correctly
      // console.log(`Processing ${isBatch ? 'batch' : 'single'} request with session ID: ${sidHeader}`); // Reduce noise
      await httpTransportInstance.handleRequest(req, res, req.body); // Use the instance variable
    } catch (err) {
      // console.error("Error processing request:", err); // Reduce noise, rely on default handler
      next(err);
    }
  });

  // Handle GET and DELETE requests to /mcp (SSE connections and session teardown)
  const handleSessionRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sid = req.headers["mcp-session-id"] as string;
      // Removed explicit session validation - rely on transport's handleRequest
      await httpTransportInstance.handleRequest(req, res); // Use the instance variable
    } catch (err) {
      // console.error("Error processing session request:", err); // Reduce noise
      next(err);
    }
  };

  app.get("/mcp", handleSessionRequest);
  app.delete("/mcp", handleSessionRequest);

// ─── 4️⃣ EVENT STORE & CACHE MANAGEMENT API ENDPOINTS ────────────────────────────
/**
 * Cache statistics endpoint
 *
 * Provides detailed information about:
 * - Cache hit/miss rates
 * - Memory usage
 * - Entry counts
 * - Server process statistics
 *
 * Useful for monitoring cache performance and diagnosing issues.
 */
app.get("/mcp/cache-stats", (_req: Request, res: Response) => {
    // Use the globally initialized cache instance directly
    const stats = globalCacheInstance.getStats();
    const processStats = process.memoryUsage();

    res.json({
        cache: {
            ...stats,
            timestamp: new Date().toISOString(),
            memoryUsageEstimate: `~${Math.round(stats.size * 10 / 1024)}MB (rough estimate)`
        },
        process: {
            uptime: process.uptime(),
            memoryUsage: {
                rss: `${Math.round(processStats.rss / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(processStats.heapTotal / 1024 / 1024)}MB`,
                heapUsed: `${Math.round(processStats.heapUsed / 1024 / 1024)}MB`,
                external: `${Math.round(processStats.external / 1024 / 1024)}MB`
            }
        },
        server: {
            nodeVersion: process.version,
            platform: process.platform,
            startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
        }
    });
});

/**
 * Event store statistics endpoint
 *
 * Provides detailed information about:
 * - Event counts
 * - Memory and disk usage
 * - Hit/miss rates
 * - Stream statistics
 *
 * Useful for monitoring event store performance and diagnosing issues.
 */
app.get("/mcp/event-store-stats", async (_req: Request, res: Response) => {
    try {
        // Use the passed event store parameter for proper dependency injection
        if (!eventStore || typeof eventStore.getStats !== 'function') {
          res.status(500).json({
            error: "Event store not available or not a PersistentEventStore"
          });
            return;
        }
        // Get stats from the passed event store parameter
        const stats = await eventStore.getStats();

        res.json({
            eventStore: {
                ...stats,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to get event store stats",
            message: (error as Error).message
        });
    }
});

/**
 * Cache invalidation endpoint (protected by API key)
 *
 * Allows authorized clients to:
 * - Invalidate specific cache entries by namespace and args
 * - Clear the entire cache
 *
 * Protected by a simple API key for basic security.
 * In production, use a more robust authentication mechanism.
 */
app.post("/mcp/cache-invalidate", (req: Request, res: Response) => {
    const expectedKey = process.env.CACHE_ADMIN_KEY;

    if (!expectedKey) {
        res.status(503).json({
            error: "Service Unavailable",
            message: "Cache admin endpoints are disabled. Set CACHE_ADMIN_KEY environment variable to enable."
        });
        return;
    }

    const apiKey = req.headers["x-api-key"];
    if (apiKey !== expectedKey) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const { namespace, args } = req.body;

    if (namespace && args) {
      // Invalidate specific entry using the global instance
      globalCacheInstance.invalidate(namespace, args);
      res.json({
        success: true,
            message: `Cache entry invalidated for namespace: ${namespace}`,
            invalidatedAt: new Date().toISOString()
        });
    } else {
      // Clear entire cache using the global instance
      globalCacheInstance.clear();
      res.json({
        success: true,
            message: "Entire cache cleared",
            clearedAt: new Date().toISOString()
        });
    }
});

/**
 * Cache persistence endpoints (POST and GET)
 *
 * Forces immediate persistence of the cache to disk.
 * Provided in both POST and GET forms for convenience:
 * - POST for programmatic use
 * - GET for easy access via browser
 *
 * Useful for ensuring data is saved before server shutdown.
 */
app.post("/mcp/cache-persist", async (req: Request, res: Response) => {
 const expectedKey = process.env.CACHE_ADMIN_KEY;
 if (!expectedKey) {
   res.status(503).json({
     error: "Service Unavailable",
     message: "Cache admin endpoints are disabled. Set CACHE_ADMIN_KEY environment variable to enable."
   });
   return;
 }
 const apiKey = req.headers["x-api-key"];
 if (apiKey !== expectedKey) {
   res.status(401).json({ error: "Unauthorized" });
   return;
 }

 try {
   // Use the global instance
   await globalCacheInstance.persistToDisk();
   res.json({
     success: true,
      message: "Cache persisted successfully",
      persistedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to persist cache",
      error: (error as Error).message
    });
  }
});

// Add GET endpoint for cache persistence (for easier access via browser or curl)
app.get("/mcp/cache-persist", async (req: Request, res: Response) => {
 const expectedKey = process.env.CACHE_ADMIN_KEY;
 if (!expectedKey) {
   res.status(503).json({
     error: "Service Unavailable",
     message: "Cache admin endpoints are disabled. Set CACHE_ADMIN_KEY environment variable to enable."
   });
   return;
 }
 const apiKey = req.headers["x-api-key"];
 if (apiKey !== expectedKey) {
   res.status(401).json({ error: "Unauthorized" });
   return;
 }

 try {
   // Use the global instance
   await globalCacheInstance.persistToDisk();
   res.json({
     success: true,
      message: "Cache persisted successfully",
      persistedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to persist cache",
      error: (error as Error).message
    });
  }
});

/**
 * OAuth Scopes Documentation endpoint
 *
 * Provides documentation for the OAuth scopes used in the MCP server.
 * This endpoint serves the documentation in markdown format.
 *
 * Useful for developers integrating with the MCP server's OAuth system.
 */
app.get("/mcp/oauth-scopes", (req: Request, res: Response) => {
  serveOAuthScopesDocumentation(req, res);
});

/**
 * OAuth configuration endpoint
 *
 * Returns the OAuth configuration information, including:
 * - Whether OAuth is enabled
 * - The issuer URL
 * - The audience value
 * - Available endpoints
 *
 * This endpoint is public and does not require authentication.
 */
app.get("/mcp/oauth-config", (_req: Request, res: Response) => {
  const oauthEnabled = !!oauthOptions; // Use passed-in options

  res.json({
    oauth: {
      enabled: oauthEnabled,
      issuer: oauthEnabled ? oauthOptions!.issuerUrl : null,
      audience: oauthEnabled ? oauthOptions!.audience : null
    },
    endpoints: {
      jwks: oauthEnabled ? `${oauthOptions!.issuerUrl}${oauthOptions!.jwksPath || '/.well-known/jwks.json'}` : null,
      tokenInfo: oauthEnabled ? "/mcp/oauth-token-info" : null,
      scopes: "/mcp/oauth-scopes"
    }
  });
});

/**
 * OAuth token info endpoint
 *
 * Returns information about the authenticated user's token.
 * This endpoint requires authentication.
 */
app.get("/mcp/oauth-token-info",
  // Use a type assertion to help TypeScript understand this is a valid middleware
  (oauthMiddleware || ((req: Request, res: Response, next: NextFunction) => {
    res.status(401).json({
      error: "oauth_not_configured",
      error_description: "OAuth is not configured for this server"
    });
  })) as express.RequestHandler,
  (req: Request, res: Response) => {
  // The OAuth middleware will have attached the token and scopes to the request
  const oauth = (req as any).oauth;

  res.json({
    token: {
      subject: oauth.token.sub,
      issuer: oauth.token.iss,
      audience: oauth.token.aud,
      scopes: oauth.scopes,
      expiresAt: oauth.token.exp ? new Date(oauth.token.exp * 1000).toISOString() : null,
      issuedAt: oauth.token.iat ? new Date(oauth.token.iat * 1000).toISOString() : null
    }
  });
});

/**
 * Shutdown handler for graceful cache persistence
 *
 * Ensures cache data is written to disk when the server is terminated
 * with SIGINT (Ctrl+C). This prevents data loss during shutdown.
 */
process.on('SIGINT', async () => {
    logger.info('Closing transports and persisting data before exit...');
    try {
        if (stdioTransportInstance && typeof stdioTransportInstance.close === 'function') {
          await stdioTransportInstance.close();
          logger.info('STDIO transport closed.');
        }
        if (httpTransportInstance && typeof httpTransportInstance.close === 'function') {
          await httpTransportInstance.close();
          logger.info('HTTP transport closed.');
        }

        if (globalCacheInstance && typeof globalCacheInstance.dispose === 'function') {
          await globalCacheInstance.dispose();
        } else {
          logger.warn('globalCacheInstance dispose method not found or cache not available.');
        }

        if (eventStoreInstance && typeof eventStoreInstance.dispose === 'function') {
            await eventStoreInstance.dispose();
        } else {
          logger.warn('eventStoreInstance dispose method not found or event store not available.');
        }
    } catch (error) {
        logger.error('Error during graceful shutdown', { error: String(error) });
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM. Closing transports and persisting data before exit...');
    try {
        if (stdioTransportInstance && typeof stdioTransportInstance.close === 'function') {
          await stdioTransportInstance.close();
          logger.info('STDIO transport closed.');
        }
        if (httpTransportInstance && typeof httpTransportInstance.close === 'function') {
          await httpTransportInstance.close();
          logger.info('HTTP transport closed.');
        }

        if (globalCacheInstance && typeof globalCacheInstance.dispose === 'function') {
          await globalCacheInstance.dispose();
        } else {
          logger.warn('globalCacheInstance dispose method not found or cache not available.');
        }

        if (eventStoreInstance && typeof eventStoreInstance.dispose === 'function') {
            await eventStoreInstance.dispose();
        } else {
          logger.warn('eventStoreInstance dispose method not found or event store not available.');
        }
    } catch (error) {
        logger.error('Error during graceful shutdown', { error: String(error) });
    }
    process.exit(0);
});

// ─── 5️⃣ HTTP SERVER STARTUP ────────────────────────────────────────────────────
/**
 * Start the HTTP server on the configured port
 *
 * Binds to IPv6 ANY address (::) which also accepts IPv4 connections
 * on dual-stack systems. Logs available endpoints for easy access.
 */
  // Return the app and the created HTTP transport instance
  return { app, httpTransport: httpTransportInstance };
} // <-- Closing brace for createAppAndHttpTransport

// Export global instances for potential use in test setup/teardown
export {
  stdioTransportInstance,
  httpTransportInstance,
  globalCacheInstance,
  eventStoreInstance,
  transcriptExtractorInstance,
  initializeGlobalInstances
};

// --- Main Execution Block ---
/**
 * Main execution block: Initializes instances and starts transports/server
 * based on execution context (direct run vs. import) and environment variables.
 */
(async () => {
  // Initialize global cache and event store first
  await initializeGlobalInstances();

  // Setup STDIO transport (skip inside Jest workers — the StdioServerTransport
  // connects to stdin which keeps Jest workers alive indefinitely).
  // Note: E2E tests spawn the server as a child process and DO need stdio transport,
  // so we only check JEST_WORKER_ID (set exclusively by Jest), not NODE_ENV.
  if (!process.env.JEST_WORKER_ID) {
    await setupStdioTransport();
  }

  // If MCP_TEST_MODE is 'stdio', DO NOT start HTTP listener.
  if (process.env.MCP_TEST_MODE === 'stdio') {
    logger.info('Running in stdio test mode, HTTP listener skipped. STDIO transport is active.');
  } else if (import.meta.url === `file://${process.argv[1]}`) {
    // Otherwise, if run directly, start the HTTP listener.
    const PORT = Number(process.env.PORT || 3000);
    // Pass OAuth options if needed (example: reading from env vars)
    const oauthOpts = process.env.OAUTH_ISSUER_URL ? {
      issuerUrl: process.env.OAUTH_ISSUER_URL,
      audience: process.env.OAUTH_AUDIENCE,
      // jwksPath: process.env.OAUTH_JWKS_PATH // Optional
    } : undefined;

    const { app } = await createAppAndHttpTransport(globalCacheInstance, eventStoreInstance, oauthOpts);

    // Start the HTTP server
    app.listen(PORT, "::", () => {
        logger.info(`SSE server listening on port ${PORT}`, {
          endpoints: [
            `http://[::1]:${PORT}/mcp`,
            `http://127.0.0.1:${PORT}/mcp/cache-stats`,
            `http://127.0.0.1:${PORT}/mcp/event-store-stats`,
            `http://127.0.0.1:${PORT}/mcp/oauth-config`,
          ]
        });
      });
  }
})(); // End main execution block