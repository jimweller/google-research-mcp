/**
 * Citation Extractor
 *
 * Extracts metadata (title, author, publish date) from HTML content
 * and formats citations in standard academic formats (APA, MLA).
 */

import * as cheerio from 'cheerio';

/**
 * Extracted citation metadata from a web page
 */
export interface CitationMetadata {
  /** Page title */
  title?: string;
  /** Author name(s) */
  author?: string;
  /** Publication date (ISO format) */
  publishedDate?: string;
  /** Site or publication name */
  siteName?: string;
  /** Content description/excerpt */
  description?: string;
}

/**
 * Formatted citations in standard academic formats
 */
export interface FormattedCitations {
  /** APA 7th edition format */
  apa: string;
  /** MLA 9th edition format */
  mla: string;
}

/**
 * Complete citation object with metadata and formatted strings
 */
export interface Citation {
  /** Extracted metadata */
  metadata: CitationMetadata;
  /** URL of the source */
  url: string;
  /** Date the content was accessed */
  accessedDate: string;
  /** Pre-formatted citation strings */
  formatted: FormattedCitations;
}

/**
 * Extracts citation metadata from HTML content using Open Graph,
 * Twitter Cards, JSON-LD, and standard meta tags.
 *
 * @param html - Raw HTML content
 * @param url - URL of the page (for fallback domain extraction)
 * @returns Extracted citation metadata
 */
export function extractCitationMetadata(html: string, url: string): CitationMetadata {
  const $ = cheerio.load(html);
  const metadata: CitationMetadata = {};

  // 1. Extract title (priority order: og:title > twitter:title > <title>)
  metadata.title =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('title').text().trim() ||
    undefined;

  // 2. Extract author (priority order: article:author > author meta > JSON-LD)
  metadata.author =
    $('meta[property="article:author"]').attr('content') ||
    $('meta[name="author"]').attr('content') ||
    $('meta[name="dc.creator"]').attr('content') ||
    extractAuthorFromJsonLd($) ||
    undefined;

  // 3. Extract publish date (priority order: article:published_time > datePublished > dc.date)
  const rawDate =
    $('meta[property="article:published_time"]').attr('content') ||
    $('meta[name="datePublished"]').attr('content') ||
    $('meta[name="dc.date"]').attr('content') ||
    $('meta[property="og:article:published_time"]').attr('content') ||
    extractDateFromJsonLd($) ||
    undefined;

  if (rawDate) {
    metadata.publishedDate = normalizeDate(rawDate);
  }

  // 4. Extract site name (priority order: og:site_name > twitter:site > domain)
  metadata.siteName =
    $('meta[property="og:site_name"]').attr('content') ||
    $('meta[name="twitter:site"]').attr('content')?.replace('@', '') ||
    extractDomainName(url);

  // 5. Extract description
  metadata.description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    $('meta[name="twitter:description"]').attr('content') ||
    undefined;

  return metadata;
}

/**
 * Extracts author from JSON-LD structured data
 */
function extractAuthorFromJsonLd($: cheerio.CheerioAPI): string | undefined {
  try {
    const jsonLdScripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < jsonLdScripts.length; i++) {
      const content = $(jsonLdScripts[i]).html();
      if (!content) continue;

      const data = JSON.parse(content);
      const author = extractAuthorFromObject(data);
      if (author) return author;
    }
  } catch {
    // JSON parse error, ignore
  }
  return undefined;
}

/**
 * Recursively extracts author from JSON-LD object
 */
function extractAuthorFromObject(obj: unknown): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;

  const data = obj as Record<string, unknown>;

  // Direct author field
  if (data.author) {
    if (typeof data.author === 'string') return data.author;
    if (typeof data.author === 'object' && data.author !== null) {
      const authorObj = data.author as Record<string, unknown>;
      if (authorObj.name && typeof authorObj.name === 'string') return authorObj.name;
    }
    if (Array.isArray(data.author) && data.author.length > 0) {
      const first = data.author[0];
      if (typeof first === 'string') return first;
      if (typeof first === 'object' && first !== null) {
        const firstObj = first as Record<string, unknown>;
        if (firstObj.name && typeof firstObj.name === 'string') return firstObj.name;
      }
    }
  }

  // Check @graph array
  if (Array.isArray(data['@graph'])) {
    for (const item of data['@graph']) {
      const author = extractAuthorFromObject(item);
      if (author) return author;
    }
  }

  return undefined;
}

/**
 * Extracts publication date from JSON-LD structured data
 */
function extractDateFromJsonLd($: cheerio.CheerioAPI): string | undefined {
  try {
    const jsonLdScripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < jsonLdScripts.length; i++) {
      const content = $(jsonLdScripts[i]).html();
      if (!content) continue;

      const data = JSON.parse(content);
      const date = extractDateFromObject(data);
      if (date) return date;
    }
  } catch {
    // JSON parse error, ignore
  }
  return undefined;
}

/**
 * Recursively extracts date from JSON-LD object
 */
function extractDateFromObject(obj: unknown): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;

  const data = obj as Record<string, unknown>;

  // Direct date fields
  const dateFields = ['datePublished', 'dateCreated', 'dateModified'];
  for (const field of dateFields) {
    if (data[field] && typeof data[field] === 'string') {
      return data[field] as string;
    }
  }

  // Check @graph array
  if (Array.isArray(data['@graph'])) {
    for (const item of data['@graph']) {
      const date = extractDateFromObject(item);
      if (date) return date;
    }
  }

  return undefined;
}

/**
 * Normalizes a date string to ISO format
 */
function normalizeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }
  } catch {
    // Date parse error
  }
  return dateStr; // Return as-is if can't parse
}

/**
 * Extracts a clean domain name from URL
 */
function extractDomainName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove www. prefix and return capitalized
    const domain = hostname.replace(/^www\./, '');
    // Capitalize first letter of each word
    return domain.split('.')[0]
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } catch {
    return 'Unknown Source';
  }
}

/**
 * Formats a date for APA citation (Year, Month Day)
 */
function formatDateAPA(dateStr?: string): string {
  if (!dateStr) return 'n.d.';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'n.d.';

    const year = date.getFullYear();
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const day = date.getDate();

    return `${year}, ${month} ${day}`;
  } catch {
    return 'n.d.';
  }
}

/**
 * Formats a date for MLA citation (Day Month Year)
 */
function formatDateMLA(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = date.toLocaleDateString('en-US', { month: 'short' }).replace('.', '');
    const day = date.getDate();

    return `${day} ${month}. ${year}`;
  } catch {
    return '';
  }
}

/**
 * Formats author name for APA citation (Last, F.)
 */
function formatAuthorAPA(author?: string): string {
  if (!author) return '';

  // Split by common separators (comma, and, &)
  const parts = author.split(/\s+/);
  if (parts.length === 1) return `${parts[0]}.`;

  // Assume "First Last" format
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];

  return `${lastName}, ${firstName.charAt(0).toUpperCase()}.`;
}

/**
 * Extracts just the domain from a URL for MLA format
 */
function extractUrlDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Creates formatted citations from metadata
 *
 * @param metadata - Extracted citation metadata
 * @param url - Source URL
 * @param accessedDate - Date content was accessed (ISO format)
 * @returns Formatted citations in APA and MLA formats
 */
export function formatCitations(
  metadata: CitationMetadata,
  url: string,
  accessedDate: string
): FormattedCitations {
  const title = metadata.title || 'Untitled';
  const siteName = metadata.siteName || extractDomainName(url);

  // APA 7th edition format:
  // Author. (Year, Month Day). Title. Site Name. URL
  // Or if no author: Title. (Year, Month Day). Site Name. URL
  let apa: string;
  if (metadata.author) {
    apa = `${formatAuthorAPA(metadata.author)} (${formatDateAPA(metadata.publishedDate)}). ${title}. ${siteName}. ${url}`;
  } else {
    apa = `${title}. (${formatDateAPA(metadata.publishedDate)}). ${siteName}. ${url}`;
  }

  // MLA 9th edition format:
  // Author. "Title." Site Name, Day Month Year, URL.
  // Or if no author: "Title." Site Name, Day Month Year, URL.
  let mla: string;
  const mlaDate = formatDateMLA(metadata.publishedDate);
  const mlaDatePart = mlaDate ? `, ${mlaDate}` : '';

  if (metadata.author) {
    mla = `${metadata.author}. "${title}." ${siteName}${mlaDatePart}, ${extractUrlDomain(url)}.`;
  } else {
    mla = `"${title}." ${siteName}${mlaDatePart}, ${extractUrlDomain(url)}.`;
  }

  return { apa, mla };
}

/**
 * Creates a complete citation object from HTML content
 *
 * @param html - Raw HTML content
 * @param url - Source URL
 * @returns Complete citation object with metadata and formatted strings
 */
export function createCitation(html: string, url: string): Citation {
  const metadata = extractCitationMetadata(html, url);
  const accessedDate = new Date().toISOString().split('T')[0];
  const formatted = formatCitations(metadata, url, accessedDate);

  return {
    metadata,
    url,
    accessedDate,
    formatted,
  };
}

/**
 * Extracts citation from pre-scraped content that may contain metadata markers
 *
 * This is used when we have already scraped content and want to extract
 * any embedded metadata from the Title/Headings format.
 *
 * @param content - Pre-scraped text content
 * @param url - Source URL
 * @returns Partial citation metadata
 */
export function extractCitationFromScrapedContent(
  content: string,
  url: string
): Partial<CitationMetadata> {
  const metadata: Partial<CitationMetadata> = {};

  // Extract title from "Title: ..." format
  const titleMatch = content.match(/^Title:\s*(.+?)(?:\n|$)/m);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim();
  }

  // Set site name from URL
  metadata.siteName = extractDomainName(url);

  return metadata;
}
