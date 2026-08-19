import axios from 'axios';
import { stealthEngine } from '../core/stealthEngine.js';
import { getRateLimiter } from '../core/rateLimiter.js';
import { getCircuitBreaker } from '../core/circuitBreaker.js';
import { parserEngine, JobPostingSchema } from '../core/parserEngine.js';
import { chaosEngine } from '../core/chaosEngine.js';
import { anomalyDetector } from '../core/anomalyDetector.js';
import { eventBus } from '../telemetry/eventBus.js';

export async function fetchHackerNewsHiringJobs(query = 'engineer') {
  const sourceKey = 'HackerNews_Hiring';
  const url = `https://hn.algolia.com/api/v1/search_by_date?tags=comment&query=${encodeURIComponent(query + ' hiring remote')}&hitsPerPage=20`;
  const rateLimiter = getRateLimiter('hn.algolia.com', { capacity: 5, refillRate: 1, meanDelayMs: 1500 });
  const circuitBreaker = getCircuitBreaker(sourceKey, { failureThreshold: 3, resetTimeoutMs: 10000 });

  return circuitBreaker.execute(async () => {
    // 1. Rate Limiting Pacing
    await rateLimiter.acquire('HN-Fetch');

    // 2. Chaos Interception
    await chaosEngine.interceptRequest(sourceKey);

    // 3. Stealth Headers
    const { headers } = stealthEngine.generateHeaders(url);
    const startTime = Date.now();

    eventBus.log('info', 'REQUEST', `[${sourceKey}] Dispatching API request to Hacker News Hiring Feed`, {
      query,
    });

    try {
      const response = await axios.get(url, {
        headers,
        timeout: 7000,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      const durationMs = Date.now() - startTime;
      eventBus.metric('http_latency_ms', durationMs, 'ms', { source: sourceKey });

      const hits = response.data?.hits || [];
      const parsedJobs = [];

      for (const hit of hits) {
        const text = hit.comment_text || '';
        if (text.length < 50) continue;

        // Parse first line: typically "Company | Role | Location | Full-time | Salary"
        const cleanText = text.replace(/<[^>]*>?/gm, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
        const lines = cleanText.split('\n').filter(l => l.trim().length > 0);
        const headerLine = lines[0] || cleanText.slice(0, 100);

        let company = 'YC / Tech Startup';
        let role = 'Full Stack Engineer';
        let location = 'Remote';

        if (headerLine.includes('|')) {
          const parts = headerLine.split('|').map(p => p.trim());
          if (parts[0]) company = parts[0];
          if (parts[1]) role = parts[1];
          if (parts[2]) location = parts[2];
        } else if (headerLine.includes('-')) {
          const parts = headerLine.split('-').map(p => p.trim());
          if (parts[0]) company = parts[0];
          if (parts[1]) role = parts[1];
        }

        // Search for salary pattern in the text
        const salaryMatch = cleanText.match(/\$[0-9]{2,3}(?:,[0-9]{3})*(?:\s*(?:k|K|–|-|\/yr|\/hr))?/);
        const salary = salaryMatch ? salaryMatch[0] : null;

        const job = {
          id: `hn-${hit.objectID}`,
          title: role.slice(0, 80),
          company: company.slice(0, 60),
          location: location.slice(0, 60),
          url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          description: cleanText.slice(0, 250),
          tags: ['Hiring', 'Remote', 'Startups'],
          salary: salary,
          postedAt: hit.created_at ? new Date(hit.created_at).toISOString() : new Date().toISOString(),
          source: 'Hacker News (Ask HN: Hiring)',
          extractionStrategy: 'REGEX_HEURISTIC',
          confidenceScore: 82,
          extractedAt: new Date().toISOString(),
        };

        const validated = JobPostingSchema.safeParse(job);
        if (validated.success) parsedJobs.push(validated.data);
      }

      // Anomaly Inspection
      anomalyDetector.inspectRun(sourceKey, {
        rawHtml: JSON.stringify(hits),
        jobs: parsedJobs,
        httpStatus: response.status,
        durationMs,
      });

      eventBus.log('resilience', 'VALIDATION', `[${sourceKey}] Successfully extracted and validated ${parsedJobs.length} live HN postings`, {
        latencyMs: durationMs,
        count: parsedJobs.length,
      });

      return {
        jobs: parsedJobs.slice(0, 15),
        source: 'Hacker News (Ask HN: Hiring)',
        latencyMs: durationMs,
      };
    } catch (err) {
      rateLimiter.applyBackoff(2.0, `HTTP Error: ${err.message}`);
      throw err;
    }
  });
}
