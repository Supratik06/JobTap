import React from 'react';
import { Play, RotateCcw, Shield, Activity, Sparkles, Terminal, Flame, Database, Layers } from 'lucide-react';

export function Navbar({
  selectedSource,
  setSelectedSource,
  searchQuery,
  setSearchQuery,
  isRunning,
  onTriggerIngestion,
  onResetChaos,
  activeTab,
  setActiveTab,
  sseConnected,
}) {
  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Brand & Connection State */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base lg:text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-sky-300 to-white">
                ACDYON INGESTION ENGINE
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                v1.0 Stealth
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-mono">
                <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                {sseConnected ? 'LIVE SSE TELEMETRY' : 'CONNECTING...'}
              </span>
              <span>•</span>
              <span className="text-slate-400 hidden sm:inline">Track 1: Resilient Scraper Architecture</span>
            </div>
          </div>
        </div>

        {/* Live Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Source Selector */}
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            disabled={isRunning}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 transition-colors"
          >
            <option value="arbeitnow">Arbeitnow (Live Job Board API)</option>
            <option value="remoteok">RemoteOK (Live API)</option>
            <option value="weworkremotely">WeWorkRemotely (Live RSS)</option>
            <option value="hackernews">Hacker News (Live Hiring Feed)</option>
            <option value="sandbox">Anti-Bot Sandbox (Controlled)</option>
            <option value="all">Federated (All Sources)</option>
          </select>

          {/* Keyword Query */}
          <input
            type="text"
            placeholder="Role / keyword (e.g. rust, lead)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isRunning}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 w-36 sm:w-48 focus:outline-none focus:border-cyan-500 transition-colors placeholder:text-slate-500 font-mono"
          />

          {/* Trigger Button */}
          <button
            onClick={onTriggerIngestion}
            disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md ${
              isRunning
                ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 glow-cyan'
            }`}
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Ingesting...' : 'Run Ingestion'}
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="max-w-7xl mx-auto mt-3.5 pt-2 border-t border-slate-800/60 flex items-center gap-1 sm:gap-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('terminal')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === 'terminal'
              ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Live Telemetry & Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('detection')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === 'detection'
              ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Detection Surface & JA4 Lab</span>
        </button>

        <button
          onClick={() => setActiveTab('chaos')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === 'chaos'
              ? 'bg-slate-800 text-rose-400 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Adversarial Chaos Controls</span>
        </button>

        <button
          onClick={() => setActiveTab('jobs')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === 'jobs'
              ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Extracted Jobs Store</span>
        </button>

        <button
          onClick={() => setActiveTab('architecture')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === 'architecture'
              ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Architecture & Resilience Flow</span>
        </button>
      </div>
    </header>
  );
}
