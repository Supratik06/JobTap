import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { stealthEngine } from '../core/stealthEngine.js';
import { getRateLimiter } from '../core/rateLimiter.js';
import { getCircuitBreaker } from '../core/circuitBreaker.js';
import { parserEngine, JobPostingSchema } from '../core/parserEngine.js';
import { chaosEngine } from '../core/chaosEngine.js';
import { anomalyDetector } from '../core/anomalyDetector.js';
import { eventBus } from '../telemetry/eventBus.js';

export async function fetchWeWorkRemotelyJobs(category = 'remote-programming-jobs') {
  const sourceKey = 'WeWorkRemotely_Live';
  const url = `https://weworkremotely.com/categories/${category}.rss`;
  const rateLimiter = getRateLimiter('weworkremotely.com', { capacity: 3, refillRate: 0.33, meanDelayMs: 2400 });
  const circuitBreaker = getCircuitBreaker(sourceKey, { failureThreshold: 3, resetTimeoutMs: 15000 });

  return circuitBreaker.execute(async () => {
    // 1. Pacing & Rate Limit Acquisition
    await rateLimiter.acquire('WWR-Fetch');

    // 2. Chaos Interception
    await chaosEngine.interceptRequest(sourceKey);

    // 3. Stealth Header Generation
    const { headers } = stealthEngine.generateHeaders(url);
    const startTime = Date.now();

    eventBus.log('info', 'REQUEST', `[${sourceKey}] Dispatching HTTP GET to ${url}`, {
      method: 'GET',
    });

    try {
      const response = await axios.get(url, {
        headers,
        timeout: 9000,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      const durationMs = Date.now() - startTime;
      eventBus.metric('http_latency_ms', durationMs, 'ms', { source: sourceKey });

      let rawXml = response.data;
      if (typeof rawXml !== 'string') {
        throw new Error('WeWorkRemotely returned non-string XML data');
      }

      // Check chaos mutation on payload
      rawXml = chaosEngine.interceptPayload(sourceKey, rawXml);

      // Parse XML RSS items
      const xmlParser = new XMLParser({ ignoreAttributes: false });
      const parsedXml = xmlParser.parse(rawXml);

      const items = parsedXml?.rss?.channel?.item;
      if (!items || !Array.isArray(items)) {
        throw new Error('No valid RSS items found in WeWorkRemotely channel feed');
      }

      const parsedJobs = items.slice(0, 15).map((item, idx) => {
        // Extract title, company format is typically "Company: Job Title"
        let rawTitle = item.title || 'Software Engineer';
        let company = 'Tech Company';
        let title = rawTitle;

        if (rawTitle.includes(':')) {
          const parts = rawTitle.split(':');
          company = parts[0].trim();
          title = parts.slice(1).join(':').trim();
        }

        // Clean HTML description snippet
        const descriptionSnippet = item.description 
          ? item.description.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').slice(0, 250)
          : '';

        const job = {
          id: `wwr-${item.guid || idx}-${Date.now().toString(36)}`,
          title: title || 'Software Engineer',
          company: company || 'Remote Team',
          location: item.region || 'Anywhere (100% Remote)',
          url: item.link || 'https://weworkremotely.com',
          description: descriptionSnippet,
          tags: ['Full-Time', 'Remote', 'Engineering'],
          salary: null,
          postedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          source: 'WeWorkRemotely (Live RSS)',
          extractionStrategy: 'SEMANTIC_MICRODATA',
          confidenceScore: 94,
          extractedAt: new Date().toISOString(),
        };

        const validated = JobPostingSchema.safeParse(job);
        return validated.success ? validated.data : null;
      }).filter(Boolean);

      // Anomaly Inspection
      anomalyDetector.inspectRun(sourceKey, {
        rawHtml: rawXml,
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
        source: 'WeWorkRemotely (Live RSS)',
        latencyMs: durationMs,
      };
    } catch (err) {
      rateLimiter.applyBackoff(2.0, `HTTP Error: ${err.message}`);
      throw err;
    }
  });
}
