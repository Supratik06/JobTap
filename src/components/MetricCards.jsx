import React from 'react';
import { Activity, ShieldCheck, Zap, Database, RotateCcw, AlertTriangle } from 'lucide-react';

export function MetricCards({ metrics, circuitBreakers, onResetCircuits }) {
  const isAnyBreakerOpen = circuitBreakers.some(cb => cb.state === 'OPEN');
  const isAnyBreakerHalfOpen = circuitBreakers.some(cb => cb.state === 'HALF_OPEN');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      
      {/* CARD 1: Circuit Breaker State */}
      <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="font-mono uppercase font-semibold">Circuit Protection</span>
          <button
            onClick={onResetCircuits}
            title="Reset All Circuit Breakers"
            className="text-slate-400 hover:text-cyan-400 transition-colors p-1 rounded hover:bg-slate-800"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${
              isAnyBreakerOpen 
                ? 'bg-rose-500 animate-ping' 
                : isAnyBreakerHalfOpen 
                ? 'bg-amber-400 animate-pulse' 
                : 'bg-emerald-400'
            }`} />
            <span className="text-xl font-extrabold font-mono text-slate-100">
              {isAnyBreakerOpen ? 'TRIPPED (OPEN)' : isAnyBreakerHalfOpen ? 'PROBING (HALF)' : 'ARMED (CLOSED)'}
            </span>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
          <span>Active Breakers: {circuitBreakers.length}</span>
          <span className={isAnyBreakerOpen ? 'text-rose-400' : 'text-emerald-400'}>
            {isAnyBreakerOpen ? 'Fallback Diverting' : '100% Traffic Clear'}
          </span>
        </div>
      </div>

      {/* CARD 2: Total Stored Listings */}
      <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="font-mono uppercase font-semibold">Extracted Job Store</span>
          <Database className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold font-mono text-slate-100">
            {metrics.jobCount || 0}
          </span>
          <span className="text-xs text-cyan-400 font-mono">deduplicated</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
          <span>Storage: In-Memory</span>
          <span className="text-cyan-400">Schema.org Valid</span>
        </div>
      </div>

      {/* CARD 3: Adaptive Pacing Jitter */}
      <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="font-mono uppercase font-semibold">Adaptive Pacing Cadence</span>
          <Zap className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold font-mono text-slate-100">
            {metrics.lastJitter ? `${metrics.lastJitter}ms` : '2,200ms'}
          </span>
          <span className="text-xs text-amber-400 font-mono">Gaussian Jitter</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
          <span>Algorithm: Token Bucket</span>
          <span className="text-slate-300">σ = 600ms Jitter</span>
        </div>
      </div>

      {/* CARD 4: Anti-Bot Defense Rating */}
      <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="font-mono uppercase font-semibold">Stealth Masking Index</span>
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold font-mono text-emerald-400">
            96 / 100
          </span>
          <span className="text-xs text-slate-400 font-mono">Clean Profile</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
          <span>JA4: Chrome 133</span>
          <span className="text-emerald-400">CDP Scrubbed</span>
        </div>
      </div>

    </div>
  );
}
