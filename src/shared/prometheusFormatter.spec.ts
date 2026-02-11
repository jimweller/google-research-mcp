import { describe, it, expect } from '@jest/globals';
import { formatPrometheusMetrics } from './prometheusFormatter.js';
import type { ServerMetrics } from './metricsCollector.js';

describe('prometheusFormatter', () => {
  describe('formatPrometheusMetrics', () => {
    it('should format empty metrics', () => {
      const metrics: ServerMetrics = {
        uptime: 0,
        totalCalls: 0,
        tools: {},
      };

      const output = formatPrometheusMetrics(metrics);

      expect(output).toContain('mcp_server_uptime_seconds 0');
      expect(output).toContain('mcp_server_total_calls_total 0');
    });

    it('should format server uptime', () => {
      const metrics: ServerMetrics = {
        uptime: 3600,
        totalCalls: 0,
        tools: {},
      };

      const output = formatPrometheusMetrics(metrics);

      expect(output).toContain('# HELP mcp_server_uptime_seconds');
      expect(output).toContain('# TYPE mcp_server_uptime_seconds gauge');
      expect(output).toContain('mcp_server_uptime_seconds 3600');
    });

    it('should format tool call counts', () => {
      const metrics: ServerMetrics = {
        uptime: 100,
        totalCalls: 150,
        tools: {
          google_search: {
            calls: 100,
            successes: 95,
            failures: 5,
            successRate: 0.95,
            latency: { p50: 50, p95: 100, p99: 150, avg: 60, min: 10, max: 200 },
            cache: { hits: 30, misses: 70, hitRate: 0.3 },
            lastCalled: '2025-01-01T00:00:00.000Z',
          },
          scrape_page: {
            calls: 50,
            successes: 48,
            failures: 2,
            successRate: 0.96,
            latency: { p50: 200, p95: 500, p99: 800, avg: 250, min: 50, max: 1000 },
            cache: { hits: 10, misses: 40, hitRate: 0.2 },
            lastCalled: '2025-01-01T00:00:00.000Z',
          },
        },
      };

      const output = formatPrometheusMetrics(metrics);

      // Check call counts
      expect(output).toContain('mcp_tool_calls_total{tool="google_search"} 100');
      expect(output).toContain('mcp_tool_calls_total{tool="scrape_page"} 50');

      // Check success counts
      expect(output).toContain('mcp_tool_successes_total{tool="google_search"} 95');
      expect(output).toContain('mcp_tool_successes_total{tool="scrape_page"} 48');

      // Check failure counts
      expect(output).toContain('mcp_tool_failures_total{tool="google_search"} 5');
      expect(output).toContain('mcp_tool_failures_total{tool="scrape_page"} 2');
    });

    it('should format latency percentiles', () => {
      const metrics: ServerMetrics = {
        uptime: 100,
        totalCalls: 10,
        tools: {
          test_tool: {
            calls: 10,
            successes: 10,
            failures: 0,
            successRate: 1.0,
            latency: { p50: 25.5, p95: 100.2, p99: 150.8, avg: 40.3, min: 5, max: 200 },
            cache: { hits: 0, misses: 10, hitRate: 0 },
            lastCalled: null,
          },
        },
      };

      const output = formatPrometheusMetrics(metrics);

      expect(output).toContain('mcp_tool_latency_milliseconds{tool="test_tool",quantile="0.5"} 25.5');
      expect(output).toContain('mcp_tool_latency_milliseconds{tool="test_tool",quantile="0.95"} 100.2');
      expect(output).toContain('mcp_tool_latency_milliseconds{tool="test_tool",quantile="0.99"} 150.8');
      expect(output).toContain('mcp_tool_latency_avg_milliseconds{tool="test_tool"} 40.3');
    });

    it('should format cache statistics', () => {
      const metrics: ServerMetrics = {
        uptime: 100,
        totalCalls: 100,
        tools: {
          cached_tool: {
            calls: 100,
            successes: 100,
            failures: 0,
            successRate: 1.0,
            latency: { p50: null, p95: null, p99: null, avg: null, min: null, max: null },
            cache: { hits: 75, misses: 25, hitRate: 0.75 },
            lastCalled: null,
          },
        },
      };

      const output = formatPrometheusMetrics(metrics);

      expect(output).toContain('mcp_tool_cache_hits_total{tool="cached_tool"} 75');
      expect(output).toContain('mcp_tool_cache_misses_total{tool="cached_tool"} 25');
      expect(output).toContain('mcp_tool_cache_hit_rate{tool="cached_tool"} 0.75');
    });

    it('should handle null latency values', () => {
      const metrics: ServerMetrics = {
        uptime: 10,
        totalCalls: 0,
        tools: {
          no_data_tool: {
            calls: 0,
            successes: 0,
            failures: 0,
            successRate: 0,
            latency: { p50: null, p95: null, p99: null, avg: null, min: null, max: null },
            cache: { hits: 0, misses: 0, hitRate: 0 },
            lastCalled: null,
          },
        },
      };

      const output = formatPrometheusMetrics(metrics);

      // Should not include latency lines for null values
      expect(output).not.toContain('mcp_tool_latency_milliseconds{tool="no_data_tool"');
      expect(output).not.toContain('mcp_tool_latency_avg_milliseconds{tool="no_data_tool"');
    });

    it('should escape special characters in tool names', () => {
      const metrics: ServerMetrics = {
        uptime: 10,
        totalCalls: 1,
        tools: {
          'tool"with"quotes': {
            calls: 1,
            successes: 1,
            failures: 0,
            successRate: 1.0,
            latency: { p50: 10, p95: 10, p99: 10, avg: 10, min: 10, max: 10 },
            cache: { hits: 0, misses: 1, hitRate: 0 },
            lastCalled: null,
          },
        },
      };

      const output = formatPrometheusMetrics(metrics);

      expect(output).toContain('tool="tool\\"with\\"quotes"');
    });

    it('should include proper Prometheus HELP and TYPE annotations', () => {
      const metrics: ServerMetrics = {
        uptime: 100,
        totalCalls: 10,
        tools: {
          test: {
            calls: 10,
            successes: 10,
            failures: 0,
            successRate: 1.0,
            latency: { p50: 10, p95: 20, p99: 30, avg: 15, min: 5, max: 40 },
            cache: { hits: 5, misses: 5, hitRate: 0.5 },
            lastCalled: null,
          },
        },
      };

      const output = formatPrometheusMetrics(metrics);

      // Check HELP annotations
      expect(output).toContain('# HELP mcp_server_uptime_seconds');
      expect(output).toContain('# HELP mcp_tool_calls_total');
      expect(output).toContain('# HELP mcp_tool_latency_milliseconds');
      expect(output).toContain('# HELP mcp_tool_cache_hits_total');

      // Check TYPE annotations
      expect(output).toContain('# TYPE mcp_server_uptime_seconds gauge');
      expect(output).toContain('# TYPE mcp_tool_calls_total counter');
      expect(output).toContain('# TYPE mcp_tool_success_rate gauge');
    });

    it('should output valid Prometheus format', () => {
      const metrics: ServerMetrics = {
        uptime: 100,
        totalCalls: 50,
        tools: {
          google_search: {
            calls: 30,
            successes: 28,
            failures: 2,
            successRate: 0.9333333333333333,
            latency: { p50: 45, p95: 120, p99: 180, avg: 55, min: 10, max: 200 },
            cache: { hits: 10, misses: 20, hitRate: 0.3333333333333333 },
            lastCalled: '2025-01-01T12:00:00.000Z',
          },
        },
      };

      const output = formatPrometheusMetrics(metrics);
      const lines = output.split('\n');

      // Each non-empty, non-comment line should be a valid metric
      for (const line of lines) {
        if (line.trim() === '' || line.startsWith('#')) continue;

        // Valid metric line format: metric_name{labels} value or metric_name value
        const metricPattern = /^[a-zA-Z_:][a-zA-Z0-9_:]*(\{[^}]+\})?\s+[0-9.eE+-]+$/;
        expect(line).toMatch(metricPattern);
      }
    });
  });
});
