/**
 * Patent Details Tool
 *
 * Get comprehensive details for a specific patent including citations and claims.
 * Uses PatentsView API for detailed patent information.
 */

import { z } from 'zod';
import { logger } from '../shared/logger.js';
import {
  CPC_SECTIONS,
  getTechnologyArea,
  getAssigneeTypeDescription,
  calculatePatentExpiration,
  calculatePatentStatus,
} from '../shared/patentConstants.js';

// ── Constants ───────────────────────────────────────────────────────────────

const PATENTSVIEW_API_BASE = 'https://search.patentsview.org/api/v1';

// ── Input Schema ────────────────────────────────────────────────────────────

export const patentDetailsInputSchema = {
  patent_id: z.string().min(1)
    .describe('Patent number (e.g., "11886826", "US11886826", "US11886826B1")'),
  include_citations: z.boolean().default(false)
    .describe('Include patents this patent cites and patents that cite this one'),
  include_claims: z.boolean().default(false)
    .describe('Include patent claims text (increases response size)'),
};

export type PatentDetailsInput = {
  patent_id: string;
  include_citations?: boolean;
  include_claims?: boolean;
};

// ── Output Types ────────────────────────────────────────────────────────────

export interface PatentAssignee {
  name: string;
  type: string;
  location: {
    city: string;
    state: string;
    country: string;
  };
}

export interface PatentInventor {
  firstName: string;
  lastName: string;
  location: {
    city: string;
    state: string;
    country: string;
  };
}

export interface PatentCpcCode {
  code: string;
  description: string;
  isPrimary: boolean;
}

export interface PatentCitation {
  citedByCount: number;
  citesCount: number;
  citedByPatents?: string[];
  citesPatents?: string[];
}

export interface PatentClaim {
  number: number;
  text: string;
  isIndependent: boolean;
}

export interface PatentDetailsResult {
  patentNumber: string;
  title: string;
  abstract: string;
  patentType: string;
  filingDate: string;
  grantDate: string;
  expirationDate: string;
  status: 'active' | 'expired' | 'unknown';
  assignees: PatentAssignee[];
  inventors: PatentInventor[];
  cpcCodes: PatentCpcCode[];
  primaryTechnologyArea: string;
  citations?: PatentCitation;
  claims?: PatentClaim[];
  url: string;
  pdfUrl: string;
  patentsViewUrl: string;
  googlePatentsUrl: string;
}

export interface PatentDetailsOutput {
  [key: string]: unknown;
  patent: PatentDetailsResult;
}

// ── Helper Functions ────────────────────────────────────────────────────────

/**
 * Normalize patent number to just the numeric portion
 * Handles formats like: "11886826", "US11886826", "US11886826B1"
 */
function normalizePatentNumber(input: string): string {
  // Remove common prefixes and suffixes
  let normalized = input.trim().toUpperCase();

  // Remove country prefix (US, EP, etc.)
  normalized = normalized.replace(/^[A-Z]{2}/, '');

  // Remove kind code suffix (A1, B1, B2, etc.)
  normalized = normalized.replace(/[A-Z]\d*$/, '');

  // Keep only digits
  normalized = normalized.replace(/\D/g, '');

  return normalized;
}

/**
 * Validate patent number format
 */
function isValidPatentNumber(input: string): boolean {
  const normalized = normalizePatentNumber(input);
  // US patent numbers are typically 6-8 digits
  return /^\d{5,11}$/.test(normalized);
}

// ── PatentsView API Response Types ──────────────────────────────────────────

interface PatentsViewPatentDetail {
  patent_id?: string;
  patent_number?: string;
  patent_title?: string;
  patent_date?: string;
  patent_type?: string;
  patent_abstract?: string;
  patent_num_us_patents_cited?: number;
  patent_num_times_cited_by_us_patents?: number;
  applications?: Array<{
    app_date?: string;
    app_number?: string;
  }>;
  assignees?: Array<{
    assignee_organization?: string;
    assignee_first_name?: string;
    assignee_last_name?: string;
    assignee_type?: string;
    assignee_city?: string;
    assignee_state?: string;
    assignee_country?: string;
  }>;
  inventors?: Array<{
    inventor_first_name?: string;
    inventor_last_name?: string;
    inventor_city?: string;
    inventor_state?: string;
    inventor_country?: string;
  }>;
  cpcs?: Array<{
    cpc_group_id?: string;
    cpc_subgroup_id?: string;
    cpc_category?: string;
  }>;
  cited_patents?: Array<{
    cited_patent_number?: string;
  }>;
  citedby_patents?: Array<{
    citedby_patent_number?: string;
  }>;
  claims?: Array<{
    claim_sequence?: number;
    claim_text?: string;
    claim_dependent?: string;
  }>;
}

interface PatentsViewDetailResponse {
  patents?: PatentsViewPatentDetail[];
  count?: number;
  error?: string;
}

// ── Main Handler ────────────────────────────────────────────────────────────

/**
 * Handle patent details request
 */
export async function handlePatentDetails(
  params: PatentDetailsInput,
  traceId?: string
): Promise<{
  isError?: boolean;
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: PatentDetailsOutput | { error: string };
}> {
  const apiKey = process.env.PATENTSVIEW_API_KEY;

  // Check for API key
  if (!apiKey) {
    logger.warn('PatentsView API key not configured', { traceId });
    return {
      isError: true,
      content: [{
        type: 'text',
        text: 'PatentsView API key required. Set PATENTSVIEW_API_KEY environment variable. Get a free key at: https://patentsview.org/apis/keyrequest'
      }],
      structuredContent: { error: 'API key required' }
    };
  }

  // Validate patent number
  if (!isValidPatentNumber(params.patent_id)) {
    logger.warn('Invalid patent number format', { traceId, patentId: params.patent_id });
    return {
      isError: true,
      content: [{
        type: 'text',
        text: `Invalid patent number format: "${params.patent_id}". Expected format: numeric patent number (e.g., "11886826", "US11886826B1")`
      }],
      structuredContent: { error: 'Invalid patent number format' }
    };
  }

  const normalizedPatentNumber = normalizePatentNumber(params.patent_id);

  try {
    // Fields to request
    const fields = [
      'patent_id', 'patent_number', 'patent_title', 'patent_date', 'patent_type', 'patent_abstract',
      'patent_num_us_patents_cited', 'patent_num_times_cited_by_us_patents',
      'applications.app_date', 'applications.app_number',
      'assignees.assignee_organization', 'assignees.assignee_first_name', 'assignees.assignee_last_name',
      'assignees.assignee_type', 'assignees.assignee_city', 'assignees.assignee_state', 'assignees.assignee_country',
      'inventors.inventor_first_name', 'inventors.inventor_last_name',
      'inventors.inventor_city', 'inventors.inventor_state', 'inventors.inventor_country',
      'cpcs.cpc_group_id', 'cpcs.cpc_subgroup_id', 'cpcs.cpc_category'
    ];

    // Add citation fields if requested
    if (params.include_citations) {
      fields.push('cited_patents.cited_patent_number', 'citedby_patents.citedby_patent_number');
    }

    // Add claims fields if requested
    if (params.include_claims) {
      fields.push('claims.claim_sequence', 'claims.claim_text', 'claims.claim_dependent');
    }

    // Build request
    const requestBody = {
      q: { patent_number: normalizedPatentNumber },
      f: fields,
      o: { size: 1 }
    };

    logger.info('Patent details request', {
      traceId,
      patentNumber: normalizedPatentNumber,
      includeCitations: params.include_citations,
      includeClaims: params.include_claims
    });

    // Make API request
    const response = await fetch(`${PATENTSVIEW_API_BASE}/patent/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('PatentsView API error', {
        traceId,
        status: response.status,
        error: errorText
      });

      if (response.status === 429) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'PatentsView API rate limit exceeded. Please wait before retrying (limit: 45 requests/minute).' }],
          structuredContent: { error: 'Rate limit exceeded' }
        };
      }

      return {
        isError: true,
        content: [{ type: 'text', text: `PatentsView API error: HTTP ${response.status}` }],
        structuredContent: { error: `HTTP ${response.status}` }
      };
    }

    const data = await response.json() as PatentsViewDetailResponse;

    if (data.error) {
      logger.error('PatentsView API returned error', { traceId, error: data.error });
      return {
        isError: true,
        content: [{ type: 'text', text: `PatentsView API error: ${data.error}` }],
        structuredContent: { error: data.error }
      };
    }

    // Check if patent was found
    if (!data.patents || data.patents.length === 0) {
      logger.warn('Patent not found', { traceId, patentNumber: normalizedPatentNumber });
      return {
        isError: true,
        content: [{ type: 'text', text: `Patent not found: ${params.patent_id}` }],
        structuredContent: { error: 'Patent not found' }
      };
    }

    const p = data.patents[0];

    // Extract data
    const patentNumber = p.patent_number || p.patent_id || normalizedPatentNumber;
    const grantDate = p.patent_date || '';
    const filingDate = p.applications?.[0]?.app_date || '';
    const patentType = p.patent_type || '';
    const expirationDate = calculatePatentExpiration(filingDate, grantDate, patentType);
    const status = calculatePatentStatus(expirationDate);

    // Build assignees
    const assignees: PatentAssignee[] = (p.assignees || []).map(a => ({
      name: a.assignee_organization ||
        `${a.assignee_first_name || ''} ${a.assignee_last_name || ''}`.trim() ||
        'Unknown',
      type: getAssigneeTypeDescription(a.assignee_type || ''),
      location: {
        city: a.assignee_city || '',
        state: a.assignee_state || '',
        country: a.assignee_country || ''
      }
    }));

    // Build inventors
    const inventors: PatentInventor[] = (p.inventors || []).map(i => ({
      firstName: i.inventor_first_name || '',
      lastName: i.inventor_last_name || '',
      location: {
        city: i.inventor_city || '',
        state: i.inventor_state || '',
        country: i.inventor_country || ''
      }
    }));

    // Build CPC codes
    const cpcCodes: PatentCpcCode[] = (p.cpcs || []).map((c, index) => ({
      code: c.cpc_group_id || c.cpc_subgroup_id || '',
      description: getTechnologyArea(c.cpc_group_id || ''),
      isPrimary: index === 0
    })).filter(c => c.code);

    const primaryCpc = cpcCodes.find(c => c.isPrimary)?.code || '';

    // Build citations if requested
    let citations: PatentCitation | undefined;
    if (params.include_citations) {
      const citedByPatents = p.citedby_patents?.map(c => c.citedby_patent_number).filter(Boolean) as string[] || [];
      const citesPatents = p.cited_patents?.map(c => c.cited_patent_number).filter(Boolean) as string[] || [];

      citations = {
        citedByCount: p.patent_num_times_cited_by_us_patents || citedByPatents.length,
        citesCount: p.patent_num_us_patents_cited || citesPatents.length,
        citedByPatents: citedByPatents.length > 0 ? citedByPatents : undefined,
        citesPatents: citesPatents.length > 0 ? citesPatents : undefined
      };
    }

    // Build claims if requested
    let claims: PatentClaim[] | undefined;
    if (params.include_claims && p.claims) {
      claims = p.claims.map(c => ({
        number: c.claim_sequence || 0,
        text: c.claim_text || '',
        isIndependent: !c.claim_dependent || c.claim_dependent === '0'
      })).sort((a, b) => a.number - b.number);
    }

    // Build result
    const patent: PatentDetailsResult = {
      patentNumber,
      title: p.patent_title || 'Untitled',
      abstract: p.patent_abstract || '',
      patentType,
      filingDate,
      grantDate,
      expirationDate,
      status,
      assignees,
      inventors,
      cpcCodes,
      primaryTechnologyArea: getTechnologyArea(primaryCpc),
      citations,
      claims,
      url: `https://patents.google.com/patent/US${patentNumber}`,
      pdfUrl: `https://patents.google.com/patent/US${patentNumber}/pdf`,
      patentsViewUrl: `https://search.patentsview.org/patents/${patentNumber}`,
      googlePatentsUrl: `https://patents.google.com/patent/US${patentNumber}`
    };

    logger.info('Patent details retrieved', {
      traceId,
      patentNumber,
      status,
      assigneeCount: assignees.length,
      inventorCount: inventors.length
    });

    // Build text response
    const textParts: string[] = [
      `Patent: US${patentNumber}`,
      `Title: ${patent.title}`,
      '',
      `Status: ${status.toUpperCase()}`,
      `Type: ${patentType}`,
      `Filed: ${filingDate}`,
      `Granted: ${grantDate}`,
      expirationDate ? `Expires: ${expirationDate}` : '',
      '',
      `Assignee: ${assignees[0]?.name || 'Unknown'}`,
      `Inventors: ${inventors.map(i => `${i.firstName} ${i.lastName}`).join(', ')}`,
      '',
      `Technology: ${patent.primaryTechnologyArea}`,
      `CPC: ${cpcCodes.map(c => c.code).join(', ')}`,
    ];

    if (citations) {
      textParts.push('');
      textParts.push(`Citations: ${citations.citesCount} cited, ${citations.citedByCount} citing`);
    }

    if (claims) {
      textParts.push('');
      textParts.push(`Claims: ${claims.length} total (${claims.filter(c => c.isIndependent).length} independent)`);
    }

    textParts.push('');
    textParts.push(`URL: ${patent.googlePatentsUrl}`);

    return {
      content: [{ type: 'text', text: textParts.filter(Boolean).join('\n') }],
      structuredContent: { patent }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Patent details request failed', { traceId, error: errorMessage });

    return {
      isError: true,
      content: [{ type: 'text', text: `Patent details request failed: ${errorMessage}` }],
      structuredContent: { error: errorMessage }
    };
  }
}
