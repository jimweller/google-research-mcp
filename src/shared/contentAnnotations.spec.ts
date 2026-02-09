/**
 * Tests for Content Annotations Module
 */

import {
  createAnnotatedContent,
  annotateSearchResults,
  annotateScrapedContent,
  annotateResearchContent,
  annotateImageResults,
  annotateNewsResults,
  annotateError,
  AnnotationPresets,
  type AnnotatedTextContent,
} from './contentAnnotations.js';

describe('contentAnnotations', () => {
  describe('AnnotationPresets', () => {
    it('has correct primaryResult preset', () => {
      expect(AnnotationPresets.primaryResult).toEqual({
        audience: ['user', 'assistant'],
        priority: 1.0,
      });
    });

    it('has correct supportingContext preset', () => {
      expect(AnnotationPresets.supportingContext).toEqual({
        audience: ['assistant'],
        priority: 0.7,
      });
    });

    it('has correct metadata preset', () => {
      expect(AnnotationPresets.metadata).toEqual({
        audience: ['user', 'assistant'],
        priority: 0.3,
      });
    });

    it('has correct error preset', () => {
      expect(AnnotationPresets.error).toEqual({
        audience: ['user', 'assistant'],
        priority: 0.9,
      });
    });

    it('has correct citation preset', () => {
      expect(AnnotationPresets.citation).toEqual({
        audience: ['assistant'],
        priority: 0.6,
      });
    });

    it('has correct summary preset', () => {
      expect(AnnotationPresets.summary).toEqual({
        audience: ['user'],
        priority: 0.8,
      });
    });

    it('searchResult preset returns descending priority', () => {
      expect(AnnotationPresets.searchResult(0).priority).toBe(1.0);
      expect(AnnotationPresets.searchResult(1).priority).toBe(0.95);
      expect(AnnotationPresets.searchResult(5).priority).toBe(0.75);
      expect(AnnotationPresets.searchResult(10).priority).toBe(0.5); // Minimum 0.5
      expect(AnnotationPresets.searchResult(20).priority).toBe(0.5); // Capped at 0.5
    });
  });

  describe('createAnnotatedContent', () => {
    it('creates annotated content with text and annotations', () => {
      const result = createAnnotatedContent('Test content', {
        audience: ['user'],
        priority: 0.8,
      });

      expect(result.type).toBe('text');
      expect(result.text).toBe('Test content');
      expect(result.annotations?.audience).toEqual(['user']);
      expect(result.annotations?.priority).toBe(0.8);
    });

    it('adds lastModified timestamp', () => {
      const before = new Date().toISOString();
      const result = createAnnotatedContent('Test', { priority: 1.0 });
      const after = new Date().toISOString();

      expect(result.annotations?.lastModified).toBeDefined();
      expect(result.annotations!.lastModified! >= before).toBe(true);
      expect(result.annotations!.lastModified! <= after).toBe(true);
    });

    it('preserves existing annotations', () => {
      const result = createAnnotatedContent('Test', {
        audience: ['assistant'],
        priority: 0.5,
      });

      expect(result.annotations?.audience).toEqual(['assistant']);
      expect(result.annotations?.priority).toBe(0.5);
    });
  });

  describe('annotateSearchResults', () => {
    it('creates annotated blocks for search results', () => {
      const urls = ['https://example.com/1', 'https://example.com/2'];
      const results = annotateSearchResults(urls, 'test query');

      expect(results.length).toBe(3); // 1 summary + 2 URLs
    });

    it('includes summary with correct annotations', () => {
      const urls = ['https://example.com'];
      const results = annotateSearchResults(urls, 'test query');

      expect(results[0].text).toContain('Found 1 results for');
      expect(results[0].text).toContain('test query');
      expect(results[0].annotations?.audience).toEqual(['user']);
      expect(results[0].annotations?.priority).toBe(0.8);
    });

    it('assigns descending priority to URLs', () => {
      const urls = [
        'https://example.com/1',
        'https://example.com/2',
        'https://example.com/3',
      ];
      const results = annotateSearchResults(urls, 'query');

      expect(results[1].annotations?.priority).toBe(1.0);
      expect(results[2].annotations?.priority).toBe(0.95);
      expect(results[3].annotations?.priority).toBe(0.9);
    });

    it('handles empty URL list', () => {
      const results = annotateSearchResults([], 'query');

      expect(results.length).toBe(1);
      expect(results[0].text).toContain('Found 0 results');
    });
  });

  describe('annotateScrapedContent', () => {
    it('creates annotated block for main content', () => {
      const results = annotateScrapedContent('Page content here');

      expect(results.length).toBe(1);
      expect(results[0].text).toBe('Page content here');
      expect(results[0].annotations?.priority).toBe(1.0);
    });

    it('includes title when provided', () => {
      const results = annotateScrapedContent('Content', {
        title: 'Page Title',
      });

      expect(results.length).toBe(2);
      expect(results[0].text).toBe('Title: Page Title');
      expect(results[0].annotations?.priority).toBe(0.3); // metadata
    });

    it('includes truncation warning when truncated', () => {
      const results = annotateScrapedContent('Content', { truncated: true });

      expect(results.length).toBe(2);
      expect(results[1].text).toContain('truncated');
      expect(results[1].annotations?.priority).toBe(0.3); // metadata
    });

    it('includes both title and truncation warning', () => {
      const results = annotateScrapedContent('Content', {
        title: 'Title',
        truncated: true,
      });

      expect(results.length).toBe(3);
      expect(results[0].text).toContain('Title');
      expect(results[2].text).toContain('truncated');
    });
  });

  describe('annotateResearchContent', () => {
    it('creates annotated blocks for research results', () => {
      const sources = [
        { url: 'https://example.com/1', success: true, contentLength: 1000 },
        { url: 'https://example.com/2', success: true, contentLength: 500 },
      ];
      const stats = { processingTimeMs: 1500 };

      const results = annotateResearchContent('Combined content', sources, stats);

      expect(results.length).toBe(3); // content + sources + stats
    });

    it('marks main content as primary result', () => {
      const sources = [{ url: 'https://example.com', success: true }];
      const stats = { processingTimeMs: 100 };

      const results = annotateResearchContent('Main content', sources, stats);

      expect(results[0].text).toBe('Main content');
      expect(results[0].annotations?.priority).toBe(1.0);
    });

    it('includes source list with citation priority', () => {
      const sources = [
        { url: 'https://example.com/1', success: true },
        { url: 'https://example.com/2', success: true },
        { url: 'https://example.com/3', success: false },
      ];
      const stats = { processingTimeMs: 100 };

      const results = annotateResearchContent('Content', sources, stats);
      const sourceBlock = results.find((r) => r.text.includes('Sources'));

      expect(sourceBlock).toBeDefined();
      expect(sourceBlock!.text).toContain('1. https://example.com/1');
      expect(sourceBlock!.text).toContain('2. https://example.com/2');
      expect(sourceBlock!.text).not.toContain('example.com/3'); // Failed source
      expect(sourceBlock!.annotations?.priority).toBe(0.6); // citation
    });

    it('includes processing stats', () => {
      const sources = [{ url: 'https://example.com', success: true }];
      const stats = {
        processingTimeMs: 2500,
        duplicatesRemoved: 5,
        reductionPercent: 15.5,
      };

      const results = annotateResearchContent('Content', sources, stats);
      const statsBlock = results.find((r) => r.text.includes('2500ms'));

      expect(statsBlock).toBeDefined();
      expect(statsBlock!.text).toContain('5 duplicates removed');
      expect(statsBlock!.text).toContain('15.5% reduction');
      expect(statsBlock!.annotations?.priority).toBe(0.3); // metadata
    });

    it('handles empty sources', () => {
      const results = annotateResearchContent('Content', [], {
        processingTimeMs: 100,
      });

      // Should still have content and stats, but no source block
      expect(results.length).toBe(2);
    });
  });

  describe('annotateImageResults', () => {
    it('creates annotated blocks for image results', () => {
      const images = [
        {
          title: 'Image 1',
          link: 'https://example.com/img1.jpg',
          width: 800,
          height: 600,
        },
        {
          title: 'Image 2',
          link: 'https://example.com/img2.jpg',
        },
      ];

      const results = annotateImageResults(images, 'test query');

      expect(results.length).toBe(3); // 1 summary + 2 images
    });

    it('includes summary with correct count', () => {
      const images = [{ title: 'Img', link: 'https://example.com/img.jpg' }];
      const results = annotateImageResults(images, 'query');

      expect(results[0].text).toContain('Found 1 images');
      expect(results[0].annotations?.priority).toBe(0.8);
    });

    it('includes image dimensions when available', () => {
      const images = [
        { title: 'Test', link: 'https://example.com/img.jpg', width: 1920, height: 1080 },
      ];
      const results = annotateImageResults(images, 'query');

      expect(results[1].text).toContain('1920x1080');
    });

    it('includes thumbnail and context links', () => {
      const images = [
        {
          title: 'Test',
          link: 'https://example.com/img.jpg',
          thumbnailLink: 'https://example.com/thumb.jpg',
          contextLink: 'https://example.com/page',
        },
      ];
      const results = annotateImageResults(images, 'query');

      expect(results[1].text).toContain('Thumbnail: https://example.com/thumb.jpg');
      expect(results[1].text).toContain('Source: https://example.com/page');
    });
  });

  describe('annotateNewsResults', () => {
    it('creates annotated blocks for news articles', () => {
      const articles = [
        {
          title: 'Breaking News',
          link: 'https://news.com/article1',
          snippet: 'This is breaking news...',
          source: 'News Site',
          publishedDate: '2024-01-15T10:00:00Z',
        },
      ];

      const results = annotateNewsResults(articles, 'query');

      expect(results.length).toBe(2); // 1 summary + 1 article
    });

    it('includes summary with correct count', () => {
      const articles = [
        { title: 'News', link: 'https://news.com', snippet: 'Test', source: 'Source' },
      ];
      const results = annotateNewsResults(articles, 'test');

      expect(results[0].text).toContain('Found 1 news articles');
      expect(results[0].annotations?.priority).toBe(0.8);
    });

    it('includes publication date when available', () => {
      const articles = [
        {
          title: 'News',
          link: 'https://news.com',
          snippet: 'Test',
          source: 'Source',
          publishedDate: '2024-01-15T10:00:00Z',
        },
      ];
      const results = annotateNewsResults(articles, 'query');

      // Date format may vary by locale, just check it's included
      expect(results[1].text).toMatch(/\d+\/\d+\/\d+|\d+-\d+-\d+|Jan|1\/15/);
    });

    it('handles missing publication date', () => {
      const articles = [
        { title: 'News', link: 'https://news.com', snippet: 'Test', source: 'Source' },
      ];
      const results = annotateNewsResults(articles, 'query');

      expect(results[1].text).not.toContain('()'); // Empty date parens
    });
  });

  describe('annotateError', () => {
    it('creates error annotation with high priority', () => {
      const result = annotateError('Something went wrong');

      expect(result.type).toBe('text');
      expect(result.text).toBe('Something went wrong');
      expect(result.annotations?.priority).toBe(0.9);
      expect(result.annotations?.audience).toEqual(['user', 'assistant']);
    });

    it('includes details when provided', () => {
      const result = annotateError('Error occurred', 'Additional details here');

      expect(result.text).toBe('Error occurred\nAdditional details here');
    });

    it('handles undefined details', () => {
      const result = annotateError('Error message', undefined);

      expect(result.text).toBe('Error message');
    });
  });
});
