import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Cpu, Network, Lock, Clock, Eye, AlertTriangle } from 'lucide-react';

export function DetectionLab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeProfileView, setActiveProfileView] = useState('Chrome 133 / macOS');

  useEffect(() => {
    fetch('/api/fingerprint/inspect')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load fingerprint diagnostics', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="glass-panel p-8 rounded-xl text-center text-slate-400 font-mono">
        Analyzing detection vectors and browser signatures...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-xl border-l-4 border-cyan-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-slate-100 font-display">
                Detection Surface & Anti-Bot Fingerprint Analysis
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Industrial anti-bot vendors (Cloudflare Bot Management, Akamai Bot Manager, Kasada, Datadome, PerimeterX) operate across 5 distinct OSI layers. Below is how our hardened stealth architecture defeats passive heuristic classification.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-900/90 p-3 rounded-lg border border-slate-800 shrink-0">
            <div className="text-center">
              <span className="text-[10px] uppercase font-mono text-rose-400 block">Naive Bot Score</span>
              <span className="text-xl font-mono font-extrabold text-rose-400">94/100</span>
              <span className="text-[9px] text-slate-500 block">(Banned in &lt;10s)</span>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="text-center">
              <span className="text-[10px] uppercase font-mono text-emerald-400 block">Stealth Engine</span>
              <span className="text-xl font-mono font-extrabold text-emerald-400">08/100</span>
              <span className="text-[9px] text-slate-500 block">(Clean Consumer)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5-Layer Detection Vector Comparison Cards */}
      <div className="grid grid-cols-1 gap-4">
        {data?.vectors?.map((vec, idx) => (
          <div key={idx} className="glass-panel rounded-xl overflow-hidden border border-slate-800">
            {/* Vector Title */}
            <div className="bg-slate-900/80 px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 text-xs font-mono font-bold flex items-center justify-center border border-cyan-800">
                  {idx + 1}
                </span>
                <span className="font-bold text-sm text-slate-100">{vec.name}</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 ml-2">
                  {vec.category}
                </span>
              </div>
            </div>

            {/* Side-by-Side Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 text-xs font-mono">
              
              {/* Naive Scraper Behavior (Vulnerable) */}
              <div className="p-4 bg-rose-950/10 space-y-2">
                <div className="flex items-center gap-1.5 text-rose-400 font-bold uppercase text-[11px]">
                  <ShieldAlert className="w-4 h-4" />
                  Naive Automation Signature
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded border border-rose-900/40 text-slate-300">
                  <span className="text-slate-500 text-[10px] block">Detected Signature:</span>
                  <span className="text-rose-300 font-semibold">{vec.naive.signature}</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-normal pt-1">
                  <strong className="text-rose-400">Vulnerability: </strong>
                  {vec.naive.reason}
                </p>
              </div>

              {/* Hardened Stealth Mitigation */}
              <div className="p-4 bg-emerald-950/10 space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase text-[11px]">
                  <ShieldCheck className="w-4 h-4" />
                  Acdyon Stealth Mitigation
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded border border-emerald-900/40 text-slate-300">
                  <span className="text-slate-500 text-[10px] block">Synthesized Profile:</span>
                  <span className="text-emerald-300 font-semibold">{vec.stealth.signature}</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-normal pt-1">
                  <strong className="text-emerald-400">Mitigation: </strong>
                  {vec.stealth.mitigation}
                </p>
              </div>

            </div>
          </div>
        ))}
      </div>

      {/* Realistic Client Profile Inspector */}
      <div className="glass-panel p-5 rounded-xl">
        <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
          <Lock className="w-4 h-4 text-cyan-400" />
          Active Cryptographic Profile & Header Order Spec
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
          <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
            <span className="text-slate-500 text-[10px] block">JA4 TLS Signature</span>
            <span className="text-cyan-400 font-bold">t13d1516h2_8daaf6152771_0166099a180a</span>
            <span className="text-[10px] text-slate-400 mt-1 block">TLS 1.3 / Chrome 133 Canonical Cipher Suite</span>
          </div>

          <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
            <span className="text-slate-500 text-[10px] block">HTTP/2 Pseudo-Header Sequence</span>
            <span className="text-cyan-400 font-bold">:method → :authority → :scheme → :path</span>
            <span className="text-[10px] text-slate-400 mt-1 block">SETTINGS_HEADER_TABLE_SIZE = 65536</span>
          </div>

          <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
            <span className="text-slate-500 text-[10px] block">Sec-CH-UA Platform Alignment</span>
            <span className="text-cyan-400 font-bold">"Google Chrome";v="133", "macOS"</span>
            <span className="text-[10px] text-slate-400 mt-1 block">GREASE brands dynamically randomized</span>
          </div>
        </div>
      </div>

    </div>
  );
}
