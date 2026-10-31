# TinyFlow AI — Mozilla Otari Hackathon (MozFest 2026)

> **Powered by Mozilla Otari.ai Open-Source AI Gateway**
> 
> Enterprise multi-agent AI code review built entirely on open-weight models, featuring automated failovers, sandboxed microVM code execution, live CVE web search, guardrails, and per-user budget enforcement.

[![Mozilla Otari](https://img.shields.io/badge/Gateway-Mozilla_Otari.ai-indigo)](#-mozilla-otari-gateway-integration)
[![Models](https://img.shields.io/badge/Models-Open--Weight-blue)](#-exact-model-declaration--fallback-registry)
[![Tools](https://img.shields.io/badge/Tools-code__execution_%7C_web__search-emerald)](#-the-6-otari-gateway-capabilities)
[![Budget](https://img.shields.io/badge/Cost_Governance-429_Budget_Caps-amber)](#5-per-user-budget-caps--global-spend-locks)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

---

## 🦊 Mozilla Otari Gateway Integration: The Architectural Evolution

### Why We Migrated from Raw Single-Endpoint Calls to Mozilla Otari.ai
In our initial prototype, TinyFlow relied on raw, direct model API calls. In real-world software engineering reviews, that approach suffered from critical limitations:
1. **Single Point of Failure**: When a provider experienced rate limits or outages, analyses crashed mid-pipeline.
2. **Hallucinated Runtime Bugs**: Models claimed off-by-one errors or infinite loops without any way to prove them.
3. **Stale Knowledge Cutoffs**: Models could not check live 2025/2026 CVE advisories or recent package deprecations.
4. **Secret Leaks in Prompts**: Developers pasting code risked sending AWS keys and passwords directly to models.
5. **Runaway Inference Bills**: Uncapped concurrent analyses could silently exhaust team API budgets.

**Mozilla Otari.ai transformed TinyFlow into an enterprise-grade agentic gateway.** All agent calls now route through `https://api.otari.ai/v1`, unlocking multi-model failover chains, isolated sandbox execution, real-time web search tools, pre-flight safety guardrails, and per-user budget controls.

---

## ⚡ The 6 Otari Gateway Capabilities

### 1. Open-Weight Model Registry & Automated Fallbacks
- Primary open-weight models (`Llama 3.2 3B`, `Qwen 2.5 Coder 7B`, `Mistral 7B`) are configured with deterministic fallback paths.
- If primary inference throws a 429, timeout, or 5xx, Otari automatically reroutes to the backup open-weight model (`Llama 3.1 8B`, `Qwen 2.5 Coder 32B`, `DeepSeek R1 Distill 14B`) without losing context or failing the user's session.

### 2. Sandboxed MicroVM Code Execution (`code_execution`)
- When the **Bugs** or **Performance** specialist identifies suspected issues (e.g., off-by-one loop boundaries, regex catastrophic backtracking), it generates a focused assertion script.
- The script executes in Otari's isolated sandbox microVM. If the assertion reproduces the error, the finding is tagged with `[Sandbox Verified via Otari Code Exec]` alongside the exact runtime trace.

### 3. Live CVE & Advisory Web Search (`web_search`)
- The **Security** specialist invokes Otari's native `web_search` tool to cross-reference imported third-party libraries, cryptographic patterns, and framework versions against live MITRE CVE databases and security bulletins.
- Verified advisories attach directly to the findings as clickable citations.

### 4. Native Pre-Flight & Post-Flight Guardrails
- Before code is dispatched to downstream specialists, Otari Guardrails inspect the payload for:
  - Leaked API keys (AWS, OpenAI, GitHub, private keys)
  - PII (email addresses, credentials)
  - Malicious prompt injections concealed inside code comments or docstrings
- Redacted tokens are neutralized while notifying the developer via UI badges.

### 5. Per-User Budget Caps & Global Spend Locks
- Every analysis request accepts client identification (`userId` / `x-user-id`) and budget metadata (`x-otari-user-budget`).
- Otari tracks cumulative token expenditures. When a user exceeds their limit (e.g., demo cap of `$0.50`), the gateway returns a clean `HTTP 429 Budget Exceeded` response, preventing accidental overrun.

### 6. Real-Time Telemetry Streaming over SSE
- Real-time Server-Sent Events stream rich Otari telemetry to the client:
  - Open-weight models used per role
  - Fallback failover counts
  - Sandbox execution results and outputs
  - Live CVE queries checked
  - Guardrail intervention receipts
  - Micro-dollar token billing calculations

---

## 🎯 The Wow Gap: Runtime Truth Over Hallucinations

| Without Otari Gateway | With TinyFlow + Mozilla Otari |
|---|---|
| **Raw Model Output**: Unverified guess about loop boundaries | **Runtime Verified**: MicroVM runs assertion test proving the off-by-one error |
| **Outdated CVEs**: Relying on 2024 training cutoff | **Live Web Search**: Queries MITRE & NVD for current 2026 advisories |
| **Brittle Endpoints**: 429 crashes the entire pipeline | **Zero Downtime**: Seamless failover to secondary open-weight model |
| **Plaintext Secrets**: Leaked keys transmitted to models | **Guardrail Redaction**: Intercepts secrets & prompt injection before inference |
| **Uncapped Costs**: Unlimited bill shock | **Hard Budget Caps**: Enforces per-user limit with clean HTTP 429 lock |

---

## 🚀 Working Demo & Quickstart

### One-Command Setup

```bash
git clone https://github.com/sanjaysah101/tinyflow-ai
cd tinyflow-ai
pnpm install
cp .env.example .env   # configure keys
pnpm run db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the landing page, or jump directly to [http://localhost:3000/app](http://localhost:3000/app) for the interactive code review sandbox.

### Environment Variables (`.env`)

```bash
# Mozilla Otari.ai AI Gateway
OTARI_API_KEY=your_otari_api_key_here
OTARI_BASE_URL=https://api.otari.ai/v1
OTARI_USER_BUDGET_LIMIT_USD=1.00

# Open-Weight Model Registry (Optional Overrides)
OTARI_ROUTER_MODEL=meta-llama/llama-3.2-3b-instruct
OTARI_SPECIALIST_MODEL=Qwen/Qwen2.5-Coder-7B-Instruct
OTARI_SYNTHESIZER_MODEL=mistralai/Mistral-7B-Instruct-v0.3

# Database & Vectors
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

### Database Setup

```bash
# Apply schema migrations
pnpm run db:migrate

# Seed 24 curated vulnerability patterns
pnpm run db:seed
```

---

## 📊 Exact Model Declaration & Fallback Registry

| Role | Primary Open-Weight Model | Fallback Open-Weight Model | Capabilities & Tools |
|---|---|---|---|
| **Router** | `meta-llama/llama-3.2-3b-instruct` | `meta-llama/llama-3.1-8b-instruct` | Language routing, Otari Guardrails pre-check |
| **Specialist** | `Qwen/Qwen2.5-Coder-7B-Instruct` | `qwen/qwen-2.5-coder-32b-instruct` | `code_execution` (microVM), `web_search` (CVEs) |
| **Synthesizer** | `mistralai/Mistral-7B-Instruct-v0.3` | `deepseek-ai/DeepSeek-R1-Distill-Qwen-14B` | Cross-specialist synthesis, deduplication, schema validation |
| **Embedding** | `nomic-ai/nomic-embed-text-v1.5` | `nomic-ai/nomic-embed-text-v1.5` | 768-dim vector embeddings for RAG retrieval |

---

## 🛠 Architecture

```
User Code Input
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│              Mozilla Otari AI Gateway Router                │
│             (meta-llama/llama-3.2-3b-instruct)              │
│  - Guardrails pre-check (leaked API secrets & injection)   │
│  - Language classification & specialist routing             │
│  - Per-user budget validation (HTTP 429 lock if capped)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
      ┌────────────────────────▼────────────────────────┐
      │          RAG: nomic-embed-text-v1.5             │
      │  Retrieves 24 vulnerability patterns via pgvector│
      └────────────────────────┬────────────────────────┘
                               │
      ┌────────────────────────▼────────────────────────┐
      │   Parallel Specialists: Qwen 2.5 Coder 7B       │
      │   (Automatic fallback to Qwen 2.5 Coder 32B)    │
      ├────────────────────────┬────────────────────────┤
      │ Security Specialist    │ Bugs Specialist        │
      │ ↳ Tool: web_search     │ ↳ Tool: code_execution │
      │   (Live CVE queries)   │   (MicroVM assertions) │
      └────────────────────────┬────────────────────────┘
                               │
      ┌────────────────────────▼────────────────────────┐
      │           Synthesizer: Mistral 7B               │
      │  (Automatic fallback to DeepSeek R1 Distill)    │
      │  - Unifies sandbox verified proofs & CVE data   │
      │  - Validates structured Zod schema              │
      └────────────────────────┬────────────────────────┘
                               │
      ┌────────────────────────▼────────────────────────┐
      │      SSE Telemetry & Postgres Persistence       │
      │  - Streamed audit trail: models, tools, spend   │
      │  - Audited history stored in analysis_history   │
      └─────────────────────────────────────────────────┘
```

---

## 🎥 Interactive Demo Features (Judge Checklist)

1. **Live Otari Feature Controls Bar** (`/app`):
   - **Primary vs Fallback Mode Toggle**: Intentionally forces primary failover to prove Otari automatic model fallback live.
   - **Otari Code Execution Toggle**: Turns microVM assertion verification on/off.
   - **Otari Live CVE Search Toggle**: Enables live web queries against CVE advisories.
   - **Otari Guardrails Toggle**: Demonstrates instant redaction of secrets in code.
   - **Per-User Budget Simulator**: Live spend bar with a `Test 429 Lock` button that instantly demonstrates Otari budget enforcement.
2. **Finding Badges**:
   - `[Sandbox Verified via Otari Code Exec]` with expandable sandbox output.
   - `[CVE Checked via Otari Web Search]` with clickable Mitre links.
   - `[Fallback Model Used]` when primary endpoint is rerouted.
   - `[Guardrail Redacted]` when API keys or injection comments are scrubbed.
3. **Audit History Dashboard** (`/app/history`):
   - Full receipts for every run: open-weight models used, fallback events, sandbox executions count, CVE searches count, and cumulative spend.

---

## 🔧 Development Scripts

```bash
pnpm dev             # Start Next.js development server
pnpm build           # Build production bundle
pnpm lint            # Run Biome linter & format check
pnpm run db:migrate  # Run database migrations
pnpm run db:seed     # Seed vulnerability patterns
```

---

## 🤝 Open Source & MozFest 2026 Compliance

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Gateway**: Mozilla Otari AI Gateway (`https://api.otari.ai/v1`)
- **Models**: 100% Open-Weight (Llama 3.2, Qwen 2.5 Coder, Mistral 7B)
- **License**: MIT
