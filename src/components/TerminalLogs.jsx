import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, Filter, Search, ArrowDown, ChevronRight, CheckCircle2, AlertCircle, AlertTriangle, Shield, Flame } from 'lucide-react';

const STAGE_COLORS = {
  PACING: 'bg-amber-950 text-amber-300 border-amber-800',
  STEALTH: 'bg-cyan-950 text-cyan-300 border-cyan-800',
  REQUEST: 'bg-blue-950 text-blue-300 border-blue-800',
  PARSE: 'bg-purple-950 text-purple-300 border-purple-800',
  VALIDATION: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  FALLBACK: 'bg-rose-950 text-rose-300 border-rose-800',
  CIRCUIT: 'bg-yellow-950 text-yellow-300 border-yellow-800',
  CHAOS: 'bg-fuchsia-950 text-fuchsia-300 border-fuchsia-800',
};

const LEVEL_ICONS = {
  info: <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />,
  warn: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
  error: <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
  stealth: <Shield className="w-3.5 h-3.5 text-sky-400 shrink-0" />,
  resilience: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
  chaos: <Flame className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />,
};

export function TerminalLogs({ logs, onClearLogs }) {
  const [selectedStage, setSelectedStage] = useState('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedLogMeta, setSelectedLogMeta] = useState(null);
  const terminalBottomRef = useRef(null);

  useEffect(() => {
    if (autoScroll && terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter(log => {
    if (selectedStage !== 'ALL' && log.stage !== selectedStage) return false;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const matchMsg = log.message?.toLowerCase().includes(q);
      const matchStage = log.stage?.toLowerCase().includes(q);
      return matchMsg || matchStage;
    }
    return true;
  });

  return (
    <div className="glass-panel rounded-xl overflow-hidden flex flex-col h-[580px]">
      
      {/* Terminal Toolbar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="font-mono text-slate-300 font-bold ml-2 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            INGESTION_PIPELINE_TELEMETRY.log
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
            {filteredLogs.length} events
          </span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Stage Filter */}
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-300 text-xs font-mono rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Stages</option>
            <option value="PACING">Pacing (Jitter)</option>
            <option value="STEALTH">Stealth (Headers)</option>
            <option value="REQUEST">Request Dispatch</option>
            <option value="PARSE">Parse Engine</option>
            <option value="VALIDATION">Validation</option>
            <option value="FALLBACK">Fallback Cascade</option>
            <option value="CIRCUIT">Circuit Breaker</option>
            <option value="CHAOS">Chaos Injection</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2 text-slate-500" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-300 text-xs font-mono rounded pl-6 pr-2 py-1 w-28 sm:w-36 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Auto-Scroll Toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded transition-colors text-xs font-mono flex items-center gap-1 ${
              autoScroll ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-slate-800 text-slate-400'
            }`}
            title="Toggle Auto-Scroll"
          >
            <ArrowDown className="w-3 h-3" />
            <span className="hidden sm:inline">Scroll</span>
          </button>

          {/* Clear Logs */}
          <button
            onClick={onClearLogs}
            className="p-1.5 rounded bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 transition-colors"
            title="Clear Log Terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5 bg-slate-950/95 relative">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center py-12">
            <Terminal className="w-8 h-8 mb-2 opacity-40 text-cyan-400" />
            <p className="font-mono">Listening to real-time ingestion pipeline events...</p>
            <p className="text-[11px] text-slate-600 mt-1">Click "Run Ingestion" or fire an Adversarial Chaos Drill above</p>
          </div>
        ) : (
          filteredLogs.map((log, idx) => {
            const stageClass = STAGE_COLORS[log.stage] || 'bg-slate-900 text-slate-300 border-slate-700';
            const icon = LEVEL_ICONS[log.level] || <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
            const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '';

            return (
              <div
                key={log.id || idx}
                onClick={() => setSelectedLogMeta(log)}
                className="group flex items-start gap-2.5 hover:bg-slate-900/80 p-1 rounded transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-500 shrink-0 pt-0.5 select-none">{timeStr}</span>
                <span className="pt-0.5">{icon}</span>
                
                {/* Stage Badge */}
                <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border shrink-0 ${stageClass}`}>
                  {log.stage || 'EVENT'}
                </span>

                {/* Log Message */}
                <span className="text-slate-200 break-all group-hover:text-cyan-300 transition-colors">
                  {log.message}
                </span>

                {/* Has Meta Indicator */}
                {log.meta && Object.keys(log.meta).length > 0 && (
                  <span className="text-[10px] text-slate-500 group-hover:text-cyan-400 shrink-0 font-mono ml-auto">
                    [meta]
                  </span>
                )}
              </div>
            );
          })
        )}
        <div ref={terminalBottomRef} />
      </div>

      {/* Meta Inspection Modal Drawer */}
      {selectedLogMeta && (
        <div className="bg-slate-900 border-t border-slate-800 p-3 max-h-48 overflow-y-auto text-xs font-mono">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
            <span className="text-cyan-400 font-bold flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3" /> Event Details & Metadata ({selectedLogMeta.stage})
            </span>
            <button
              onClick={() => setSelectedLogMeta(null)}
              className="text-slate-400 hover:text-slate-100 text-xs px-2 py-0.5 rounded hover:bg-slate-800"
            >
              Close
            </button>
          </div>
          <pre className="text-slate-300 text-[11px] overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(selectedLogMeta, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
