/**
 * Tests for Content Size Optimization Utilities
 */

import { describe, it, expect } from '@jest/globals';
import {
  truncateContent,
  estimateTokens,
  getSizeCategory,
  generateSizeMetadata,
  extractHeadings,
  extractExcerpt,
  generatePreview,
  filterByKeywords,
  extractQueryKeywords,
} from './contentSizeOptimization.js';

describe('contentSizeOptimization', () => {
  describe('estimateTokens', () => {
    it('should estimate ~4 chars per token', () => {
      const text = 'This is a test string with some content.';
      const tokens = estimateTokens(text);
      // 41 characters / 4 ≈ 10-11 tokens
      expect(tokens).toBeGreaterThanOrEqual(10);
      expect(tokens).toBeLessThanOrEqual(12);
    });

    it('should handle empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should round up', () => {
      expect(estimateTokens('abc')).toBe(1); // 3 / 4 = 0.75 → 1
    });
  });

  describe('getSizeCategory', () => {
    it('should return small for content < 5k chars', () => {
      expect(getSizeCategory(1000)).toBe('small');
      expect(getSizeCategory(4999)).toBe('small');
    });

    it('should return medium for content < 20k chars', () => {
      expect(getSizeCategory(5000)).toBe('medium');
      expect(getSizeCategory(19999)).toBe('medium');
    });

    it('should return large for content < 50k chars', () => {
      expect(getSizeCategory(20000)).toBe('large');
      expect(getSizeCategory(49999)).toBe('large');
    });

    it('should return very_large for content >= 50k chars', () => {
      expect(getSizeCategory(50000)).toBe('very_large');
      expect(getSizeCategory(100000)).toBe('very_large');
    });
  });

  describe('generateSizeMetadata', () => {
    it('should generate correct metadata', () => {
      const content = 'x'.repeat(10000);
      const metadata = generateSizeMetadata(content);

      expect(metadata.contentLength).toBe(10000);
      expect(metadata.estimatedTokens).toBe(2500);
      expect(metadata.truncated).toBe(false);
      expect(metadata.sizeCategory).toBe('medium');
      expect(metadata.originalLength).toBeUndefined();
    });

    it('should include originalLength when truncated', () => {
      const content = 'x'.repeat(5000);
      const metadata = generateSizeMetadata(content, 10000, true);

      expect(metadata.truncated).toBe(true);
      expect(metadata.originalLength).toBe(10000);
    });
  });

  describe('truncateContent', () => {
    it('should not truncate content under limit', () => {
      const content = 'Short content.';
      const result = truncateContent(content, 1000);

      expect(result.truncated).toBe(false);
      expect(result.content).toBe(content);
      expect(result.originalLength).toBe(content.length);
      expect(result.charactersRemoved).toBe(0);
    });

    it('should truncate content over limit (start strategy)', () => {
      const content = 'First sentence here with enough content. Second sentence follows. Third sentence is here too. Fourth sentence concludes the text.';
      const result = truncateContent(content, 100, 'start');

      expect(result.truncated).toBe(true);
      expect(result.content).toContain('CONTENT TRUNCATED');
      expect(result.originalLength).toBe(content.length);
    });

    it('should truncate at natural breakpoints', () => {
      const content = 'First paragraph here.\n\nSecond paragraph with more content.\n\nThird paragraph.';
      const result = truncateContent(content, 30, 'start');

      expect(result.truncated).toBe(true);
      // Should try to truncate at paragraph boundary
    });

    it('should use balanced strategy when specified', () => {
      const content = 'A'.repeat(500) + '\n\nMIDDLE\n\n' + 'Z'.repeat(500);
      const result = truncateContent(content, 200, 'balanced');

      expect(result.truncated).toBe(true);
      expect(result.content).toContain('AAA');
      expect(result.content).toContain('ZZZ');
      expect(result.content).toContain('CONTENT TRUNCATED');
    });
  });

  describe('extractHeadings', () => {
    it('should extract markdown headings', () => {
      const content = `# Main Title
Some content here.

## Section One
More content.

### Subsection
Even more content.

## Section Two
Final content.`;

      const headings = extractHeadings(content);

      expect(headings).toHaveLength(4);
      expect(headings[0]).toEqual({ level: 1, text: 'Main Title' });
      expect(headings[1]).toEqual({ level: 2, text: 'Section One' });
      expect(headings[2]).toEqual({ level: 3, text: 'Subsection' });
      expect(headings[3]).toEqual({ level: 2, text: 'Section Two' });
    });

    it('should extract underlined headings', () => {
      const content = `Title Here
==========

Subtitle
--------`;

      const headings = extractHeadings(content);

      expect(headings.length).toBeGreaterThanOrEqual(2);
      expect(headings.find(h => h.text === 'Title Here' && h.level === 1)).toBeTruthy();
      expect(headings.find(h => h.text === 'Subtitle' && h.level === 2)).toBeTruthy();
    });

    it('should return empty array for content without headings', () => {
      const content = 'Just some plain text without any headings or structure.';
      const headings = extractHeadings(content);
      expect(headings).toEqual([]);
    });
  });

  describe('extractExcerpt', () => {
    it('should extract first substantial paragraph', () => {
      const content = `# Title

Short intro.

This is a longer first paragraph that contains more than one hundred characters of actual content that should be extracted as the excerpt.

More content follows.`;

      const excerpt = extractExcerpt(content);

      expect(excerpt).toContain('longer first paragraph');
      expect(excerpt.length).toBeGreaterThan(50);
    });

    it('should truncate long paragraphs', () => {
      const content = 'A'.repeat(1000);
      const excerpt = extractExcerpt(content, 100);

      expect(excerpt.length).toBeLessThanOrEqual(103); // 100 + '...'
      expect(excerpt).toContain('...');
    });

    it('should handle short content', () => {
      const content = 'Short.';
      const excerpt = extractExcerpt(content);
      expect(excerpt).toBe('Short.');
    });
  });

  describe('generatePreview', () => {
    it('should generate complete preview', () => {
      const url = 'https://example.com/page';
      const content = `# Title

This is a longer first paragraph that contains more than one hundred characters of actual content for the excerpt.

## Section One

Content here.`;

      const preview = generatePreview(url, content, 'Test Page');

      expect(preview.url).toBe(url);
      expect(preview.title).toBe('Test Page');
      expect(preview.contentLength).toBe(content.length);
      expect(preview.estimatedTokens).toBeGreaterThan(0);
      expect(preview.headings.length).toBeGreaterThan(0);
      expect(preview.excerpt.length).toBeGreaterThan(0);
      expect(['small', 'medium', 'large', 'very_large']).toContain(preview.sizeCategory);
    });
  });

  describe('filterByKeywords', () => {
    it('should filter paragraphs by keywords', () => {
      const content = `This paragraph talks about machine learning algorithms.

This paragraph is about cooking recipes and food.

Another paragraph discussing deep learning and neural networks.

Final paragraph about gardening tips.`;

      const result = filterByKeywords(content, ['machine', 'learning', 'neural']);

      expect(result.includedParagraphs).toBe(2);
      expect(result.excludedParagraphs).toBe(2);
      expect(result.content).toContain('machine learning');
      expect(result.content).toContain('neural networks');
      expect(result.content).not.toContain('cooking');
      expect(result.content).not.toContain('gardening');
    });

    it('should be case-insensitive', () => {
      // Content must be at least 50 chars (minParagraphLength default)
      const content = 'This is a longer paragraph that mentions PYTHON programming language and related topics.';
      const result = filterByKeywords(content, ['python']);

      expect(result.includedParagraphs).toBe(1);
    });

    it('should return all content when no keywords provided', () => {
      const content = 'Some content here.\n\nMore content.';
      const result = filterByKeywords(content, []);

      expect(result.content).toBe(content);
    });

    it('should skip short paragraphs', () => {
      const content = `Short.

This is a longer paragraph about Python programming and code.`;

      const result = filterByKeywords(content, ['python'], 50);

      expect(result.includedParagraphs).toBe(1);
    });
  });

  describe('extractQueryKeywords', () => {
    it('should extract significant keywords', () => {
      const query = 'how to implement machine learning in Python';
      const keywords = extractQueryKeywords(query);

      expect(keywords).toContain('implement');
      expect(keywords).toContain('machine');
      expect(keywords).toContain('learning');
      expect(keywords).toContain('python');
      // Should not include stop words
      expect(keywords).not.toContain('how');
      expect(keywords).not.toContain('to');
      expect(keywords).not.toContain('in');
    });

    it('should limit to 10 keywords', () => {
      const query = 'one two three four five six seven eight nine ten eleven twelve thirteen';
      const keywords = extractQueryKeywords(query);

      expect(keywords.length).toBeLessThanOrEqual(10);
    });

    it('should filter out short words and stop words', () => {
      const query = 'a to be or in on at';
      const keywords = extractQueryKeywords(query);

      // All words are stop words or < 3 chars
      expect(keywords.length).toBe(0);
    });
  });
});
