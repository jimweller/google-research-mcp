/**
 * Content Annotations Module
 *
 * Adds MCP-compliant content annotations to tool responses.
 * Per MCP spec 2025-11-25, annotations include:
 * - audience: who should see the content ("user" | "assistant")
 * - priority: importance weight (0.0 - 1.0)
 * - lastModified: ISO 8601 timestamp
 */

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * MCP content annotations interface
 */
export interface ContentAnnotations {
  /** Who should see this content */
  audience?: ('user' | 'assistant')[];
  /** Importance weight (0.0 - 1.0, where 1.0 is most important) */
  priority?: number;
  /** ISO 8601 timestamp of when content was last modified */
  lastModified?: string;
}

/**
 * Text content block with annotations
 */
export interface AnnotatedTextContent {
  type: 'text';
  text: string;
  annotations?: ContentAnnotations;
}

/**
 * Source metadata for annotation helpers
 */
export interface SourceMetadata {
  url: string;
  success: boolean;
  contentLength?: number;
}

/**
 * Stats metadata for research annotation
 */
export interface ResearchStats {
  processingTimeMs: number;
  duplicatesRemoved?: number;
  reductionPercent?: number;
}

// ── Annotation Presets ───────────────────────────────────────────────────────

/**
 * Pre-configured annotation presets for common use cases
 */
export const AnnotationPresets = {
  /**
   * Primary result content - highest priority, visible to both user and assistant
   */
  primaryResult: {
    audience: ['user', 'assistant'] as ('user' | 'assistant')[],
    priority: 1.0,
  },

  /**
   * Supporting context - mainly for assistant's understanding
   */
  supportingContext: {
    audience: ['assistant'] as ('user' | 'assistant')[],
    priority: 0.7,
  },

  /**
   * Metadata/debug information - low priority
   */
  metadata: {
    audience: ['user', 'assistant'] as ('user' | 'assistant')[],
    priority: 0.3,
  },

  /**
   * Error information - high priority for visibility
   */
  error: {
    audience: ['user', 'assistant'] as ('user' | 'assistant')[],
    priority: 0.9,
  },

  /**
   * Citation/source information - medium priority, mainly for assistant
   */
  citation: {
    audience: ['assistant'] as ('user' | 'assistant')[],
    priority: 0.6,
  },

  /**
   * Summary content - high priority, mainly for user readability
   */
  summary: {
    audience: ['user'] as ('user' | 'assistant')[],
    priority: 0.8,
  },

  /**
   * Individual search result URL - descending priority by rank
   */
  searchResult: (index: number) => ({
    audience: ['user', 'assistant'] as ('user' | 'assistant')[],
    priority: Math.max(0.5, 1.0 - index * 0.05),
  }),
} as const;

// ── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Creates an annotated text content block
 *
 * @param text - The text content
 * @param annotations - Content annotations (audience, priority)
 * @returns Annotated text content block
 */
export function createAnnotatedContent(
  text: string,
  annotations: ContentAnnotations
): AnnotatedTextContent {
  return {
    type: 'text',
    text,
    annotations: {
      ...annotations,
      lastModified: new Date().toISOString(),
    },
  };
}

/**
 * Creates annotated content blocks for search results
 *
 * @param urls - Array of URLs from search results
 * @param query - The search query
 * @returns Array of annotated text content blocks
 */
export function annotateSearchResults(
  urls: string[],
  query: string
): AnnotatedTextContent[] {
  const results: AnnotatedTextContent[] = [];

  // Summary header
  results.push(
    createAnnotatedContent(
      `Found ${urls.length} results for: "${query}"`,
      AnnotationPresets.summary
    )
  );

  // Individual URLs with descending priority
  urls.forEach((url, index) => {
    results.push(
      createAnnotatedContent(url, AnnotationPresets.searchResult(index))
    );
  });

  return results;
}

/**
 * Creates annotated content blocks for scraped page content
 *
 * @param content - The scraped text content
 * @param metadata - Optional metadata (title, truncation status)
 * @returns Array of annotated text content blocks
 */
export function annotateScrapedContent(
  content: string,
  metadata?: { title?: string; truncated?: boolean }
): AnnotatedTextContent[] {
  const results: AnnotatedTextContent[] = [];

  // Title metadata if available
  if (metadata?.title) {
    results.push(
      createAnnotatedContent(`Title: ${metadata.title}`, AnnotationPresets.metadata)
    );
  }

  // Main content with high priority
  results.push(createAnnotatedContent(content, AnnotationPresets.primaryResult));

  // Truncation warning if applicable
  if (metadata?.truncated) {
    results.push(
      createAnnotatedContent(
        '[Content truncated due to size limits]',
        AnnotationPresets.metadata
      )
    );
  }

  return results;
}

/**
 * Creates annotated content blocks for combined research content
 *
 * @param combinedContent - The combined content from all sources
 * @param sources - Array of source metadata
 * @param stats - Processing statistics
 * @returns Array of annotated text content blocks
 */
export function annotateResearchContent(
  combinedContent: string,
  sources: SourceMetadata[],
  stats: ResearchStats
): AnnotatedTextContent[] {
  const results: AnnotatedTextContent[] = [];

  // Main combined content with highest priority
  results.push(
    createAnnotatedContent(combinedContent, AnnotationPresets.primaryResult)
  );

  // Source list for citation purposes
  const successfulSources = sources.filter((s) => s.success);
  if (successfulSources.length > 0) {
    const sourceList = successfulSources
      .map((s, i) => `${i + 1}. ${s.url}`)
      .join('\n');

    results.push(
      createAnnotatedContent(
        `--- Sources ---\n${sourceList}`,
        AnnotationPresets.citation
      )
    );
  }

  // Processing stats (low priority metadata)
  const statsText = [
    `Processed in ${stats.processingTimeMs}ms`,
    stats.duplicatesRemoved ? `${stats.duplicatesRemoved} duplicates removed` : null,
    stats.reductionPercent ? `${stats.reductionPercent.toFixed(1)}% reduction` : null,
  ]
    .filter(Boolean)
    .join(', ');

  results.push(createAnnotatedContent(statsText, AnnotationPresets.metadata));

  return results;
}

/**
 * Creates annotated content for image search results
 *
 * @param images - Array of image results
 * @param query - The search query
 * @returns Array of annotated text content blocks
 */
export function annotateImageResults(
  images: Array<{
    title?: string;
    link?: string;
    thumbnailLink?: string;
    contextLink?: string;
    width?: number;
    height?: number;
  }>,
  query: string
): AnnotatedTextContent[] {
  const results: AnnotatedTextContent[] = [];

  // Summary header
  results.push(
    createAnnotatedContent(
      `Found ${images.length} images for: "${query}"`,
      AnnotationPresets.summary
    )
  );

  // Individual images with descending priority
  images.forEach((img, index) => {
    const title = img.title || 'Untitled image';
    const link = img.link || '';
    const sizeInfo = img.width && img.height ? ` (${img.width}x${img.height})` : '';
    const text = `${index + 1}. ${title}${sizeInfo}\n   Image: ${link}${img.thumbnailLink ? `\n   Thumbnail: ${img.thumbnailLink}` : ''}${img.contextLink ? `\n   Source: ${img.contextLink}` : ''}`;

    results.push(
      createAnnotatedContent(text, AnnotationPresets.searchResult(index))
    );
  });

  return results;
}

/**
 * Creates annotated content for news search results
 *
 * @param articles - Array of news articles
 * @param query - The search query
 * @returns Array of annotated text content blocks
 */
export function annotateNewsResults(
  articles: Array<{
    title?: string;
    link?: string;
    snippet?: string;
    source?: string;
    publishedDate?: string;
  }>,
  query: string
): AnnotatedTextContent[] {
  const results: AnnotatedTextContent[] = [];

  // Summary header
  results.push(
    createAnnotatedContent(
      `Found ${articles.length} news articles for: "${query}"`,
      AnnotationPresets.summary
    )
  );

  // Individual articles with descending priority
  articles.forEach((article, index) => {
    const title = article.title || 'Untitled article';
    const link = article.link || '';
    const snippet = article.snippet || '';
    const source = article.source || 'Unknown source';
    const dateStr = article.publishedDate
      ? ` (${new Date(article.publishedDate).toLocaleDateString()})`
      : '';
    const text = `${index + 1}. ${title}${dateStr}\n   ${snippet}\n   Source: ${source}\n   Link: ${link}`;

    results.push(
      createAnnotatedContent(text, AnnotationPresets.searchResult(index))
    );
  });

  return results;
}

/**
 * Creates annotated error content
 *
 * @param message - Error message
 * @param details - Optional additional details
 * @returns Annotated text content block
 */
export function annotateError(
  message: string,
  details?: string
): AnnotatedTextContent {
  const text = details ? `${message}\n${details}` : message;
  return createAnnotatedContent(text, AnnotationPresets.error);
}
