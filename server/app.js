import express from 'express';
import cors from 'cors';
import { eventBus } from './telemetry/eventBus.js';
import { stealthEngine } from './core/stealthEngine.js';
import { getAllCircuitBreakers, resetAllCircuitBreakers } from './core/circuitBreaker.js';
import { chaosEngine } from './core/chaosEngine.js';
import { fallbackCascade } from './core/fallbackCascade.js';
import { anomalyDetector } from './core/anomalyDetector.js';

// Adapters
import { fetchArbeitnowJobs } from './adapters/arbeitnow.js';
import { fetchRemoteOkJobs } from './adapters/remoteok.js';
import { fetchWeWorkRemotelyJobs } from './adapters/weworkremotely.js';
import { fetchHackerNewsHiringJobs } from './adapters/hackernews.js';
import { fetchSandboxJobs } from './adapters/sandbox.js';

const app = express();

app.use(cors());
app.use(express.json());

// In-memory unified job store
let globalJobStore = [];

function mergeJobs(newJobs) {
  const existingIds = new Set(globalJobStore.map(j => j.id));
  const added = [];

  for (const job of newJobs) {
    if (!existingIds.has(job.id)) {
      globalJobStore.unshift(job);
      existingIds.add(job.id);
      added.push(job);
    }
  }

  if (globalJobStore.length > 300) {
    globalJobStore = globalJobStore.slice(0, 300);
  }

  return added;
}

const router = express.Router();

// 1. SSE Real-Time Telemetry Stream
router.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no',
  });

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  eventBus.addClient(res);
});

// 2. Health & System Metrics
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    memoryUsageMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),
    jobCount: globalJobStore.length,
    circuitBreakers: getAllCircuitBreakers(),
  });
});

// 3. Trigger Ingestion Run
router.post('/ingest/run', async (req, res) => {
  const { source = 'arbeitnow', query = '', enableFallback = true } = req.body || {};

  eventBus.log('info', 'REQUEST', `Starting ingestion run for source: ${source} (Query: "${query}")`, {
    source,
    query,
    enableFallback,
  });

  try {
    let result = null;

    const runWithCascade = async (primaryKey, primaryFn, secondaryFn) => {
      if (!enableFallback) {
        return await primaryFn();
      }
      return await fallbackCascade.executeCascade({
        sourceKey: primaryKey,
        primaryFn,
        secondaryMirrorFn: secondaryFn,
      });
    };

    switch (source) {
      case 'arbeitnow':
        result = await runWithCascade('Arbeitnow_Live',
          () => fetchArbeitnowJobs(query),
          () => fetchWeWorkRemotelyJobs('remote-programming-jobs')
        );
        break;

      case 'remoteok':
        result = await runWithCascade('RemoteOK_Live', 
          () => fetchRemoteOkJobs(query || 'engineer'),
          () => fetchArbeitnowJobs(query)
        );
        break;

      case 'weworkremotely':
        result = await runWithCascade('WeWorkRemotely_Live',
          () => fetchWeWorkRemotelyJobs('remote-programming-jobs'),
          () => fetchArbeitnowJobs(query)
        );
        break;

      case 'hackernews':
        result = await runWithCascade('HackerNews_Hiring',
          () => fetchHackerNewsHiringJobs(query || 'engineer'),
          () => fetchArbeitnowJobs(query)
        );
        break;

      case 'sandbox':
        result = await runWithCascade('AntiBot_Sandbox',
          () => fetchSandboxJobs(query || 'engineer'),
          () => fetchArbeitnowJobs(query)
        );
        break;

      case 'all':
        // Run all concurrently with adaptive spacing
        const settled = await Promise.allSettled([
          fetchArbeitnowJobs(query).catch(e => ({ jobs: [], error: e.message, source: 'Arbeitnow' })),
          fetchRemoteOkJobs(query || 'engineer').catch(e => ({ jobs: [], error: e.message, source: 'RemoteOK' })),
          fetchWeWorkRemotelyJobs('remote-programming-jobs').catch(e => ({ jobs: [], error: e.message, source: 'WeWorkRemotely' })),
          fetchHackerNewsHiringJobs(query || 'engineer').catch(e => ({ jobs: [], error: e.message, source: 'HackerNews' })),
          fetchSandboxJobs(query || 'engineer').catch(e => ({ jobs: [], error: e.message, source: 'Sandbox' }))
        ]);

        const allJobs = [];
        settled.forEach(s => {
          if (s.status === 'fulfilled' && s.value?.jobs) {
            allJobs.push(...s.value.jobs);
          }
        });

        result = {
          jobs: allJobs,
          source: 'Federated (All Sources)',
          tierUsed: 'FEDERATED_MULTISOURCE',
        };
        break;

      default:
        return res.status(400).json({ error: `Unknown source: ${source}` });
    }

    const added = mergeJobs(result.jobs || []);

    eventBus.metric('jobs_ingested_total', globalJobStore.length, 'count');
    eventBus.log('resilience', 'VALIDATION', `Ingestion completed successfully. ${added.length} new listings added to store.`, {
      source,
      tierUsed: result.tierUsed || 'PRIMARY_LIVE',
      totalAvailable: globalJobStore.length,
    });

    res.json({
      success: true,
      result: {
        source: result.source,
        tierUsed: result.tierUsed || 'PRIMARY_LIVE',
        fallbackOccurred: result.fallbackOccurred || false,
        fallbackReason: result.fallbackReason || null,
        jobCount: result.jobs?.length || 0,
        newJobsAdded: added.length,
        jobs: result.jobs || [],
      },
    });
  } catch (err) {
    eventBus.log('error', 'FALLBACK', `Ingestion run failed unrecoverably: ${err.message}`, {
      source,
      error: err.message,
    });

    res.status(500).json({
      success: false,
      error: err.message,
      source,
    });
  }
});

// 4. Job Store Query API
router.get('/jobs', (req, res) => {
  const { query, source, tag, limit = 50 } = req.query;
  let filtered = [...globalJobStore];

  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(j => 
      j.title?.toLowerCase().includes(q) || 
      j.company?.toLowerCase().includes(q) || 
      (j.description && j.description.toLowerCase().includes(q))
    );
  }

  if (source) {
    filtered = filtered.filter(j => j.source?.toLowerCase().includes(source.toLowerCase()));
  }

  if (tag) {
    filtered = filtered.filter(j => j.tags && j.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
  }

  res.json({
    total: filtered.length,
    jobs: filtered.slice(0, Number(limit)),
  });
});

// 5. Circuit Breakers Status & Control
router.get('/circuit/status', (req, res) => {
  res.json({
    breakers: getAllCircuitBreakers(),
  });
});

router.post('/circuit/reset', (req, res) => {
  const breakers = resetAllCircuitBreakers();
  res.json({
    success: true,
    breakers,
  });
});

// 6. Chaos Controls
router.get('/chaos/config', (req, res) => {
  res.json(chaosEngine.getConfig());
});

router.post('/chaos/config', (req, res) => {
  const updated = chaosEngine.updateConfig(req.body);
  res.json({
    success: true,
    config: updated,
  });
});

router.post('/chaos/reset', (req, res) => {
  const reset = chaosEngine.resetConfig();
  res.json({
    success: true,
    config: reset,
  });
});

// 7. Detection Surface Vector Inspection
router.get('/fingerprint/inspect', (req, res) => {
  res.json(stealthEngine.inspectDetectionVectors());
});

// 8. Anomaly Log
router.get('/anomalies', (req, res) => {
  res.json({
    anomalies: anomalyDetector.getAnomalies(),
  });
});

// 9. Clear Logs
router.post('/telemetry/clear', (req, res) => {
  eventBus.clearHistory();
  res.json({ success: true });
});

// Seed some initial data into job store from fallback cache
const initialSnapshot = fallbackCascade.getSnapshot('global');
if (initialSnapshot && initialSnapshot.jobs) {
  mergeJobs(initialSnapshot.jobs);
}

// Mount the router at both `/api` and `/` so requests like `/api/health` or `/health` both match correctly
app.use('/api', router);
app.use('/', router);

export default app;
