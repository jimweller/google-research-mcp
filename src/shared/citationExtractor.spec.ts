/**
 * Tests for Citation Extractor
 */

import {
  extractCitationMetadata,
  formatCitations,
  createCitation,
  extractCitationFromScrapedContent,
  type CitationMetadata,
} from './citationExtractor.js';

describe('citationExtractor', () => {
  describe('extractCitationMetadata', () => {
    it('extracts title from og:title meta tag', () => {
      const html = `
        <html>
          <head>
            <meta property="og:title" content="Test Article Title">
          </head>
          <body></body>
        </html>
      `;
      const metadata = extractCitationMetadata(html, 'https://example.com/article');
      expect(metadata.title).toBe('Test Article Title');
    });

    it('extracts title from twitter:title when og:title not present', () => {
      const html = `
        <html>
          <head>
            <meta name="twitter:title" content="Twitter Title">
          </head>
          <body></body>
        </html>
      `;
      const metadata = extractCitationMetadata(html, 'https://example.com/article');
      expect(metadata.title).toBe('Twitter Title');
    });

    it('falls back to <title> tag when meta tags not present', () => {
      const html = `
        <html>
          <head>
            <title>Page Title</title>
          </head>
          <body></body>
        </html>
      `;
      const metadata = extractCitationMetadata(html, 'https://example.com/article');
      expect(metadata.title).toBe('Page Title');
    });

    it('extracts author from article:author meta tag', () => {
      const html = `
        <html>
          <head>
            <meta property="article:author" content="John Doe">
          </head>
          <body></body>
        </html>
      `;
      const metadata = extractCitationMetadata(html, 'https://example.com/article');
      expect(metadata.author).toBe('John Doe');
    });

    it('extracts author from name="author" meta tag', () => {
      const html = `
        <html>
          <head>
            <meta name="author" content="Jane Smith">
          </head>
          <body></body>
        </html>
      `;
      const metadata = extractCitationMetadata(html, 'https://example.com/article');
      expect(metadata.author).toBe('Jane Smith');
    });

    it('extracts author from JSON-LD structured data', () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@type": "Article",
                "author": {
                  "@type": "Person",
                  "name": "JSON-LD Author"
                }
              }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const metadata = extractCitationMetadata(html, 'https://example.com/article');
      expect(metadata.author).toBe('JSON-LD Author');
    });

    it('extracts publish date from article:published_time', () => {
      const html = `
        <html>
          <head>
            <meta property="article:published_time" content="2024-01-15T10:30:00Z">
          </head>
          <body></body>
        </html>
      `;
      const metadata = extractCitationMetadata(html, 'https://example.com/article');
      expect(metadata.publishedDate).toBe('2024-01-15');
    });

    it('extracts site name from og:site_name', () => {
      const html = `
        <html>
          <head>
            <meta property="og:site_name" content="Example News">
          </head>
          <body></body>
        </html>
      `;
      const metadata = extractCitationMetadata(html, 'https://example.com/article');
      expect(metadata.siteName).toBe('Example News');
    });

    it('falls back to domain name for site name', () => {
      const html = `
        <html>
          <head></head>
          <body></body>
        </html>
      `;
      const metadata = extractCitationMetadata(html, 'https://www.example.com/article');
      expect(metadata.siteName).toBe('Example');
    });

    it('extracts description from og:description', () => {
      const html = `
        <html>
          <head>
            <meta property="og:description" content="This is a test description.">
          </head>
          <body></body>
        </html>
      `;
      const metadata = extractCitationMetadata(html, 'https://example.com/article');
      expect(metadata.description).toBe('This is a test description.');
    });

    it('handles malformed JSON-LD gracefully', () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              { invalid json }
            </script>
            <title>Fallback Title</title>
          </head>
          <body></body>
        </html>
      `;
      const metadata = extractCitationMetadata(html, 'https://example.com/article');
      expect(metadata.title).toBe('Fallback Title');
    });

    it('handles empty HTML', () => {
      const metadata = extractCitationMetadata('', 'https://example.com');
      expect(metadata.siteName).toBe('Example');
    });
  });

  describe('formatCitations', () => {
    it('formats APA citation with author and date', () => {
      const metadata: CitationMetadata = {
        title: 'Test Article',
        author: 'John Doe',
        publishedDate: '2024-01-15',
        siteName: 'Example News',
      };
      const url = 'https://example.com/article';
      const accessedDate = '2024-02-01';

      const formatted = formatCitations(metadata, url, accessedDate);

      expect(formatted.apa).toContain('Doe, J.');
      // Check for year and month (day may vary by timezone)
      expect(formatted.apa).toMatch(/2024, January \d+/);
      expect(formatted.apa).toContain('Test Article');
      expect(formatted.apa).toContain('Example News');
      expect(formatted.apa).toContain(url);
    });

    it('formats APA citation without author', () => {
      const metadata: CitationMetadata = {
        title: 'Test Article',
        publishedDate: '2024-01-15',
        siteName: 'Example News',
      };
      const url = 'https://example.com/article';
      const accessedDate = '2024-02-01';

      const formatted = formatCitations(metadata, url, accessedDate);

      expect(formatted.apa.startsWith('Test Article.')).toBe(true);
      // Check for year and month (day may vary by timezone)
      expect(formatted.apa).toMatch(/2024, January \d+/);
    });

    it('formats MLA citation with author and date', () => {
      const metadata: CitationMetadata = {
        title: 'Test Article',
        author: 'John Doe',
        publishedDate: '2024-01-15',
        siteName: 'Example News',
      };
      const url = 'https://example.com/article';
      const accessedDate = '2024-02-01';

      const formatted = formatCitations(metadata, url, accessedDate);

      expect(formatted.mla).toContain('John Doe');
      expect(formatted.mla).toContain('"Test Article."');
      expect(formatted.mla).toContain('Example News');
      // Check for month and year (day may vary by timezone)
      expect(formatted.mla).toMatch(/\d+ Jan\. 2024/);
    });

    it('formats MLA citation without author', () => {
      const metadata: CitationMetadata = {
        title: 'Test Article',
        siteName: 'Example News',
      };
      const url = 'https://example.com/article';
      const accessedDate = '2024-02-01';

      const formatted = formatCitations(metadata, url, accessedDate);

      expect(formatted.mla.startsWith('"Test Article."')).toBe(true);
    });

    it('uses n.d. for APA when no date available', () => {
      const metadata: CitationMetadata = {
        title: 'Test Article',
        siteName: 'Example News',
      };
      const url = 'https://example.com/article';
      const accessedDate = '2024-02-01';

      const formatted = formatCitations(metadata, url, accessedDate);

      expect(formatted.apa).toContain('n.d.');
    });

    it('handles missing title', () => {
      const metadata: CitationMetadata = {
        siteName: 'Example News',
      };
      const url = 'https://example.com/article';
      const accessedDate = '2024-02-01';

      const formatted = formatCitations(metadata, url, accessedDate);

      expect(formatted.apa).toContain('Untitled');
      expect(formatted.mla).toContain('Untitled');
    });
  });

  describe('createCitation', () => {
    it('creates complete citation object from HTML', () => {
      const html = `
        <html>
          <head>
            <meta property="og:title" content="Test Article">
            <meta property="article:author" content="John Doe">
            <meta property="article:published_time" content="2024-01-15">
            <meta property="og:site_name" content="Example News">
          </head>
          <body></body>
        </html>
      `;
      const url = 'https://example.com/article';

      const citation = createCitation(html, url);

      expect(citation.metadata.title).toBe('Test Article');
      expect(citation.metadata.author).toBe('John Doe');
      expect(citation.metadata.publishedDate).toBe('2024-01-15');
      expect(citation.metadata.siteName).toBe('Example News');
      expect(citation.url).toBe(url);
      expect(citation.accessedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(citation.formatted.apa).toBeDefined();
      expect(citation.formatted.mla).toBeDefined();
    });

    it('handles minimal HTML', () => {
      const html = '<html><head><title>Simple Page</title></head><body></body></html>';
      const url = 'https://example.com/page';

      const citation = createCitation(html, url);

      expect(citation.metadata.title).toBe('Simple Page');
      expect(citation.url).toBe(url);
    });
  });

  describe('extractCitationFromScrapedContent', () => {
    it('extracts title from scraped content format', () => {
      const content = `Title: My Article Title
Headings: Introduction Conclusion
Paragraphs: Some text here...
Body: Full body content`;
      const url = 'https://example.com/article';

      const metadata = extractCitationFromScrapedContent(content, url);

      expect(metadata.title).toBe('My Article Title');
      expect(metadata.siteName).toBe('Example');
    });

    it('handles content without title', () => {
      const content = 'Just some plain text content';
      const url = 'https://example.com/page';

      const metadata = extractCitationFromScrapedContent(content, url);

      expect(metadata.title).toBeUndefined();
      expect(metadata.siteName).toBe('Example');
    });
  });

  describe('edge cases', () => {
    it('handles JSON-LD with @graph array', () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@graph": [
                  {
                    "@type": "Article",
                    "author": {
                      "@type": "Person",
                      "name": "Graph Author"
                    },
                    "datePublished": "2024-03-01"
                  }
                ]
              }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const metadata = extractCitationMetadata(html, 'https://example.com');
      expect(metadata.author).toBe('Graph Author');
      expect(metadata.publishedDate).toBe('2024-03-01');
    });

    it('handles array of authors in JSON-LD', () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@type": "Article",
                "author": [
                  { "@type": "Person", "name": "First Author" },
                  { "@type": "Person", "name": "Second Author" }
                ]
              }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const metadata = extractCitationMetadata(html, 'https://example.com');
      expect(metadata.author).toBe('First Author');
    });

    it('handles string author in JSON-LD', () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@type": "Article",
                "author": "Simple String Author"
              }
            </script>
          </head>
          <body></body>
        </html>
      `;
      const metadata = extractCitationMetadata(html, 'https://example.com');
      expect(metadata.author).toBe('Simple String Author');
    });

    it('handles invalid URL gracefully in domain extraction', () => {
      const metadata = extractCitationMetadata('', 'not-a-valid-url');
      expect(metadata.siteName).toBe('Unknown Source');
    });
  });
});
