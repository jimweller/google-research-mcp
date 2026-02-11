# Metrics System Architecture Design

## Overview

This document describes the architecture for Issue #46 - Per-tool execution metrics.

## Components

### 1. MetricsCollector Class

**File:** `src/shared/metricsCollector.ts`

```typescript
interface LatencyStats {
  p50: number | null;   // Median
  p95: number | null;   // 95th percentile
  p99: number | null;   // 99th percentile
  avg: number | null;   // Average
  min: number | null;   // Minimum
  max: number | null;   // Maximum
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;      // hits / (hits + misses), or 0 if no calls
}

interface ToolMetrics {
  calls: number;
  successes: number;
  failures: number;
  successRate: number;  // successes / calls, or 0 if no calls
  latency: LatencyStats;
  cache: CacheStats;
  lastCalled: string | null;  // ISO timestamp
}

interface ServerMetrics {
  uptime: number;       // Seconds since collector creation
  totalCalls: number;   // Across all tools
  tools: Record<string, ToolMetrics>;
}
```

**Implementation Details:**
- Use reservoir sampling for percentile calculation (max 1000 samples per tool)
- Thread-safe using synchronous operations (Node.js single-threaded)
- Memory bounded: O(n * 1000) where n = number of tools

### 2. Percentile Calculation

Using sorted array approach (simple, efficient for 1000 samples):

```typescript
function calculatePercentile(sortedValues: number[], percentile: number): number | null {
  if (sortedValues.length === 0) return null;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}
```

### 3. InstrumentTool Wrapper

**File:** `src/shared/instrumentTool.ts`

```typescript
function instrumentTool<TParams, TResult extends { fromCache?: boolean }>(
  name: string,
  handler: (params: TParams) => Promise<TResult>,
  metrics: MetricsCollector
): (params: TParams) => Promise<TResult> {
  return async (params: TParams): Promise<TResult> => {
    const start = performance.now();
    try {
      const result = await handler(params);
      const duration = performance.now() - start;
      metrics.recordCall(name, duration, true, result.fromCache ?? false);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      metrics.recordCall(name, duration, false, false);
      throw error;
    }
  };
}
```

### 4. Resource Integration

**File:** `src/resources/index.ts` (modify)

Add two new resources:
- `stats://tools` - All tool metrics
- `stats://tools/{name}` - Single tool metrics (template)

### 5. Prometheus Formatter

**File:** `src/shared/prometheusFormatter.ts`

```typescript
function formatPrometheusMetrics(metrics: ServerMetrics): string {
  const lines: string[] = [];

  // Server uptime
  lines.push('# HELP mcp_server_uptime_seconds Server uptime in seconds');
  lines.push('# TYPE mcp_server_uptime_seconds gauge');
  lines.push(`mcp_server_uptime_seconds ${metrics.uptime}`);

  // Per-tool metrics
  lines.push('# HELP mcp_tool_calls_total Total tool invocations');
  lines.push('# TYPE mcp_tool_calls_total counter');
  for (const [tool, m] of Object.entries(metrics.tools)) {
    lines.push(`mcp_tool_calls_total{tool="${tool}"} ${m.calls}`);
  }

  // ... latency histograms, cache hits, etc.

  return lines.join('\n');
}
```

### 6. HTTP Endpoint

**File:** `src/server.ts` (modify)

Add endpoint:
```typescript
app.get('/mcp/metrics/prometheus', (req, res) => {
  const metrics = globalMetricsCollector.getMetrics();
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(formatPrometheusMetrics(metrics));
});
```

## Blast Radius

| File | Change Type | Risk |
|------|-------------|------|
| `src/shared/metricsCollector.ts` | New | Low |
| `src/shared/metricsCollector.spec.ts` | New | Low |
| `src/shared/instrumentTool.ts` | New | Low |
| `src/shared/instrumentTool.spec.ts` | New | Low |
| `src/shared/prometheusFormatter.ts` | New | Low |
| `src/shared/prometheusFormatter.spec.ts` | New | Low |
| `src/resources/index.ts` | Modify | Medium |
| `src/resources/resources.spec.ts` | Modify | Medium |
| `src/server.ts` | Modify | Medium |

## Verification Commands

```bash
# Type check
npx tsc --noEmit

# Run all tests
npm test

# Run E2E tests
npm run test:e2e

# Manual verification
curl http://localhost:3000/mcp/metrics/prometheus
```

## Implementation Order

1. MetricsCollector class + tests
2. InstrumentTool wrapper + tests (can parallel with #1)
3. Resource integration (depends on #1)
4. Prometheus formatter (depends on #1)
5. Server integration - instrument tools (depends on #1, #2)
6. Full verification
7. Documentation

## Security Considerations

- No PII in metrics (only tool names, counts, latencies)
- Memory bounded to prevent DoS
- No secrets exposed via Prometheus endpoint
