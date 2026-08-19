import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { AdaptiveRateLimiter } from '../server/core/rateLimiter.js';
import { CircuitBreaker, CircuitState } from '../server/core/circuitBreaker.js';
import { SelfHealingParser } from '../server/core/parserEngine.js';
import { StealthEngine } from '../server/core/stealthEngine.js';
import { FallbackCascadeManager } from '../server/core/fallbackCascade.js';

describe('Resilient Ingestion Engine Tests', () => {

  describe('AdaptiveRateLimiter & Jitter Math', () => {
    test('Calculates positive Gaussian jitter within bounded bounds', () => {
      const limiter = new AdaptiveRateLimiter({
        minDelayMs: 50,
        meanDelayMs: 100,
        jitterSigmaMs: 20,
      });

      const delay = limiter.calculateHumanJitter();
      assert.ok(delay >= 50, `Delay (${delay}) should satisfy minDelay floor`);
      assert.ok(delay < 500, `Delay (${delay}) should be reasonably bounded`);
    });

    test('Applies exponential backoff multiplier correctly', () => {
      const limiter = new AdaptiveRateLimiter({ minDelayMs: 100, meanDelayMs: 200 });
      assert.equal(limiter.backoffMultiplier, 1.0);
      
      limiter.applyBackoff(2.0, 'Simulated 429');
      assert.equal(limiter.backoffMultiplier, 2.0);
      assert.ok(limiter.calculateHumanJitter() >= 200);

      limiter.decayBackoff();
      assert.ok(limiter.backoffMultiplier < 2.0);
    });
  });

  describe('CircuitBreaker State Transitions', () => {
    test('Trips from CLOSED to OPEN on consecutive failures threshold', async () => {
      const breaker = new CircuitBreaker('test-breaker', {
        failureThreshold: 3,
        resetTimeoutMs: 500,
      });

      assert.equal(breaker.state, CircuitState.CLOSED);

      // Trigger 3 failures
      const failingAction = async () => { throw new Error('429 Rate limited'); };

      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingAction);
        } catch (e) {
          // Expected
        }
      }

      assert.equal(breaker.state, CircuitState.OPEN);
      assert.equal(breaker.consecutiveFailures, 3);
    });

    test('Executes fallback when circuit is OPEN without invoking failing primary', async () => {
      const breaker = new CircuitBreaker('test-fallback', {
        failureThreshold: 1,
        resetTimeoutMs: 1000,
      });

      breaker.forceOpen(1000);
      assert.equal(breaker.state, CircuitState.OPEN);

      let primaryInvoked = false;
      const primaryAction = async () => { primaryInvoked = true; return 'live'; };
      const fallbackAction = async () => ({ status: 'cached_fallback' });

      const result = await breaker.execute(primaryAction, fallbackAction);
      assert.equal(primaryInvoked, false, 'Primary action must NOT be invoked when OPEN');
      assert.equal(result.status, 'cached_fallback');
    });
  });

  describe('SelfHealingParser & Multi-Tier Fallback', () => {
    const parser = new SelfHealingParser();

    test('Tier 1: Parses structured JSON-LD JobPosting schema', () => {
      const sampleHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org/",
            "@type": "JobPosting",
            "title": "Senior Distributed Systems Engineer",
            "description": "Building next-generation storage",
            "datePosted": "2026-08-19T00:00:00Z",
            "hiringOrganization": { "@type": "Organization", "name": "Acdyon Labs" },
            "jobLocation": { "@type": "Place", "address": { "addressLocality": "Remote" } }
          }
          </script>
        </head>
        <body></body>
        </html>
      `;

      const jobs = parser.parseJobHtml(sampleHtml, 'test-jsonld');
      assert.equal(jobs.length, 1);
      assert.equal(jobs[0].title, 'Senior Distributed Systems Engineer');
      assert.equal(jobs[0].company, 'Acdyon Labs');
      assert.equal(jobs[0].extractionStrategy, 'JSON_LD');
      assert.equal(jobs[0].confidenceScore, 98);
    });

    test('Tier 3: Recovers via CSS Selector Cascade when JSON-LD is absent', () => {
      const sampleHtml = `
        <div class="job-card">
          <h3 class="title">Staff Rust Engineer</h3>
          <span class="company">HyperCore Inc</span>
          <span class="location">Remote / San Francisco</span>
          <div class="salary-badge">$220,000 / yr</div>
          <p class="snippet">Low level performance optimizations</p>
        </div>
      `;

      const jobs = parser.parseJobHtml(sampleHtml, 'test-cascade');
      assert.equal(jobs.length, 1);
      assert.equal(jobs[0].title, 'Staff Rust Engineer');
      assert.equal(jobs[0].company, 'HyperCore Inc');
      assert.equal(jobs[0].extractionStrategy, 'CSS_CASCADE');
      assert.ok(jobs[0].confidenceScore >= 75);
    });

    test('Tier 4: Recovers via Heuristic Regex Scanner on obfuscated markup', () => {
      const obfuscatedHtml = `
        <div>
          <span>Random obfuscated string</span>
          <div>We are urgently hiring a Principal Software Architect to lead our distributed team.</div>
        </div>
      `;

      const jobs = parser.parseJobHtml(obfuscatedHtml, 'test-regex');
      assert.ok(jobs.length >= 1);
      assert.equal(jobs[0].extractionStrategy, 'REGEX_HEURISTIC');
    });
  });

  describe('Arbeitnow Live Adapter Integration', () => {
    test('Fetches and validates live listings schema from Arbeitnow API', async () => {
      const { fetchArbeitnowJobs } = await import('../server/adapters/arbeitnow.js');
      const result = await fetchArbeitnowJobs('engineer');
      assert.ok(result.jobs.length > 0, 'Should parse at least 1 job');
      assert.ok(result.jobs[0].title, 'Job must have a title');
      assert.ok(result.jobs[0].company, 'Job must have a company');
      assert.equal(result.jobs[0].source, 'Arbeitnow (Live Job Board API)');
      assert.ok(result.jobs[0].confidenceScore >= 90);
    });
  });

  describe('StealthEngine Header Generation', () => {
    test('Synthesizes coherent Sec-CH-UA and browser headers', () => {
      const stealth = new StealthEngine();
      const { headers, profile } = stealth.generateHeaders('https://linkedin.com/jobs');

      assert.ok(headers['User-Agent']);
      assert.ok(headers['Accept']);
      assert.ok(headers['Accept-Language']);
      assert.ok(headers['Sec-Fetch-Mode']);

      if (profile.browser === 'Chrome') {
        assert.ok(headers['Sec-CH-UA']);
        assert.ok(headers['Sec-CH-UA-Platform']);
      }
    });
  });

  describe('FallbackCascadeManager', () => {
    test('Falls back seamlessly to Snapshot Cache when primary throws', async () => {
      const cascade = new FallbackCascadeManager();

      const result = await cascade.executeCascade({
        sourceKey: 'test_failing_stream',
        primaryFn: async () => { throw new Error('403 Cloudflare Bot Wall'); },
        secondaryMirrorFn: async () => { throw new Error('503 Service Unavailable'); },
      });

      assert.equal(result.fallbackOccurred, true);
      assert.equal(result.tierUsed, 'SNAPSHOT_CACHE');
      assert.ok(result.jobs.length > 0);
      assert.equal(result.jobs[0].extractionStrategy, 'FALLBACK_CACHE');
    });
  });
});
