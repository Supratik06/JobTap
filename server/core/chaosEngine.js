import { eventBus } from '../telemetry/eventBus.js';

export class ChaosEngine {
  constructor() {
    this.config = {
      simulateRateLimit429: false,
      simulateCloudflare403: false,
      simulateMarkupMutation: false,
      simulateNetworkLatencyMs: 0,
      simulateEmptyPayload200: false,
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    eventBus.log('chaos', 'CHAOS', 'Updated adversarial chaos simulation settings', this.config);
    eventBus.broadcast('CHAOS_CONFIG', this.config);
    return this.config;
  }

  getConfig() {
    return this.config;
  }

  resetConfig() {
    this.config = {
      simulateRateLimit429: false,
      simulateCloudflare403: false,
      simulateMarkupMutation: false,
      simulateNetworkLatencyMs: 0,
      simulateEmptyPayload200: false,
    };
    eventBus.log('info', 'CHAOS', 'Adversarial chaos simulation reset to clean state');
    eventBus.broadcast('CHAOS_CONFIG', this.config);
    return this.config;
  }

  /**
   * Intercept an outgoing request or incoming response and inject chaos if enabled
   */
  async interceptRequest(source) {
    // 1. Injected Latency
    if (this.config.simulateNetworkLatencyMs > 0) {
      eventBus.log('chaos', 'CHAOS', `[${source}] Injecting ${this.config.simulateNetworkLatencyMs}ms network lag`);
      await new Promise(r => setTimeout(r, this.config.simulateNetworkLatencyMs));
    }

    // 2. Simulated HTTP 429 Too Many Requests
    if (this.config.simulateRateLimit429) {
      eventBus.log('chaos', 'CHAOS', `[${source}] Chaos Triggered: Simulating HTTP 429 Too Many Requests (Rate limit exceeded)`);
      const err = new Error('HTTP 429 Too Many Requests: Rate limit exceeded for source IP');
      err.status = 429;
      err.retryAfter = 5;
      throw err;
    }

    // 3. Simulated HTTP 403 Cloudflare Bot Block
    if (this.config.simulateCloudflare403) {
      eventBus.log('chaos', 'CHAOS', `[${source}] Chaos Triggered: Simulating HTTP 403 Forbidden (Cloudflare Ray ID 89bf21a7 - Bot Protection Active)`);
      const err = new Error('HTTP 403 Forbidden: Cloudflare Bot Management Challenge Page');
      err.status = 403;
      err.cfRay = '89bf21a7e9f82d1a';
      throw err;
    }
  }

  /**
   * Intercept HTML payload before parsing and mutate markup if chaos enabled
   */
  interceptPayload(source, html) {
    if (this.config.simulateEmptyPayload200) {
      eventBus.log('chaos', 'CHAOS', `[${source}] Chaos Triggered: Returning empty stub body with 200 OK (Testing Anomaly Detector)`);
      return `<!DOCTYPE html><html><head><title>System Maintenance</title></head><body><div class="empty-stub">No listings found. Please verify you are human.</div></body></html>`;
    }

    if (this.config.simulateMarkupMutation && typeof html === 'string') {
      eventBus.log('chaos', 'CHAOS', `[${source}] Chaos Triggered: Mutating DOM markup & scrambling CSS selectors to simulate overnight redesign`);
      
      // Mutate classes by replacing standard job classes with random hashed obfuscated names
      let mutated = html
        .replace(/class="job-card"/g, 'class="x9f_m7"')
        .replace(/class="title"/g, 'class="z1_tk"')
        .replace(/class="company"/g, 'class="q8_b"')
        .replace(/class="location"/g, 'class="w4_l"')
        .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '<!-- JSON-LD stripped by CDN -->');

      return mutated;
    }

    return html;
  }
}

export const chaosEngine = new ChaosEngine();
