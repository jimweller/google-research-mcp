/**
 * MCP Sampling Support
 *
 * Implements MCP Sampling primitive per the official specification.
 * Allows the server to request LLM completions from the client for
 * specific, well-defined tasks.
 *
 * IMPORTANT: Use sparingly. Sampling is for narrow tasks where the server
 * needs LLM help to do its job better - not for general reasoning.
 *
 * Appropriate uses:
 * - Query expansion (expanding ambiguous queries)
 * - Language detection
 * - Entity extraction from unstructured text
 *
 * Inappropriate uses:
 * - General reasoning (LLM client already does this)
 * - Research synthesis
 * - Summary generation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from './logger.js';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Options for a sampling request
 */
export interface SamplingOptions {
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** System prompt for the LLM */
  systemPrompt?: string;
  /** Temperature for generation (0-2) */
  temperature?: number;
  /** Stop sequences */
  stopSequences?: string[];
}

/**
 * Result from a sampling request
 */
export interface SamplingResult {
  /** Whether sampling was successful */
  success: boolean;
  /** The generated content (if successful) */
  content?: string;
  /** Error message (if failed) */
  error?: string;
  /** Whether sampling is supported by the client */
  samplingSupported: boolean;
}

// ── State ────────────────────────────────────────────────────────────────────

/**
 * Reference to the server instance (set during initialization)
 */
let serverInstance: McpServer | null = null;

/**
 * Whether the connected client supports sampling
 */
let clientSupportsSampling = false;

// ── Initialization ───────────────────────────────────────────────────────────

/**
 * Initializes sampling support
 *
 * @param server - The MCP server instance
 */
export function initializeSampling(server: McpServer): void {
  serverInstance = server;
  // Note: Client sampling support is determined during handshake
  // For now, we assume sampling may not be supported and handle gracefully
  clientSupportsSampling = false;
}

/**
 * Sets whether the client supports sampling
 * (Called after capability negotiation)
 */
export function setClientSamplingSupport(supported: boolean): void {
  clientSupportsSampling = supported;
  logger.info('Client sampling support:', { supported });
}

// ── Sampling Functions ───────────────────────────────────────────────────────

/**
 * Requests an LLM completion from the client
 *
 * @param prompt - The prompt to send
 * @param options - Sampling options
 * @returns The sampling result
 */
export async function requestSampling(
  prompt: string,
  options: SamplingOptions = {}
): Promise<SamplingResult> {
  // Check if sampling is available
  if (!serverInstance) {
    return {
      success: false,
      error: 'Server not initialized',
      samplingSupported: false,
    };
  }

  if (!clientSupportsSampling) {
    return {
      success: false,
      error: 'Client does not support sampling',
      samplingSupported: false,
    };
  }

  const {
    maxTokens = 100,
    systemPrompt,
    temperature = 0.7,
  } = options;

  try {
    // Note: The actual sampling request depends on the MCP SDK's
    // implementation. This is a placeholder for when SDK support is available.
    logger.info('Sampling request attempted', { promptLength: prompt.length, maxTokens });

    // For now, return not supported since we need to verify SDK support
    return {
      success: false,
      error: 'Sampling not yet implemented in this SDK version',
      samplingSupported: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Sampling request failed', { error: message });

    return {
      success: false,
      error: message,
      samplingSupported: clientSupportsSampling,
    };
  }
}

// ── Query Expansion ──────────────────────────────────────────────────────────

/**
 * Expands an ambiguous query using sampling
 *
 * Falls back to the original query if sampling is unavailable.
 *
 * @param query - The original query
 * @param context - Optional context about the query domain
 * @returns Expanded query or original if expansion fails
 */
export async function expandQuery(
  query: string,
  context?: string
): Promise<string> {
  // If query is already detailed, don't expand
  if (query.split(' ').length >= 5) {
    return query;
  }

  const systemPrompt = `You are a search query expansion assistant. Your task is to expand
ambiguous or brief search queries into more specific, searchable terms.
Only output the expanded query, nothing else.`;

  const prompt = context
    ? `Expand this query for web search in the context of ${context}: "${query}"`
    : `Expand this query for web search: "${query}"`;

  const result = await requestSampling(prompt, {
    maxTokens: 50,
    systemPrompt,
    temperature: 0.3,
  });

  if (result.success && result.content) {
    logger.info('Query expanded', { original: query, expanded: result.content });
    return result.content.trim();
  }

  // Fallback to original query
  return query;
}

/**
 * Detects the language of content using sampling
 *
 * Falls back to 'unknown' if sampling is unavailable.
 *
 * @param content - The content to analyze
 * @returns Detected language code (ISO 639-1) or 'unknown'
 */
export async function detectLanguage(content: string): Promise<string> {
  // Take first 500 chars for detection
  const sample = content.slice(0, 500);

  const systemPrompt = `You are a language detection assistant. Respond with only the
ISO 639-1 two-letter language code (e.g., 'en', 'es', 'fr', 'de', 'zh', 'ja').
If uncertain, respond with 'unknown'.`;

  const prompt = `What language is this text written in?\n\n${sample}`;

  const result = await requestSampling(prompt, {
    maxTokens: 10,
    systemPrompt,
    temperature: 0,
  });

  if (result.success && result.content) {
    const code = result.content.trim().toLowerCase().slice(0, 2);
    if (/^[a-z]{2}$/.test(code)) {
      return code;
    }
  }

  return 'unknown';
}

// ── Export ───────────────────────────────────────────────────────────────────

export { clientSupportsSampling };
