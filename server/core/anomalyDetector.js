import { eventBus } from '../telemetry/eventBus.js';

export class AnomalyDetector {
  constructor() {
    this.sourceBaselines = new Map();
    this.anomalies = [];
  }

  /**
   * Register or update statistical baseline for a source
   */
  updateBaseline(source, { payloadSizeBytes, jobCount, avgConfidence }) {
    if (!this.sourceBaselines.has(source)) {
      this.sourceBaselines.set(source, {
        samples: 0,
        avgPayloadSize: payloadSizeBytes,
        avgJobCount: jobCount,
        avgConfidence: avgConfidence,
      });
    }

    const baseline = this.sourceBaselines.get(source);
    baseline.samples += 1;
    // Exponential moving average (alpha = 0.2)
    baseline.avgPayloadSize = baseline.avgPayloadSize * 0.8 + payloadSizeBytes * 0.2;
    baseline.avgJobCount = baseline.avgJobCount * 0.8 + jobCount * 0.2;
    baseline.avgConfidence = baseline.avgConfidence * 0.8 + avgConfidence * 0.2;
  }

  /**
   * Inspect response & extraction for subtle bot challenges, honeypots, or markup rot
   */
  inspectRun(source, { rawHtml, jobs, httpStatus, durationMs }) {
    const payloadSize = (rawHtml && typeof rawHtml === 'string') ? rawHtml.length : 0;
    const jobCount = jobs ? jobs.length : 0;
    const avgConfidence = jobCount > 0 
      ? Math.round(jobs.reduce((acc, j) => acc + (j.confidenceScore || 0), 0) / jobCount) 
      : 0;

    const detectedAnomalies = [];

    // 1. Silent CAPTCHA / Soft-Block Check (HTTP 200 but contains challenge keywords)
    if (rawHtml && typeof rawHtml === 'string') {
      const lower = rawHtml.toLowerCase();
      const botKeywords = [
        'captcha', 'cf-browser-verification', 'challenge-running', 'turnstile',
        'pardon our interruption', 'datadome', 'press & hold', 'perimeterx',
        'unusual traffic from your computer network', 'bot detected', 'verify you are human'
      ];

      for (const kw of botKeywords) {
        if (lower.includes(kw)) {
          detectedAnomalies.push({
            type: 'SOFT_BOT_WALL',
            severity: 'CRITICAL',
            message: `Detected hidden bot challenge keyword in 200 OK response: "${kw}"`,
            evidence: kw,
          });
          break;
        }
      }
    }

    // 2. Empty Yield Anomaly (HTTP 200 with normal body size but 0 extracted listings)
    if (httpStatus === 200 && jobCount === 0 && payloadSize > 5000) {
      detectedAnomalies.push({
        type: 'EMPTY_YIELD_DRIFT',
        severity: 'HIGH',
        message: `HTTP 200 received with ${Math.round(payloadSize / 1024)}KB body, but 0 valid jobs extracted. Markup structural mutation suspected.`,
        evidence: { payloadSize, jobCount },
      });
    }

    // 3. Payload Size Collapse (e.g. 150KB dropped to 3KB)
    const baseline = this.sourceBaselines.get(source);
    if (baseline && baseline.samples >= 2) {
      if (payloadSize < baseline.avgPayloadSize * 0.25) {
        detectedAnomalies.push({
          type: 'PAYLOAD_COLLAPSE',
          severity: 'HIGH',
          message: `Payload size dropped by >75% (${payloadSize} bytes vs expected ~${Math.round(baseline.avgPayloadSize)} bytes). Possible honeypot or stub response.`,
          evidence: { currentSize: payloadSize, expected: Math.round(baseline.avgPayloadSize) },
        });
      }

      // 4. Extraction Confidence Degradation
      if (avgConfidence < baseline.avgConfidence * 0.6 && avgConfidence < 60) {
        detectedAnomalies.push({
          type: 'CONFIDENCE_DEGRADATION',
          severity: 'MEDIUM',
          message: `Average extraction confidence dropped to ${avgConfidence}% (Baseline: ${Math.round(baseline.avgConfidence)}%). Primary selectors failing.`,
          evidence: { currentConfidence: avgConfidence, baselineConfidence: Math.round(baseline.avgConfidence) },
        });
      }
    }

    // If anomalies detected, broadcast alerts
    if (detectedAnomalies.length > 0) {
      for (const anomaly of detectedAnomalies) {
        this.anomalies.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          source,
          timestamp: new Date().toISOString(),
          ...anomaly,
        });

        eventBus.log('warn', 'VALIDATION', `[${source}] Anomaly Triggered: ${anomaly.message}`, {
          type: anomaly.type,
          severity: anomaly.severity,
          source,
        });

        eventBus.broadcast('ANOMALY_DETECTED', {
          source,
          anomaly,
        });
      }
    } else {
      // Normal run - update baseline
      this.updateBaseline(source, { payloadSizeBytes: payloadSize, jobCount, avgConfidence });
    }

    return {
      hasAnomalies: detectedAnomalies.length > 0,
      anomalies: detectedAnomalies,
      avgConfidence,
    };
  }

  getAnomalies() {
    return this.anomalies.slice(-20);
  }
}

export const anomalyDetector = new AnomalyDetector();
