import { stealthEngine } from '../core/stealthEngine.js';
import { getRateLimiter } from '../core/rateLimiter.js';
import { getCircuitBreaker } from '../core/circuitBreaker.js';
import { parserEngine } from '../core/parserEngine.js';
import { chaosEngine } from '../core/chaosEngine.js';
import { anomalyDetector } from '../core/anomalyDetector.js';
import { eventBus } from '../telemetry/eventBus.js';

export async function fetchSandboxJobs(query = 'engineer') {
  const sourceKey = 'AntiBot_Sandbox';
  const url = `https://sandbox.internal/jobs?q=${encodeURIComponent(query)}`;
  const rateLimiter = getRateLimiter('sandbox.internal', { capacity: 5, refillRate: 1, meanDelayMs: 1200 });
  const circuitBreaker = getCircuitBreaker(sourceKey, { failureThreshold: 3, resetTimeoutMs: 8000 });

  return circuitBreaker.execute(async () => {
    // 1. Pacing acquisition
    await rateLimiter.acquire('Sandbox-Fetch');

    // 2. Chaos check
    await chaosEngine.interceptRequest(sourceKey);

    const startTime = Date.now();
    eventBus.log('info', 'REQUEST', `[${sourceKey}] Requesting rendered DOM from Adversarial Sandbox`, {
      query,
    });

    // Simulate network delay
    await new Promise(r => setTimeout(r, 150 + Math.random() * 200));

    // Generate dynamic mock HTML simulating a modern guarded job portal
    const rawHtml = generateSandboxHtml(query);
    
    // Pass through chaos interceptor (mutates DOM or empties body if chaos enabled)
    const interceptedHtml = chaosEngine.interceptPayload(sourceKey, rawHtml);

    // Parse HTML using the self-healing multi-tier parser engine
    const parsedJobs = parserEngine.parseJobHtml(interceptedHtml, 'AntiBot Sandbox', 'https://sandbox.internal/jobs');

    const durationMs = Date.now() - startTime;
    eventBus.metric('http_latency_ms', durationMs, 'ms', { source: sourceKey });

    // Inspect for anomalies
    const anomalyResult = anomalyDetector.inspectRun(sourceKey, {
      rawHtml: interceptedHtml,
      jobs: parsedJobs,
      httpStatus: 200,
      durationMs,
    });

    if (parsedJobs.length === 0) {
      throw new Error('Sandbox parser yielded 0 valid listings due to severe markup disruption');
    }

    eventBus.log('resilience', 'VALIDATION', `[${sourceKey}] Successfully extracted ${parsedJobs.length} listings from Sandbox`, {
      latencyMs: durationMs,
      anomalyCount: anomalyResult.anomalies.length,
    });

    return {
      jobs: parsedJobs,
      source: 'Anti-Bot Sandbox (Controlled)',
      latencyMs: durationMs,
    };
  });
}

function generateSandboxHtml(query) {
  const timestamp = new Date().toISOString();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${query} Jobs | Adversarial Talent Portal</title>
  <!-- Schema.org Tier 1 JSON-LD -->
  <script type="application/ld+json">
  [
    {
      "@context": "https://schema.org/",
      "@type": "JobPosting",
      "id": "sb-001",
      "title": "Principal Distributed Systems Engineer (${query})",
      "description": "Architect mission-critical distributed consensus layers and edge replication fabrics.",
      "datePosted": "${timestamp}",
      "employmentType": "FULL_TIME",
      "hiringOrganization": {
        "@type": "Organization",
        "name": "Acdyon Core Labs",
        "sameAs": "https://acdyon.internal"
      },
      "jobLocation": {
        "@type": "Place",
        "address": {
          "addressLocality": "Remote / San Francisco, CA",
          "addressCountry": "US"
        }
      },
      "baseSalary": {
        "@type": "MonetaryAmount",
        "currency": "$",
        "value": {
          "@type": "QuantitativeValue",
          "value": "210000 - 260000"
        }
      }
    },
    {
      "@context": "https://schema.org/",
      "@type": "JobPosting",
      "id": "sb-002",
      "title": "Senior Low-Latency Rust Developer",
      "description": "Build high-throughput network ingestion pipelines with custom zero-copy memory buffers.",
      "datePosted": "${timestamp}",
      "employmentType": "FULL_TIME",
      "hiringOrganization": {
        "@type": "Organization",
        "name": "EdgeStream Technologies"
      },
      "jobLocation": {
        "@type": "Place",
        "address": {
          "addressLocality": "Remote (EU/US)"
        }
      },
      "baseSalary": {
        "@type": "MonetaryAmount",
        "currency": "$",
        "value": "180000 - 230000"
      }
    }
  ]
  </script>
</head>
<body>
  <div class="app-root">
    <header class="header-nav">
      <h1>Talent Intelligence Network</h1>
    </header>

    <main class="listings-container">
      <!-- Tier 3 CSS Cascade Cards -->
      <article class="job-card" data-job-id="sb-card-03">
        <h3 class="title">Staff AI Infrastructure Specialist (${query})</h3>
        <span class="company">HyperScale Intelligence</span>
        <span class="location">Remote / New York, NY</span>
        <div class="salary-badge">$220,000 - $275,000 / yr</div>
        <p class="snippet">Optimize distributed GPU clusters, tensor parallelism, and low-latency inference routing.</p>
        <div class="tags">
          <span class="tag">PyTorch</span>
          <span class="tag">Kubernetes</span>
          <span class="tag">Triton</span>
        </div>
        <a href="https://sandbox.internal/jobs/sb-03" class="apply-btn">Apply Now</a>
      </article>

      <article class="job-card" data-job-id="sb-card-04">
        <h3 class="title">Senior Full-Stack Product Engineer</h3>
        <span class="company">Linearity Systems</span>
        <span class="location">Remote (Global)</span>
        <div class="salary-badge">$160,000 - $210,000 / yr</div>
        <p class="snippet">Lead frontend craft, real-time collaboration engines, and optimistic UI synchronization.</p>
        <div class="tags">
          <span class="tag">TypeScript</span>
          <span class="tag">React</span>
          <span class="tag">WebSockets</span>
        </div>
        <a href="https://sandbox.internal/jobs/sb-04" class="apply-btn">Apply Now</a>
      </article>

      <article class="job-card" data-job-id="sb-card-05">
        <h3 class="title">Security & Reverse Engineering Lead</h3>
        <span class="company">ShieldGate Defense</span>
        <span class="location">Remote / London, UK</span>
        <div class="salary-badge">$195,000 - $245,000 / yr</div>
        <p class="snippet">Deconstruct obfuscated payloads, anti-bot mechanisms, and TLS fingerprint heuristics.</p>
        <div class="tags">
          <span class="tag">Security</span>
          <span class="tag">C++</span>
          <span class="tag">Ghidra</span>
        </div>
        <a href="https://sandbox.internal/jobs/sb-05" class="apply-btn">Apply Now</a>
      </article>
    </main>
  </div>
</body>
</html>
`;
}
