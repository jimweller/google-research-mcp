/**
 * Tool instrumentation wrapper for automatic metrics collection.
 *
 * Wraps tool handlers to automatically record execution metrics including:
 * - Call duration (using high-resolution performance.now())
 * - Success/failure status
 * - Cache hit detection (via result.fromCache property)
 */

/**
 * Interface for the metrics collector.
 * Defines the contract for recording tool call metrics.
 * This allows the wrapper to work with any implementation that satisfies the interface.
 */
export interface IMetricsCollector {
  /**
   * Record a tool call with its metrics.
   * @param toolName - Name of the tool being called
   * @param durationMs - Duration of the call in milliseconds
   * @param success - Whether the call succeeded
   * @param cacheHit - Whether the result was served from cache
   */
  recordCall(toolName: string, durationMs: number, success: boolean, cacheHit: boolean): void;
}

/**
 * Type for tool handler results that may include cache information.
 */
export interface InstrumentedResult {
  fromCache?: boolean;
}

/**
 * Wraps a tool handler to automatically record metrics on every call.
 *
 * @param name - The name of the tool (used for metric labeling)
 * @param handler - The original tool handler function
 * @param metrics - The metrics collector instance
 * @returns A wrapped handler that records metrics and preserves the original behavior
 *
 * @example
 * ```typescript
 * const instrumentedSearch = instrumentTool(
 *   'google_search',
 *   originalSearchHandler,
 *   metricsCollector
 * );
 *
 * // Use exactly like the original handler
 * const result = await instrumentedSearch({ query: 'test' });
 * ```
 */
export function instrumentTool<TParams, TResult extends InstrumentedResult>(
  name: string,
  handler: (params: TParams) => Promise<TResult>,
  metrics: IMetricsCollector
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
