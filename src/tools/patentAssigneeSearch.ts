/**
 * Patent Assignee Search Tool
 *
 * Search all patents for a specific company/assignee using PatentsView API.
 * Provides pagination, filtering, and summary aggregations.
 */

import { z } from 'zod';
import { logger } from '../shared/logger.js';
import {
  CPC_SECTIONS,
  ASSIGNEE_TYPE_MAP,
  getTechnologyArea,
  calculatePatentExpiration,
  calculatePatentStatus,
} from '../shared/patentConstants.js';

// ── Constants ───────────────────────────────────────────────────────────────

const PATENTSVIEW_API_BASE = 'https://search.patentsview.org/api/v1';

// ── Input Schema ────────────────────────────────────────────────────────────

export const patentAssigneeSearchInputSchema = {
  assignee: z.string().min(1).max(500)
    .describe('Company/organization name to search for'),
  assignee_type: z.enum(['any', 'us_company', 'foreign_company', 'us_individual', 'foreign_individual', 'government']).default('any')
    .describe('Filter by assignee type'),
  patent_type: z.enum(['any', 'utility', 'design', 'plant', 'reissue']).default('any')
    .describe('Filter by patent type'),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe('Filter patents granted on or after this date (YYYY-MM-DD)'),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe('Filter patents granted on or before this date (YYYY-MM-DD)'),
  include_expired: z.boolean().default(true)
    .describe('Include patents that have expired'),
  page: z.number().int().min(1).default(1)
    .describe('Page number for pagination'),
  per_page: z.number().int().min(1).max(100).default(25)
    .describe('Results per page (max 100)'),
};

export type PatentAssigneeSearchInput = {
  assignee: string;
  assignee_type?: 'any' | 'us_company' | 'foreign_company' | 'us_individual' | 'foreign_individual' | 'government';
  patent_type?: 'any' | 'utility' | 'design' | 'plant' | 'reissue';
  date_from?: string;
  date_to?: string;
  include_expired?: boolean;
  page?: number;
  per_page?: number;
};

// ── Output Types ────────────────────────────────────────────────────────────

export interface PatentAssigneeResult {
  patentNumber: string;
  title: string;
  grantDate: string;
  filingDate: string;
  patentType: 'utility' | 'design' | 'plant' | 'reissue' | 'other';
  status: 'active' | 'expired' | 'unknown';
  expirationDate?: string;
  primaryCpc: string;
  cpcCodes: string[];
  technologyArea: string;
  inventors: string[];
  assignee: string;
  url: string;
  patentsViewUrl: string;
}

export interface PatentAssigneeSearchOutput {
  [key: string]: unknown;
  assignee: string;
  totalPatents: number;
  page: number;
  totalPages: number;
  patents: PatentAssigneeResult[];
  summary: {
    byStatus: { active: number; expired: number; unknown: number };
    byType: { utility: number; design: number; plant: number; reissue: number; other: number };
    byYear: Record<string, number>;
    topCpcCodes: Array<{ code: string; description: string; count: number }>;
  };
}

// ── Helper Functions ────────────────────────────────────────────────────────

/**
 * Map patent type from PatentsView format
 */
function mapPatentType(type: string): 'utility' | 'design' | 'plant' | 'reissue' | 'other' {
  const normalized = type?.toLowerCase() || '';
  if (normalized.includes('utility')) return 'utility';
  if (normalized.includes('design')) return 'design';
  if (normalized.includes('plant')) return 'plant';
  if (normalized.includes('reissue')) return 'reissue';
  return 'other';
}

/**
 * Build PatentsView API query
 */
function buildQuery(params: PatentAssigneeSearchInput): Record<string, unknown> {
  const conditions: Array<Record<string, unknown>> = [];

  // Assignee name search (use text search for partial matching)
  conditions.push({
    _or: [
      { assignee_organization: params.assignee },
      { _text_any: { assignee_organization: params.assignee } }
    ]
  });

  // Assignee type filter
  if (params.assignee_type && params.assignee_type !== 'any') {
    const typeCode = ASSIGNEE_TYPE_MAP[params.assignee_type];
    if (typeCode) {
      conditions.push({ assignee_type: typeCode });
    }
  }

  // Patent type filter
  if (params.patent_type && params.patent_type !== 'any') {
    conditions.push({ patent_type: params.patent_type });
  }

  // Date range filters
  if (params.date_from) {
    conditions.push({ _gte: { patent_date: params.date_from } });
  }
  if (params.date_to) {
    conditions.push({ _lte: { patent_date: params.date_to } });
  }

  // Combine conditions
  if (conditions.length === 1) {
    return conditions[0];
  }
  return { _and: conditions };
}

/**
 * Calculate summary aggregations from patent results
 */
function calculateSummary(patents: PatentAssigneeResult[]): PatentAssigneeSearchOutput['summary'] {
  const byStatus = { active: 0, expired: 0, unknown: 0 };
  const byType = { utility: 0, design: 0, plant: 0, reissue: 0, other: 0 };
  const byYear: Record<string, number> = {};
  const cpcCounts: Record<string, number> = {};

  for (const patent of patents) {
    // Count by status
    byStatus[patent.status]++;

    // Count by type
    byType[patent.patentType]++;

    // Count by year
    if (patent.grantDate) {
      const year = patent.grantDate.substring(0, 4);
      byYear[year] = (byYear[year] || 0) + 1;
    }

    // Count CPC codes
    if (patent.primaryCpc) {
      const section = patent.primaryCpc.substring(0, 4); // e.g., "G06F"
      cpcCounts[section] = (cpcCounts[section] || 0) + 1;
    }
  }

  // Get top CPC codes
  const topCpcCodes = Object.entries(cpcCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([code, count]) => ({
      code,
      description: getTechnologyArea(code),
      count
    }));

  return { byStatus, byType, byYear, topCpcCodes };
}

// ── PatentsView API Response Types ──────────────────────────────────────────

interface PatentsViewPatent {
  patent_id?: string;
  patent_number?: string;
  patent_title?: string;
  patent_date?: string;
  patent_type?: string;
  patent_abstract?: string;
  applications?: Array<{
    app_date?: string;
    app_number?: string;
  }>;
  assignees?: Array<{
    assignee_organization?: string;
    assignee_first_name?: string;
    assignee_last_name?: string;
    assignee_type?: string;
  }>;
  inventors?: Array<{
    inventor_first_name?: string;
    inventor_last_name?: string;
  }>;
  cpcs?: Array<{
    cpc_group_id?: string;
    cpc_subgroup_id?: string;
  }>;
}

interface PatentsViewResponse {
  patents?: PatentsViewPatent[];
  count?: number;
  total_hits?: number;
  error?: string;
}

// ── Main Handler ────────────────────────────────────────────────────────────

/**
 * Handle patent assignee search request
 */
export async function handlePatentAssigneeSearch(
  params: PatentAssigneeSearchInput,
  traceId?: string
): Promise<{
  isError?: boolean;
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: PatentAssigneeSearchOutput;
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
      structuredContent: {
        assignee: params.assignee,
        totalPatents: 0,
        page: params.page ?? 1,
        totalPages: 0,
        patents: [],
        summary: {
          byStatus: { active: 0, expired: 0, unknown: 0 },
          byType: { utility: 0, design: 0, plant: 0, reissue: 0, other: 0 },
          byYear: {},
          topCpcCodes: []
        }
      }
    };
  }

  const page = params.page ?? 1;
  const perPage = Math.min(params.per_page ?? 25, 100);

  try {
    // Build query
    const query = buildQuery(params);

    // Fields to request
    const fields = [
      'patent_id', 'patent_number', 'patent_title', 'patent_date', 'patent_type',
      'applications.app_date', 'applications.app_number',
      'assignees.assignee_organization', 'assignees.assignee_type',
      'inventors.inventor_first_name', 'inventors.inventor_last_name',
      'cpcs.cpc_group_id', 'cpcs.cpc_subgroup_id'
    ];

    // Build request body
    const requestBody = {
      q: query,
      f: fields,
      o: {
        size: perPage,
        after: page > 1 ? [(page - 1) * perPage] : undefined
      },
      s: [{ patent_date: 'desc' }]
    };

    logger.info('Patent assignee search request', {
      traceId,
      assignee: params.assignee,
      page,
      perPage
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

      // Handle rate limiting
      if (response.status === 429) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'PatentsView API rate limit exceeded. Please wait before retrying (limit: 45 requests/minute).' }],
          structuredContent: {
            assignee: params.assignee,
            totalPatents: 0,
            page,
            totalPages: 0,
            patents: [],
            summary: {
              byStatus: { active: 0, expired: 0, unknown: 0 },
              byType: { utility: 0, design: 0, plant: 0, reissue: 0, other: 0 },
              byYear: {},
              topCpcCodes: []
            }
          }
        };
      }

      return {
        isError: true,
        content: [{ type: 'text', text: `PatentsView API error: HTTP ${response.status}` }],
        structuredContent: {
          assignee: params.assignee,
          totalPatents: 0,
          page,
          totalPages: 0,
          patents: [],
          summary: {
            byStatus: { active: 0, expired: 0, unknown: 0 },
            byType: { utility: 0, design: 0, plant: 0, reissue: 0, other: 0 },
            byYear: {},
            topCpcCodes: []
          }
        }
      };
    }

    const data = await response.json() as PatentsViewResponse;

    if (data.error) {
      logger.error('PatentsView API returned error', { traceId, error: data.error });
      return {
        isError: true,
        content: [{ type: 'text', text: `PatentsView API error: ${data.error}` }],
        structuredContent: {
          assignee: params.assignee,
          totalPatents: 0,
          page,
          totalPages: 0,
          patents: [],
          summary: {
            byStatus: { active: 0, expired: 0, unknown: 0 },
            byType: { utility: 0, design: 0, plant: 0, reissue: 0, other: 0 },
            byYear: {},
            topCpcCodes: []
          }
        }
      };
    }

    // Parse results
    const rawPatents = data.patents || [];
    const totalHits = data.total_hits || rawPatents.length;
    const totalPages = Math.ceil(totalHits / perPage);

    // Transform patents
    const patents: PatentAssigneeResult[] = rawPatents.map(p => {
      const patentType = mapPatentType(p.patent_type || '');
      const grantDate = p.patent_date || '';
      const filingDate = p.applications?.[0]?.app_date || '';
      const expirationDate = calculatePatentExpiration(filingDate, grantDate, patentType);
      const status = calculatePatentStatus(expirationDate);

      // Filter expired if requested (default is to include expired)
      if (params.include_expired === false && status === 'expired') {
        return null;
      }

      const primaryCpc = p.cpcs?.[0]?.cpc_group_id || '';
      const cpcCodes = [...new Set(p.cpcs?.map(c => c.cpc_group_id).filter(Boolean) || [])];

      const inventors = p.inventors?.map(i =>
        `${i.inventor_first_name || ''} ${i.inventor_last_name || ''}`.trim()
      ).filter(Boolean) || [];

      const assigneeName = p.assignees?.[0]?.assignee_organization ||
        `${p.assignees?.[0]?.assignee_first_name || ''} ${p.assignees?.[0]?.assignee_last_name || ''}`.trim() ||
        params.assignee;

      const patentNumber = p.patent_number || p.patent_id || '';

      const result: PatentAssigneeResult = {
        patentNumber,
        title: p.patent_title || 'Untitled',
        grantDate,
        filingDate,
        patentType,
        status,
        expirationDate: expirationDate || undefined,
        primaryCpc,
        cpcCodes,
        technologyArea: getTechnologyArea(primaryCpc),
        inventors,
        assignee: assigneeName,
        url: `https://patents.google.com/patent/US${patentNumber}`,
        patentsViewUrl: `https://search.patentsview.org/patents/${patentNumber}`
      };
      return result;
    }).filter((p): p is PatentAssigneeResult => p !== null);

    // Calculate summary
    const summary = calculateSummary(patents);

    logger.info('Patent assignee search completed', {
      traceId,
      totalHits,
      returned: patents.length
    });

    // Build text response
    const textParts: string[] = [
      `Patent search for assignee: "${params.assignee}"`,
      `Found ${totalHits} total patents (showing page ${page} of ${totalPages})`,
      '',
      `Summary: ${summary.byStatus.active} active, ${summary.byStatus.expired} expired`,
      ''
    ];

    for (const patent of patents.slice(0, 10)) {
      textParts.push(`- ${patent.patentNumber}: ${patent.title}`);
      textParts.push(`  Status: ${patent.status} | Type: ${patent.patentType} | ${patent.technologyArea}`);
    }

    if (patents.length > 10) {
      textParts.push(`... and ${patents.length - 10} more`);
    }

    return {
      content: [{ type: 'text', text: textParts.join('\n') }],
      structuredContent: {
        assignee: params.assignee,
        totalPatents: totalHits,
        page,
        totalPages,
        patents,
        summary
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Patent assignee search failed', { traceId, error: errorMessage });

    return {
      isError: true,
      content: [{ type: 'text', text: `Patent assignee search failed: ${errorMessage}` }],
      structuredContent: {
        assignee: params.assignee,
        totalPatents: 0,
        page: params.page ?? 1,
        totalPages: 0,
        patents: [],
        summary: {
          byStatus: { active: 0, expired: 0, unknown: 0 },
          byType: { utility: 0, design: 0, plant: 0, reissue: 0, other: 0 },
          byYear: {},
          topCpcCodes: []
        }
      }
    };
  }
}
