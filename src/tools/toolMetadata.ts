/**
 * Tool Metadata and Icons
 *
 * Provides icons and _meta fields for all tools per MCP spec 2025-11-25.
 * Icons are SVG data URIs for efficient embedding without external dependencies.
 */

// ── Icon Data URIs ───────────────────────────────────────────────────────────

/**
 * Search magnifying glass icon (Google Search, Academic Search)
 */
export const SEARCH_ICON = `data:image/svg+xml;base64,${Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="11" cy="11" r="8"/>
  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
</svg>
`.trim()).toString('base64')}`;

/**
 * Image icon (Google Image Search)
 */
export const IMAGE_ICON = `data:image/svg+xml;base64,${Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
  <circle cx="8.5" cy="8.5" r="1.5"/>
  <polyline points="21 15 16 10 5 21"/>
</svg>
`.trim()).toString('base64')}`;

/**
 * Newspaper icon (Google News Search)
 */
export const NEWS_ICON = `data:image/svg+xml;base64,${Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
  <path d="M18 14h-8"/>
  <path d="M15 18h-5"/>
  <path d="M10 6h8v4h-8V6Z"/>
</svg>
`.trim()).toString('base64')}`;

/**
 * Document/page icon (Scrape Page)
 */
export const DOCUMENT_ICON = `data:image/svg+xml;base64,${Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
  <polyline points="14 2 14 8 20 8"/>
  <line x1="16" y1="13" x2="8" y2="13"/>
  <line x1="16" y1="17" x2="8" y2="17"/>
  <polyline points="10 9 9 9 8 9"/>
</svg>
`.trim()).toString('base64')}`;

/**
 * Combined search + document icon (Search and Scrape)
 */
export const RESEARCH_ICON = `data:image/svg+xml;base64,${Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="9" cy="9" r="5"/>
  <line x1="12.5" y1="12.5" x2="15" y2="15"/>
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
  <polyline points="14 2 14 8 20 8"/>
</svg>
`.trim()).toString('base64')}`;

/**
 * Graduation cap / academic icon (Academic Search)
 */
export const ACADEMIC_ICON = `data:image/svg+xml;base64,${Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
  <path d="M6 12v5c3 3 9 3 12 0v-5"/>
</svg>
`.trim()).toString('base64')}`;

/**
 * List/sequence icon (Sequential Search)
 */
export const SEQUENCE_ICON = `data:image/svg+xml;base64,${Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="8" y1="6" x2="21" y2="6"/>
  <line x1="8" y1="12" x2="21" y2="12"/>
  <line x1="8" y1="18" x2="21" y2="18"/>
  <line x1="3" y1="6" x2="3.01" y2="6"/>
  <line x1="3" y1="12" x2="3.01" y2="12"/>
  <line x1="3" y1="18" x2="3.01" y2="18"/>
</svg>
`.trim()).toString('base64')}`;

// ── Tool Metadata ────────────────────────────────────────────────────────────

/**
 * Tool tier classification
 */
export type ToolTier = 'core' | 'composite' | 'utility' | 'experimental';

/**
 * Tool category classification
 */
export type ToolCategory = 'search' | 'extraction' | 'research' | 'tracking';

/**
 * Tool metadata structure for _meta field
 */
export interface ToolMeta {
  /** Tool category for grouping */
  category: ToolCategory;
  /** Tool tier (complexity level) */
  tier: ToolTier;
  /** Cache TTL in seconds (0 = no cache) */
  cacheTTL: number;
  /** Rate limit info */
  rateLimit?: string;
  /** External API dependencies */
  externalAPIs: string[];
  /** Whether this tool is recommended for most use cases */
  recommended?: boolean;
}

/**
 * Complete tool metadata with icon
 */
export interface ToolMetadata {
  icon: string;
  meta: ToolMeta;
}

/**
 * Metadata for all tools
 */
export const TOOL_METADATA: Record<string, ToolMetadata> = {
  google_search: {
    icon: SEARCH_ICON,
    meta: {
      category: 'search',
      tier: 'core',
      cacheTTL: 1800, // 30 minutes
      rateLimit: '100/day (Google API)',
      externalAPIs: ['Google Custom Search API'],
    },
  },

  google_image_search: {
    icon: IMAGE_ICON,
    meta: {
      category: 'search',
      tier: 'core',
      cacheTTL: 1800,
      rateLimit: '100/day (Google API)',
      externalAPIs: ['Google Custom Search API'],
    },
  },

  google_news_search: {
    icon: NEWS_ICON,
    meta: {
      category: 'search',
      tier: 'core',
      cacheTTL: 900, // 15 minutes for news
      rateLimit: '100/day (Google API)',
      externalAPIs: ['Google Custom Search API'],
    },
  },

  scrape_page: {
    icon: DOCUMENT_ICON,
    meta: {
      category: 'extraction',
      tier: 'core',
      cacheTTL: 3600, // 1 hour
      externalAPIs: ['Web pages', 'YouTube Transcript API'],
    },
  },

  search_and_scrape: {
    icon: RESEARCH_ICON,
    meta: {
      category: 'research',
      tier: 'composite',
      cacheTTL: 1800,
      rateLimit: '100/day (Google API)',
      externalAPIs: ['Google Custom Search API', 'Web pages'],
      recommended: true,
    },
  },

  academic_search: {
    icon: ACADEMIC_ICON,
    meta: {
      category: 'search',
      tier: 'core',
      cacheTTL: 86400, // 24 hours (papers don't change)
      rateLimit: '100/day (Google API)',
      externalAPIs: ['Google Custom Search API'],
    },
  },

  sequential_search: {
    icon: SEQUENCE_ICON,
    meta: {
      category: 'tracking',
      tier: 'utility',
      cacheTTL: 0, // No cache - state tracking
      externalAPIs: [],
    },
  },
};

/**
 * Gets metadata for a specific tool
 */
export function getToolMetadata(toolName: string): ToolMetadata | undefined {
  return TOOL_METADATA[toolName];
}

/**
 * Gets icon for a specific tool
 */
export function getToolIcon(toolName: string): string | undefined {
  return TOOL_METADATA[toolName]?.icon;
}

/**
 * Gets _meta field for a specific tool
 */
export function getToolMeta(toolName: string): ToolMeta | undefined {
  return TOOL_METADATA[toolName]?.meta;
}
