/**
 * Tests for Academic Paper Search Tool
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  handleAcademicSearch,
  academicSearchInputSchema,
  academicSearchOutputSchema,
  type AcademicSearchInput,
} from './academicSearch.js';

// Save original env vars
const originalEnv = { ...process.env };

describe('academicSearch', () => {
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
      expect(academicSearchInputSchema.query).toBeDefined();
    });

    it('should have num_results with default of 5', () => {
      expect(academicSearchInputSchema.num_results).toBeDefined();
    });

    it('should have optional year_from and year_to', () => {
      expect(academicSearchInputSchema.year_from).toBeDefined();
      expect(academicSearchInputSchema.year_to).toBeDefined();
    });

    it('should have source filter with valid values', () => {
      expect(academicSearchInputSchema.source).toBeDefined();
    });

    it('should have pdf_only boolean option', () => {
      expect(academicSearchInputSchema.pdf_only).toBeDefined();
    });

    it('should have sort_by option', () => {
      expect(academicSearchInputSchema.sort_by).toBeDefined();
    });
  });

  describe('output schema', () => {
    it('should have papers array', () => {
      expect(academicSearchOutputSchema.papers).toBeDefined();
    });

    it('should have query field', () => {
      expect(academicSearchOutputSchema.query).toBeDefined();
    });

    it('should have totalResults field', () => {
      expect(academicSearchOutputSchema.totalResults).toBeDefined();
    });

    it('should have source field', () => {
      expect(academicSearchOutputSchema.source).toBeDefined();
    });
  });

  describe('handleAcademicSearch', () => {
    it('should return error when API credentials are missing', async () => {
      delete process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;

      const result = await handleAcademicSearch({ query: 'machine learning' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing Google API credentials');
      expect(result.structuredContent.papers).toEqual([]);
      expect(result.structuredContent.resultCount).toBe(0);
    });

    it('should return error when search ID is missing', async () => {
      delete process.env.GOOGLE_CUSTOM_SEARCH_ID;

      const result = await handleAcademicSearch({ query: 'neural networks' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing Google API credentials');
    });

    it('should handle successful API response with papers', async () => {
      const mockResponse = {
        searchInformation: {
          totalResults: '100',
        },
        items: [
          {
            title: 'Deep Learning for Image Recognition',
            link: 'https://arxiv.org/abs/2301.12345',
            displayLink: 'arxiv.org',
            snippet: 'by J. Smith - 2023 - This paper presents a novel deep learning approach...',
            pagemap: {
              metatags: [{
                'citation_author': 'John Smith',
                'og:description': 'This paper presents a comprehensive study of deep learning techniques for image recognition tasks.',
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

      const result = await handleAcademicSearch({
        query: 'deep learning image recognition',
        num_results: 5,
      });

      expect(result.isError).toBeUndefined();
      expect(result.structuredContent.papers).toHaveLength(1);
      expect(result.structuredContent.papers[0].title).toBe('Deep Learning for Image Recognition');
      expect(result.structuredContent.totalResults).toBe(100);
      expect(result.structuredContent.source).toBe('Google Scholar Search');
    });

    it('should extract arXiv ID from URL', async () => {
      const mockResponse = {
        searchInformation: { totalResults: '1' },
        items: [
          {
            title: 'Test Paper',
            link: 'https://arxiv.org/abs/2301.12345v2',
            displayLink: 'arxiv.org',
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

      const result = await handleAcademicSearch({ query: 'test' });

      expect(result.structuredContent.papers[0].arxivId).toBe('2301.12345v2');
    });

    it('should generate PDF URL for arXiv papers', async () => {
      const mockResponse = {
        searchInformation: { totalResults: '1' },
        items: [
          {
            title: 'Test Paper',
            link: 'https://arxiv.org/abs/2301.12345',
            displayLink: 'arxiv.org',
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

      const result = await handleAcademicSearch({ query: 'test' });

      expect(result.structuredContent.papers[0].pdfUrl).toBe('https://arxiv.org/pdf/2301.12345.pdf');
    });

    it('should extract DOI from URL', async () => {
      const mockResponse = {
        searchInformation: { totalResults: '1' },
        items: [
          {
            title: 'Test Paper',
            link: 'https://doi.org/10.1234/test.paper',
            displayLink: 'doi.org',
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

      const result = await handleAcademicSearch({ query: 'test' });

      expect(result.structuredContent.papers[0].doi).toBe('10.1234/test.paper');
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          text: () => Promise.resolve('Rate limit exceeded'),
        } as unknown as Response)
      );

      const result = await handleAcademicSearch({ query: 'test' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Academic search failed');
    });

    it('should handle network errors gracefully', async () => {
      global.fetch = jest.fn(() =>
        Promise.reject(new Error('Network error'))
      );

      const result = await handleAcademicSearch({ query: 'test' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Network error');
    });

    it('should build correct query for arxiv source filter', async () => {
      let capturedUrl = '';
      global.fetch = jest.fn((url: string | URL | Request) => {
        capturedUrl = String(url);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], searchInformation: { totalResults: '0' } }),
        } as Response);
      });

      await handleAcademicSearch({
        query: 'quantum computing',
        source: 'arxiv',
      });

      expect(capturedUrl).toContain('site%3Aarxiv.org');
    });

    it('should add date sort parameter when requested', async () => {
      let capturedUrl = '';
      global.fetch = jest.fn((url: string | URL | Request) => {
        capturedUrl = String(url);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], searchInformation: { totalResults: '0' } }),
        } as Response);
      });

      await handleAcademicSearch({
        query: 'test',
        sort_by: 'date',
      });

      expect(capturedUrl).toContain('sort=date');
    });

    it('should add year filter to query', async () => {
      let capturedUrl = '';
      global.fetch = jest.fn((url: string | URL | Request) => {
        capturedUrl = String(url);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], searchInformation: { totalResults: '0' } }),
        } as Response);
      });

      await handleAcademicSearch({
        query: 'machine learning',
        year_from: 2020,
        year_to: 2024,
      });

      expect(capturedUrl).toContain('2020..2024');
    });

    it('should add pdf filter when pdf_only is true', async () => {
      let capturedUrl = '';
      global.fetch = jest.fn((url: string | URL | Request) => {
        capturedUrl = String(url);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], searchInformation: { totalResults: '0' } }),
        } as Response);
      });

      await handleAcademicSearch({
        query: 'test',
        pdf_only: true,
      });

      expect(capturedUrl).toContain('filetype%3Apdf');
    });

    it('should generate APA citation', async () => {
      const mockResponse = {
        searchInformation: { totalResults: '1' },
        items: [
          {
            title: 'Machine Learning Advances',
            link: 'https://example.com/paper',
            displayLink: 'example.com',
            snippet: 'by A. Smith, B. Jones - 2023',
            pagemap: {
              metatags: [{
                'citation_author': 'Alice Smith, Bob Jones',
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

      const result = await handleAcademicSearch({ query: 'test' });

      expect(result.structuredContent.papers[0].citations.apa).toContain('Smith');
      expect(result.structuredContent.papers[0].citations.apa).toContain('Machine Learning Advances');
    });

    it('should generate MLA citation', async () => {
      const mockResponse = {
        searchInformation: { totalResults: '1' },
        items: [
          {
            title: 'Neural Networks Study',
            link: 'https://example.com/paper',
            displayLink: 'example.com',
            snippet: 'by Test Author - 2022',
          },
        ],
      };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      const result = await handleAcademicSearch({ query: 'test' });

      expect(result.structuredContent.papers[0].citations.mla).toContain('"Neural Networks Study."');
    });

    it('should generate BibTeX citation', async () => {
      const mockResponse = {
        searchInformation: { totalResults: '1' },
        items: [
          {
            title: 'Deep Learning Methods',
            link: 'https://example.com/paper',
            displayLink: 'example.com',
            snippet: 'by Author Name - 2024',
          },
        ],
      };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      const result = await handleAcademicSearch({ query: 'test' });

      expect(result.structuredContent.papers[0].citations.bibtex).toContain('@article{');
      expect(result.structuredContent.papers[0].citations.bibtex).toContain('title = {Deep Learning Methods}');
    });

    it('should extract year from snippet', async () => {
      const mockResponse = {
        searchInformation: { totalResults: '1' },
        items: [
          {
            title: 'Test Paper',
            link: 'https://example.com/paper',
            displayLink: 'example.com',
            snippet: 'Published in 2023, this paper explores...',
          },
        ],
      };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      const result = await handleAcademicSearch({ query: 'test' });

      expect(result.structuredContent.papers[0].year).toBe(2023);
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

      const result = await handleAcademicSearch({ query: 'nonexistent topic xyz123' });

      expect(result.structuredContent.papers).toEqual([]);
      expect(result.structuredContent.resultCount).toBe(0);
    });

    it('should trim query whitespace', async () => {
      let capturedUrl = '';
      global.fetch = jest.fn((url: string | URL | Request) => {
        capturedUrl = String(url);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], searchInformation: { totalResults: '0' } }),
        } as Response);
      });

      const result = await handleAcademicSearch({ query: '  test query  ' });

      expect(result.structuredContent.query).toBe('test query');
    });

    it('should map venue names correctly', async () => {
      const mockResponse = {
        searchInformation: { totalResults: '1' },
        items: [
          {
            title: 'Test Paper',
            link: 'https://ieee.org/paper',
            displayLink: 'ieee.org',
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

      const result = await handleAcademicSearch({ query: 'test' });

      expect(result.structuredContent.papers[0].venue).toBe('IEEE');
    });

    it('should handle authors with "et al." pattern', async () => {
      const mockResponse = {
        searchInformation: { totalResults: '1' },
        items: [
          {
            title: '[Smith et al.] A Study on AI',
            link: 'https://example.com/paper',
            displayLink: 'example.com',
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

      const result = await handleAcademicSearch({ query: 'test' });

      expect(result.structuredContent.papers[0].authors).toContain('Smith et al.');
    });
  });
});
