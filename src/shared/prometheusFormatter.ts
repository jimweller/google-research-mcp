/**
 * Prometheus metrics formatter.
 *
 * Converts internal metrics to Prometheus exposition format.
 * See: https://prometheus.io/docs/instrumenting/exposition_formats/
 */

import type { ServerMetrics, ToolMetrics } from './metricsCollector.js';

/**
 * Format server metrics in Prometheus exposition format.
 *
 * @param metrics - The server metrics to format
 * @returns Prometheus-formatted metrics string
 */
export function formatPrometheusMetrics(metrics: ServerMetrics): string {
  const lines: string[] = [];

  // Server uptime
  lines.push('# HELP mcp_server_uptime_seconds Server uptime in seconds');
  lines.push('# TYPE mcp_server_uptime_seconds gauge');
  lines.push(`mcp_server_uptime_seconds ${metrics.uptime}`);
  lines.push('');

  // Total calls across all tools
  lines.push('# HELP mcp_server_total_calls_total Total calls across all tools');
  lines.push('# TYPE mcp_server_total_calls_total counter');
  lines.push(`mcp_server_total_calls_total ${metrics.totalCalls}`);
  lines.push('');

  // Per-tool metrics
  const tools = Object.entries(metrics.tools);

  if (tools.length > 0) {
    // Tool call counts
    lines.push('# HELP mcp_tool_calls_total Total tool invocations');
    lines.push('# TYPE mcp_tool_calls_total counter');
    for (const [tool, m] of tools) {
      lines.push(`mcp_tool_calls_total{tool="${escapeLabel(tool)}"} ${m.calls}`);
    }
    lines.push('');

    // Tool success counts
    lines.push('# HELP mcp_tool_successes_total Successful tool invocations');
    lines.push('# TYPE mcp_tool_successes_total counter');
    for (const [tool, m] of tools) {
      lines.push(`mcp_tool_successes_total{tool="${escapeLabel(tool)}"} ${m.successes}`);
    }
    lines.push('');

    // Tool failure counts
    lines.push('# HELP mcp_tool_failures_total Failed tool invocations');
    lines.push('# TYPE mcp_tool_failures_total counter');
    for (const [tool, m] of tools) {
      lines.push(`mcp_tool_failures_total{tool="${escapeLabel(tool)}"} ${m.failures}`);
    }
    lines.push('');

    // Success rate (gauge)
    lines.push('# HELP mcp_tool_success_rate Tool success rate (0-1)');
    lines.push('# TYPE mcp_tool_success_rate gauge');
    for (const [tool, m] of tools) {
      lines.push(`mcp_tool_success_rate{tool="${escapeLabel(tool)}"} ${m.successRate}`);
    }
    lines.push('');

    // Latency percentiles
    lines.push('# HELP mcp_tool_latency_milliseconds Tool latency percentiles');
    lines.push('# TYPE mcp_tool_latency_milliseconds gauge');
    for (const [tool, m] of tools) {
      if (m.latency.p50 !== null) {
        lines.push(`mcp_tool_latency_milliseconds{tool="${escapeLabel(tool)}",quantile="0.5"} ${m.latency.p50}`);
      }
      if (m.latency.p95 !== null) {
        lines.push(`mcp_tool_latency_milliseconds{tool="${escapeLabel(tool)}",quantile="0.95"} ${m.latency.p95}`);
      }
      if (m.latency.p99 !== null) {
        lines.push(`mcp_tool_latency_milliseconds{tool="${escapeLabel(tool)}",quantile="0.99"} ${m.latency.p99}`);
      }
    }
    lines.push('');

    // Average latency
    lines.push('# HELP mcp_tool_latency_avg_milliseconds Average tool latency');
    lines.push('# TYPE mcp_tool_latency_avg_milliseconds gauge');
    for (const [tool, m] of tools) {
      if (m.latency.avg !== null) {
        lines.push(`mcp_tool_latency_avg_milliseconds{tool="${escapeLabel(tool)}"} ${m.latency.avg}`);
      }
    }
    lines.push('');

    // Cache hits
    lines.push('# HELP mcp_tool_cache_hits_total Tool cache hits');
    lines.push('# TYPE mcp_tool_cache_hits_total counter');
    for (const [tool, m] of tools) {
      lines.push(`mcp_tool_cache_hits_total{tool="${escapeLabel(tool)}"} ${m.cache.hits}`);
    }
    lines.push('');

    // Cache misses
    lines.push('# HELP mcp_tool_cache_misses_total Tool cache misses');
    lines.push('# TYPE mcp_tool_cache_misses_total counter');
    for (const [tool, m] of tools) {
      lines.push(`mcp_tool_cache_misses_total{tool="${escapeLabel(tool)}"} ${m.cache.misses}`);
    }
    lines.push('');

    // Cache hit rate
    lines.push('# HELP mcp_tool_cache_hit_rate Tool cache hit rate (0-1)');
    lines.push('# TYPE mcp_tool_cache_hit_rate gauge');
    for (const [tool, m] of tools) {
      lines.push(`mcp_tool_cache_hit_rate{tool="${escapeLabel(tool)}"} ${m.cache.hitRate}`);
    }
  }

  return lines.join('\n');
}

/**
 * Escape special characters in Prometheus label values.
 * Labels must escape: backslash, double-quote, and newline.
 */
function escapeLabel(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}
