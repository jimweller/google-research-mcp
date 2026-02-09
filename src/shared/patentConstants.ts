/**
 * Shared Patent Constants
 *
 * Common constants used across patent-related tools to maintain consistency
 * and avoid duplication.
 */

/**
 * CPC (Cooperative Patent Classification) Section Descriptions
 *
 * The CPC is a hierarchical patent classification system jointly developed
 * by the USPTO and EPO. The first letter indicates the technology section.
 *
 * @see https://www.cooperativepatentclassification.org/
 */
export const CPC_SECTIONS: Record<string, string> = {
  'A': 'Human Necessities',
  'B': 'Performing Operations; Transporting',
  'C': 'Chemistry; Metallurgy',
  'D': 'Textiles; Paper',
  'E': 'Fixed Constructions',
  'F': 'Mechanical Engineering; Lighting; Heating; Weapons',
  'G': 'Physics',
  'H': 'Electricity',
  'Y': 'Emerging Technologies',
};

/**
 * Get the technology area description for a CPC code
 *
 * @param cpcCode - The CPC code (e.g., "G06F", "H04L")
 * @returns The technology area description, or "Unknown" if not found
 */
export function getTechnologyArea(cpcCode: string): string {
  if (!cpcCode || cpcCode.length === 0) return 'Unknown';
  const section = cpcCode.charAt(0).toUpperCase();
  return CPC_SECTIONS[section] || 'Unknown';
}

/**
 * PatentsView API assignee type mappings
 *
 * Maps user-friendly assignee type names to PatentsView API codes.
 * @see https://patentsview.org/apis/
 */
export const ASSIGNEE_TYPE_MAP: Record<string, string> = {
  'any': '',
  'us_company': '2',
  'foreign_company': '3',
  'us_individual': '4',
  'foreign_individual': '5',
  'government': '6',
};

/**
 * Assignee type code to description mapping
 *
 * Maps PatentsView API assignee type codes to human-readable descriptions.
 */
export const ASSIGNEE_TYPE_DESCRIPTIONS: Record<string, string> = {
  '2': 'US Company/Corporation',
  '3': 'Foreign Company/Corporation',
  '4': 'US Individual',
  '5': 'Foreign Individual',
  '6': 'US Government',
  '7': 'Foreign Government',
  '8': 'Country Government',
  '9': 'State Government (US)',
};

/**
 * Get the assignee type description from a type code
 *
 * @param typeCode - The PatentsView assignee type code
 * @returns Human-readable description
 */
export function getAssigneeTypeDescription(typeCode: string): string {
  return ASSIGNEE_TYPE_DESCRIPTIONS[typeCode] || 'Unknown';
}

/**
 * Patent office prefixes for filtering
 */
export const PATENT_OFFICE_PREFIXES: Record<string, string> = {
  'US': 'US',   // USPTO
  'EP': 'EP',   // EPO
  'WO': 'WO',   // WIPO
  'JP': 'JP',   // JPO
  'CN': 'CN',   // CNIPA
  'KR': 'KR',   // KIPO
};

/**
 * Patent term duration in years by patent type
 *
 * Utility and plant patents: 20 years from filing date
 * Design patents: 15 years from grant date (post-May 13, 2015) or 14 years (prior)
 */
export const PATENT_TERM_YEARS = {
  utility: 20,
  plant: 20,
  design_new: 15,  // Filed on or after May 13, 2015
  design_old: 14,  // Filed before May 13, 2015
} as const;

/**
 * Design patent term change cutoff date
 */
export const DESIGN_PATENT_CUTOFF_DATE = new Date('2015-05-13');

/**
 * Calculate patent expiration date based on filing/grant dates and type
 *
 * @param filingDate - Filing date (YYYY-MM-DD)
 * @param grantDate - Grant date (YYYY-MM-DD)
 * @param patentType - Type of patent (utility, design, plant)
 * @returns Expiration date (YYYY-MM-DD) or empty string if cannot calculate
 */
export function calculatePatentExpiration(
  filingDate: string,
  grantDate: string,
  patentType: string
): string {
  if (!filingDate && !grantDate) return '';

  try {
    const normalizedType = patentType?.toLowerCase() || '';

    if (normalizedType.includes('utility') || normalizedType.includes('plant')) {
      const filing = new Date(filingDate);
      if (isNaN(filing.getTime())) return '';
      filing.setFullYear(filing.getFullYear() + PATENT_TERM_YEARS.utility);
      return filing.toISOString().split('T')[0];
    } else if (normalizedType.includes('design')) {
      const grant = new Date(grantDate);
      if (isNaN(grant.getTime())) return '';
      const years = grant >= DESIGN_PATENT_CUTOFF_DATE
        ? PATENT_TERM_YEARS.design_new
        : PATENT_TERM_YEARS.design_old;
      grant.setFullYear(grant.getFullYear() + years);
      return grant.toISOString().split('T')[0];
    }
  } catch {
    return '';
  }

  return '';
}

/**
 * Calculate patent status based on expiration date
 *
 * @param expirationDate - Expiration date (YYYY-MM-DD)
 * @returns Patent status: active, expired, or unknown
 */
export function calculatePatentStatus(
  expirationDate: string
): 'active' | 'expired' | 'unknown' {
  if (!expirationDate) return 'unknown';

  try {
    const expiration = new Date(expirationDate);
    if (isNaN(expiration.getTime())) return 'unknown';
    return expiration > new Date() ? 'active' : 'expired';
  } catch {
    return 'unknown';
  }
}
