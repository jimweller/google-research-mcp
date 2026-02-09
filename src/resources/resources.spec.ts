/**
 * Tests for MCP Resources Module
 */

import {
  trackSearch,
  getRecentSearches,
  clearRecentSearches,
  type RecentSearch,
} from './index.js';

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
});
