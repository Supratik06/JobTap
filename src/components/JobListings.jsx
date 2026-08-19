import React, { useState } from 'react';
import { Database, ExternalLink, Code2, Tag, MapPin, DollarSign, Calendar, Sparkles, CheckCircle2 } from 'lucide-react';

const STRATEGY_BADGES = {
  JSON_LD: { label: 'JSON-LD (98%)', bg: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
  SEMANTIC_MICRODATA: { label: 'Microdata (94%)', bg: 'bg-sky-950 text-sky-300 border-sky-800' },
  CSS_CASCADE: { label: 'CSS Cascade (78%)', bg: 'bg-amber-950 text-amber-300 border-amber-800' },
  REGEX_HEURISTIC: { label: 'Regex Heuristic (82%)', bg: 'bg-purple-950 text-purple-300 border-purple-800' },
  FALLBACK_CACHE: { label: 'Cache Snapshot', bg: 'bg-cyan-950 text-cyan-300 border-cyan-800' },
};

export function JobListings({ jobs }) {
  const [selectedJob, setSelectedJob] = useState(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState('ALL');

  const filtered = jobs.filter(j => {
    if (selectedStrategy !== 'ALL' && j.extractionStrategy !== selectedStrategy) return false;
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      return (
        j.title?.toLowerCase().includes(q) ||
        j.company?.toLowerCase().includes(q) ||
        j.location?.toLowerCase().includes(q) ||
        (j.tags && j.tags.some(t => t.toLowerCase().includes(q)))
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      
      {/* Control Bar */}
      <div className="glass-panel p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Database className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-mono font-bold text-slate-200">
            {filtered.length} listings in memory
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Strategy Filter */}
          <select
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono rounded px-3 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Extraction Strategies</option>
            <option value="JSON_LD">Tier 1: JSON-LD</option>
            <option value="SEMANTIC_MICRODATA">Tier 2: Microdata</option>
            <option value="CSS_CASCADE">Tier 3: CSS Cascade</option>
            <option value="REGEX_HEURISTIC">Tier 4: Regex Heuristic</option>
            <option value="FALLBACK_CACHE">Fallback Snapshot</option>
          </select>

          {/* Search */}
          <input
            type="text"
            placeholder="Filter listings..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono rounded px-3 py-1.5 w-full sm:w-48 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Grid of Listings */}
      {filtered.length === 0 ? (
        <div className="glass-panel p-12 rounded-xl text-center text-slate-500 font-mono">
          No job postings match the filter. Trigger an ingestion run to populate fresh data.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((job) => {
            const badge = STRATEGY_BADGES[job.extractionStrategy] || { label: job.extractionStrategy, bg: 'bg-slate-800 text-slate-300' };
            const dateStr = job.postedAt ? new Date(job.postedAt).toLocaleDateString() : 'Recent';

            return (
              <div
                key={job.id}
                className="glass-panel glass-panel-hover p-4 rounded-xl flex flex-col justify-between border border-slate-800/80"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded border ${badge.bg}`}>
                      {badge.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                      {job.source}
                    </span>
                  </div>

                  {/* Title & Company */}
                  <h3 className="font-bold text-sm text-slate-100 line-clamp-2 mb-1 group-hover:text-cyan-400">
                    {job.title}
                  </h3>
                  <p className="text-xs font-medium text-cyan-400 mb-2">
                    {job.company}
                  </p>

                  {/* Metadata Chips */}
                  <div className="space-y-1 text-[11px] text-slate-400 font-mono mb-3">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>{job.location || 'Remote'}</span>
                    </div>

                    {job.salary && (
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <DollarSign className="w-3 h-3 shrink-0" />
                        <span>{job.salary}</span>
                      </div>
                    )}
                  </div>

                  {/* Description Snippet */}
                  {job.description && (
                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed mb-3">
                      {job.description}
                    </p>
                  )}

                  {/* Tags */}
                  {job.tags && job.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {job.tags.slice(0, 3).map((t, idx) => (
                        <span key={idx} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <button
                    onClick={() => setSelectedJob(job)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-400 transition-colors font-mono"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    Inspect JSON
                  </button>

                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
                  >
                    Apply <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* JSON Inspection Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-100">Canonical Zod Schema Inspection</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedJob.title} — {selectedJob.company}</p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded-lg transition-colors"
              >
                Close
              </button>
            </div>

            <pre className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-cyan-300 overflow-x-auto border border-slate-800 leading-relaxed">
              {JSON.stringify(selectedJob, null, 2)}
            </pre>
          </div>
        </div>
      )}

    </div>
  );
}
