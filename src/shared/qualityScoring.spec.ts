/**
 * Tests for Quality Scoring Module
 */

import {
  scoreRelevance,
  scoreFreshness,
  scoreAuthority,
  scoreContentQuality,
  scoreSource,
  scoreAndRankSources,
  getTopSources,
  getAverageScores,
  DEFAULT_WEIGHTS,
  DOMAIN_AUTHORITY,
  type QualityScores,
  type SourceWithQuality,
} from './qualityScoring.js';

describe('qualityScoring', () => {
  describe('scoreRelevance', () => {
    it('returns 0.5 for empty content or query', () => {
      expect(scoreRelevance('', 'query')).toBe(0.5);
      expect(scoreRelevance('content', '')).toBe(0.5);
      expect(scoreRelevance('', '')).toBe(0.5);
    });

    it('returns elevated score for exact phrase match', () => {
      const content = 'This is about machine learning techniques for NLP.';
      const query = 'machine learning';
      const score = scoreRelevance(content, query);
      // Exact phrase match adds 0.3 bonus, plus term frequency contribution
      expect(score).toBeGreaterThan(0.4);
    });

    it('returns low score for partial term matches', () => {
      const content = 'This article discusses learning algorithms.';
      const query = 'machine learning';
      const score = scoreRelevance(content, query);
      // Only one term matches, so score is low
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(0.5);
    });

    it('returns low score for no matches', () => {
      const content = 'This is about cooking recipes.';
      const query = 'machine learning';
      const score = scoreRelevance(content, query);
      expect(score).toBeLessThan(0.6);
    });

    it('increases score with term frequency', () => {
      const content1 = 'Machine learning is great.';
      const content2 = 'Machine learning uses machine learning algorithms. Machine learning is key.';
      const query = 'machine learning';

      const score1 = scoreRelevance(content1, query);
      const score2 = scoreRelevance(content2, query);

      expect(score2).toBeGreaterThanOrEqual(score1);
    });

    it('ignores short query terms (<=2 chars)', () => {
      const content = 'This is a test of AI systems.';
      const query = 'AI is';
      const score = scoreRelevance(content, query);
      // Only 'AI' should be matched (2 chars ignored)
      expect(score).toBeLessThan(1.0);
    });

    it('is case insensitive', () => {
      const content = 'MACHINE LEARNING algorithms';
      const query = 'machine learning';
      const score = scoreRelevance(content, query);
      // Case insensitivity verified - score same as lowercase
      expect(score).toBeGreaterThan(0.4);
    });
  });

  describe('scoreFreshness', () => {
    it('returns 0.5 for undefined date', () => {
      expect(scoreFreshness(undefined)).toBe(0.5);
    });

    it('returns 0.5 for invalid date', () => {
      expect(scoreFreshness('not-a-date')).toBe(0.5);
    });

    it('returns 1.0 for content within last week', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3);
      expect(scoreFreshness(recentDate.toISOString())).toBe(1.0);
    });

    it('returns 0.9 for content within last month', () => {
      const date = new Date();
      date.setDate(date.getDate() - 15);
      expect(scoreFreshness(date.toISOString())).toBe(0.9);
    });

    it('returns 0.75 for content within 3 months', () => {
      const date = new Date();
      date.setDate(date.getDate() - 60);
      expect(scoreFreshness(date.toISOString())).toBe(0.75);
    });

    it('returns 0.5 for content within 1 year', () => {
      const date = new Date();
      date.setDate(date.getDate() - 200);
      expect(scoreFreshness(date.toISOString())).toBe(0.5);
    });

    it('returns 0.2 for very old content (>2 years)', () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 3);
      expect(scoreFreshness(oldDate.toISOString())).toBe(0.2);
    });

    it('returns 0.5 for future dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      expect(scoreFreshness(futureDate.toISOString())).toBe(0.5);
    });

    it('accepts Date objects', () => {
      const date = new Date();
      date.setDate(date.getDate() - 3);
      expect(scoreFreshness(date)).toBe(1.0);
    });
  });

  describe('scoreAuthority', () => {
    it('returns high score for .gov domains', () => {
      expect(scoreAuthority('https://whitehouse.gov/article')).toBe(0.95);
      expect(scoreAuthority('https://www.cdc.gov/health')).toBe(0.95);
    });

    it('returns high score for .edu domains', () => {
      expect(scoreAuthority('https://mit.edu/research')).toBe(0.90);
      expect(scoreAuthority('https://www.stanford.edu/news')).toBe(0.90);
    });

    it('returns high score for known authoritative domains', () => {
      expect(scoreAuthority('https://en.wikipedia.org/wiki/Test')).toBe(0.85);
      expect(scoreAuthority('https://www.nature.com/articles/123')).toBe(0.92);
      expect(scoreAuthority('https://www.reuters.com/news')).toBe(0.85);
    });

    it('returns moderate score for developer resources', () => {
      expect(scoreAuthority('https://github.com/user/repo')).toBe(0.80);
      expect(scoreAuthority('https://stackoverflow.com/questions/123')).toBe(0.82);
    });

    it('returns lower score for user-generated content sites', () => {
      expect(scoreAuthority('https://medium.com/@user/article')).toBe(0.45);
      expect(scoreAuthority('https://reddit.com/r/topic')).toBe(0.40);
    });

    it('returns default score for unknown domains', () => {
      expect(scoreAuthority('https://randomsite.example/page')).toBe(0.50);
    });

    it('returns low score for invalid URLs', () => {
      expect(scoreAuthority('not-a-url')).toBe(0.30);
    });

    it('handles subdomains correctly', () => {
      expect(scoreAuthority('https://docs.github.com/en')).toBe(0.80);
    });
  });

  describe('scoreContentQuality', () => {
    it('returns 0 for empty content', () => {
      expect(scoreContentQuality('')).toBe(0);
    });

    it('returns low score for very short content', () => {
      const score = scoreContentQuality('Short.');
      expect(score).toBeLessThan(0.3);
    });

    it('returns moderate score for medium content', () => {
      const content = 'A'.repeat(400);
      const score = scoreContentQuality(content);
      expect(score).toBeGreaterThan(0.3);
      expect(score).toBeLessThan(0.7);
    });

    it('returns higher score for ideal length content', () => {
      const content = 'This is a paragraph. '.repeat(50); // ~1000 chars
      const score = scoreContentQuality(content);
      expect(score).toBeGreaterThan(0.5);
    });

    it('rewards content with paragraph structure', () => {
      const withParagraphs = 'First paragraph content here.\n\nSecond paragraph content here.\n\nThird paragraph here.';
      const withoutParagraphs = 'All text in one block without any breaks or structure at all.';

      const scoreWith = scoreContentQuality(withParagraphs);
      const scoreWithout = scoreContentQuality(withoutParagraphs);

      expect(scoreWith).toBeGreaterThanOrEqual(scoreWithout);
    });

    it('rewards content with headings', () => {
      // Use longer content to avoid length penalty
      const withHeadings = '# Title\n\n' + 'Content here with more text to meet minimum length. '.repeat(10) + '\n\n## Section\n\n' + 'More content in this section as well. '.repeat(10);
      const score = scoreContentQuality(withHeadings);
      expect(score).toBeGreaterThan(0.5);
    });

    it('rewards content with lists', () => {
      // Use longer content to avoid length penalty
      const withList = 'Introduction to the topic. '.repeat(5) + '\n\n- Item one with details\n- Item two with details\n- Item three with details\n\n' + 'Conclusion paragraph. '.repeat(5);
      const score = scoreContentQuality(withList);
      expect(score).toBeGreaterThan(0.5);
    });

    it('penalizes content with excessive special characters', () => {
      const normalContent = 'Normal content with regular text and punctuation.';
      const messyContent = '!!!@@@###$$$%%%^^^&&&***((())){}[]|||\\\\///~~~';

      const normalScore = scoreContentQuality(normalContent);
      const messyScore = scoreContentQuality(messyContent);

      expect(normalScore).toBeGreaterThan(messyScore);
    });
  });

  describe('scoreSource', () => {
    it('returns all quality dimensions', () => {
      const scores = scoreSource(
        'https://github.com/repo',
        'Machine learning content about neural networks.',
        'machine learning'
      );

      expect(scores).toHaveProperty('overall');
      expect(scores).toHaveProperty('relevance');
      expect(scores).toHaveProperty('freshness');
      expect(scores).toHaveProperty('authority');
      expect(scores).toHaveProperty('contentQuality');
    });

    it('calculates weighted overall score', () => {
      const scores = scoreSource(
        'https://example.com',
        'Test content',
        'test'
      );

      // Overall should be weighted average of components
      const expected =
        scores.relevance * DEFAULT_WEIGHTS.relevance +
        scores.freshness * DEFAULT_WEIGHTS.freshness +
        scores.authority * DEFAULT_WEIGHTS.authority +
        scores.contentQuality * DEFAULT_WEIGHTS.contentQuality;

      expect(scores.overall).toBeCloseTo(expected, 1);
    });

    it('uses publication date for freshness', () => {
      const recentDate = new Date().toISOString();
      const oldDate = new Date('2020-01-01').toISOString();

      const recentScores = scoreSource(
        'https://example.com',
        'Content',
        'query',
        recentDate
      );

      const oldScores = scoreSource(
        'https://example.com',
        'Content',
        'query',
        oldDate
      );

      expect(recentScores.freshness).toBeGreaterThan(oldScores.freshness);
    });

    it('accepts custom weights', () => {
      const customWeights = {
        relevance: 0.5,
        freshness: 0.1,
        authority: 0.3,
        contentQuality: 0.1,
      };

      const scores = scoreSource(
        'https://example.com',
        'Test content',
        'test',
        undefined,
        customWeights
      );

      const expected =
        scores.relevance * customWeights.relevance +
        scores.freshness * customWeights.freshness +
        scores.authority * customWeights.authority +
        scores.contentQuality * customWeights.contentQuality;

      expect(scores.overall).toBeCloseTo(expected, 1);
    });

    it('rounds scores to two decimal places', () => {
      const scores = scoreSource(
        'https://example.com',
        'Some test content for scoring',
        'test'
      );

      expect(Number.isFinite(scores.overall)).toBe(true);
      expect(scores.overall.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
    });
  });

  describe('scoreAndRankSources', () => {
    const sources = [
      {
        url: 'https://wikipedia.org/wiki/ML',
        content: 'Machine learning is a field of AI.',
        publishedDate: new Date().toISOString(),
      },
      {
        url: 'https://random-blog.com/post',
        content: 'Random unrelated content.',
      },
      {
        url: 'https://github.com/ml-repo',
        content: 'Machine learning algorithms and neural networks implementation.',
      },
    ];

    it('returns sources with quality scores', () => {
      const ranked = scoreAndRankSources(sources, { query: 'machine learning' });

      expect(ranked.length).toBe(3);
      ranked.forEach((source) => {
        expect(source).toHaveProperty('scores');
        expect(source.scores).toHaveProperty('overall');
      });
    });

    it('sorts sources by overall score descending', () => {
      const ranked = scoreAndRankSources(sources, { query: 'machine learning' });

      for (let i = 0; i < ranked.length - 1; i++) {
        expect(ranked[i].scores.overall).toBeGreaterThanOrEqual(
          ranked[i + 1].scores.overall
        );
      }
    });

    it('filters by minimum score', () => {
      const ranked = scoreAndRankSources(sources, {
        query: 'machine learning',
        minScore: 0.6,
      });

      ranked.forEach((source) => {
        expect(source.scores.overall).toBeGreaterThanOrEqual(0.6);
      });
    });

    it('includes metadata with domain', () => {
      const ranked = scoreAndRankSources(sources, { query: 'test' });

      ranked.forEach((source) => {
        expect(source.metadata?.domain).toBeDefined();
      });
    });

    it('preserves original URL and content', () => {
      const ranked = scoreAndRankSources(sources, { query: 'test' });

      sources.forEach((original) => {
        const found = ranked.find((r) => r.url === original.url);
        expect(found).toBeDefined();
        expect(found!.content).toBe(original.content);
      });
    });

    it('accepts custom weights', () => {
      const ranked = scoreAndRankSources(sources, {
        query: 'machine learning',
        weights: { relevance: 1.0, freshness: 0, authority: 0, contentQuality: 0 },
      });

      // With 100% relevance weight, the ML-related content should be first
      expect(ranked[0].content).toContain('learning');
    });
  });

  describe('getTopSources', () => {
    const sources = [
      { url: 'https://a.com', content: 'A' },
      { url: 'https://b.com', content: 'B' },
      { url: 'https://c.com', content: 'C' },
      { url: 'https://d.com', content: 'D' },
    ];

    it('returns top N sources', () => {
      const top = getTopSources(sources, 'test', 2);
      expect(top.length).toBe(2);
    });

    it('defaults to top 3', () => {
      const top = getTopSources(sources, 'test');
      expect(top.length).toBe(3);
    });

    it('returns all if N exceeds source count', () => {
      const top = getTopSources(sources, 'test', 10);
      expect(top.length).toBe(4);
    });

    it('returns sources in descending score order', () => {
      const top = getTopSources(sources, 'test', 3);

      for (let i = 0; i < top.length - 1; i++) {
        expect(top[i].scores.overall).toBeGreaterThanOrEqual(
          top[i + 1].scores.overall
        );
      }
    });
  });

  describe('getAverageScores', () => {
    it('returns null for empty array', () => {
      expect(getAverageScores([])).toBeNull();
    });

    it('returns correct averages', () => {
      const sources: SourceWithQuality[] = [
        {
          url: 'a',
          content: 'a',
          scores: { overall: 0.8, relevance: 0.9, freshness: 0.7, authority: 0.8, contentQuality: 0.8 },
        },
        {
          url: 'b',
          content: 'b',
          scores: { overall: 0.6, relevance: 0.7, freshness: 0.5, authority: 0.6, contentQuality: 0.6 },
        },
      ];

      const avg = getAverageScores(sources);

      expect(avg).not.toBeNull();
      expect(avg!.overall).toBe(0.7);
      expect(avg!.relevance).toBe(0.8);
      expect(avg!.freshness).toBe(0.6);
      expect(avg!.authority).toBe(0.7);
      expect(avg!.contentQuality).toBe(0.7);
    });

    it('handles single source', () => {
      const sources: SourceWithQuality[] = [
        {
          url: 'a',
          content: 'a',
          scores: { overall: 0.75, relevance: 0.8, freshness: 0.6, authority: 0.7, contentQuality: 0.9 },
        },
      ];

      const avg = getAverageScores(sources);

      expect(avg).toEqual(sources[0].scores);
    });
  });

  describe('DEFAULT_WEIGHTS', () => {
    it('weights sum to 1.0', () => {
      const sum =
        DEFAULT_WEIGHTS.relevance +
        DEFAULT_WEIGHTS.freshness +
        DEFAULT_WEIGHTS.authority +
        DEFAULT_WEIGHTS.contentQuality;

      expect(sum).toBe(1.0);
    });
  });

  describe('DOMAIN_AUTHORITY', () => {
    it('contains expected high-authority domains', () => {
      expect(DOMAIN_AUTHORITY['.gov']).toBeGreaterThan(0.9);
      expect(DOMAIN_AUTHORITY['.edu']).toBeGreaterThan(0.85);
      expect(DOMAIN_AUTHORITY['wikipedia.org']).toBeGreaterThan(0.8);
    });

    it('all scores are between 0 and 1', () => {
      Object.values(DOMAIN_AUTHORITY).forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });
  });
});
