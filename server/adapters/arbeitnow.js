import axios from 'axios';
import { stealthEngine } from '../core/stealthEngine.js';
import { getRateLimiter } from '../core/rateLimiter.js';
import { getCircuitBreaker } from '../core/circuitBreaker.js';
import { parserEngine, JobPostingSchema } from '../core/parserEngine.js';
import { chaosEngine } from '../core/chaosEngine.js';
import { anomalyDetector } from '../core/anomalyDetector.js';
import { eventBus } from '../telemetry/eventBus.js';

export async function fetchArbeitnowJobs(query = '') {
  const sourceKey = 'Arbeitnow_Live';
  const url = 'https://www.arbeitnow.com/api/job-board-api';
  const rateLimiter = getRateLimiter('arbeitnow.com', { capacity: 4, refillRate: 0.5, meanDelayMs: 2000 });
  const circuitBreaker = getCircuitBreaker(sourceKey, { failureThreshold: 3, resetTimeoutMs: 12000 });

  return circuitBreaker.execute(async () => {
    // 1. Pacing & Jitter Acquisition
    await rateLimiter.acquire('Arbeitnow-Fetch');

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
        timeout: 9000,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      const durationMs = Date.now() - startTime;
      eventBus.metric('http_latency_ms', durationMs, 'ms', { source: sourceKey });

      let data = response.data;
      if (!data || !Array.isArray(data.data)) {
        throw new Error('Arbeitnow API returned non-conforming data structure');
      }

      let rawListings = data.data;

      // Filter by query if specified
      if (query && query.trim().length > 0) {
        const q = query.toLowerCase();
        rawListings = rawListings.filter(item => 
          (item.title && item.title.toLowerCase().includes(q)) ||
          (item.company_name && item.company_name.toLowerCase().includes(q)) ||
          (item.location && item.location.toLowerCase().includes(q)) ||
          (item.tags && item.tags.some(t => t.toLowerCase().includes(q)))
        );
      }

      // Check chaos mutation on payload
      const serialized = JSON.stringify(rawListings);
      chaosEngine.interceptPayload(sourceKey, serialized);

      const parsedJobs = rawListings.slice(0, 20).map((item) => {
        // Strip HTML from description snippet
        const descriptionSnippet = item.description 
          ? item.description.replace(/<[^>]*>?/gm, ' ').replace(/&[a-z0-9]+;/gi, ' ').replace(/\s+/g, ' ').slice(0, 260)
          : '';

        // Extract salary pattern if present in description
        const salaryMatch = descriptionSnippet.match(/(?:€|\$|£)[0-9]{2,3}(?:,[0-9]{3})*(?:\s*(?:k|K|–|-|\/yr|\/hr|k\s*EUR))?/i);
        const salary = salaryMatch ? salaryMatch[0] : null;

        // Tags consolidation
        const tags = Array.isArray(item.tags) ? [...item.tags] : [];
        if (item.job_types && Array.isArray(item.job_types)) {
          tags.push(...item.job_types);
        }
        if (item.remote) {
          tags.push('Remote');
        }

        const job = {
          id: `arbeitnow-${item.slug || Math.random().toString(36).substr(2, 9)}`,
          title: item.title || 'Software Engineer',
          company: item.company_name || 'Hiring Company',
          location: item.location || (item.remote ? 'Remote' : 'Germany / Europe'),
          url: item.url || 'https://www.arbeitnow.com',
          description: descriptionSnippet,
          tags: tags.slice(0, 4),
          salary: salary,
          postedAt: item.created_at ? new Date(item.created_at * 1000).toISOString() : new Date().toISOString(),
          source: 'Arbeitnow (Live Job Board API)',
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

      eventBus.log('resilience', 'VALIDATION', `[${sourceKey}] Successfully extracted and validated ${parsedJobs.length} live listings from Arbeitnow`, {
        latencyMs: durationMs,
        count: parsedJobs.length,
      });

      return {
        jobs: parsedJobs,
        source: 'Arbeitnow (Live Job Board API)',
        latencyMs: durationMs,
      };
    } catch (err) {
      rateLimiter.applyBackoff(2.0, `HTTP Error: ${err.message}`);
      throw err;
    }
  });
}
