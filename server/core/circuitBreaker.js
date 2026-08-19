import { eventBus } from '../telemetry/eventBus.js';

export const CircuitState = {
  CLOSED: 'CLOSED',       // Normal operation
  OPEN: 'OPEN',           // Tripped / Blocking upstream requests
  HALF_OPEN: 'HALF_OPEN', // Testing recovery with canary probes
};

export class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.state = CircuitState.CLOSED;
    this.failureThreshold = options.failureThreshold || 3; // Trip after 3 consecutive failures
    this.recoveryThreshold = options.recoveryThreshold || 2; // Close after 2 successful probes
    this.resetTimeoutMs = options.resetTimeoutMs || 10000; // 10s cooldown
    this.currentResetTimeout = this.resetTimeoutMs;
    
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalFallbacks = 0;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
    this.nextAttempt = Date.now();
  }

  /**
   * Execute an operation protected by the circuit breaker
   */
  async execute(actionFn, fallbackFn) {
    this.totalRequests += 1;
    this.checkStateTransition();

    if (this.state === CircuitState.OPEN) {
      this.totalFallbacks += 1;
      eventBus.log('resilience', 'CIRCUIT', `[${this.name}] Circuit is OPEN. Intercepting request and executing Fallback Cascade immediately`, {
        circuit: this.name,
        state: this.state,
        cooldownRemainingMs: Math.max(0, this.nextAttempt - Date.now()),
      });

      if (fallbackFn) {
        return fallbackFn({
          reason: 'CIRCUIT_OPEN',
          cooldownRemainingMs: Math.max(0, this.nextAttempt - Date.now()),
        });
      }
      throw new Error(`Circuit breaker '${this.name}' is OPEN. Upstream source unavailable.`);
    }

    // Try executing the primary action
    try {
      const result = await actionFn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);

      if (fallbackFn) {
        this.totalFallbacks += 1;
        eventBus.log('warn', 'FALLBACK', `[${this.name}] Primary execution failed. Invoking Fallback Cascade`, {
          circuit: this.name,
          error: error.message,
        });
        return fallbackFn({
          reason: 'EXECUTION_FAILURE',
          originalError: error,
        });
      }
      throw error;
    }
  }

  checkStateTransition() {
    const now = Date.now();
    if (this.state === CircuitState.OPEN && now >= this.nextAttempt) {
      this.state = CircuitState.HALF_OPEN;
      this.consecutiveSuccesses = 0;
      this.lastStateChange = now;

      eventBus.log('info', 'CIRCUIT', `[${this.name}] Cooldown elapsed. Transitioning from OPEN -> HALF_OPEN (Probing canary request)`, {
        circuit: this.name,
        state: this.state,
      });
      this.broadcastState();
    }
  }

  onSuccess() {
    this.consecutiveFailures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.consecutiveSuccesses += 1;
      if (this.consecutiveSuccesses >= this.recoveryThreshold) {
        this.state = CircuitState.CLOSED;
        this.currentResetTimeout = this.resetTimeoutMs; // Reset backoff
        this.lastStateChange = Date.now();

        eventBus.log('resilience', 'CIRCUIT', `[${this.name}] Canary probes succeeded! Circuit CLOSED (Upstream source fully restored)`, {
          circuit: this.name,
          state: this.state,
        });
        this.broadcastState();
      }
    }
  }

  onFailure(error) {
    this.lastFailureTime = Date.now();
    this.totalFailures += 1;
    this.consecutiveFailures += 1;
    this.consecutiveSuccesses = 0;

    eventBus.log('error', 'CIRCUIT', `[${this.name}] Failure detected: ${error.message} (Consecutive: ${this.consecutiveFailures}/${this.failureThreshold})`, {
      circuit: this.name,
      consecutiveFailures: this.consecutiveFailures,
      errorStatus: error.status || error.code || 'UNKNOWN',
    });

    if (this.state === CircuitState.HALF_OPEN || this.consecutiveFailures >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.lastStateChange = Date.now();
      // Exponential backoff for repeated trip events
      this.currentResetTimeout = Math.min(60000, this.currentResetTimeout * 1.5);
      this.nextAttempt = Date.now() + this.currentResetTimeout;

      eventBus.log('warn', 'CIRCUIT', `[${this.name}] Failure threshold reached! Tripping circuit to OPEN for ${Math.round(this.currentResetTimeout / 1000)}s cooldown`, {
        circuit: this.name,
        state: this.state,
        cooldownSeconds: Math.round(this.currentResetTimeout / 1000),
      });
      this.broadcastState();
    }
  }

  reset() {
    this.state = CircuitState.CLOSED;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.currentResetTimeout = this.resetTimeoutMs;
    this.lastStateChange = Date.now();

    eventBus.log('info', 'CIRCUIT', `[${this.name}] Circuit manually reset to CLOSED`, {
      circuit: this.name,
      state: this.state,
    });
    this.broadcastState();
  }

  forceOpen(durationMs = 15000) {
    this.state = CircuitState.OPEN;
    this.currentResetTimeout = durationMs;
    this.nextAttempt = Date.now() + durationMs;
    this.lastStateChange = Date.now();

    eventBus.log('chaos', 'CIRCUIT', `[${this.name}] Chaos forced circuit to OPEN for ${Math.round(durationMs / 1000)}s`, {
      circuit: this.name,
      state: this.state,
    });
    this.broadcastState();
  }

  broadcastState() {
    eventBus.broadcast('CIRCUIT_STATE', this.getStatus());
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalFallbacks: this.totalFallbacks,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      cooldownRemainingMs: this.state === CircuitState.OPEN ? Math.max(0, this.nextAttempt - Date.now()) : 0,
    };
  }
}

// Breaker registry
const breakerRegistry = new Map();

export function getCircuitBreaker(name, options = {}) {
  if (!breakerRegistry.has(name)) {
    breakerRegistry.set(name, new CircuitBreaker(name, options));
  }
  return breakerRegistry.get(name);
}

export function getAllCircuitBreakers() {
  return Array.from(breakerRegistry.values()).map(cb => cb.getStatus());
}

export function resetAllCircuitBreakers() {
  for (const cb of breakerRegistry.values()) {
    cb.reset();
  }
  return getAllCircuitBreakers();
}
