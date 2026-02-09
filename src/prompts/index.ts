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
 * - patent-portfolio-analysis: Analyze patent portfolio for a company and subsidiaries
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

/**
 * Detail level options for patent analysis
 */
export type PatentDetailLevel = 'summary' | 'standard' | 'comprehensive';

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
  registerPatentPortfolioAnalysis(server);
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

/**
 * Registers the patent-portfolio-analysis prompt
 */
function registerPatentPortfolioAnalysis(server: McpServer): void {
  server.prompt(
    'patent-portfolio-analysis',
    {
      company: z
        .string()
        .min(1)
        .max(200)
        .describe('Parent company name'),
      subsidiaries: z
        .string()
        .optional()
        .describe('Comma-separated list of subsidiary/related company names'),
      focus_areas: z
        .string()
        .optional()
        .describe('Technology areas to emphasize (CPC codes or keywords, comma-separated)'),
      include_expired: z
        .boolean()
        .default(true)
        .describe('Include expired patents in the analysis'),
      detail_level: z
        .enum(['summary', 'standard', 'comprehensive'])
        .default('standard')
        .describe('Detail level: summary (counts only), standard (with top patents), comprehensive (with citations)'),
    },
    async ({ company, subsidiaries, focus_areas, include_expired = true, detail_level = 'standard' }) => {
      const subsidiaryList = subsidiaries
        ? subsidiaries.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const focusAreaList = focus_areas
        ? focus_areas.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const hasPatentsViewKey = !!process.env.PATENTSVIEW_API_KEY;

      const toolGuidance = hasPatentsViewKey
        ? `**PatentsView API Available** - Use \`patent_assignee_search\` for comprehensive results with pagination.
For detailed patent information, use \`patent_details\` with include_citations=${detail_level === 'comprehensive'}.`
        : `**Note:** PatentsView API key not configured. Using \`patent_search\` (Google Patents) which is limited to 10 results per query.
For comprehensive portfolio analysis, set the PATENTSVIEW_API_KEY environment variable.
Get a free key at: https://patentsview.org/apis/keyrequest`;

      const subsidiarySection = subsidiaryList.length > 0
        ? `\n**Subsidiaries to search:**\n${subsidiaryList.map(s => `- ${s}`).join('\n')}`
        : '\n**No subsidiaries specified** - Consider searching for common variations (Inc, LLC, Corp) of the parent company.';

      const focusSection = focusAreaList.length > 0
        ? `\n**Focus areas:** ${focusAreaList.join(', ')}`
        : '';

      const citationGuidance = detail_level === 'comprehensive'
        ? '\n5. For top patents, use `patent_details` with include_citations=true to identify highly-cited innovations'
        : detail_level === 'standard'
          ? '\n5. Use `patent_details` on 3-5 notable patents for additional context'
          : '';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Build a comprehensive patent portfolio analysis for:

**Company:** ${company}${subsidiarySection}${focusSection}
**Include Expired:** ${include_expired}
**Detail Level:** ${detail_level}

---

${toolGuidance}

## Analysis Workflow

### Phase 1: Entity Discovery & Search

Search for patents from each entity with name variations:

**Parent company variations:**
- "${company}"
- "${company} Inc"
- "${company} LLC"
- "${company} Corp"
- "${company} Corporation"
${subsidiaryList.map(s => `\n**${s} variations:**\n- "${s}"\n- "${s} Inc"\n- "${s} LLC"`).join('')}

${hasPatentsViewKey
                ? `For each variation, use \`patent_assignee_search\` with per_page=25 to get results.`
                : `For each variation, use \`patent_search\` with assignee filter.`}

### Phase 2: ${detail_level === 'summary' ? 'Aggregation' : 'Detail Enrichment'}

${detail_level === 'summary'
                ? 'Aggregate counts and technology distribution from search results.'
                : `For notable patents (newest, most relevant to focus areas):${citationGuidance}`}

### Phase 3: Analysis & Reporting

1. Combine results from all entities
2. Calculate totals by status (active/expired) and type (utility/design/plant)
3. Identify technology distribution by CPC section
4. Note filing trends over time
5. Highlight key inventors if patterns emerge

---

## Output Format

### Executive Summary
- Total patents across all entities: [count]
- Active: [count] | Expired: [count]
- Primary technology areas: [top 3]
- Most recent filing: [date]

### Portfolio by Entity

| Entity | Total | Active | Expired | Primary Technology |
|--------|-------|--------|---------|-------------------|
| ${company} | ... | ... | ... | ... |
${subsidiaryList.map(s => `| ${s} | ... | ... | ... | ... |`).join('\n')}

### Technology Distribution

| CPC Section | Description | Count | % |
|-------------|-------------|-------|---|
| G | Physics | ... | ...% |
| H | Electricity | ... | ...% |
| ... | ... | ... | ...% |

### Filing Timeline

[Year-by-year breakdown showing filing trends]

${detail_level !== 'summary' ? `### Notable Patents

Top patents by strategic importance:
1. **[Patent Number]** - [Title]
   - Status: [active/expired] | Type: [utility/design]
   - Technology: [CPC description]
   - Assignee: [name]
${detail_level === 'comprehensive' ? '   - Forward Citations: [count]' : ''}

` : ''}### Portfolio Health Assessment

- **Strengths:** [Areas with strong coverage]
- **Gaps:** [Areas with limited coverage]
- **Upcoming Expirations:** [Patents expiring in next 2 years]
- **Innovation Trend:** [Increasing/stable/declining based on filing dates]

---

Begin by searching for patents from the parent company "${company}".`,
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
  'patent-portfolio-analysis': {
    name: 'patent-portfolio-analysis',
    description: 'Analyze patent portfolio for a company and its subsidiaries',
    arguments: ['company', 'subsidiaries', 'focus_areas', 'include_expired', 'detail_level'],
  },
} as const;

/**
 * List of all prompt names
 */
export const PROMPT_NAMES = Object.keys(PROMPT_METADATA) as Array<
  keyof typeof PROMPT_METADATA
>;
