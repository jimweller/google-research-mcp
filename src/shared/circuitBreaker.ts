/**
 * Timer-free circuit breaker for external API calls.
 *
 * States: CLOSED → OPEN → HALF_OPEN → CLOSED
 *
 * Instead of using setTimeout for state transitions (which conflicts with Jest
 * fake timers), the breaker checks elapsed time on each execute() call via an
 * injectable `now` function.
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Milliseconds to wait before transitioning from OPEN → HALF_OPEN (default: 60_000) */
  resetTimeout?: number;
  /** Number of successful calls in HALF_OPEN before closing the circuit (default: 1) */
  halfOpenMaxAttempts?: number;
  /** Injectable clock for testing (default: Date.now) */
  now?: () => number;
  /** Called when the circuit transitions to a new state */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export class CircuitOpenError extends Error {
  public readonly remainingMs: number;

  constructor(remainingMs: number) {
    super(`Circuit is OPEN — retry after ${Math.ceil(remainingMs / 1000)}s`);
    this.name = 'CircuitOpenError';
    this.remainingMs = remainingMs;
  }
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private halfOpenSuccesses = 0;
  private lastFailureTime = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly halfOpenMaxAttempts: number;
  private readonly now: () => number;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 60_000;
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts ?? 1;
    this.now = options.now ?? Date.now;
    this.onStateChange = options.onStateChange;
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws CircuitOpenError if the circuit is open and the reset timeout
   * has not elapsed.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if OPEN circuit should transition to HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      const elapsed = this.now() - this.lastFailureTime;
      if (elapsed >= this.resetTimeout) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        throw new CircuitOpenError(this.resetTimeout - elapsed);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /** Manually reset the circuit to CLOSED */
  reset(): void {
    this.failureCount = 0;
    this.halfOpenSuccesses = 0;
    this.lastFailureTime = 0;
    if (this.state !== CircuitState.CLOSED) {
      this.transitionTo(CircuitState.CLOSED);
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.halfOpenMaxAttempts) {
        this.failureCount = 0;
        this.halfOpenSuccesses = 0;
        this.transitionTo(CircuitState.CLOSED);
      }
    } else {
      // In CLOSED state, a success resets the failure counter
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = this.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN re-opens the circuit
      this.halfOpenSuccesses = 0;
      this.transitionTo(CircuitState.OPEN);
    } else if (this.failureCount >= this.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  private transitionTo(newState: CircuitState): void {
    const prev = this.state;
    this.state = newState;
    if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenSuccesses = 0;
    }
    this.onStateChange?.(prev, newState);
  }
}
