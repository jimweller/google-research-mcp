import { describe, it, expect, jest } from '@jest/globals';
import { CircuitBreaker, CircuitState, CircuitOpenError } from './circuitBreaker.js';

describe('CircuitBreaker', () => {
  let mockNow: number;
  const now = () => mockNow;

  beforeEach(() => {
    mockNow = 1_000_000;
  });

  function createBreaker(overrides: Partial<Parameters<typeof CircuitBreaker['prototype']['execute']> extends never ? object : object> & {
    failureThreshold?: number;
    resetTimeout?: number;
    halfOpenMaxAttempts?: number;
    onStateChange?: (from: CircuitState, to: CircuitState) => void;
  } = {}) {
    return new CircuitBreaker({
      failureThreshold: overrides.failureThreshold ?? 3,
      resetTimeout: overrides.resetTimeout ?? 10_000,
      halfOpenMaxAttempts: overrides.halfOpenMaxAttempts ?? 1,
      now,
      onStateChange: overrides.onStateChange,
    });
  }

  describe('CLOSED state', () => {
    it('should start in CLOSED state', () => {
      const cb = createBreaker();
      expect(cb.getState()).toBe(CircuitState.CLOSED);
      expect(cb.getFailureCount()).toBe(0);
    });

    it('should pass through successful calls', async () => {
      const cb = createBreaker();
      const result = await cb.execute(async () => 'ok');
      expect(result).toBe('ok');
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it('should propagate errors without opening if under threshold', async () => {
      const cb = createBreaker({ failureThreshold: 3 });

      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow('fail');

      expect(cb.getFailureCount()).toBe(2);
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reset failure count on success', async () => {
      const cb = createBreaker({ failureThreshold: 3 });

      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      expect(cb.getFailureCount()).toBe(2);

      await cb.execute(async () => 'ok');
      expect(cb.getFailureCount()).toBe(0);
    });
  });

  describe('CLOSED → OPEN transition', () => {
    it('should open after reaching failure threshold', async () => {
      const cb = createBreaker({ failureThreshold: 3 });

      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
      }

      expect(cb.getState()).toBe(CircuitState.OPEN);
    });

    it('should fire onStateChange callback', async () => {
      const transitions: Array<[CircuitState, CircuitState]> = [];
      const cb = createBreaker({
        failureThreshold: 2,
        onStateChange: (from, to) => transitions.push([from, to]),
      });

      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();

      expect(transitions).toEqual([[CircuitState.CLOSED, CircuitState.OPEN]]);
    });
  });

  describe('OPEN state', () => {
    it('should throw CircuitOpenError without calling the function', async () => {
      const cb = createBreaker({ failureThreshold: 1 });
      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
      expect(cb.getState()).toBe(CircuitState.OPEN);

      const fn = jest.fn(async () => 'ok');
      await expect(cb.execute(fn)).rejects.toThrow(CircuitOpenError);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should include remaining time in CircuitOpenError', async () => {
      const cb = createBreaker({ failureThreshold: 1, resetTimeout: 10_000 });
      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();

      mockNow += 3_000; // 3s later — 7s remaining

      try {
        await cb.execute(async () => 'ok');
      } catch (err) {
        expect(err).toBeInstanceOf(CircuitOpenError);
        expect((err as CircuitOpenError).remainingMs).toBe(7_000);
      }
    });
  });

  describe('OPEN → HALF_OPEN transition', () => {
    it('should transition to HALF_OPEN after resetTimeout elapses', async () => {
      const cb = createBreaker({ failureThreshold: 1, resetTimeout: 10_000 });
      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      expect(cb.getState()).toBe(CircuitState.OPEN);

      mockNow += 10_000; // Exactly at reset timeout

      const result = await cb.execute(async () => 'recovered');
      expect(result).toBe('recovered');
      // After one success in HALF_OPEN → CLOSED
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('HALF_OPEN state', () => {
    async function openBreaker(cb: CircuitBreaker, threshold: number) {
      for (let i = 0; i < threshold; i++) {
        await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      }
    }

    it('should close after enough successes in HALF_OPEN', async () => {
      const cb = createBreaker({ failureThreshold: 2, resetTimeout: 5_000, halfOpenMaxAttempts: 2 });
      await openBreaker(cb, 2);
      expect(cb.getState()).toBe(CircuitState.OPEN);

      mockNow += 5_000;

      // First success — still HALF_OPEN
      await cb.execute(async () => 'ok1');
      expect(cb.getState()).toBe(CircuitState.HALF_OPEN);

      // Second success — transitions to CLOSED
      await cb.execute(async () => 'ok2');
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it('should re-open on failure in HALF_OPEN', async () => {
      const cb = createBreaker({ failureThreshold: 1, resetTimeout: 5_000 });
      await openBreaker(cb, 1);
      expect(cb.getState()).toBe(CircuitState.OPEN);

      mockNow += 5_000;

      // Failure during HALF_OPEN → back to OPEN
      await expect(cb.execute(async () => { throw new Error('still broken'); })).rejects.toThrow();
      expect(cb.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('reset()', () => {
    it('should reset to CLOSED from any state', async () => {
      const cb = createBreaker({ failureThreshold: 1 });
      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      expect(cb.getState()).toBe(CircuitState.OPEN);

      cb.reset();
      expect(cb.getState()).toBe(CircuitState.CLOSED);
      expect(cb.getFailureCount()).toBe(0);

      // Should work normally after reset
      const result = await cb.execute(async () => 'ok');
      expect(result).toBe('ok');
    });
  });

  describe('full lifecycle', () => {
    it('should go through CLOSED → OPEN → HALF_OPEN → CLOSED', async () => {
      const transitions: Array<[CircuitState, CircuitState]> = [];
      const cb = createBreaker({
        failureThreshold: 2,
        resetTimeout: 10_000,
        onStateChange: (from, to) => transitions.push([from, to]),
      });

      // CLOSED: 2 failures → OPEN
      await expect(cb.execute(async () => { throw new Error('1'); })).rejects.toThrow();
      await expect(cb.execute(async () => { throw new Error('2'); })).rejects.toThrow();
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // OPEN: calls rejected
      await expect(cb.execute(async () => 'ok')).rejects.toThrow(CircuitOpenError);

      // Advance time past reset → HALF_OPEN on next call
      mockNow += 10_000;

      // HALF_OPEN: 1 success → CLOSED
      await cb.execute(async () => 'recovered');
      expect(cb.getState()).toBe(CircuitState.CLOSED);

      expect(transitions).toEqual([
        [CircuitState.CLOSED, CircuitState.OPEN],
        [CircuitState.OPEN, CircuitState.HALF_OPEN],
        [CircuitState.HALF_OPEN, CircuitState.CLOSED],
      ]);
    });
  });
});
