import { eventBus } from '../telemetry/eventBus.js';

export class AdaptiveRateLimiter {
  constructor(options = {}) {
    this.domain = options.domain || 'global';
    this.capacity = options.capacity || 5; // Max burst capacity
    this.refillRate = options.refillRate || 1; // Tokens per second
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
    this.minDelayMs = options.minDelayMs || 1200; // Minimum floor delay
    this.meanDelayMs = options.meanDelayMs || 2200; // Mean target delay
    this.jitterSigmaMs = options.jitterSigmaMs || 600; // Standard deviation
    this.queue = [];
    this.isProcessing = false;
    this.history = [];
    this.backoffMultiplier = 1.0;
  }

  /**
   * Refill token bucket based on elapsed time
   */
  refill() {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.refillRate);
    this.lastRefill = now;
  }

  /**
   * Box-Muller transform for true Gaussian distributed jitter
   */
  calculateHumanJitter() {
    let u1 = 0, u2 = 0;
    while (u1 === 0) u1 = Math.random();
    while (u2 === 0) u2 = Math.random();
    
    // Standard normal distribution Z ~ N(0, 1)
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    
    // Scale to target mean and standard deviation
    let delay = (this.meanDelayMs + z * this.jitterSigmaMs) * this.backoffMultiplier;
    
    // Clamp to minimum safety threshold
    delay = Math.max(this.minDelayMs * this.backoffMultiplier, Math.round(delay));
    return delay;
  }

  /**
   * Schedule a task with adaptive pacing
   */
  async acquire(tag = 'job-request') {
    return new Promise((resolve) => {
      this.queue.push({ resolve, tag, enqueuedAt: Date.now() });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      this.refill();

      if (this.tokens < 1) {
        // Need to wait for token refill
        const waitMs = Math.ceil(((1 - this.tokens) / this.refillRate) * 1000);
        eventBus.log('info', 'PACING', `[${this.domain}] Token bucket empty. Waiting ${waitMs}ms for token refill...`, {
          queueLength: this.queue.length,
          tokens: this.tokens.toFixed(2),
        });
        await new Promise((r) => setTimeout(r, waitMs));
        this.refill();
      }

      // Consume 1 token
      this.tokens -= 1;

      // Compute randomized human-like jitter delay
      const jitterDelay = this.calculateHumanJitter();
      const item = this.queue.shift();
      const queueWaitTime = Date.now() - item.enqueuedAt;

      eventBus.log('stealth', 'PACING', `[${this.domain}] Executing paced dispatch with ${jitterDelay}ms Gaussian jitter`, {
        tag: item.tag,
        jitterDelayMs: jitterDelay,
        queueWaitTimeMs: queueWaitTime,
        remainingQueue: this.queue.length,
        tokensRemaining: this.tokens.toFixed(2),
      });

      eventBus.metric('rate_limiter_jitter', jitterDelay, 'ms', { domain: this.domain });
      eventBus.metric('rate_limiter_queue_length', this.queue.length, 'count', { domain: this.domain });

      await new Promise((r) => setTimeout(r, jitterDelay));

      this.history.push({
        timestamp: Date.now(),
        delay: jitterDelay,
        queueWaitTime,
      });
      if (this.history.length > 50) this.history.shift();

      item.resolve({ jitterDelay, queueWaitTime });
    }

    this.isProcessing = false;
  }

  /**
   * Apply exponential backoff when upstream signals pressure
   */
  applyBackoff(multiplier = 2.0, reason = 'Rate limit warning') {
    this.backoffMultiplier = Math.min(8.0, this.backoffMultiplier * multiplier);
    eventBus.log('warn', 'PACING', `[${this.domain}] Applied backoff multiplier: ${this.backoffMultiplier.toFixed(1)}x (${reason})`, {
      newMeanDelay: Math.round(this.meanDelayMs * this.backoffMultiplier),
    });
  }

  /**
   * Cool down backoff after sustained successful requests
   */
  decayBackoff() {
    if (this.backoffMultiplier > 1.0) {
      this.backoffMultiplier = Math.max(1.0, this.backoffMultiplier * 0.85);
      if (this.backoffMultiplier <= 1.05) this.backoffMultiplier = 1.0;
    }
  }

  getStatus() {
    return {
      domain: this.domain,
      tokensAvailable: Number(this.tokens.toFixed(2)),
      capacity: this.capacity,
      queueLength: this.queue.length,
      backoffMultiplier: Number(this.backoffMultiplier.toFixed(2)),
      effectiveMeanDelayMs: Math.round(this.meanDelayMs * this.backoffMultiplier),
    };
  }
}

// Global registry of rate limiters per domain
const limiterRegistry = new Map();

export function getRateLimiter(domain = 'default', options = {}) {
  if (!limiterRegistry.has(domain)) {
    limiterRegistry.set(domain, new AdaptiveRateLimiter({ domain, ...options }));
  }
  return limiterRegistry.get(domain);
}
