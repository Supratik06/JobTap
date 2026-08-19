import React from 'react';
import { Layers, Shield, Cpu, RefreshCw, AlertOctagon, CheckCircle2, GitBranch, Terminal } from 'lucide-react';

export function ArchitectureView() {
  return (
    <div className="space-y-6">
      
      {/* Architecture Header */}
      <div className="glass-panel p-6 rounded-xl border-l-4 border-cyan-500">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-slate-100 font-display">
            System Design & Resilience Architecture Specification
          </h2>
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
          Comprehensive multi-layer blueprint addressing detection mitigation, distributed pacing, circuit breaker failover, self-healing DOM parsing, and ethical boundaries.
        </p>
      </div>

      {/* Grid of 4 Core Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Pillar 1: Ingestion & Pacing Strategy */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-amber-400">
            <Cpu className="w-4 h-4" />
            <h3 className="font-bold text-sm text-slate-100">1. Adaptive Pacing & Session Layer</h3>
          </div>
          
          <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
            <div className="text-cyan-400 font-bold">Mathematical Cadence Model:</div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Instead of rigid deterministic intervals, requests follow a Poisson process combined with Box-Muller Gaussian jitter:
            </p>
            <div className="bg-slate-900 p-2 rounded text-[11px] text-amber-300">
              Delay = max(1200ms, (μ + Z × σ) × BackoffMultiplier)
              <br />
              <span className="text-slate-500">where μ = 2200ms, σ = 600ms, Z ~ N(0,1)</span>
            </div>
            <p className="text-[11px] text-slate-400">
              • <strong>Token Bucket:</strong> Enforces burst bounds per target domain.<br />
              • <strong>Exponential Jitter Backoff:</strong> Multiplies mean pacing by 2.0x upon 429/Retry-After signals.
            </p>
          </div>
        </div>

        {/* Pillar 2: Circuit Breaker State Machine */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-cyan-400">
            <RefreshCw className="w-4 h-4" />
            <h3 className="font-bold text-sm text-slate-100">2. Circuit Breaker & Fallback Cascade</h3>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
            <div className="text-cyan-400 font-bold">3-State Finite State Machine:</div>
            
            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="p-2 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300">
                <strong>CLOSED</strong><br />Normal Flow
              </div>
              <div className="p-2 rounded bg-rose-950/60 border border-rose-800 text-rose-300">
                <strong>OPEN</strong><br />Diverting Traffic
              </div>
              <div className="p-2 rounded bg-amber-950/60 border border-amber-800 text-amber-300">
                <strong>HALF-OPEN</strong><br />Canary Probing
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-normal pt-1">
              • <strong>Trigger:</strong> 3 consecutive failures trips breaker to OPEN for 10-60s.<br />
              • <strong>Zero-Downtime Cascade:</strong> Primary Live → Secondary Mirror Feed → Stale-While-Revalidate Snapshot Cache.
            </p>
          </div>
        </div>

        {/* Pillar 3: Self-Healing Parser */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <GitBranch className="w-4 h-4" />
            <h3 className="font-bold text-sm text-slate-100">3. 4-Tier Self-Healing Extraction</h3>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
            <div className="text-cyan-400 font-bold">Extraction Hierarchy:</div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between p-1.5 rounded bg-slate-900 border border-slate-800">
                <span>Tier 1: schema.org JSON-LD</span>
                <span className="text-emerald-400 font-bold">98% Confidence</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded bg-slate-900 border border-slate-800">
                <span>Tier 2: Semantic Microdata / OG</span>
                <span className="text-sky-400 font-bold">94% Confidence</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded bg-slate-900 border border-slate-800">
                <span>Tier 3: Fuzzy Selector Cascade</span>
                <span className="text-amber-400 font-bold">78% Confidence</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded bg-slate-900 border border-slate-800">
                <span>Tier 4: Zero-Shot Regex Pattern Scanner</span>
                <span className="text-purple-400 font-bold">82% Confidence</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 pt-1">
              • <strong>Anomaly Detector:</strong> Flags soft-blocks, empty yields, or &gt;75% HTML size collapse.
            </p>
          </div>
        </div>

        {/* Pillar 4: Where We Stop & Legal / Ethical Boundaries */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertOctagon className="w-4 h-4" />
            <h3 className="font-bold text-sm text-slate-100">4. Ethical Line & Technical Safeguards</h3>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
            <div className="text-rose-400 font-bold">Where We Draw The Line:</div>
            <ul className="space-y-1.5 text-[11px] text-slate-400 list-disc list-inside">
              <li>
                <strong className="text-slate-200">No Authenticated Scraping:</strong> Never bypass password-protected sessions, private LinkedIn networks, or paywalls.
              </li>
              <li>
                <strong className="text-slate-200">No CAPTCHA Farms / Solver Exploits:</strong> If a hard Cloudflare Turnstile or reCAPTCHA is thrown, the circuit trips immediately. We do not use OCR break farms.
              </li>
              <li>
                <strong className="text-slate-200">Non-Invasive Concurrency:</strong> Strict token bucket caps prevent any denial-of-service load on upstream servers.
              </li>
              <li>
                <strong className="text-slate-200">PII Redaction:</strong> Ingests only public organizational postings; redacts recruiter personal email and phone numbers automatically.
              </li>
            </ul>
          </div>
        </div>

      </div>

    </div>
  );
}
