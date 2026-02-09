/**
 * Tests for Output Schemas
 */

import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
import {
  googleSearchOutputSchema,
  scrapePageOutputSchema,
  searchAndScrapeOutputSchema,
  type GoogleSearchOutput,
  type ScrapePageOutput,
  type SearchAndScrapeOutput,
} from './outputSchemas.js';

describe('outputSchemas', () => {
  describe('googleSearchOutputSchema', () => {
    it('validates valid google search output', () => {
      const validOutput: GoogleSearchOutput = {
        urls: ['https://example.com', 'https://test.org'],
        query: 'test query',
        resultCount: 2,
      };

      // Create a Zod schema from the raw shape to validate
      const schema = z.object(googleSearchOutputSchema);
      const result = schema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('rejects invalid URLs', () => {
      const invalidOutput = {
        urls: ['not-a-url'],
        query: 'test query',
        resultCount: 1,
      };

      const schema = z.object(googleSearchOutputSchema);
      const result = schema.safeParse(invalidOutput);
      expect(result.success).toBe(false);
    });

    it('rejects negative result count', () => {
      const invalidOutput = {
        urls: [],
        query: 'test query',
        resultCount: -1,
      };

      const schema = z.object(googleSearchOutputSchema);
      const result = schema.safeParse(invalidOutput);
      expect(result.success).toBe(false);
    });

    it('accepts empty URLs array with zero count', () => {
      const validOutput: GoogleSearchOutput = {
        urls: [],
        query: 'no results',
        resultCount: 0,
      };

      const schema = z.object(googleSearchOutputSchema);
      const result = schema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });
  });

  describe('scrapePageOutputSchema', () => {
    it('validates valid scrape page output for HTML', () => {
      const validOutput: ScrapePageOutput = {
        url: 'https://example.com',
        content: 'Page content here',
        contentType: 'html',
        contentLength: 17,
        truncated: false,
        estimatedTokens: 5,
        sizeCategory: 'small',
      };

      const schema = z.object(scrapePageOutputSchema);
      const result = schema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('validates valid scrape page output for YouTube', () => {
      const validOutput: ScrapePageOutput = {
        url: 'https://youtube.com/watch?v=abc123XYZ00',
        content: 'Video transcript here',
        contentType: 'youtube',
        contentLength: 22,
        truncated: false,
        estimatedTokens: 6,
        sizeCategory: 'small',
      };

      const schema = z.object(scrapePageOutputSchema);
      const result = schema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('validates valid scrape page output for PDF with metadata', () => {
      const validOutput: ScrapePageOutput = {
        url: 'https://example.com/doc.pdf',
        content: 'PDF content',
        contentType: 'pdf',
        contentLength: 11,
        truncated: false,
        estimatedTokens: 3,
        sizeCategory: 'small',
        metadata: {
          title: 'My Document',
          pageCount: 10,
        },
      };

      const schema = z.object(scrapePageOutputSchema);
      const result = schema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('accepts output without metadata', () => {
      const validOutput: ScrapePageOutput = {
        url: 'https://example.com',
        content: 'Content',
        contentType: 'html',
        contentLength: 7,
        truncated: false,
        estimatedTokens: 2,
        sizeCategory: 'small',
      };

      const schema = z.object(scrapePageOutputSchema);
      const result = schema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('validates all content types', () => {
      const contentTypes: ScrapePageOutput['contentType'][] = ['html', 'youtube', 'pdf', 'docx', 'pptx'];

      for (const contentType of contentTypes) {
        const validOutput: ScrapePageOutput = {
          url: 'https://example.com',
          content: 'Content',
          contentType,
          contentLength: 7,
          truncated: false,
          estimatedTokens: 2,
          sizeCategory: 'small',
        };

        const schema = z.object(scrapePageOutputSchema);
        const result = schema.safeParse(validOutput);
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid content type', () => {
      const invalidOutput = {
        url: 'https://example.com',
        content: 'Content',
        contentType: 'invalid',
        contentLength: 7,
        truncated: false,
        estimatedTokens: 2,
        sizeCategory: 'small',
      };

      const schema = z.object(scrapePageOutputSchema);
      const result = schema.safeParse(invalidOutput);
      expect(result.success).toBe(false);
    });

    it('validates all size categories', () => {
      const categories: ScrapePageOutput['sizeCategory'][] = ['small', 'medium', 'large', 'very_large'];

      for (const sizeCategory of categories) {
        const validOutput: ScrapePageOutput = {
          url: 'https://example.com',
          content: 'Content',
          contentType: 'html',
          contentLength: 7,
          truncated: false,
          estimatedTokens: 2,
          sizeCategory,
        };

        const schema = z.object(scrapePageOutputSchema);
        const result = schema.safeParse(validOutput);
        expect(result.success).toBe(true);
      }
    });

    it('accepts output with originalLength when truncated', () => {
      const validOutput: ScrapePageOutput = {
        url: 'https://example.com',
        content: 'Truncated content...',
        contentType: 'html',
        contentLength: 20,
        truncated: true,
        estimatedTokens: 5,
        sizeCategory: 'small',
        originalLength: 50000,
      };

      const schema = z.object(scrapePageOutputSchema);
      const result = schema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });
  });

  describe('searchAndScrapeOutputSchema', () => {
    it('validates valid search and scrape output', () => {
      const validOutput: SearchAndScrapeOutput = {
        query: 'test query',
        sources: [
          { url: 'https://example.com', success: true, contentLength: 1000 },
          { url: 'https://test.org', success: false },
        ],
        combinedContent: 'Combined content from sources',
        summary: {
          urlsSearched: 3,
          urlsScraped: 2,
          processingTimeMs: 1500,
          duplicatesRemoved: 5,
          reductionPercent: 15.5,
        },
        sizeMetadata: {
          contentLength: 29,
          estimatedTokens: 8,
          truncated: false,
          sizeCategory: 'small',
        },
      };

      const schema = z.object(searchAndScrapeOutputSchema);
      const result = schema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('validates output without deduplication stats', () => {
      const validOutput: SearchAndScrapeOutput = {
        query: 'test query',
        sources: [
          { url: 'https://example.com', success: true, contentLength: 500 },
        ],
        combinedContent: 'Content',
        summary: {
          urlsSearched: 1,
          urlsScraped: 1,
          processingTimeMs: 500,
        },
        sizeMetadata: {
          contentLength: 7,
          estimatedTokens: 2,
          truncated: false,
          sizeCategory: 'small',
        },
      };

      const schema = z.object(searchAndScrapeOutputSchema);
      const result = schema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('validates output with empty sources', () => {
      const validOutput: SearchAndScrapeOutput = {
        query: 'no results query',
        sources: [],
        combinedContent: '',
        summary: {
          urlsSearched: 0,
          urlsScraped: 0,
          processingTimeMs: 100,
        },
        sizeMetadata: {
          contentLength: 0,
          estimatedTokens: 0,
          truncated: false,
          sizeCategory: 'small',
        },
      };

      const schema = z.object(searchAndScrapeOutputSchema);
      const result = schema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('validates source with only required fields', () => {
      const validOutput: SearchAndScrapeOutput = {
        query: 'test',
        sources: [
          { url: 'https://example.com', success: false },
        ],
        combinedContent: '',
        summary: {
          urlsSearched: 1,
          urlsScraped: 0,
          processingTimeMs: 1000,
        },
        sizeMetadata: {
          contentLength: 0,
          estimatedTokens: 0,
          truncated: false,
          sizeCategory: 'small',
        },
      };

      const schema = z.object(searchAndScrapeOutputSchema);
      const result = schema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('validates output with truncation metadata', () => {
      const validOutput: SearchAndScrapeOutput = {
        query: 'test',
        sources: [{ url: 'https://example.com', success: true }],
        combinedContent: 'truncated...',
        summary: {
          urlsSearched: 1,
          urlsScraped: 1,
          processingTimeMs: 500,
        },
        sizeMetadata: {
          contentLength: 12,
          estimatedTokens: 3,
          truncated: true,
          originalLength: 100000,
          sizeCategory: 'small',
        },
      };

      const schema = z.object(searchAndScrapeOutputSchema);
      const result = schema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('rejects invalid source URL', () => {
      const invalidOutput = {
        query: 'test',
        sources: [
          { url: 'not-a-url', success: true },
        ],
        combinedContent: 'Content',
        summary: {
          urlsSearched: 1,
          urlsScraped: 1,
          processingTimeMs: 500,
        },
        sizeMetadata: {
          contentLength: 7,
          estimatedTokens: 2,
          truncated: false,
          sizeCategory: 'small',
        },
      };

      const schema = z.object(searchAndScrapeOutputSchema);
      const result = schema.safeParse(invalidOutput);
      expect(result.success).toBe(false);
    });

    it('rejects missing required summary fields', () => {
      const invalidOutput = {
        query: 'test',
        sources: [],
        combinedContent: '',
        summary: {
          urlsSearched: 1,
          // Missing urlsScraped and processingTimeMs
        },
        sizeMetadata: {
          contentLength: 0,
          estimatedTokens: 0,
          truncated: false,
          sizeCategory: 'small',
        },
      };

      const schema = z.object(searchAndScrapeOutputSchema);
      const result = schema.safeParse(invalidOutput);
      expect(result.success).toBe(false);
    });
  });

  describe('type inference', () => {
    it('GoogleSearchOutput type matches schema structure', () => {
      // This test verifies the type matches at compile time
      const output: GoogleSearchOutput = {
        urls: ['https://example.com'],
        query: 'test',
        resultCount: 1,
      };

      // Should compile without errors
      expect(output.urls).toHaveLength(1);
      expect(output.query).toBe('test');
      expect(output.resultCount).toBe(1);
    });

    it('ScrapePageOutput type matches schema structure', () => {
      const output: ScrapePageOutput = {
        url: 'https://example.com',
        content: 'content',
        contentType: 'html',
        contentLength: 7,
        truncated: false,
        estimatedTokens: 2,
        sizeCategory: 'small',
        metadata: { title: 'Title', pageCount: 5 },
      };

      expect(output.contentType).toBe('html');
      expect(output.metadata?.title).toBe('Title');
      expect(output.sizeCategory).toBe('small');
    });

    it('SearchAndScrapeOutput type matches schema structure', () => {
      const output: SearchAndScrapeOutput = {
        query: 'test',
        sources: [{ url: 'https://example.com', success: true }],
        combinedContent: 'combined',
        summary: {
          urlsSearched: 1,
          urlsScraped: 1,
          processingTimeMs: 100,
        },
        sizeMetadata: {
          contentLength: 8,
          estimatedTokens: 2,
          truncated: false,
          sizeCategory: 'small',
        },
      };

      expect(output.sources).toHaveLength(1);
      expect(output.summary.processingTimeMs).toBe(100);
      expect(output.sizeMetadata.sizeCategory).toBe('small');
    });
  });
});
