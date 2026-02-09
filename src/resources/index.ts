/**
 * MCP Resources Module
 *
 * Implements MCP Resources primitive to expose server state through
 * the standard MCP protocol.
 *
 * Resources:
 * - search://recent - Last 20 search queries
 * - config://server - Server configuration (non-sensitive)
 * - stats://cache - Cache statistics
 * - stats://events - Event store statistics
 * - search://results/{query} - Cached results for a specific query (template)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PersistentCache } from '../cache/index.js';
import type { PersistentEventStore } from '../shared/persistentEventStore.js';
import { getCurrentSessionForResource } from '../tools/sequentialSearch.js';
import { getResourceContent, listCachedResources, getResourceCacheStats } from '../shared/resourceLinks.js';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Tracked search query information
 */
export interface RecentSearch {
  /** The search query */
  query: string;
  /** ISO timestamp when search was executed */
  timestamp: string;
  /** Number of results returned */
  resultCount: number;
  /** Trace ID for debugging */
  traceId?: string;
  /** Tool that executed the search */
  tool?: 'google_search' | 'google_image_search' | 'google_news_search' | 'search_and_scrape';
}

/**
 * Server configuration for resources
 */
export interface ServerConfig {
  /** Package version */
  version: string;
  /** Server start time */
  startTime: Date;
}

// ── Recent Search Tracking ───────────────────────────────────────────────────

const MAX_RECENT_SEARCHES = 20;
let recentSearches: RecentSearch[] = [];

/**
 * Tracks a search query for the recent searches resource
 *
 * @param search - Search information to track
 */
export function trackSearch(search: RecentSearch): void {
  recentSearches.unshift(search);
  if (recentSearches.length > MAX_RECENT_SEARCHES) {
    recentSearches = recentSearches.slice(0, MAX_RECENT_SEARCHES);
  }
}

/**
 * Gets the current list of recent searches
 *
 * @returns Array of recent searches
 */
export function getRecentSearches(): RecentSearch[] {
  return [...recentSearches];
}

/**
 * Clears all tracked searches (useful for testing)
 */
export function clearRecentSearches(): void {
  recentSearches = [];
}

// ── Resource Registration ────────────────────────────────────────────────────

/**
 * Registers MCP resources with the server
 *
 * @param server - The MCP server instance
 * @param cache - The persistent cache instance
 * @param eventStore - The event store instance (optional)
 * @param config - Server configuration
 */
export function registerResources(
  server: McpServer,
  cache: PersistentCache,
  eventStore: PersistentEventStore | null,
  config: ServerConfig
): void {
  // ── search://recent ──────────────────────────────────────────────────────
  server.resource(
    'recent-searches',
    'search://recent',
    {
      description: 'List of recent search queries executed on this server',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              searches: recentSearches,
              totalCount: recentSearches.length,
              maxTracked: MAX_RECENT_SEARCHES,
              generatedAt: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    })
  );

  // ── config://server ──────────────────────────────────────────────────────
  server.resource(
    'server-config',
    'config://server',
    {
      description: 'Current server configuration (non-sensitive values)',
      mimeType: 'application/json',
    },
    async (uri) => {
      const uptime = Math.floor(
        (Date.now() - config.startTime.getTime()) / 1000
      );

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                version: config.version,
                startTime: config.startTime.toISOString(),
                uptimeSeconds: uptime,
                uptimeFormatted: formatUptime(uptime),
                features: {
                  caching: true,
                  deduplication: true,
                  circuitBreaker: true,
                  youtubeTranscripts: true,
                  documentParsing: true,
                  citationExtraction: true,
                  qualityScoring: true,
                  contentAnnotations: true,
                },
                tools: [
                  'google_search',
                  'google_image_search',
                  'google_news_search',
                  'scrape_page',
                  'search_and_scrape',
                  'sequential_search',
                  'academic_search',
                ],
                limits: {
                  maxScrapeContentSize: '50 KB',
                  maxResearchCombinedSize: '300 KB',
                  maxDocumentSize: '10 MB',
                  searchCacheTTL: '30 minutes',
                  scrapeCacheTTL: '1 hour',
                },
                generatedAt: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── stats://cache ────────────────────────────────────────────────────────
  server.resource(
    'cache-stats',
    'stats://cache',
    {
      description: 'Cache performance metrics and current state',
      mimeType: 'application/json',
    },
    async (uri) => {
      const stats = cache.getStats();

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                ...stats,
                // hitRatio is already computed in stats.metrics.hitRatio
                generatedAt: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── stats://events ───────────────────────────────────────────────────────
  if (eventStore) {
    server.resource(
      'event-stats',
      'stats://events',
      {
        description: 'Event store performance metrics',
        mimeType: 'application/json',
      },
      async (uri) => {
        const stats = await eventStore.getStats();

        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'application/json',
              text: JSON.stringify(
                {
                  ...stats,
                  generatedAt: new Date().toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );
  }

  // ── search://session/current ────────────────────────────────────────────────
  server.resource(
    'current-research-session',
    'search://session/current',
    {
      description: 'Current sequential search research session state',
      mimeType: 'application/json',
    },
    async (uri) => {
      const session = getCurrentSessionForResource();

      if (!session) {
        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'application/json',
              text: JSON.stringify(
                {
                  active: false,
                  message: 'No active research session',
                  generatedAt: new Date().toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                active: true,
                session: {
                  sessionId: session.sessionId,
                  question: session.question,
                  currentStep: session.currentStep,
                  totalStepsEstimate: session.totalStepsEstimate,
                  isComplete: session.isComplete,
                  sourceCount: session.sources.length,
                  gapsCount: session.gaps.filter(g => !g.resolved).length,
                  startedAt: session.startedAt,
                  completedAt: session.completedAt,
                },
                sources: session.sources.map(s => ({
                  url: s.url,
                  summary: s.summary,
                  qualityScore: s.qualityScore,
                })),
                gaps: session.gaps.map(g => ({
                  description: g.description,
                  resolved: g.resolved,
                })),
                generatedAt: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── stats://resources ───────────────────────────────────────────────────────
  server.resource(
    'resource-cache-stats',
    'stats://resources',
    {
      description: 'Statistics for resource_link content cache',
      mimeType: 'application/json',
    },
    async (uri) => {
      const stats = getResourceCacheStats();

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                ...stats,
                cachedUris: listCachedResources(),
                generatedAt: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}

// ── Utility Functions ────────────────────────────────────────────────────────

/**
 * Formats uptime seconds into human-readable string
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

// Re-export for convenience
export type { PersistentCache, PersistentEventStore };
