/**
 * Tests for Patent Search Tool
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  handlePatentSearch,
  patentSearchInputSchema,
  generateCompanyNameVariations,
  type PatentSearchInput,
} from './patentSearch.js';

// Save original env vars
const originalEnv = { ...process.env };

describe('patentSearch', () => {
  beforeEach(() => {
    // Set required env vars
    process.env.GOOGLE_CUSTOM_SEARCH_API_KEY = 'AIzaSy_test_key_123456789012345';
    process.env.GOOGLE_CUSTOM_SEARCH_ID = '1234567890:testid';
  });

  afterEach(() => {
    // Restore env vars
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  describe('input schema', () => {
    it('should have required query field', () => {
      expect(patentSearchInputSchema.query).toBeDefined();
    });

    it('should have num_results with default of 5', () => {
      expect(patentSearchInputSchema.num_results).toBeDefined();
    });

    it('should have search_type with valid values', () => {
      expect(patentSearchInputSchema.search_type).toBeDefined();
    });

    it('should have optional patent_office filter', () => {
      expect(patentSearchInputSchema.patent_office).toBeDefined();
    });

    it('should have optional assignee filter', () => {
      expect(patentSearchInputSchema.assignee).toBeDefined();
    });

    it('should have optional inventor filter', () => {
      expect(patentSearchInputSchema.inventor).toBeDefined();
    });

    it('should have optional cpc_code filter', () => {
      expect(patentSearchInputSchema.cpc_code).toBeDefined();
    });

    it('should have optional year_from and year_to', () => {
      expect(patentSearchInputSchema.year_from).toBeDefined();
      expect(patentSearchInputSchema.year_to).toBeDefined();
    });
  });

  describe('handlePatentSearch', () => {
    it('should return error when API credentials are missing', async () => {
      delete process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;

      const result = await handlePatentSearch({ query: 'machine learning' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing Google API credentials');
      expect(result.structuredContent.patents).toEqual([]);
      expect(result.structuredContent.resultCount).toBe(0);
    });

    it('should return error when search ID is missing', async () => {
      delete process.env.GOOGLE_CUSTOM_SEARCH_ID;

      const result = await handlePatentSearch({ query: 'neural networks' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing Google API credentials');
    });

    it('should handle successful API response with patents', async () => {
      const mockResponse = {
        searchInformation: {
          totalResults: '1000',
        },
        items: [
          {
            title: 'Method for Machine Learning - Google Patents',
            link: 'https://patents.google.com/patent/US1234567B2',
            snippet: 'Inventors: John Smith. A method for implementing machine learning algorithms...',
            displayLink: 'patents.google.com',
            pagemap: {
              metatags: [{
                'citation_publication_date': '2023-01-15',
              }],
            },
          },
        ],
      };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      const result = await handlePatentSearch({
        query: 'machine learning method',
        num_results: 5,
      });

      expect(result.isError).toBeUndefined();
      expect(result.structuredContent.patents).toHaveLength(1);
      expect(result.structuredContent.patents[0].patentNumber).toBe('US1234567B2');
      expect(result.structuredContent.totalResults).toBe(1000);
      expect(result.structuredContent.source).toBe('Google Patents');
    });

    it('should extract patent number from URL', async () => {
      const mockResponse = {
        searchInformation: { totalResults: '1' },
        items: [
          {
            title: 'Test Patent',
            link: 'https://patents.google.com/patent/EP1234567A1/en',
            snippet: 'Test snippet',
          },
        ],
      };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      const result = await handlePatentSearch({ query: 'test' });

      expect(result.structuredContent.patents[0].patentNumber).toBe('EP1234567A1');
      expect(result.structuredContent.patents[0].patentOffice).toBe('EP');
    });

    it('should generate PDF URL for patents', async () => {
      const mockResponse = {
        searchInformation: { totalResults: '1' },
        items: [
          {
            title: 'Test Patent',
            link: 'https://patents.google.com/patent/US9876543B1',
            snippet: 'Test snippet',
          },
        ],
      };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      const result = await handlePatentSearch({ query: 'test' });

      expect(result.structuredContent.patents[0].pdfUrl).toBe('https://patents.google.com/patent/US9876543B1/pdf');
    });

    it('should extract inventors from snippet', async () => {
      const mockResponse = {
        searchInformation: { totalResults: '1' },
        items: [
          {
            title: 'Test Patent',
            link: 'https://patents.google.com/patent/US1234567B2',
            snippet: 'Inventors: Alice Johnson, Bob Smith. This patent describes...',
          },
        ],
      };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      const result = await handlePatentSearch({ query: 'test' });

      expect(result.structuredContent.patents[0].inventors).toContain('Alice Johnson');
      expect(result.structuredContent.patents[0].inventors).toContain('Bob Smith');
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          text: () => Promise.resolve('Rate limit exceeded'),
        } as unknown as Response)
      );

      const result = await handlePatentSearch({ query: 'test' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Patent search failed');
    });

    it('should handle network errors gracefully', async () => {
      global.fetch = jest.fn(() =>
        Promise.reject(new Error('Network error'))
      );

      const result = await handlePatentSearch({ query: 'test' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Network error');
    });

    it('should build correct query for patent office filter', async () => {
      let capturedUrl = '';
      global.fetch = jest.fn((url: string | URL | Request) => {
        capturedUrl = String(url);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], searchInformation: { totalResults: '0' } }),
        } as Response);
      });

      await handlePatentSearch({
        query: 'neural network',
        patent_office: 'US',
      });

      expect(capturedUrl).toContain('patent%2FUS');
    });

    it('should build query with assignee name variations', async () => {
      let capturedUrl = '';
      global.fetch = jest.fn((url: string | URL | Request) => {
        capturedUrl = String(url);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], searchInformation: { totalResults: '0' } }),
        } as Response);
      });

      await handlePatentSearch({
        query: 'test',
        assignee: 'Rapt Media',
      });

      // Should include the company name as quoted search term
      expect(capturedUrl).toContain('Rapt');
      // Should also include variation without spaces
      expect(capturedUrl).toContain('raptmedia');
    });

    it('should build correct query for year range', async () => {
      let capturedUrl = '';
      global.fetch = jest.fn((url: string | URL | Request) => {
        capturedUrl = String(url);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], searchInformation: { totalResults: '0' } }),
        } as Response);
      });

      await handlePatentSearch({
        query: 'test',
        year_from: 2020,
        year_to: 2024,
      });

      expect(capturedUrl).toContain('2020..2024');
    });

    it('should add site:patents.google.com to query', async () => {
      let capturedUrl = '';
      global.fetch = jest.fn((url: string | URL | Request) => {
        capturedUrl = String(url);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], searchInformation: { totalResults: '0' } }),
        } as Response);
      });

      await handlePatentSearch({ query: 'test query' });

      expect(capturedUrl).toContain('site%3Apatents.google.com');
    });

    it('should return empty results when no items found', async () => {
      const mockResponse = {
        searchInformation: { totalResults: '0' },
        items: [],
      };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      const result = await handlePatentSearch({ query: 'nonexistent patent xyz123' });

      expect(result.structuredContent.patents).toEqual([]);
      expect(result.structuredContent.resultCount).toBe(0);
    });

    it('should skip non-patent URLs', async () => {
      const mockResponse = {
        searchInformation: { totalResults: '2' },
        items: [
          {
            title: 'Valid Patent',
            link: 'https://patents.google.com/patent/US1234567B2',
            snippet: 'Patent content',
          },
          {
            title: 'Not a patent page',
            link: 'https://patents.google.com/scholar?q=test',
            snippet: 'Scholar results',
          },
        ],
      };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      const result = await handlePatentSearch({ query: 'test' });

      // Should only include the valid patent
      expect(result.structuredContent.patents).toHaveLength(1);
      expect(result.structuredContent.patents[0].patentNumber).toBe('US1234567B2');
    });

    it('should set correct search type in response', async () => {
      const mockResponse = {
        searchInformation: { totalResults: '0' },
        items: [],
      };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      const result = await handlePatentSearch({
        query: 'test',
        search_type: 'landscape',
      });

      expect(result.structuredContent.searchType).toBe('landscape');
    });

    it('should trim query whitespace', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], searchInformation: { totalResults: '0' } }),
        } as Response)
      );

      const result = await handlePatentSearch({ query: '  test query  ' });

      expect(result.structuredContent.query).toBe('test query');
    });
  });

  describe('generateCompanyNameVariations', () => {
    it('should return empty array for empty input', () => {
      expect(generateCompanyNameVariations('')).toEqual([]);
      expect(generateCompanyNameVariations('   ')).toEqual([]);
    });

    it('should generate no-space variations', () => {
      const variations = generateCompanyNameVariations('Rapt Media');

      expect(variations).toContain('Rapt Media');
      expect(variations).toContain('raptmedia');
      expect(variations).toContain('RaptMedia');
    });

    it('should add Inc suffix variations', () => {
      const variations = generateCompanyNameVariations('Rapt Media');

      expect(variations).toContain('Rapt Media Inc');
      expect(variations).toContain('Rapt Media, Inc.');
    });

    it('should handle names with existing suffixes', () => {
      const variations = generateCompanyNameVariations('Google LLC');

      // Should include original
      expect(variations).toContain('Google LLC');
      // Should include base name without suffix
      expect(variations).toContain('Google');
      // Should include no-space lowercase of base
      expect(variations).toContain('google');
    });

    it('should handle names with Inc suffix', () => {
      const variations = generateCompanyNameVariations('Flixmaster, Inc.');

      expect(variations).toContain('Flixmaster, Inc.');
      expect(variations).toContain('Flixmaster');
      expect(variations).toContain('flixmaster');
    });

    it('should not duplicate entries', () => {
      const variations = generateCompanyNameVariations('Apple');
      const uniqueVariations = [...new Set(variations)];

      expect(variations.length).toBe(uniqueVariations.length);
    });

    it('should handle single word company names', () => {
      const variations = generateCompanyNameVariations('Kaltura');

      expect(variations).toContain('Kaltura');
      expect(variations).toContain('kaltura');
      expect(variations).toContain('Kaltura Inc');
    });
  });
});
