# Adding New Tools to Google Researcher MCP

This guide walks you through adding a new tool to the MCP server. Follow these steps to ensure your tool integrates properly with the existing architecture.

## Overview

Tools in this MCP server follow a consistent pattern:
1. Define input/output schemas with Zod
2. Implement the tool handler function
3. Register the tool with the server
4. Add tests
5. Update documentation

## Step 1: Plan Your Tool

Before writing code, answer these questions:

- **What does the tool do?** (one sentence)
- **When should an LLM use this tool?** (vs. existing tools)
- **What external APIs does it call?** (if any)
- **What parameters does it need?**
- **What does it return?**

## Step 2: Create the Tool File

Create a new file in `src/tools/`:

```typescript
// src/tools/myNewTool.ts

import { z } from 'zod';
import { logger } from '../shared/logger.js';

// ── Input Schema ────────────────────────────────────────────────────────────
// Define all parameters with clear descriptions for LLMs
export const myNewToolInputSchema = {
  // Required parameter
  query: z
    .string()
    .min(1)
    .max(500)
    .describe('The search query. Be specific for better results.'),

  // Optional parameter with default
  limit: z
    .number()
    .min(1)
    .max(10)
    .default(5)
    .describe('Number of results to return (1-10).'),

  // Optional enum parameter
  format: z
    .enum(['json', 'text', 'markdown'])
    .optional()
    .describe('Output format. Defaults to text if omitted.'),
};

// TypeScript type derived from schema
export type MyNewToolInput = z.infer<z.ZodObject<typeof myNewToolInputSchema>>;

// ── Output Schema (optional but recommended) ────────────────────────────────
export const myNewToolOutputSchema = z.object({
  results: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
    snippet: z.string(),
  })),
  query: z.string(),
  resultCount: z.number(),
});

export type MyNewToolOutput = z.infer<typeof myNewToolOutputSchema>;

// ── Handler Function ────────────────────────────────────────────────────────
export async function handleMyNewTool(
  params: MyNewToolInput,
  traceId: string
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: MyNewToolOutput;
}> {
  const { query, limit = 5, format } = params;

  logger.info('myNewTool invoked', { traceId, query, limit });

  try {
    // Your implementation here
    // Example: call an external API, process data, etc.

    const results = []; // Replace with actual implementation

    // Build structured output
    const structuredContent: MyNewToolOutput = {
      results,
      query,
      resultCount: results.length,
    };

    // Build text content for backward compatibility
    const textContent = results
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}`)
      .join('\n\n');

    return {
      content: [{ type: 'text', text: textContent || 'No results found.' }],
      structuredContent,
    };

  } catch (error) {
    logger.error('myNewTool failed', { traceId, error });
    throw error;
  }
}
```

## Step 3: Register the Tool in server.ts

Add your tool registration in `src/server.ts`:

```typescript
// Import your tool
import {
  handleMyNewTool,
  myNewToolInputSchema,
  myNewToolOutputSchema,
  type MyNewToolInput,
} from './tools/myNewTool.js';

// Inside the initializeServer() function, add registration:
server.registerTool(
  "my_new_tool",  // Tool name (snake_case)
  {
    title: "My New Tool",
    description: `Short description of what the tool does.

**When to use:**
- Specific scenario 1
- Specific scenario 2

**When to use other tools instead:**
- Use X when you need Y

**Key parameters:**
- param1: What it does
- param2: What it does

**Caching:** Results cached for X minutes.`,
    inputSchema: myNewToolInputSchema,
    outputSchema: myNewToolOutputSchema,
    annotations: {
      title: "My New Tool",
      readOnlyHint: true,      // true if tool doesn't modify state
      openWorldHint: true,     // true if tool accesses external resources
    },
  },
  async (params) => {
    const traceId = randomUUID();
    const result = await handleMyNewTool(params as MyNewToolInput, traceId);
    return result;
  }
);
```

## Step 4: Add Tests

Create a test file `src/tools/myNewTool.spec.ts`:

```typescript
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { handleMyNewTool, myNewToolInputSchema } from './myNewTool.js';
import { z } from 'zod';

describe('myNewTool', () => {
  const traceId = 'test-trace-id';

  describe('Input Schema', () => {
    it('validates required parameters', () => {
      const schema = z.object(myNewToolInputSchema);

      // Valid input
      expect(() => schema.parse({ query: 'test' })).not.toThrow();

      // Missing required param
      expect(() => schema.parse({})).toThrow();

      // Invalid type
      expect(() => schema.parse({ query: 123 })).toThrow();
    });

    it('applies defaults', () => {
      const schema = z.object(myNewToolInputSchema);
      const result = schema.parse({ query: 'test' });
      expect(result.limit).toBe(5);
    });
  });

  describe('Handler', () => {
    it('returns structured content', async () => {
      const result = await handleMyNewTool({ query: 'test' }, traceId);

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent.query).toBe('test');
    });

    it('handles errors gracefully', async () => {
      // Mock external API failure if applicable
      await expect(
        handleMyNewTool({ query: '' }, traceId)
      ).rejects.toThrow();
    });
  });
});
```

## Step 5: Update Documentation

### README.md

Add your tool to these sections:

1. **For AI Assistants table** (line ~70):
```markdown
| Your use case | `my_new_tool` — brief description |
```

2. **When to Use Each Tool table** (line ~150):
```markdown
| **`my_new_tool`** | **Best for** | When to use it... |
```

3. **Tool Reference section** (line ~240):
```markdown
#### `my_new_tool`
Description of what it does.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | ... |
| `limit` | number | 5 | ... |
```

4. **Features table** - Update tool count

### docs/manual-testing-guide.md

Add a test scenario for your tool.

### docs/architecture/architecture.md

Add your tool to:
- Tool list
- Mermaid diagram
- External services (if applicable)

## Step 6: Build and Test

```bash
# Clean build
npm run build

# Run all tests
npm test

# Run only your tool's tests
npm test -- --testPathPattern="myNewTool"

# Run E2E tests
npm run test:e2e:stdio
```

## Tool Description Best Practices

Your tool description is critical for LLM tool selection. Follow this format:

```
Short one-line description.

**When to use:**
- Bullet points of specific scenarios
- Be concrete, not abstract

**When to use [other tool] instead:**
- Help LLMs choose the right tool

**Key parameters:**
- param: what it controls

**Caching:** How long results are cached.
```

## Checklist

Before submitting your PR:

- [ ] Tool file created in `src/tools/`
- [ ] Input/output schemas defined with Zod
- [ ] Handler function implemented with proper error handling
- [ ] Tool registered in `server.ts` with clear description
- [ ] Tests added and passing
- [ ] README.md updated (3 sections)
- [ ] manual-testing-guide.md updated
- [ ] architecture.md updated
- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] `npm run test:e2e:stdio` passes

## Examples

For reference, see these well-implemented tools:

- **Simple tool**: `src/tools/patentSearch.ts` - Google API wrapper
- **Complex tool**: `src/tools/academicSearch.ts` - Multiple sources, citations
- **State tracking**: `src/tools/sequentialSearch.ts` - Session management

## Need Help?

- Check existing tools for patterns
- Review [Architecture Guide](./architecture/architecture.md)
- Open an issue with questions
