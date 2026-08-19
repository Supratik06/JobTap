import axios from 'axios';
import { stealthEngine } from '../core/stealthEngine.js';
import { getRateLimiter } from '../core/rateLimiter.js';
import { getCircuitBreaker } from '../core/circuitBreaker.js';
import { parserEngine, JobPostingSchema } from '../core/parserEngine.js';
import { chaosEngine } from '../core/chaosEngine.js';
import { anomalyDetector } from '../core/anomalyDetector.js';
import { eventBus } from '../telemetry/eventBus.js';

export async function fetchRemoteOkJobs(query = 'engineer') {
  const sourceKey = 'RemoteOK_Live';
  const url = `https://remoteok.com/api?tag=${encodeURIComponent(query)}`;
  const rateLimiter = getRateLimiter('remoteok.com', { capacity: 4, refillRate: 0.5, meanDelayMs: 2000 });
  const circuitBreaker = getCircuitBreaker(sourceKey, { failureThreshold: 3, resetTimeoutMs: 12000 });

  return circuitBreaker.execute(async () => {
    // 1. Pacing & Jitter Acquisition
    await rateLimiter.acquire('RemoteOK-Fetch');

    // 2. Chaos Interception
    await chaosEngine.interceptRequest(sourceKey);

    // 3. Stealth Header Generation
    const { headers } = stealthEngine.generateHeaders(url);
    const startTime = Date.now();

    eventBus.log('info', 'REQUEST', `[${sourceKey}] Dispatching HTTP GET to ${url}`, {
      method: 'GET',
      headersUsed: Object.keys(headers).length,
    });

    try {
      const response = await axios.get(url, {
        headers,
        timeout: 8000,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      const durationMs = Date.now() - startTime;
      eventBus.metric('http_latency_ms', durationMs, 'ms', { source: sourceKey });

      let data = response.data;
      if (!Array.isArray(data)) {
        throw new Error('RemoteOK API returned non-array payload');
      }

      // Filter out metadata header object (first item is legal notice in remoteok API)
      const rawListings = data.filter(item => item && item.id && item.position);

      const parsedJobs = rawListings.slice(0, 15).map((item) => {
        const job = {
          id: `remoteok-${item.id}`,
          title: item.position || 'Software Engineer',
          company: item.company || 'Remote Startup',
          location: item.location || 'Remote Worldwide',
          url: item.url || `https://remoteok.com/remote-jobs/${item.id}`,
          description: item.description ? item.description.slice(0, 250).replace(/<[^>]*>?/gm, '') : '',
          tags: Array.isArray(item.tags) ? item.tags.slice(0, 4) : ['Remote', 'Tech'],
          salary: item.salary_min && item.salary_max ? `$${Math.round(item.salary_min / 1000)}k - $${Math.round(item.salary_max / 1000)}k` : null,
          postedAt: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
          source: 'RemoteOK (Live API)',
          extractionStrategy: 'JSON_LD',
          confidenceScore: 99,
          extractedAt: new Date().toISOString(),
        };

        const validated = JobPostingSchema.safeParse(job);
        return validated.success ? validated.data : null;
      }).filter(Boolean);

      // Anomaly Inspection
      anomalyDetector.inspectRun(sourceKey, {
        rawHtml: JSON.stringify(data),
        jobs: parsedJobs,
        httpStatus: response.status,
        durationMs,
      });

      eventBus.log('resilience', 'VALIDATION', `[${sourceKey}] Successfully extracted and validated ${parsedJobs.length} live listings`, {
        latencyMs: durationMs,
        count: parsedJobs.length,
      });

      return {
        jobs: parsedJobs,
        source: 'RemoteOK (Live API)',
        latencyMs: durationMs,
      };
    } catch (err) {
      rateLimiter.applyBackoff(2.0, `HTTP Error: ${err.message}`);
      throw err;
    }
  });
}
