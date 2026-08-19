import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar.jsx';
import { MetricCards } from './components/MetricCards.jsx';
import { TerminalLogs } from './components/TerminalLogs.jsx';
import { DetectionLab } from './components/DetectionLab.jsx';
import { ChaosLab } from './components/ChaosLab.jsx';
import { JobListings } from './components/JobListings.jsx';
import { ArchitectureView } from './components/ArchitectureView.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState('terminal');
  const [selectedSource, setSelectedSource] = useState('arbeitnow');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  
  const [logs, setLogs] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [metrics, setMetrics] = useState({
    jobCount: 0,
    lastJitter: 2200,
  });
  const [circuitBreakers, setCircuitBreakers] = useState([]);

  // Fetch initial state
  const loadInitialData = async () => {
    try {
      const [healthRes, jobsRes, circuitRes] = await Promise.all([
        fetch('/api/health').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/jobs').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/circuit/status').then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      if (healthRes) {
        setMetrics(m => ({ ...m, jobCount: healthRes.jobCount }));
        if (healthRes.circuitBreakers) setCircuitBreakers(healthRes.circuitBreakers);
      }
      if (jobsRes && jobsRes.jobs) {
        setJobs(jobsRes.jobs);
      }
      if (circuitRes && circuitRes.breakers) {
        setCircuitBreakers(circuitRes.breakers);
      }
    } catch (err) {
      console.error('Failed to load initial server state', err);
    }
  };

  // SSE Stream Listener
  useEffect(() => {
    loadInitialData();

    const eventSource = new EventSource('/api/events');

    eventSource.addEventListener('connected', () => {
      setSseConnected(true);
    });

    eventSource.addEventListener('history', (e) => {
      try {
        const hist = JSON.parse(e.data);
        if (Array.isArray(hist)) {
          const logItems = hist.filter(h => h.type === 'LOG').map(h => ({ id: h.id, ...h.payload }));
          setLogs(logItems);
        }
      } catch (err) {}
    });

    eventSource.addEventListener('LOG', (e) => {
      try {
        const event = JSON.parse(e.data);
        setLogs(prev => [...prev.slice(-150), { id: event.id, ...event.payload }]);
      } catch (err) {}
    });

    eventSource.addEventListener('CIRCUIT_STATE', (e) => {
      try {
        const event = JSON.parse(e.data);
        const updatedBreaker = event.payload;
        setCircuitBreakers(prev => {
          const exists = prev.some(b => b.name === updatedBreaker.name);
          if (exists) {
            return prev.map(b => b.name === updatedBreaker.name ? updatedBreaker : b);
          }
          return [...prev, updatedBreaker];
        });
      } catch (err) {}
    });

    eventSource.addEventListener('METRIC', (e) => {
      try {
        const event = JSON.parse(e.data);
        const m = event.payload;
        if (m.name === 'rate_limiter_jitter') {
          setMetrics(prev => ({ ...prev, lastJitter: m.value }));
        } else if (m.name === 'jobs_ingested_total') {
          setMetrics(prev => ({ ...prev, jobCount: m.value }));
        }
      } catch (err) {}
    });

    eventSource.addEventListener('HISTORY_CLEARED', () => {
      setLogs([]);
    });

    eventSource.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Trigger Ingestion Run
  const handleTriggerIngestion = async () => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/ingest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: selectedSource,
          query: searchQuery || 'engineer',
          enableFallback: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.result?.jobs) {
          // Refresh job listings
          const jobsRes = await fetch('/api/jobs');
          if (jobsRes.ok) {
            const jobsData = await jobsRes.json();
            if (jobsData.jobs) {
              setJobs(jobsData.jobs);
              setMetrics(m => ({ ...m, jobCount: jobsData.total }));
            }
          }
        }
      }
    } catch (err) {
      console.error('Ingestion execution failed', err);
    } finally {
      setIsRunning(false);
    }
  };

  // Reset All Circuits
  const handleResetCircuits = async () => {
    try {
      const res = await fetch('/api/circuit/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.breakers) setCircuitBreakers(data.breakers);
      }
    } catch (err) {
      console.error('Failed to reset circuits', err);
    }
  };

  // Clear Terminal Logs
  const handleClearLogs = async () => {
    try {
      await fetch('/api/telemetry/clear', { method: 'POST' });
      setLogs([]);
    } catch (err) {
      console.error('Failed to clear logs', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-950">
      
      {/* Top Navbar */}
      <Navbar
        selectedSource={selectedSource}
        setSelectedSource={setSelectedSource}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isRunning={isRunning}
        onTriggerIngestion={handleTriggerIngestion}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sseConnected={sseConnected}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        
        {/* Metric Cards */}
        <MetricCards
          metrics={metrics}
          circuitBreakers={circuitBreakers}
          onResetCircuits={handleResetCircuits}
        />

        {/* Tab Views */}
        {activeTab === 'terminal' && (
          <TerminalLogs
            logs={logs}
            onClearLogs={handleClearLogs}
          />
        )}

        {activeTab === 'detection' && (
          <DetectionLab />
        )}

        {activeTab === 'chaos' && (
          <ChaosLab
            onTriggerIngestion={handleTriggerIngestion}
          />
        )}

        {activeTab === 'jobs' && (
          <JobListings
            jobs={jobs}
          />
        )}

        {activeTab === 'architecture' && (
          <ArchitectureView />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-4 px-4 text-center text-xs font-mono text-slate-500">
        Acdyon Technologies Engineering Assessment • Track 1: Resilient Ingestion Engine • Built with Node.js, Express, Cheerio, Zod, React & Vite
      </footer>
    </div>
  );
}
