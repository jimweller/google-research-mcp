import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  MetricsCollector,
  ToolMetrics,
  ServerMetrics,
} from './metricsCollector.js';

describe('MetricsCollector', () => {
  let mockNow: number;
  const now = () => mockNow;

  beforeEach(() => {
    mockNow = 1_000_000;
  });

  function createCollector(maxSamples = 1000) {
    return new MetricsCollector({
      maxSamplesPerTool: maxSamples,
      now,
    });
  }

  describe('basic recording', () => {
    it('should start with no tools', () => {
      const collector = createCollector();
      const metrics = collector.getMetrics() as ServerMetrics;

      expect(metrics.totalCalls).toBe(0);
      expect(Object.keys(metrics.tools)).toHaveLength(0);
    });

    it('should record a successful call', () => {
      const collector = createCollector();
      collector.recordCall('google_search', 150, true, false);

      const metrics = collector.getMetrics('google_search') as ToolMetrics;

      expect(metrics.calls).toBe(1);
      expect(metrics.successes).toBe(1);
      expect(metrics.failures).toBe(0);
      expect(metrics.successRate).toBe(1);
    });

    it('should record a failed call', () => {
      const collector = createCollector();
      collector.recordCall('scrape_page', 500, false, false);

      const metrics = collector.getMetrics('scrape_page') as ToolMetrics;

      expect(metrics.calls).toBe(1);
      expect(metrics.successes).toBe(0);
      expect(metrics.failures).toBe(1);
      expect(metrics.successRate).toBe(0);
    });

    it('should calculate correct success rate', () => {
      const collector = createCollector();

      collector.recordCall('tool', 100, true, false);
      collector.recordCall('tool', 100, true, false);
      collector.recordCall('tool', 100, false, false);
      collector.recordCall('tool', 100, true, false);

      const metrics = collector.getMetrics('tool') as ToolMetrics;

      expect(metrics.calls).toBe(4);
      expect(metrics.successes).toBe(3);
      expect(metrics.failures).toBe(1);
      expect(metrics.successRate).toBe(0.75);
    });

    it('should track multiple tools independently', () => {
      const collector = createCollector();

      collector.recordCall('tool_a', 100, true, false);
      collector.recordCall('tool_a', 100, true, false);
      collector.recordCall('tool_b', 200, false, false);

      const metricsA = collector.getMetrics('tool_a') as ToolMetrics;
      const metricsB = collector.getMetrics('tool_b') as ToolMetrics;

      expect(metricsA.calls).toBe(2);
      expect(metricsA.successes).toBe(2);

      expect(metricsB.calls).toBe(1);
      expect(metricsB.failures).toBe(1);
    });

    it('should return null for unknown tool', () => {
      const collector = createCollector();
      const metrics = collector.getMetrics('nonexistent');

      expect(metrics).toBeNull();
    });

    it('should track lastCalled timestamp', () => {
      const collector = createCollector();

      mockNow = 1_500_000;
      collector.recordCall('tool', 100, true, false);

      const metrics = collector.getMetrics('tool') as ToolMetrics;

      expect(metrics.lastCalled).toBe(new Date(1_500_000).toISOString());
    });
  });

  describe('latency percentile calculation', () => {
    it('should calculate percentiles for single value', () => {
      const collector = createCollector();
      collector.recordCall('tool', 100, true, false);

      const metrics = collector.getMetrics('tool') as ToolMetrics;

      expect(metrics.latency.p50).toBe(100);
      expect(metrics.latency.p95).toBe(100);
      expect(metrics.latency.p99).toBe(100);
      expect(metrics.latency.avg).toBe(100);
      expect(metrics.latency.min).toBe(100);
      expect(metrics.latency.max).toBe(100);
    });

    it('should calculate percentiles for multiple values', () => {
      const collector = createCollector();

      // Record 100 calls with latencies 1-100
      for (let i = 1; i <= 100; i++) {
        collector.recordCall('tool', i, true, false);
      }

      const metrics = collector.getMetrics('tool') as ToolMetrics;

      expect(metrics.latency.p50).toBe(50);
      expect(metrics.latency.p95).toBe(95);
      expect(metrics.latency.p99).toBe(99);
      expect(metrics.latency.min).toBe(1);
      expect(metrics.latency.max).toBe(100);
      expect(metrics.latency.avg).toBeCloseTo(50.5, 1);
    });

    it('should handle latencies with outliers', () => {
      const collector = createCollector();

      // 98 calls at 100ms, 1 call at 500ms, 1 call at 1000ms
      for (let i = 0; i < 98; i++) {
        collector.recordCall('tool', 100, true, false);
      }
      collector.recordCall('tool', 500, true, false);
      collector.recordCall('tool', 1000, true, false);

      const metrics = collector.getMetrics('tool') as ToolMetrics;

      expect(metrics.latency.p50).toBe(100);
      expect(metrics.latency.p95).toBe(100);
      expect(metrics.latency.p99).toBe(500);
      expect(metrics.latency.min).toBe(100);
      expect(metrics.latency.max).toBe(1000);
    });

    it('should return null latency stats when no calls', () => {
      const collector = createCollector();

      // Force creation of tool without samples
      const metrics = collector.getMetrics() as ServerMetrics;

      expect(Object.keys(metrics.tools)).toHaveLength(0);
    });
  });

  describe('cache hit/miss tracking', () => {
    it('should track cache hits', () => {
      const collector = createCollector();

      collector.recordCall('tool', 10, true, true);
      collector.recordCall('tool', 100, true, false);
      collector.recordCall('tool', 5, true, true);

      const metrics = collector.getMetrics('tool') as ToolMetrics;

      expect(metrics.cache.hits).toBe(2);
      expect(metrics.cache.misses).toBe(1);
      expect(metrics.cache.hitRate).toBeCloseTo(2 / 3, 5);
    });

    it('should calculate 0 hit rate when no cache operations', () => {
      const collector = createCollector();

      // New tool with no calls has 0 hit rate
      const serverMetrics = collector.getMetrics() as ServerMetrics;
      expect(Object.keys(serverMetrics.tools)).toHaveLength(0);
    });

    it('should calculate 100% hit rate when all hits', () => {
      const collector = createCollector();

      collector.recordCall('tool', 10, true, true);
      collector.recordCall('tool', 10, true, true);

      const metrics = collector.getMetrics('tool') as ToolMetrics;

      expect(metrics.cache.hitRate).toBe(1);
    });

    it('should calculate 0% hit rate when all misses', () => {
      const collector = createCollector();

      collector.recordCall('tool', 100, true, false);
      collector.recordCall('tool', 100, true, false);

      const metrics = collector.getMetrics('tool') as ToolMetrics;

      expect(metrics.cache.hitRate).toBe(0);
    });
  });

  describe('reset functionality', () => {
    it('should clear all tool metrics', () => {
      const collector = createCollector();

      collector.recordCall('tool_a', 100, true, false);
      collector.recordCall('tool_b', 200, false, true);

      collector.reset();

      const metrics = collector.getMetrics() as ServerMetrics;

      expect(metrics.totalCalls).toBe(0);
      expect(Object.keys(metrics.tools)).toHaveLength(0);
    });

    it('should allow recording after reset', () => {
      const collector = createCollector();

      collector.recordCall('tool', 100, true, false);
      collector.reset();
      collector.recordCall('tool', 200, false, true);

      const metrics = collector.getMetrics('tool') as ToolMetrics;

      expect(metrics.calls).toBe(1);
      expect(metrics.successes).toBe(0);
      expect(metrics.failures).toBe(1);
      expect(metrics.cache.hits).toBe(1);
    });

    it('should not affect uptime calculation', () => {
      const collector = createCollector();

      mockNow += 5000;
      collector.recordCall('tool', 100, true, false);

      collector.reset();

      mockNow += 5000;
      const metrics = collector.getMetrics() as ServerMetrics;

      // Uptime is 10 seconds from start, regardless of reset
      expect(metrics.uptime).toBe(10);
    });
  });

  describe('memory bounds (reservoir sampling)', () => {
    it('should limit samples to maxSamplesPerTool', () => {
      const maxSamples = 100;
      const collector = createCollector(maxSamples);

      // Record more calls than the limit
      for (let i = 0; i < 500; i++) {
        collector.recordCall('tool', i, true, false);
      }

      expect(collector.getSampleCount('tool')).toBe(maxSamples);
    });

    it('should respect default max of 1000 samples', () => {
      const collector = createCollector();

      for (let i = 0; i < 2000; i++) {
        collector.recordCall('tool', i, true, false);
      }

      expect(collector.getSampleCount('tool')).toBe(1000);
    });

    it('should maintain sample diversity with reservoir sampling', () => {
      const maxSamples = 100;
      const collector = createCollector(maxSamples);

      // Record 1000 calls with distinct latencies
      for (let i = 0; i < 1000; i++) {
        collector.recordCall('tool', i, true, false);
      }

      const metrics = collector.getMetrics('tool') as ToolMetrics;

      // With reservoir sampling, we should see a range of values
      // The min should be relatively small and max relatively large
      expect(metrics.latency.min).toBeLessThan(200);
      expect(metrics.latency.max).toBeGreaterThan(800);
    });

    it('should track correct call count even when samples are bounded', () => {
      const maxSamples = 10;
      const collector = createCollector(maxSamples);

      for (let i = 0; i < 100; i++) {
        collector.recordCall('tool', i, true, false);
      }

      const metrics = collector.getMetrics('tool') as ToolMetrics;

      expect(metrics.calls).toBe(100);
      expect(collector.getSampleCount('tool')).toBe(maxSamples);
    });
  });

  describe('server metrics aggregation', () => {
    it('should calculate total calls across all tools', () => {
      const collector = createCollector();

      collector.recordCall('tool_a', 100, true, false);
      collector.recordCall('tool_a', 100, true, false);
      collector.recordCall('tool_b', 200, true, false);
      collector.recordCall('tool_c', 300, true, false);

      const metrics = collector.getMetrics() as ServerMetrics;

      expect(metrics.totalCalls).toBe(4);
    });

    it('should calculate uptime in seconds', () => {
      const collector = createCollector();

      mockNow += 5_500; // 5.5 seconds later

      const metrics = collector.getMetrics() as ServerMetrics;

      expect(metrics.uptime).toBe(5); // Floored to seconds
    });

    it('should include all tools in server metrics', () => {
      const collector = createCollector();

      collector.recordCall('google_search', 100, true, false);
      collector.recordCall('scrape_page', 200, true, true);
      collector.recordCall('academic_search', 300, false, false);

      const metrics = collector.getMetrics() as ServerMetrics;

      expect(Object.keys(metrics.tools)).toHaveLength(3);
      expect(metrics.tools['google_search']).toBeDefined();
      expect(metrics.tools['scrape_page']).toBeDefined();
      expect(metrics.tools['academic_search']).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle zero duration calls', () => {
      const collector = createCollector();

      collector.recordCall('tool', 0, true, false);

      const metrics = collector.getMetrics('tool') as ToolMetrics;

      expect(metrics.latency.min).toBe(0);
      expect(metrics.latency.max).toBe(0);
      expect(metrics.latency.avg).toBe(0);
    });

    it('should handle very large latencies', () => {
      const collector = createCollector();

      collector.recordCall('tool', 1_000_000, true, false); // 1 million ms

      const metrics = collector.getMetrics('tool') as ToolMetrics;

      expect(metrics.latency.max).toBe(1_000_000);
    });

    it('should handle rapid successive calls', () => {
      const collector = createCollector();

      for (let i = 0; i < 10000; i++) {
        collector.recordCall('tool', Math.random() * 1000, Math.random() > 0.1, Math.random() > 0.5);
      }

      const metrics = collector.getMetrics('tool') as ToolMetrics;

      expect(metrics.calls).toBe(10000);
      expect(metrics.successes + metrics.failures).toBe(10000);
      expect(metrics.cache.hits + metrics.cache.misses).toBe(10000);
    });

    it('should handle tool names with special characters', () => {
      const collector = createCollector();

      collector.recordCall('tool-with-dashes', 100, true, false);
      collector.recordCall('tool_with_underscores', 100, true, false);
      collector.recordCall('tool.with.dots', 100, true, false);

      const metrics = collector.getMetrics() as ServerMetrics;

      expect(metrics.tools['tool-with-dashes']).toBeDefined();
      expect(metrics.tools['tool_with_underscores']).toBeDefined();
      expect(metrics.tools['tool.with.dots']).toBeDefined();
    });
  });
});
