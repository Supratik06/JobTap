import React, { useState, useEffect } from 'react';
import { Flame, AlertTriangle, RefreshCw, Zap, ShieldOff, Cpu, Bug, Activity } from 'lucide-react';

export function ChaosLab({ onTriggerIngestion }) {
  const [config, setConfig] = useState({
    simulateRateLimit429: false,
    simulateCloudflare403: false,
    simulateMarkupMutation: false,
    simulateNetworkLatencyMs: 0,
    simulateEmptyPayload200: false,
  });
  const [loading, setLoading] = useState(false);
  const [activeDrill, setActiveDrill] = useState(null);

  useEffect(() => {
    fetch('/api/chaos/config')
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error('Failed to fetch chaos config', err));
  }, []);

  const toggleOption = async (key, val) => {
    const updated = { ...config, [key]: val };
    setConfig(updated);
    try {
      await fetch('/api/chaos/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (err) {
      console.error('Failed to update chaos config', err);
    }
  };

  const resetAllChaos = async () => {
    try {
      const res = await fetch('/api/chaos/reset', { method: 'POST' });
      const data = await res.json();
      setConfig(data.config);
      setActiveDrill(null);
    } catch (err) {
      console.error('Failed to reset chaos', err);
    }
  };

  const runFireDrill = async (drillName, drillConfig) => {
    setActiveDrill(drillName);
    setLoading(true);

    // Apply chaos settings
    await fetch('/api/chaos/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(drillConfig),
    });
    setConfig(drillConfig);

    // Trigger Ingestion immediately to observe resilience reaction
    if (onTriggerIngestion) {
      await onTriggerIngestion();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Chaos Control Banner */}
      <div className="glass-panel p-6 rounded-xl border-l-4 border-rose-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-rose-400" />
              <h2 className="text-lg font-bold text-slate-100 font-display">
                Adversarial Chaos Engineering & Resilience Injection
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Test how the pipeline behaves when upstream platforms actively retaliate mid-run: rate limits, Cloudflare bot challenges, overnight DOM mutations, and honeypot payloads.
            </p>
          </div>

          <button
            onClick={resetAllChaos}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 border border-slate-700 transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset to Clean State
          </button>
        </div>
      </div>

      {/* Pre-Packaged Fire Drills */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Drill 1 */}
        <div className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-rose-500/50 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                Fire Drill #1
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-100 mb-1">429 Rate Limit Burst & Trip</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Forces upstream 429 Too Many Requests errors. Verifies token bucket backoff scaling, circuit breaker trip to OPEN, and instant fallback diversion.
            </p>
          </div>
          <button
            onClick={() => runFireDrill('RateLimitBurst', {
              simulateRateLimit429: true,
              simulateCloudflare403: false,
              simulateMarkupMutation: false,
              simulateNetworkLatencyMs: 0,
              simulateEmptyPayload200: false,
            })}
            disabled={loading}
            className="mt-4 w-full py-2 rounded bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-700 text-xs font-mono font-bold transition-colors"
          >
            {loading && activeDrill === 'RateLimitBurst' ? 'Executing Drill...' : 'Launch 429 Drill'}
          </button>
        </div>

        {/* Drill 2 */}
        <div className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-amber-500/50 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                Fire Drill #2
              </span>
              <Bug className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-100 mb-1">Overnight Markup Mutation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Scrambles DOM classes (e.g. <code>.job-card</code> → <code>.x9f_m7</code>) and strips JSON-LD. Verifies Tier 3/4 self-healing parser recovery.
            </p>
          </div>
          <button
            onClick={() => runFireDrill('MarkupDrift', {
              simulateRateLimit429: false,
              simulateCloudflare403: false,
              simulateMarkupMutation: true,
              simulateNetworkLatencyMs: 0,
              simulateEmptyPayload200: false,
            })}
            disabled={loading}
            className="mt-4 w-full py-2 rounded bg-amber-950 hover:bg-amber-900 text-amber-200 border border-amber-700 text-xs font-mono font-bold transition-colors"
          >
            {loading && activeDrill === 'MarkupDrift' ? 'Executing Drill...' : 'Launch DOM Drift Drill'}
          </button>
        </div>

        {/* Drill 3 */}
        <div className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-purple-500/50 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                Fire Drill #3
              </span>
              <ShieldOff className="w-4 h-4 text-purple-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-100 mb-1">Cloudflare 403 Bot Wall</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Simulates Cloudflare Ray ID 403 Challenge intercept. Verifies circuit breaker interception and zero-downtime cache snapshot recovery.
            </p>
          </div>
          <button
            onClick={() => runFireDrill('CloudflareBlock', {
              simulateRateLimit429: false,
              simulateCloudflare403: true,
              simulateMarkupMutation: false,
              simulateNetworkLatencyMs: 0,
              simulateEmptyPayload200: false,
            })}
            disabled={loading}
            className="mt-4 w-full py-2 rounded bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-700 text-xs font-mono font-bold transition-colors"
          >
            {loading && activeDrill === 'CloudflareBlock' ? 'Executing Drill...' : 'Launch 403 Wall Drill'}
          </button>
        </div>

      </div>

      {/* Granular Chaos Switches */}
      <div className="glass-panel p-5 rounded-xl">
        <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-rose-400" />
          Granular Adversary Parameters
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          
          {/* Switch 1 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <div>
              <span className="font-bold text-slate-200 block">Inject HTTP 429 Too Many Requests</span>
              <span className="text-slate-400 text-[11px]">Forces rate limit burst response</span>
            </div>
            <input
              type="checkbox"
              checked={config.simulateRateLimit429}
              onChange={(e) => toggleOption('simulateRateLimit429', e.target.checked)}
              className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
            />
          </div>

          {/* Switch 2 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <div>
              <span className="font-bold text-slate-200 block">Inject Cloudflare 403 Bot Wall</span>
              <span className="text-slate-400 text-[11px]">Simulates Ray ID bot challenge</span>
            </div>
            <input
              type="checkbox"
              checked={config.simulateCloudflare403}
              onChange={(e) => toggleOption('simulateCloudflare403', e.target.checked)}
              className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
            />
          </div>

          {/* Switch 3 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <div>
              <span className="font-bold text-slate-200 block">Inject DOM Selector Mutation</span>
              <span className="text-slate-400 text-[11px]">Scrambles CSS classes and strips schema.org</span>
            </div>
            <input
              type="checkbox"
              checked={config.simulateMarkupMutation}
              onChange={(e) => toggleOption('simulateMarkupMutation', e.target.checked)}
              className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
            />
          </div>

          {/* Switch 4 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <div>
              <span className="font-bold text-slate-200 block">Inject Empty Body 200 OK (Honeypot)</span>
              <span className="text-slate-400 text-[11px]">Tests statistical anomaly detector</span>
            </div>
            <input
              type="checkbox"
              checked={config.simulateEmptyPayload200}
              onChange={(e) => toggleOption('simulateEmptyPayload200', e.target.checked)}
              className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
            />
          </div>

        </div>
      </div>

    </div>
  );
}
