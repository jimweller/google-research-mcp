/**
 * Per-tool execution metrics collector.
 *
 * Tracks call counts, success/failure rates, latency percentiles, and cache hit rates
 * for each tool. Uses reservoir sampling to bound memory usage.
 */

export interface LatencyStats {
  p50: number | null;
  p95: number | null;
  p99: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

export interface ToolMetrics {
  calls: number;
  successes: number;
  failures: number;
  successRate: number;
  latency: LatencyStats;
  cache: CacheStats;
  lastCalled: string | null;
}

export interface ServerMetrics {
  uptime: number;
  totalCalls: number;
  tools: Record<string, ToolMetrics>;
}

export interface MetricsCollectorOptions {
  /** Maximum number of latency samples to retain per tool (default: 1000) */
  maxSamplesPerTool?: number;
  /** Injectable clock for testing (default: Date.now) */
  now?: () => number;
}

interface ToolData {
  calls: number;
  successes: number;
  failures: number;
  cacheHits: number;
  cacheMisses: number;
  lastCalled: number | null;
  latencySamples: number[];
  sampleCount: number;
}

/**
 * Calculate a percentile from a sorted array of values.
 * Uses the nearest-rank method.
 */
function calculatePercentile(sortedValues: number[], percentile: number): number | null {
  if (sortedValues.length === 0) return null;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}

export class MetricsCollector {
  private readonly tools: Map<string, ToolData> = new Map();
  private readonly startTime: number;
  private readonly maxSamplesPerTool: number;
  private readonly now: () => number;

  constructor(options: MetricsCollectorOptions = {}) {
    this.maxSamplesPerTool = options.maxSamplesPerTool ?? 1000;
    this.now = options.now ?? Date.now;
    this.startTime = this.now();
  }

  /**
   * Record a tool call with its duration, success status, and cache hit status.
   */
  recordCall(tool: string, duration: number, success: boolean, cacheHit: boolean): void {
    let data = this.tools.get(tool);
    if (!data) {
      data = {
        calls: 0,
        successes: 0,
        failures: 0,
        cacheHits: 0,
        cacheMisses: 0,
        lastCalled: null,
        latencySamples: [],
        sampleCount: 0,
      };
      this.tools.set(tool, data);
    }

    data.calls++;
    data.sampleCount++;
    data.lastCalled = this.now();

    if (success) {
      data.successes++;
    } else {
      data.failures++;
    }

    if (cacheHit) {
      data.cacheHits++;
    } else {
      data.cacheMisses++;
    }

    // Reservoir sampling: keep at most maxSamplesPerTool samples
    if (data.latencySamples.length < this.maxSamplesPerTool) {
      data.latencySamples.push(duration);
    } else {
      // Replace a random element with probability maxSamplesPerTool / sampleCount
      const replaceIndex = Math.floor(Math.random() * data.sampleCount);
      if (replaceIndex < this.maxSamplesPerTool) {
        data.latencySamples[replaceIndex] = duration;
      }
    }
  }

  /**
   * Get metrics for a specific tool or all tools.
   */
  getMetrics(tool?: string): ServerMetrics | ToolMetrics | null {
    if (tool !== undefined) {
      return this.getToolMetrics(tool);
    }

    const toolsMetrics: Record<string, ToolMetrics> = {};
    let totalCalls = 0;

    for (const [name, data] of this.tools) {
      const metrics = this.computeToolMetrics(data);
      toolsMetrics[name] = metrics;
      totalCalls += data.calls;
    }

    return {
      uptime: Math.floor((this.now() - this.startTime) / 1000),
      totalCalls,
      tools: toolsMetrics,
    };
  }

  /**
   * Reset all collected metrics.
   */
  reset(): void {
    this.tools.clear();
  }

  /**
   * Get the number of latency samples stored for a tool.
   * Exposed for testing memory bounds.
   */
  getSampleCount(tool: string): number {
    const data = this.tools.get(tool);
    return data ? data.latencySamples.length : 0;
  }

  private getToolMetrics(tool: string): ToolMetrics | null {
    const data = this.tools.get(tool);
    if (!data) return null;
    return this.computeToolMetrics(data);
  }

  private computeToolMetrics(data: ToolData): ToolMetrics {
    const sortedLatencies = [...data.latencySamples].sort((a, b) => a - b);

    const latency: LatencyStats = {
      p50: calculatePercentile(sortedLatencies, 50),
      p95: calculatePercentile(sortedLatencies, 95),
      p99: calculatePercentile(sortedLatencies, 99),
      avg: sortedLatencies.length > 0
        ? sortedLatencies.reduce((sum, v) => sum + v, 0) / sortedLatencies.length
        : null,
      min: sortedLatencies.length > 0 ? sortedLatencies[0] : null,
      max: sortedLatencies.length > 0 ? sortedLatencies[sortedLatencies.length - 1] : null,
    };

    const totalCacheOps = data.cacheHits + data.cacheMisses;

    return {
      calls: data.calls,
      successes: data.successes,
      failures: data.failures,
      successRate: data.calls > 0 ? data.successes / data.calls : 0,
      latency,
      cache: {
        hits: data.cacheHits,
        misses: data.cacheMisses,
        hitRate: totalCacheOps > 0 ? data.cacheHits / totalCacheOps : 0,
      },
      lastCalled: data.lastCalled !== null
        ? new Date(data.lastCalled).toISOString()
        : null,
    };
  }
}
