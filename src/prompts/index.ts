/**
 * MCP Prompts Module
 *
 * Implements MCP Prompts primitive to provide reusable research workflow
 * templates that clients can discover and execute.
 *
 * Prompts:
 * - comprehensive-research: Deep research on a topic with multiple sources
 * - fact-check: Verify a claim using authoritative sources
 * - summarize-url: Extract and summarize content from a URL
 * - news-briefing: Get a current news summary on a topic
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Depth options for research
 */
export type ResearchDepth = 'quick' | 'standard' | 'deep';

/**
 * Format options for summaries
 */
export type SummaryFormat = 'brief' | 'detailed' | 'bullets';

/**
 * Time range options for news
 */
export type NewsTimeRange = 'hour' | 'day' | 'week' | 'month';

// ── Prompt Registration ──────────────────────────────────────────────────────

/**
 * Registers all MCP prompts with the server
 *
 * @param server - The MCP server instance
 */
export function registerPrompts(server: McpServer): void {
  registerComprehensiveResearch(server);
  registerFactCheck(server);
  registerSummarizeUrl(server);
  registerNewsBriefing(server);
}

// ── Individual Prompt Implementations ────────────────────────────────────────

/**
 * Registers the comprehensive-research prompt
 */
function registerComprehensiveResearch(server: McpServer): void {
  server.prompt(
    'comprehensive-research',
    {
      topic: z
        .string()
        .min(1)
        .max(500)
        .describe('The topic or question to research'),
      depth: z
        .enum(['quick', 'standard', 'deep'])
        .default('standard')
        .describe(
          'Research depth: quick (3 sources), standard (5 sources), deep (8 sources)'
        ),
    },
    async ({ topic, depth = 'standard' }) => {
      const numSources =
        depth === 'quick' ? 3 : depth === 'standard' ? 5 : 8;

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `I need you to research the following topic comprehensively:

**Topic:** ${topic}

**Research Instructions:**
1. Use the \`search_and_scrape\` tool with num_results=${numSources} to gather information from multiple sources
2. For each finding, note the source URL for proper citation
3. Look for both consensus AND disagreement among sources
4. Identify any gaps or limitations in the available information
5. Consider source authority and recency when weighing evidence

**Output Format:**
Please structure your response as follows:

## Executive Summary
(2-3 sentences overview of key findings)

## Key Findings
(Bulleted list of main points with inline citations [Source 1], [Source 2], etc.)

## Different Perspectives
(If sources disagree, explain the different viewpoints)

## Limitations & Gaps
(What couldn't be verified or is missing from available sources)

## Sources
(Numbered list of all URLs used)

---

Begin by calling the search_and_scrape tool with the topic.`,
            },
          },
        ],
      };
    }
  );
}

/**
 * Registers the fact-check prompt
 */
function registerFactCheck(server: McpServer): void {
  server.prompt(
    'fact-check',
    {
      claim: z
        .string()
        .min(1)
        .max(1000)
        .describe('The claim or statement to verify'),
      sources: z
        .number()
        .min(2)
        .max(8)
        .default(4)
        .describe('Number of sources to check (2-8)'),
    },
    async ({ claim, sources = 4 }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Please fact-check the following claim:

**Claim:** "${claim}"

**Verification Process:**
1. Use \`search_and_scrape\` with num_results=${sources} to find evidence
2. Specifically look for:
   - Direct evidence supporting the claim
   - Direct evidence contradicting the claim
   - Contextual information that affects interpretation
3. Prefer authoritative sources (academic, government, established news outlets)
4. Note the publication date of each source to assess recency

**Output Format:**
Please structure your response as follows:

## Verdict
**[TRUE / FALSE / PARTIALLY TRUE / UNVERIFIED]**

## Confidence Level
**[High / Medium / Low]** — explain why

## Supporting Evidence
(Evidence that supports the claim, with source citations)

## Contradicting Evidence
(Evidence that contradicts the claim, with source citations)

## Important Context
(Additional context that affects how we should interpret this claim)

## Methodology
(Brief note on what sources were consulted)

## Sources
(Numbered list of URLs)

---

Begin verification by searching for evidence related to this claim.`,
          },
        },
      ],
    })
  );
}

/**
 * Registers the summarize-url prompt
 */
function registerSummarizeUrl(server: McpServer): void {
  server.prompt(
    'summarize-url',
    {
      url: z.string().url().describe('The URL to summarize'),
      format: z
        .enum(['brief', 'detailed', 'bullets'])
        .default('detailed')
        .describe(
          'Output format: brief (1 paragraph), detailed (comprehensive), bullets (key points)'
        ),
    },
    async ({ url, format = 'detailed' }) => {
      const formatInstructions: Record<SummaryFormat, string> = {
        brief:
          'Provide a single paragraph summary (3-5 sentences) covering the main point.',
        detailed:
          'Provide a comprehensive summary including: main thesis, key arguments, supporting evidence, and conclusions.',
        bullets:
          'Provide a bulleted list of 5-10 key points, each being one clear takeaway.',
      };

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Please summarize the content at this URL:

**URL:** ${url}

**Format:** ${format}

**Instructions:**
1. Use the \`scrape_page\` tool to retrieve the content
2. ${formatInstructions[format]}
3. Include any relevant metadata (author, date, publication) if available from the citation
4. Note if the content appears to be truncated or incomplete

**Output Format:**

## Title
[The title of the article/page]

## Summary
[Your summary in the requested format]

## Key Takeaways
- [Main point 1]
- [Main point 2]
- [Main point 3]

## Source Information
- **Author:** [If available]
- **Published:** [If available]
- **Site:** [Site name]

---

Begin by scraping the URL.`,
            },
          },
        ],
      };
    }
  );
}

/**
 * Registers the news-briefing prompt
 */
function registerNewsBriefing(server: McpServer): void {
  server.prompt(
    'news-briefing',
    {
      topic: z
        .string()
        .min(1)
        .max(200)
        .describe('The news topic to get a briefing on'),
      timeRange: z
        .enum(['hour', 'day', 'week', 'month'])
        .default('week')
        .describe('How recent the news should be'),
    },
    async ({ topic, timeRange = 'week' }) => {
      const timeDescriptions: Record<NewsTimeRange, string> = {
        hour: 'the past hour (breaking news)',
        day: 'the past 24 hours',
        week: 'the past week',
        month: 'the past month',
      };

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Create a news briefing on:

**Topic:** ${topic}
**Time Range:** ${timeDescriptions[timeRange]}

**Instructions:**
1. Use \`google_news_search\` with freshness="${timeRange}" to find recent news
2. Then use \`scrape_page\` on the top 3-5 most relevant results for full details
3. Synthesize the information into a coherent briefing

**Output Format:**

## Headline Summary
(One sentence capturing the overall state of this topic)

## Key Developments
(3-5 main news items, each with:)
- **What happened:** Brief description
- **When:** Date/time
- **Source:** Publication name
- **Link:** URL

## Analysis
(What this means in context, patterns or trends you notice)

## What to Watch
(Upcoming events, expected developments, or open questions)

## Sources Used
(List of all sources consulted)

---

Begin by searching for recent news on this topic.`,
            },
          },
        ],
      };
    }
  );
}

// ── Prompt Descriptions (for testing and documentation) ─────────────────────

/**
 * Metadata about available prompts
 */
export const PROMPT_METADATA = {
  'comprehensive-research': {
    name: 'comprehensive-research',
    description: 'Research a topic thoroughly using multiple sources, with synthesis and citations',
    arguments: ['topic', 'depth'],
  },
  'fact-check': {
    name: 'fact-check',
    description: 'Verify a claim using multiple authoritative sources',
    arguments: ['claim', 'sources'],
  },
  'summarize-url': {
    name: 'summarize-url',
    description: 'Extract and summarize content from a specific URL',
    arguments: ['url', 'format'],
  },
  'news-briefing': {
    name: 'news-briefing',
    description: 'Get a current news summary on a topic',
    arguments: ['topic', 'timeRange'],
  },
} as const;

/**
 * List of all prompt names
 */
export const PROMPT_NAMES = Object.keys(PROMPT_METADATA) as Array<
  keyof typeof PROMPT_METADATA
>;
