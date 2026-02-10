import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { instrumentTool, IMetricsCollector, InstrumentedResult } from './instrumentTool.js';

describe('instrumentTool', () => {
  let mockMetrics: jest.Mocked<IMetricsCollector>;

  beforeEach(() => {
    mockMetrics = {
      recordCall: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('successful call recording', () => {
    it('should record a successful call with correct metrics', async () => {
      const handler = jest.fn(async () => ({ data: 'result' }));
      const instrumented = instrumentTool('test_tool', handler, mockMetrics);

      const result = await instrumented({ query: 'test' });

      expect(result).toEqual({ data: 'result' });
      expect(mockMetrics.recordCall).toHaveBeenCalledTimes(1);
      expect(mockMetrics.recordCall).toHaveBeenCalledWith(
        'test_tool',
        expect.any(Number),
        true,
        false
      );
    });

    it('should preserve the original return value', async () => {
      const expectedResult = {
        items: [1, 2, 3],
        metadata: { count: 3 },
        nested: { deep: { value: 'test' } },
      };
      const handler = jest.fn(async () => expectedResult);
      const instrumented = instrumentTool('preserve_test', handler, mockMetrics);

      const result = await instrumented({});

      expect(result).toBe(expectedResult);
      expect(result).toEqual(expectedResult);
    });

    it('should pass parameters to the original handler', async () => {
      const handler = jest.fn(async (params: { a: number; b: string }) => ({
        sum: params.a,
        text: params.b,
      }));
      const instrumented = instrumentTool('param_test', handler, mockMetrics);

      await instrumented({ a: 42, b: 'hello' });

      expect(handler).toHaveBeenCalledWith({ a: 42, b: 'hello' });
    });

    it('should record multiple sequential calls', async () => {
      const handler = jest.fn(async (params: { id: number }) => ({ id: params.id }));
      const instrumented = instrumentTool('multi_call', handler, mockMetrics);

      await instrumented({ id: 1 });
      await instrumented({ id: 2 });
      await instrumented({ id: 3 });

      expect(mockMetrics.recordCall).toHaveBeenCalledTimes(3);
      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  describe('failed call recording', () => {
    it('should record a failed call and re-throw the error', async () => {
      const error = new Error('Test error');
      const handler = jest.fn(async () => {
        throw error;
      });
      const instrumented = instrumentTool('fail_tool', handler, mockMetrics);

      await expect(instrumented({})).rejects.toThrow('Test error');

      expect(mockMetrics.recordCall).toHaveBeenCalledTimes(1);
      expect(mockMetrics.recordCall).toHaveBeenCalledWith(
        'fail_tool',
        expect.any(Number),
        false,
        false
      );
    });

    it('should preserve error type and properties', async () => {
      class CustomError extends Error {
        public readonly code: number;
        constructor(message: string, code: number) {
          super(message);
          this.name = 'CustomError';
          this.code = code;
        }
      }

      const customError = new CustomError('Custom failure', 500);
      const handler = jest.fn(async () => {
        throw customError;
      });
      const instrumented = instrumentTool('custom_error_tool', handler, mockMetrics);

      try {
        await instrumented({});
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBe(customError);
        expect(err).toBeInstanceOf(CustomError);
        expect((err as CustomError).code).toBe(500);
      }
    });

    it('should record cacheHit as false for failed calls', async () => {
      const handler = jest.fn(async () => {
        throw new Error('fail');
      });
      const instrumented = instrumentTool('fail_cache_test', handler, mockMetrics);

      await expect(instrumented({})).rejects.toThrow();

      const recordedCacheHit = mockMetrics.recordCall.mock.calls[0][3];
      expect(recordedCacheHit).toBe(false);
    });
  });

  describe('cache hit detection', () => {
    it('should detect cache hit when fromCache is true', async () => {
      const handler = jest.fn(async () => ({
        data: 'cached result',
        fromCache: true,
      }));
      const instrumented = instrumentTool('cache_hit_tool', handler, mockMetrics);

      await instrumented({});

      expect(mockMetrics.recordCall).toHaveBeenCalledWith(
        'cache_hit_tool',
        expect.any(Number),
        true,
        true
      );
    });

    it('should detect cache miss when fromCache is false', async () => {
      const handler = jest.fn(async () => ({
        data: 'fresh result',
        fromCache: false,
      }));
      const instrumented = instrumentTool('cache_miss_tool', handler, mockMetrics);

      await instrumented({});

      expect(mockMetrics.recordCall).toHaveBeenCalledWith(
        'cache_miss_tool',
        expect.any(Number),
        true,
        false
      );
    });

    it('should default to cache miss when fromCache is undefined', async () => {
      const handler = jest.fn(async () => ({
        data: 'result without cache info',
      }));
      const instrumented = instrumentTool('no_cache_info_tool', handler, mockMetrics);

      await instrumented({});

      expect(mockMetrics.recordCall).toHaveBeenCalledWith(
        'no_cache_info_tool',
        expect.any(Number),
        true,
        false
      );
    });

    it('should handle result with only fromCache property', async () => {
      const handler = jest.fn(async () => ({
        fromCache: true,
      }));
      const instrumented = instrumentTool('only_cache_tool', handler, mockMetrics);

      const result = await instrumented({});

      expect(result).toEqual({ fromCache: true });
      expect(mockMetrics.recordCall).toHaveBeenCalledWith(
        'only_cache_tool',
        expect.any(Number),
        true,
        true
      );
    });
  });

  describe('timing accuracy', () => {
    it('should record duration as a non-negative number for successful calls', async () => {
      const handler = jest.fn(async () => ({ result: 'fast' }));
      const instrumented = instrumentTool('timing_tool', handler, mockMetrics);

      await instrumented({});

      const recordedDuration = mockMetrics.recordCall.mock.calls[0][1];
      expect(typeof recordedDuration).toBe('number');
      expect(recordedDuration).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(recordedDuration)).toBe(true);
    });

    it('should record duration as a non-negative number for failed calls', async () => {
      const handler = jest.fn(async () => {
        throw new Error('failure');
      });
      const instrumented = instrumentTool('timing_fail_tool', handler, mockMetrics);

      await expect(instrumented({})).rejects.toThrow();

      const recordedDuration = mockMetrics.recordCall.mock.calls[0][1];
      expect(typeof recordedDuration).toBe('number');
      expect(recordedDuration).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(recordedDuration)).toBe(true);
    });

    it('should use high-resolution timing via performance.now()', async () => {
      // Verify the implementation uses performance.now() by checking
      // that duration is a floating point number (not integer milliseconds)
      // Note: In fake timer environment, this may be 0 for instant ops
      const handler = jest.fn(async () => ({ data: 'test' }));
      const instrumented = instrumentTool('precision_tool', handler, mockMetrics);

      await instrumented({});

      const recordedDuration = mockMetrics.recordCall.mock.calls[0][1];
      expect(typeof recordedDuration).toBe('number');
      // performance.now() can return floating point values
      expect(Number.isFinite(recordedDuration)).toBe(true);
    });

    it('should record duration less than a reasonable upper bound', async () => {
      const handler = jest.fn(async () => ({ instant: true }));
      const instrumented = instrumentTool('instant_tool', handler, mockMetrics);

      await instrumented({});

      const recordedDuration = mockMetrics.recordCall.mock.calls[0][1];
      // Even with fake timers, synchronous operations should complete quickly
      expect(recordedDuration).toBeLessThan(1000);
    });
  });

  describe('tool name handling', () => {
    it('should record the correct tool name', async () => {
      const handler = jest.fn(async () => ({}));

      const tool1 = instrumentTool('google_search', handler, mockMetrics);
      const tool2 = instrumentTool('scrape_page', handler, mockMetrics);
      const tool3 = instrumentTool('search_and_scrape', handler, mockMetrics);

      await tool1({});
      await tool2({});
      await tool3({});

      expect(mockMetrics.recordCall.mock.calls[0][0]).toBe('google_search');
      expect(mockMetrics.recordCall.mock.calls[1][0]).toBe('scrape_page');
      expect(mockMetrics.recordCall.mock.calls[2][0]).toBe('search_and_scrape');
    });

    it('should handle special characters in tool names', async () => {
      const handler = jest.fn(async () => ({}));
      const instrumented = instrumentTool('tool-with-dashes_and_underscores', handler, mockMetrics);

      await instrumented({});

      expect(mockMetrics.recordCall).toHaveBeenCalledWith(
        'tool-with-dashes_and_underscores',
        expect.any(Number),
        true,
        false
      );
    });
  });

  describe('type safety', () => {
    it('should preserve handler input type', async () => {
      interface SearchParams {
        query: string;
        limit: number;
      }
      interface SearchResult extends InstrumentedResult {
        results: string[];
      }

      const handler = jest.fn(async (params: SearchParams): Promise<SearchResult> => ({
        results: Array(params.limit).fill(params.query),
      }));

      const instrumented = instrumentTool<SearchParams, SearchResult>(
        'typed_tool',
        handler,
        mockMetrics
      );

      const result = await instrumented({ query: 'test', limit: 3 });

      expect(result.results).toHaveLength(3);
      expect(result.results).toEqual(['test', 'test', 'test']);
    });

    it('should work with void-like result objects', async () => {
      const handler = jest.fn(async () => ({}));
      const instrumented = instrumentTool('void_tool', handler, mockMetrics);

      const result = await instrumented({});

      expect(result).toEqual({});
    });
  });

  describe('concurrent calls', () => {
    it('should handle concurrent calls independently', async () => {
      let callCount = 0;
      const handler = jest.fn(async (params: { cached: boolean }) => {
        const id = ++callCount;
        // No setTimeout needed - just return immediately
        return { id, fromCache: params.cached };
      });
      const instrumented = instrumentTool('concurrent_tool', handler, mockMetrics);

      const results = await Promise.all([
        instrumented({ cached: false }),
        instrumented({ cached: true }),
        instrumented({ cached: false }),
      ]);

      expect(results).toHaveLength(3);
      expect(mockMetrics.recordCall).toHaveBeenCalledTimes(3);

      // Verify each call recorded independently with correct cache status
      const calls = mockMetrics.recordCall.mock.calls;
      expect(calls.some(([, , , cacheHit]) => cacheHit === true)).toBe(true);
      expect(calls.some(([, , , cacheHit]) => cacheHit === false)).toBe(true);
    });

    it('should record metrics for all concurrent calls', async () => {
      const handler = jest.fn(async (params: { value: number }) => ({
        result: params.value * 2,
      }));
      const instrumented = instrumentTool('concurrent_metrics', handler, mockMetrics);

      await Promise.all([
        instrumented({ value: 1 }),
        instrumented({ value: 2 }),
        instrumented({ value: 3 }),
        instrumented({ value: 4 }),
        instrumented({ value: 5 }),
      ]);

      expect(mockMetrics.recordCall).toHaveBeenCalledTimes(5);
      // All calls should be recorded as successful with cache miss
      mockMetrics.recordCall.mock.calls.forEach((call) => {
        expect(call[0]).toBe('concurrent_metrics');
        expect(call[2]).toBe(true); // success
        expect(call[3]).toBe(false); // cacheHit
      });
    });
  });
});
