# Acdyon Technologies — Resilient Data Ingestion Engine

> **Engineering Assessment Submission (Track 1: Ingestion & Scraping System)**  
> Built with Node.js, Express, React, Vite, Tailwind CSS v4, Cheerio, and Zod.

[![Tests](https://img.shields.io/badge/Tests-10%2F10%20Passing-emerald)]()
[![License](https://img.shields.io/badge/License-MIT-cyan)]()
[![Status](https://img.shields.io/badge/Status-Production%20Ready-blue)]()

---

## Quick Start (Local Setup)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Test Suite
```bash
npm test
```
All 10 unit and integration tests verify:
- Gaussian / Box-Muller jitter math and adaptive token bucket backoff
- Circuit breaker state transitions (`CLOSED` $\rightarrow$ `OPEN` $\rightarrow$ `HALF-OPEN` $\rightarrow$ `CLOSED`)
- 4-Tier self-healing extraction (JSON-LD $\rightarrow$ Microdata $\rightarrow$ CSS Cascade $\rightarrow$ Heuristic Regex)
- Live `https://www.arbeitnow.com/api/job-board-api` integration and canonical Zod schema validation
- Stealth header synthesis and JA4 profile integrity
- Multi-tier fallback cascade to cached snapshots

### 3. Launch Development Server & Interactive Dashboard
```bash
npm run dev
```
- **Interactive UI Dashboard:** `http://localhost:5173`
- **Backend API & SSE Telemetry Server:** `http://localhost:3001`

---

## System Architecture

```
                                  [ INGESTION TRIGGER ]
                                            │
                                ┌───────────┴───────────┐
                                ▼                       ▼
                      [ Token Bucket ]         [ Gaussian Jitter ]
                      (Domain Pacing)         (μ=2.2s, σ=0.6s)
                                │                       │
                                └───────────┬───────────┘
                                            ▼
                              [ Stealth Header Engine ]
                              (BoringSSL JA4, HTTP/2 Order)
                                            │
                                            ▼
                              [ Circuit Breaker Gateway ]
                                  /                   \
                        (State: CLOSED)         (State: OPEN)
                              /                           \
                             ▼                             ▼
                  [ Target Data Source ]       [ 3-Tier Fallback Cascade ]
              • Arbeitnow Live API            • Tier 2: Secondary Mirror
              • RemoteOK Live Stream          • Tier 3: SWR Snapshot Cache
              • WeWorkRemotely RSS
              • Hacker News Hiring
              • Anti-Bot Chaos Sandbox
                             │
                             ▼
              [ 4-Tier Self-Healing Parser ]
              1. schema.org JSON-LD (98%)
              2. Semantic Microdata (94%)
              3. Fuzzy CSS Cascade  (78%)
              4. Heuristic Regex    (82%)
                             │
                             ▼
              [ Zod Canonical Schema Validation ]
                             │
                             ▼
              [ Real-Time SSE Telemetry & Job Store ]
```

---

## Key Features

1. **Live Data Ingestion:**
   - Real-time ingestion from **Arbeitnow API** (`https://www.arbeitnow.com/api/job-board-api`), **RemoteOK**, **WeWorkRemotely RSS**, and **Hacker News Hiring Feed**.
2. **Detection Surface & Fingerprint Lab:**
   - Visual side-by-side analysis of naive bot signatures vs hardened stealth signatures across TLS JA4, HTTP/2 pseudo-header order, Sec-CH-UA client hints, and CDP runtime artifacts.
3. **Adversarial Chaos Controls & Fire Drills:**
   - One-click triggers to inject **HTTP 429 Rate Limits**, **Cloudflare 403 Bot Walls**, **Overnight DOM Markup Scrambling**, and **Empty Stub Payloads** to watch the circuit breaker trip and the self-healing parser recover in real time.
4. **Real-Time SSE Event Stream:**
   - Color-coded stage waterfall logs (`PACING`, `STEALTH`, `REQUEST`, `PARSE`, `VALIDATION`, `FALLBACK`, `CIRCUIT`, `CHAOS`) with full metadata inspection.
5. **Deduplicated Canonical Job Explorer:**
   - Modern, responsive job explorer showing provenance tags, extraction strategy confidence scores, salary chips, and raw JSON inspectors.

---

## Submission Deliverables

- **System Design Document:** [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md)
- **Decisions & Trade-offs Document:** [DECISIONS.md](DECISIONS.md)
- **Automated Tests:** `tests/ingestion.test.js`
