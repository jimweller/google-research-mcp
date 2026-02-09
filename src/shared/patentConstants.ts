/**
 * Shared Patent Constants
 *
 * Common constants used by patent_search tool (Google Patents via Custom Search API).
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
