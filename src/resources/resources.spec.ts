/**
 * Tests for MCP Resources Module
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  trackSearch,
  getRecentSearches,
  clearRecentSearches,
  registerResources,
  type RecentSearch,
  type ServerConfig,
} from './index.js';
import { MetricsCollector } from '../shared/metricsCollector.js';
import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PersistentCache } from '../cache/index.js';

describe('MCP Resources', () => {
  beforeEach(() => {
    clearRecentSearches();
  });

  describe('trackSearch', () => {
    it('tracks a search query', () => {
      const search: RecentSearch = {
        query: 'test query',
        timestamp: new Date().toISOString(),
        resultCount: 5,
        traceId: 'trace-123',
        tool: 'google_search',
      };

      trackSearch(search);

      const recent = getRecentSearches();
      expect(recent).toHaveLength(1);
      expect(recent[0]).toEqual(search);
    });

    it('adds new searches to the front', () => {
      const search1: RecentSearch = {
        query: 'first',
        timestamp: '2024-01-01T00:00:00Z',
        resultCount: 3,
      };
      const search2: RecentSearch = {
        query: 'second',
        timestamp: '2024-01-01T01:00:00Z',
        resultCount: 5,
      };

      trackSearch(search1);
      trackSearch(search2);

      const recent = getRecentSearches();
      expect(recent[0].query).toBe('second');
      expect(recent[1].query).toBe('first');
    });

    it('limits to 20 recent searches', () => {
      for (let i = 0; i < 25; i++) {
        trackSearch({
          query: `query-${i}`,
          timestamp: new Date().toISOString(),
          resultCount: i,
        });
      }

      const recent = getRecentSearches();
      expect(recent).toHaveLength(20);
      expect(recent[0].query).toBe('query-24'); // Most recent
      expect(recent[19].query).toBe('query-5'); // Oldest kept
    });

    it('tracks different tool types', () => {
      trackSearch({
        query: 'image',
        timestamp: new Date().toISOString(),
        resultCount: 10,
        tool: 'google_image_search',
      });
      trackSearch({
        query: 'news',
        timestamp: new Date().toISOString(),
        resultCount: 5,
        tool: 'google_news_search',
      });
      trackSearch({
        query: 'research',
        timestamp: new Date().toISOString(),
        resultCount: 8,
        tool: 'search_and_scrape',
      });

      const recent = getRecentSearches();
      expect(recent[0].tool).toBe('search_and_scrape');
      expect(recent[1].tool).toBe('google_news_search');
      expect(recent[2].tool).toBe('google_image_search');
    });
  });

  describe('getRecentSearches', () => {
    it('returns empty array when no searches tracked', () => {
      const recent = getRecentSearches();
      expect(recent).toEqual([]);
    });

    it('returns a copy of the searches array', () => {
      trackSearch({
        query: 'test',
        timestamp: new Date().toISOString(),
        resultCount: 1,
      });

      const recent1 = getRecentSearches();
      const recent2 = getRecentSearches();

      expect(recent1).not.toBe(recent2);
      expect(recent1).toEqual(recent2);
    });

    it('modifications to returned array do not affect tracked searches', () => {
      trackSearch({
        query: 'test',
        timestamp: new Date().toISOString(),
        resultCount: 1,
      });

      const recent = getRecentSearches();
      recent.pop();

      expect(getRecentSearches()).toHaveLength(1);
    });
  });

  describe('clearRecentSearches', () => {
    it('clears all tracked searches', () => {
      trackSearch({
        query: 'test1',
        timestamp: new Date().toISOString(),
        resultCount: 1,
      });
      trackSearch({
        query: 'test2',
        timestamp: new Date().toISOString(),
        resultCount: 2,
      });

      expect(getRecentSearches()).toHaveLength(2);

      clearRecentSearches();

      expect(getRecentSearches()).toHaveLength(0);
    });

    it('allows tracking new searches after clearing', () => {
      trackSearch({
        query: 'before',
        timestamp: new Date().toISOString(),
        resultCount: 1,
      });

      clearRecentSearches();

      trackSearch({
        query: 'after',
        timestamp: new Date().toISOString(),
        resultCount: 2,
      });

      const recent = getRecentSearches();
      expect(recent).toHaveLength(1);
      expect(recent[0].query).toBe('after');
    });
  });

  describe('RecentSearch type', () => {
    it('allows optional fields', () => {
      const minimalSearch: RecentSearch = {
        query: 'minimal',
        timestamp: new Date().toISOString(),
        resultCount: 0,
      };

      trackSearch(minimalSearch);

      const recent = getRecentSearches();
      expect(recent[0].traceId).toBeUndefined();
      expect(recent[0].tool).toBeUndefined();
    });

    it('preserves all fields', () => {
      const fullSearch: RecentSearch = {
        query: 'full search',
        timestamp: '2024-01-15T10:30:00Z',
        resultCount: 10,
        traceId: 'abc-123-def',
        tool: 'google_search',
      };

      trackSearch(fullSearch);

      const recent = getRecentSearches();
      expect(recent[0]).toEqual(fullSearch);
    });
  });

  describe('registerResources with MetricsCollector', () => {
    let mockServer: jest.Mocked<McpServer>;
    let mockCache: jest.Mocked<PersistentCache>;
    let metricsCollector: MetricsCollector;
    let registeredResources: Map<string, { handler: (uri: URL, params?: Record<string, string>) => Promise<unknown> }>;

    beforeEach(() => {
      registeredResources = new Map();

      mockServer = {
        resource: jest.fn((name: string, uri: string, _options: unknown, handler: (uri: URL, params?: Record<string, string>) => Promise<unknown>) => {
          registeredResources.set(name, { handler });
        }),
      } as unknown as jest.Mocked<McpServer>;

      mockCache = {
        getStats: jest.fn().mockReturnValue({
          totalEntries: 10,
          hitRate: 0.75,
        }),
      } as unknown as jest.Mocked<PersistentCache>;

      metricsCollector = new MetricsCollector({
        now: () => 1700000000000, // Fixed time for testing
      });
    });

    it('registers stats://tools resource when metricsCollector is provided', () => {
      const config: ServerConfig = {
        version: '1.0.0',
        startTime: new Date('2024-01-01T00:00:00Z'),
      };

      registerResources(mockServer, mockCache, null, config, metricsCollector);

      expect(mockServer.resource).toHaveBeenCalledWith(
        'tool-stats',
        'stats://tools',
        expect.objectContaining({
          description: expect.stringContaining('Per-tool execution metrics'),
          mimeType: 'application/json',
        }),
        expect.any(Function)
      );
    });

    it('registers stats://tools/{name} resource template when metricsCollector is provided', () => {
      const config: ServerConfig = {
        version: '1.0.0',
        startTime: new Date('2024-01-01T00:00:00Z'),
      };

      registerResources(mockServer, mockCache, null, config, metricsCollector);

      expect(mockServer.resource).toHaveBeenCalledWith(
        'tool-stats-by-name',
        expect.any(ResourceTemplate),
        expect.objectContaining({
          description: expect.stringContaining('Metrics for a specific tool'),
          mimeType: 'application/json',
        }),
        expect.any(Function)
      );
    });

    it('does not register stats://tools resources when metricsCollector is not provided', () => {
      const config: ServerConfig = {
        version: '1.0.0',
        startTime: new Date('2024-01-01T00:00:00Z'),
      };

      registerResources(mockServer, mockCache, null, config);

      const resourceNames = (mockServer.resource as jest.Mock).mock.calls.map(
        (call: unknown[]) => call[0]
      );
      expect(resourceNames).not.toContain('tool-stats');
      expect(resourceNames).not.toContain('tool-stats-by-name');
    });

    it('stats://tools returns ServerMetrics with all tool data', async () => {
      const config: ServerConfig = {
        version: '1.0.0',
        startTime: new Date('2024-01-01T00:00:00Z'),
      };

      // Record some tool calls
      metricsCollector.recordCall('google_search', 100, true, false);
      metricsCollector.recordCall('google_search', 150, true, true);
      metricsCollector.recordCall('scrape_page', 200, false, false);

      registerResources(mockServer, mockCache, null, config, metricsCollector);

      const toolStatsResource = registeredResources.get('tool-stats');
      expect(toolStatsResource).toBeDefined();

      const result = await toolStatsResource!.handler(new URL('stats://tools'));
      const contents = (result as { contents: Array<{ text: string }> }).contents;
      expect(contents).toHaveLength(1);

      const data = JSON.parse(contents[0].text);
      expect(data.totalCalls).toBe(3);
      expect(data.tools).toBeDefined();
      expect(data.tools.google_search).toBeDefined();
      expect(data.tools.google_search.calls).toBe(2);
      expect(data.tools.google_search.successes).toBe(2);
      expect(data.tools.scrape_page).toBeDefined();
      expect(data.tools.scrape_page.calls).toBe(1);
      expect(data.tools.scrape_page.failures).toBe(1);
      expect(data.generatedAt).toBeDefined();
    });

    it('stats://tools/{name} returns ToolMetrics for existing tool', async () => {
      const config: ServerConfig = {
        version: '1.0.0',
        startTime: new Date('2024-01-01T00:00:00Z'),
      };

      metricsCollector.recordCall('google_search', 100, true, false);
      metricsCollector.recordCall('google_search', 150, true, true);

      registerResources(mockServer, mockCache, null, config, metricsCollector);

      const toolStatsByNameResource = registeredResources.get('tool-stats-by-name');
      expect(toolStatsByNameResource).toBeDefined();

      const result = await toolStatsByNameResource!.handler(
        new URL('stats://tools/google_search'),
        { name: 'google_search' }
      );
      const contents = (result as { contents: Array<{ text: string }> }).contents;
      expect(contents).toHaveLength(1);

      const data = JSON.parse(contents[0].text);
      expect(data.tool).toBe('google_search');
      expect(data.calls).toBe(2);
      expect(data.successes).toBe(2);
      expect(data.failures).toBe(0);
      expect(data.successRate).toBe(1);
      expect(data.cache.hits).toBe(1);
      expect(data.cache.misses).toBe(1);
      expect(data.latency).toBeDefined();
      expect(data.generatedAt).toBeDefined();
    });

    it('stats://tools/{name} returns error for non-existent tool', async () => {
      const config: ServerConfig = {
        version: '1.0.0',
        startTime: new Date('2024-01-01T00:00:00Z'),
      };

      registerResources(mockServer, mockCache, null, config, metricsCollector);

      const toolStatsByNameResource = registeredResources.get('tool-stats-by-name');
      expect(toolStatsByNameResource).toBeDefined();

      const result = await toolStatsByNameResource!.handler(
        new URL('stats://tools/nonexistent_tool'),
        { name: 'nonexistent_tool' }
      );
      const contents = (result as { contents: Array<{ text: string }> }).contents;
      expect(contents).toHaveLength(1);

      const data = JSON.parse(contents[0].text);
      expect(data.error).toBe('Tool not found');
      expect(data.tool).toBe('nonexistent_tool');
      expect(data.message).toContain('No metrics available');
      expect(data.generatedAt).toBeDefined();
    });
  });
});
