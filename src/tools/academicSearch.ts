/**
 * Academic Paper Search Tool
 *
 * Searches academic papers using the Semantic Scholar API.
 * Free tier: 100 requests per 5 minutes, no API key required for basic usage.
 *
 * Returns:
 * - Paper titles, authors, abstracts
 * - Citation counts and publication years
 * - PDF URLs (when available)
 * - Pre-formatted citations (APA, MLA, BibTeX)
 */

import { z } from 'zod';
import { getErrorMessage } from '../types/googleApi.js';

// ── Constants ────────────────────────────────────────────────────────────────

/** Semantic Scholar API base URL */
const SEMANTIC_SCHOLAR_API = 'https://api.semanticscholar.org/graph/v1';

/** Request timeout in milliseconds */
const API_TIMEOUT_MS = 15_000;

/** Fields to request from Semantic Scholar */
const PAPER_FIELDS = [
  'title',
  'authors',
  'abstract',
  'year',
  'citationCount',
  'url',
  'venue',
  'publicationDate',
  'openAccessPdf',
  'externalIds',
  'fieldsOfStudy',
].join(',');

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Author information from Semantic Scholar
 */
export interface PaperAuthor {
  authorId: string;
  name: string;
}

/**
 * External IDs for a paper
 */
export interface ExternalIds {
  DOI?: string;
  ArXiv?: string;
  PubMed?: string;
  MAG?: string;
  CorpusId?: number;
}

/**
 * Open access PDF information
 */
export interface OpenAccessPdf {
  url: string;
  status?: string;
}

/**
 * Raw paper data from Semantic Scholar API
 */
export interface SemanticScholarPaper {
  paperId: string;
  title: string;
  authors?: PaperAuthor[];
  abstract?: string;
  year?: number;
  citationCount?: number;
  url?: string;
  venue?: string;
  publicationDate?: string;
  openAccessPdf?: OpenAccessPdf;
  externalIds?: ExternalIds;
  fieldsOfStudy?: string[];
}

/**
 * Semantic Scholar search response
 */
export interface SemanticScholarSearchResponse {
  total: number;
  offset: number;
  next?: number;
  data: SemanticScholarPaper[];
}

/**
 * Formatted citations for a paper
 */
export interface FormattedCitations {
  apa: string;
  mla: string;
  bibtex: string;
}

/**
 * Processed paper result for output
 */
export interface AcademicPaperResult {
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  abstract?: string;
  citationCount?: number;
  url?: string;
  pdfUrl?: string;
  doi?: string;
  arxivId?: string;
  fieldsOfStudy?: string[];
  citations: FormattedCitations;
}

// ── Input Schema ─────────────────────────────────────────────────────────────

/**
 * Input schema for academic_search tool
 */
export const academicSearchInputSchema = {
  /** Search query for academic papers */
  query: z.string().min(1).max(500)
    .describe('Search query for academic papers'),

  /** Number of results to return (1-10) */
  num_results: z.number().int().min(1).max(10).default(5)
    .describe('Number of papers to return (1-10, default: 5)'),

  /** Filter by publication year (from) */
  year_from: z.number().int().min(1900).max(2030).optional()
    .describe('Only include papers published in or after this year'),

  /** Filter by publication year (to) */
  year_to: z.number().int().min(1900).max(2030).optional()
    .describe('Only include papers published in or before this year'),

  /** Filter by field of study */
  fields_of_study: z.array(z.string()).max(5).optional()
    .describe('Filter by fields (e.g., ["Computer Science", "Medicine"])'),

  /** Only return papers with open access PDF */
  open_access_only: z.boolean().default(false)
    .describe('Only return papers with freely available PDFs'),

  /** Sort order */
  sort_by: z.enum(['relevance', 'citations', 'date']).default('relevance')
    .describe('Sort by relevance, citation count, or publication date'),
};

// ── Output Schema ────────────────────────────────────────────────────────────

/**
 * Output schema for academic_search tool
 */
export const academicSearchOutputSchema = {
  /** Array of academic papers */
  papers: z.array(z.object({
    title: z.string().describe('Paper title'),
    authors: z.array(z.string()).describe('List of author names'),
    year: z.number().int().optional().describe('Publication year'),
    venue: z.string().optional().describe('Journal or conference name'),
    abstract: z.string().optional().describe('Paper abstract'),
    citationCount: z.number().int().optional().describe('Number of citations'),
    url: z.string().url().optional().describe('URL to paper page'),
    pdfUrl: z.string().url().optional().describe('Direct URL to PDF'),
    doi: z.string().optional().describe('Digital Object Identifier'),
    arxivId: z.string().optional().describe('arXiv identifier'),
    fieldsOfStudy: z.array(z.string()).optional().describe('Research fields'),
    citations: z.object({
      apa: z.string().describe('APA 7th edition format'),
      mla: z.string().describe('MLA 9th edition format'),
      bibtex: z.string().describe('BibTeX format'),
    }).describe('Pre-formatted citations'),
  })).describe('List of academic papers'),

  /** Original search query */
  query: z.string().describe('The search query that was executed'),

  /** Total results found */
  totalResults: z.number().int().describe('Total papers matching query'),

  /** Number of results returned */
  resultCount: z.number().int().describe('Number of papers returned'),

  /** Data source */
  source: z.literal('Semantic Scholar').describe('Data source'),
};

// ── Output Type ──────────────────────────────────────────────────────────────

export interface AcademicSearchOutput {
  papers: AcademicPaperResult[];
  query: string;
  totalResults: number;
  resultCount: number;
  source: 'Semantic Scholar';
  [key: string]: unknown; // Index signature for MCP SDK compatibility
}

// ── Citation Formatting ──────────────────────────────────────────────────────

/**
 * Formats author names for APA style (Last, F. M.)
 */
function formatAuthorsAPA(authors: string[]): string {
  if (authors.length === 0) return 'Unknown Author';
  if (authors.length === 1) return formatSingleAuthorAPA(authors[0]);
  if (authors.length === 2) {
    return `${formatSingleAuthorAPA(authors[0])} & ${formatSingleAuthorAPA(authors[1])}`;
  }
  // 3+ authors: First author et al.
  return `${formatSingleAuthorAPA(authors[0])} et al.`;
}

function formatSingleAuthorAPA(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const lastName = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map(p => p[0].toUpperCase() + '.').join(' ');
  return `${lastName}, ${initials}`;
}

/**
 * Formats author names for MLA style (Last, First)
 */
function formatAuthorsMLA(authors: string[]): string {
  if (authors.length === 0) return 'Unknown Author';
  if (authors.length === 1) return formatSingleAuthorMLA(authors[0]);
  if (authors.length === 2) {
    return `${formatSingleAuthorMLA(authors[0])}, and ${authors[1]}`;
  }
  // 3+ authors
  return `${formatSingleAuthorMLA(authors[0])}, et al.`;
}

function formatSingleAuthorMLA(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(' ');
  return `${lastName}, ${firstName}`;
}

/**
 * Formats authors for BibTeX
 */
function formatAuthorsBibTeX(authors: string[]): string {
  return authors.join(' and ') || 'Unknown Author';
}

/**
 * Creates a BibTeX key from title and year
 */
function createBibTeXKey(title: string, year?: number): string {
  const firstWord = title.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
  return `${firstWord}${year || 'unknown'}`;
}

/**
 * Generates formatted citations for a paper
 */
function generateCitations(paper: SemanticScholarPaper): FormattedCitations {
  const authors = paper.authors?.map(a => a.name) || [];
  const year = paper.year;
  const title = paper.title;
  const venue = paper.venue || 'Unknown Venue';
  const doi = paper.externalIds?.DOI;

  // APA 7th Edition
  let apa = `${formatAuthorsAPA(authors)} (${year || 'n.d.'}). ${title}. `;
  if (venue !== 'Unknown Venue') {
    apa += `*${venue}*. `;
  }
  if (doi) {
    apa += `https://doi.org/${doi}`;
  }

  // MLA 9th Edition
  let mla = `${formatAuthorsMLA(authors)}. "${title}." `;
  if (venue !== 'Unknown Venue') {
    mla += `*${venue}*, `;
  }
  if (year) {
    mla += `${year}`;
  }
  if (doi) {
    mla += `, https://doi.org/${doi}`;
  }
  mla += '.';

  // BibTeX
  const bibtexKey = createBibTeXKey(title, year);
  let bibtex = `@article{${bibtexKey},\n`;
  bibtex += `  title = {${title}},\n`;
  bibtex += `  author = {${formatAuthorsBibTeX(authors)}},\n`;
  if (year) bibtex += `  year = {${year}},\n`;
  if (venue !== 'Unknown Venue') bibtex += `  journal = {${venue}},\n`;
  if (doi) bibtex += `  doi = {${doi}},\n`;
  bibtex += `}`;

  return { apa, mla, bibtex };
}

// ── Handler ──────────────────────────────────────────────────────────────────

/**
 * Input type for academic search handler
 */
export type AcademicSearchInput = {
  query: string;
  num_results?: number;
  year_from?: number;
  year_to?: number;
  fields_of_study?: string[];
  open_access_only?: boolean;
  sort_by?: 'relevance' | 'citations' | 'date';
};

/**
 * Handler for the academic_search tool
 */
export async function handleAcademicSearch(input: AcademicSearchInput): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: AcademicSearchOutput;
  isError?: boolean;
}> {
  const {
    query,
    num_results = 5,
    year_from,
    year_to,
    fields_of_study,
    open_access_only = false,
    sort_by = 'relevance',
  } = input;

  try {
    // Build search URL
    const params = new URLSearchParams({
      query: query.trim(),
      limit: String(num_results * 2), // Request more to filter
      fields: PAPER_FIELDS,
    });

    // Add year filters
    if (year_from) {
      params.set('year', year_to ? `${year_from}-${year_to}` : `${year_from}-`);
    } else if (year_to) {
      params.set('year', `-${year_to}`);
    }

    // Add field of study filter
    if (fields_of_study && fields_of_study.length > 0) {
      params.set('fieldsOfStudy', fields_of_study.join(','));
    }

    const url = `${SEMANTIC_SCHOLAR_API}/paper/search?${params.toString()}`;

    // Make API request
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as SemanticScholarSearchResponse;

    // Process and filter results
    let papers = data.data || [];

    // Filter for open access if requested
    if (open_access_only) {
      papers = papers.filter(p => p.openAccessPdf?.url);
    }

    // Sort results
    if (sort_by === 'citations') {
      papers.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
    } else if (sort_by === 'date') {
      papers.sort((a, b) => (b.year || 0) - (a.year || 0));
    }

    // Limit to requested number
    papers = papers.slice(0, num_results);

    // Transform to output format
    const results: AcademicPaperResult[] = papers.map(paper => ({
      title: paper.title,
      authors: paper.authors?.map(a => a.name) || [],
      year: paper.year,
      venue: paper.venue,
      abstract: paper.abstract,
      citationCount: paper.citationCount,
      url: paper.url,
      pdfUrl: paper.openAccessPdf?.url,
      doi: paper.externalIds?.DOI,
      arxivId: paper.externalIds?.ArXiv,
      fieldsOfStudy: paper.fieldsOfStudy,
      citations: generateCitations(paper),
    }));

    // Build text content
    let textContent = `Academic Search Results for: "${query}"\n`;
    textContent += `Found ${data.total} total papers, showing ${results.length}\n\n`;

    results.forEach((paper, index) => {
      textContent += `--- Paper ${index + 1} ---\n`;
      textContent += `Title: ${paper.title}\n`;
      textContent += `Authors: ${paper.authors.join(', ')}\n`;
      if (paper.year) textContent += `Year: ${paper.year}\n`;
      if (paper.venue) textContent += `Venue: ${paper.venue}\n`;
      if (paper.citationCount !== undefined) textContent += `Citations: ${paper.citationCount}\n`;
      if (paper.abstract) {
        const truncatedAbstract = paper.abstract.length > 300
          ? paper.abstract.substring(0, 300) + '...'
          : paper.abstract;
        textContent += `Abstract: ${truncatedAbstract}\n`;
      }
      if (paper.pdfUrl) textContent += `PDF: ${paper.pdfUrl}\n`;
      if (paper.doi) textContent += `DOI: ${paper.doi}\n`;
      textContent += `\nCitation (APA): ${paper.citations.apa}\n\n`;
    });

    const output: AcademicSearchOutput = {
      papers: results,
      query: query.trim(),
      totalResults: data.total,
      resultCount: results.length,
      source: 'Semantic Scholar',
    };

    return {
      content: [{ type: 'text', text: textContent }],
      structuredContent: output,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    return {
      content: [{ type: 'text', text: `Academic search failed: ${errorMessage}` }],
      structuredContent: {
        papers: [],
        query: query.trim(),
        totalResults: 0,
        resultCount: 0,
        source: 'Semantic Scholar',
      },
      isError: true,
    };
  }
}
