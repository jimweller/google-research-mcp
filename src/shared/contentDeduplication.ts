/**
 * Content Deduplication Module
 *
 * Removes duplicate or near-duplicate content from multiple sources while
 * preserving attribution. Uses paragraph-level hashing for efficient detection.
 */

// ── Configuration ──────────────────────────────────────────────────────────

/** Default minimum paragraph length to consider for deduplication */
const DEFAULT_MIN_PARAGRAPH_LENGTH = 50;

/** Default similarity threshold (0.0-1.0) for near-duplicate detection */
const DEFAULT_SIMILARITY_THRESHOLD = 0.85;

/**
 * Hash proximity threshold for candidate selection.
 * Paragraphs with hashes differing by more than this value are skipped
 * in near-duplicate detection (performance optimization).
 * Uses djb2 hash which produces 32-bit integers; 1M difference covers
 * ~0.02% of hash space - sufficient to catch similar paragraphs while
 * avoiding O(n²) comparisons.
 */
const HASH_PROXIMITY_THRESHOLD = 1_000_000;

// ── Public Interfaces ──────────────────────────────────────────────────────

export interface SourceContent {
  /** Source URL for attribution */
  url: string;
  /** Raw content from the source */
  content: string;
}

export interface DeduplicationOptions {
  /** Minimum paragraph length to consider (default: 50) */
  minParagraphLength?: number;
  /** Similarity threshold 0.0-1.0 for near-duplicates (default: 0.85) */
  similarityThreshold?: number;
  /** Preserve Title/Content structure (default: true) */
  preserveStructure?: boolean;
}

export interface DeduplicationStats {
  /** Total characters before deduplication */
  originalLength: number;
  /** Total characters after deduplication */
  deduplicatedLength: number;
  /** Number of duplicate paragraphs removed */
  duplicatesRemoved: number;
  /** Percentage reduction in content size */
  reductionPercent: number;
  /** Number of sources processed */
  sourcesProcessed: number;
}

export interface DeduplicationResult {
  /** Deduplicated content */
  content: string;
  /** Statistics about the deduplication */
  stats: DeduplicationStats;
}

// ── Internal Types ─────────────────────────────────────────────────────────

interface Paragraph {
  /** Original text */
  text: string;
  /** Normalized text for comparison */
  normalized: string;
  /** Hash of normalized text */
  hash: number;
  /** Source URL for attribution */
  sourceUrl: string;
}

// ── Utility Functions ──────────────────────────────────────────────────────

/**
 * Normalizes text for comparison:
 * - Converts to lowercase
 * - Collapses whitespace
 * - Removes punctuation
 * - Trims
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\r\n]+/g, ' ')           // Collapse newlines
    .replace(/\s+/g, ' ')               // Collapse whitespace
    .replace(/[^\w\s]/g, '')            // Remove punctuation
    .trim();
}

/**
 * Fast string hash using djb2 algorithm.
 * Good distribution, fast computation, suitable for deduplication.
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash >>> 0; // Convert to unsigned 32-bit integer
  }
  return hash;
}

/**
 * Calculates similarity ratio between two strings using normalized Levenshtein distance.
 * Returns 0.0 (completely different) to 1.0 (identical).
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  // Use the shorter string for reference
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;

  // Early exit for very different lengths
  if (longer.length > shorter.length * 2) return 0.0;

  // Simple character overlap ratio for performance
  // (Full Levenshtein is O(n*m) which can be slow for long paragraphs)
  const charSetA = new Set(a.split(''));
  const charSetB = new Set(b.split(''));
  let overlap = 0;
  for (const char of charSetA) {
    if (charSetB.has(char)) overlap++;
  }

  return (2 * overlap) / (charSetA.size + charSetB.size);
}

/**
 * Splits content into paragraphs, filtering by minimum length.
 */
function splitIntoParagraphs(
  content: string,
  minLength: number,
  sourceUrl: string
): Paragraph[] {
  // Split on double newlines or significant whitespace gaps
  const rawParagraphs = content.split(/\n\s*\n|\r\n\s*\r\n/);

  const paragraphs: Paragraph[] = [];

  for (const text of rawParagraphs) {
    const trimmed = text.trim();
    if (trimmed.length < minLength) continue;

    const normalized = normalizeText(trimmed);
    if (normalized.length < minLength) continue;

    paragraphs.push({
      text: trimmed,
      normalized,
      hash: hashString(normalized),
      sourceUrl,
    });
  }

  return paragraphs;
}

/**
 * Checks if a paragraph is a near-duplicate of any seen paragraph.
 */
function isNearDuplicate(
  paragraph: Paragraph,
  seenHashes: Map<number, Paragraph[]>,
  threshold: number
): boolean {
  // First check exact hash match
  const candidates = seenHashes.get(paragraph.hash);
  if (candidates) {
    for (const candidate of candidates) {
      if (candidate.normalized === paragraph.normalized) {
        return true; // Exact duplicate
      }
    }
  }

  // Check near-duplicates using similarity
  // Only check paragraphs with similar hashes (within bucket) for performance
  for (const [hash, paragraphs] of seenHashes) {
    // Skip if hashes are too different (performance optimization)
    if (Math.abs(hash - paragraph.hash) > HASH_PROXIMITY_THRESHOLD) continue;

    for (const candidate of paragraphs) {
      const similarity = calculateSimilarity(
        candidate.normalized,
        paragraph.normalized
      );
      if (similarity >= threshold) {
        return true; // Near-duplicate
      }
    }
  }

  return false;
}

// ── Main Deduplication Function ────────────────────────────────────────────

/**
 * Deduplicates content from multiple sources.
 *
 * Algorithm:
 * 1. Split each source into paragraphs
 * 2. Normalize and hash each paragraph
 * 3. Keep first occurrence, remove duplicates/near-duplicates
 * 4. Preserve source attribution
 *
 * @param sources - Array of source content with URLs
 * @param options - Deduplication options
 * @returns Deduplicated content with statistics
 */
export function deduplicateContent(
  sources: SourceContent[],
  options: DeduplicationOptions = {}
): DeduplicationResult {
  const minParagraphLength = options.minParagraphLength ?? DEFAULT_MIN_PARAGRAPH_LENGTH;
  const similarityThreshold = options.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const preserveStructure = options.preserveStructure ?? true;

  // Track statistics
  let originalLength = 0;
  let duplicatesRemoved = 0;

  // Track seen paragraphs by hash for O(1) lookup
  const seenHashes = new Map<number, Paragraph[]>();

  // Collect unique paragraphs with attribution
  const uniqueParagraphs: { text: string; url: string }[] = [];

  // Process each source
  for (const source of sources) {
    if (!source.content || source.content.trim().length === 0) continue;

    originalLength += source.content.length;

    const paragraphs = splitIntoParagraphs(
      source.content,
      minParagraphLength,
      source.url
    );

    for (const paragraph of paragraphs) {
      const isDupe = isNearDuplicate(paragraph, seenHashes, similarityThreshold);

      if (isDupe) {
        duplicatesRemoved++;
        continue;
      }

      // Add to seen hashes
      const existing = seenHashes.get(paragraph.hash) || [];
      existing.push(paragraph);
      seenHashes.set(paragraph.hash, existing);

      // Keep this paragraph
      uniqueParagraphs.push({
        text: paragraph.text,
        url: source.url,
      });
    }
  }

  // Build output content
  let content: string;
  if (preserveStructure) {
    // Group by source URL
    const bySource = new Map<string, string[]>();
    for (const p of uniqueParagraphs) {
      const existing = bySource.get(p.url) || [];
      existing.push(p.text);
      bySource.set(p.url, existing);
    }

    const sections: string[] = [];
    for (const [url, texts] of bySource) {
      sections.push(`## Source: ${url}\n\n${texts.join('\n\n')}`);
    }
    content = sections.join('\n\n---\n\n');
  } else {
    content = uniqueParagraphs.map(p => p.text).join('\n\n');
  }

  const deduplicatedLength = content.length;
  const reductionPercent = originalLength > 0
    ? Math.round(((originalLength - deduplicatedLength) / originalLength) * 100)
    : 0;

  return {
    content,
    stats: {
      originalLength,
      deduplicatedLength,
      duplicatesRemoved,
      reductionPercent,
      sourcesProcessed: sources.length,
    },
  };
}
