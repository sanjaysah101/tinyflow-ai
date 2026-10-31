import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:
    "TinyFlow AI — Multi-Agent Code Oracle Powered by Mozilla Otari.ai | MozFest 2026",
  description:
    "An enterprise multi-agent code review pipeline powered by Mozilla Otari.ai open-weight models, featuring automated failovers, sandboxed microVM code execution, live CVE web search, guardrails, and per-user budget enforcement.",
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const OTARI_FEATURES = [
  {
    title: "Judge-Proof 3-Tier BYOK",
    desc: "Bring your own Otari or OpenRouter API key directly in the UI. 3-tier failover (BYOK -> Workspace Key -> Secondary Gateway) guarantees zero credit exhaustion during live demos.",
    icon: "🔑",
    badge: "BYOK Enabled",
  },
  {
    title: "Multi-Model Fallback Chains",
    desc: "Never suffer API downtime. The Otari Gateway automatically catches 429s and timeouts, cascading from primary open-weight models (Qwen 3.5 9B, Qwen 3 32B, Qwen 3.6 35B) to secondary fallbacks without dropping pipeline state.",
    icon: "🔀",
    badge: "Zero Downtime",
  },
  {
    title: "Sandboxed Code Execution",
    desc: "Specialist agents generate isolated runtime assertions to verify loop boundaries, regex catastrophic backtracking, and edge cases inside Otari's microVM sandbox before reporting issues.",
    icon: "⚡",
    badge: "code_execution tool",
  },
  {
    title: "Live CVE & Advisory Web Search",
    desc: "Security specialists query real-time vulnerability databases and deprecation advisories using Otari's built-in web_search tool, attaching live MITRE CVE citations to findings.",
    icon: "🌐",
    badge: "web_search tool",
  },
  {
    title: "Pre & Post Flight Guardrails",
    desc: "Intercepts leaked secrets (AWS, OpenAI, GitHub tokens), PII emails, and malicious prompt injections hidden inside code comments before code ever reaches downstream models.",
    icon: "🛡️",
    badge: "Safety & Privacy",
  },
  {
    title: "Per-User Budget Caps & Lock",
    desc: "Tracks cumulative spend per user fingerprint. When a developer exceeds their allocated budget (e.g. $0.50 cap), Otari returns a clean HTTP 429 budget lock, preventing unexpected billing spikes.",
    icon: "💳",
    badge: "Cost Governance",
  },
  {
    title: "Real-time Telemetry & Receipts",
    desc: "Every step streams audit telemetry over SSE: model versions used, latency, sandbox execution results, web search citations, guardrail actions, and precise per-token cost receipts.",
    icon: "📊",
    badge: "Full Observability",
  },
];

const MODELS = [
  {
    name: "Qwen 3.5 9B",
    role: "Router & Guardrails",
    fallback: "alibaba/qwen3-30b-a3b-instruct-2507",
    desc: "Classifies languages, selects relevant specialist categories, and executes safety guardrail pre-flight inspection ($0.10/M).",
    params: "9B params",
    badge: "⚡ Fast Open-Weight",
    color: "from-blue-500/20 to-blue-600/10",
    border: "border-blue-500/20",
    badgeColor: "text-blue-400",
  },
  {
    name: "Qwen 3 32B Dense",
    role: "Code Specialist + Sandbox",
    fallback: "alibaba/qwen3-coder-480b-a35b-instruct-turbo",
    desc: "Code-specialized open-weight dense model with Otari microVM code execution and live CVE web search tools enabled ($0.08/M).",
    params: "32B params",
    badge: "🔬 Tool-Equipped Specialist",
    color: "from-indigo-500/20 to-indigo-600/10",
    border: "border-indigo-500/20",
    badgeColor: "text-indigo-400",
  },
  {
    name: "Qwen 3.6 35B MoE",
    role: "Synthesizer & Auditor",
    fallback: "alibaba/qwen3.5-27b",
    desc: "Synthesizes parallel specialist findings, verifies sandbox results, deduplicates issues, and outputs a strictly validated JSON report ($0.10/M).",
    params: "35B MoE",
    badge: "🏆 CoT Synthesizer",
    color: "from-violet-500/20 to-violet-600/10",
    border: "border-violet-500/20",
    badgeColor: "text-violet-400",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Otari Guardrails & Route",
    desc: "Qwen 3.5 9B inspects the snippet for leaked secrets and prompt injection comments, redacts threats, and selects active specialist domains.",
    icon: "🛡️",
  },
  {
    num: "02",
    title: "RAG Pattern Retrieval",
    desc: "Qwen 3 embedding model retrieves verified vulnerability patterns from pgvector to ground subsequent specialist prompts.",
    icon: "🔍",
  },
  {
    num: "03",
    title: "Tool-Equipped Specialists in Parallel",
    desc: "Qwen 3 32B runs parallel reviews. Security runs Otari web_search for CVE advisories; Bugs runs Otari code_execution sandbox assertions.",
    icon: "⚡",
  },
  {
    num: "04",
    title: "Qwen 3.6 35B MoE Synthesis",
    desc: "Qwen 3.6 35B unifies specialist outputs, incorporates sandbox run proofs, and generates a structured, prioritized report.",
    icon: "⚗️",
  },
  {
    num: "05",
    title: "SSE Telemetry & Budget Audit",
    desc: "Live metrics, tool execution logs, fallback counts, and per-user budget consumption are streamed to the client in real-time.",
    icon: "📈",
  },
];

const STATS = [
  { label: "Gateway", value: "Otari.ai", sub: "Mozilla Hosted Gateway" },
  {
    label: "Model Architecture",
    value: "Open-Weight",
    sub: "Llama · Qwen · Mistral",
  },
  {
    label: "Tool Sandbox",
    value: "MicroVM",
    sub: "Live Code Exec & CVE Search",
  },
  {
    label: "Budget Security",
    value: "429 Caps",
    sub: "Per-User Token Governance",
  },
];

const WOW_BEFORE = `// Direct Single-Endpoint Call (Brittle & Blind)
// Fails on rate limits; cannot execute code; misses recent CVEs.
{
  "finding": "Looks like you have a loop bug on line 5.",
  "status": "Unverified guess - no runtime check possible",
  "cve_status": "Training cutoff 2024 - cannot check 2026 advisories",
  "guardrails": "Disabled - leaked AWS secret sent in plain text!"
}`;

const WOW_AFTER = `// TinyFlow + Mozilla Otari AI Gateway
{
  "severity": "critical",
  "title": "Off-by-One Buffer Overrun",
  "sandboxVerified": true,
  "executionOutput": "AssertionError: IndexOutOfBounds in cache loop: index 4 >= length 4",
  "cve": "CVE-2026-2189 Checked via Otari Web Search",
  "guardrailRedacted": "API_KEY string sanitized before specialist dispatch",
  "budget": { "userSpentUsd": 0.012, "capUsd": 0.50 }
}`;

// ─── Landing Page ─────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans overflow-x-hidden">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/8 blur-[180px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-600/8 blur-[180px] rounded-full" />
      </div>

      <div className="relative z-10">
        {/* ── Nav ── */}
        <nav className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-sm font-bold text-indigo-400">
              TF
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">TinyFlow AI</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-mono hidden sm:inline-block">
                Powered by Mozilla Otari
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:block text-xs text-zinc-500 font-mono">
              MozFest 2026 Hackathon
            </span>
            <a
              href="https://github.com/sanjaysah101/tinyflow-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10"
            >
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              GitHub
            </a>
            <Link
              href="/app"
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Launch App →
            </Link>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          {/* Prominent Mozilla Otari Gateway Banner */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500/10 via-violet-500/15 to-emerald-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono mb-8 shadow-lg shadow-indigo-950/40">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Mozilla Otari Hackathon · MozFest 2026 Official Submission
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.08]">
            Multi-Agent Code Oracle.
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-300 to-emerald-400">
              Powered by Mozilla Otari.ai Gateway.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-300 max-w-2xl mx-auto leading-relaxed mb-8">
            TinyFlow AI unites open-weight models (Llama 3.2, Qwen 2.5 Coder,
            Mistral 7B) through Mozilla&apos;s hosted Otari Gateway —
            supercharged with automated model fallbacks, sandboxed microVM code
            execution, live CVE web search, and per-user budget caps.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/app"
              className="flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-semibold text-lg transition-all hover:scale-105 shadow-2xl shadow-indigo-900/30"
            >
              ✨ Open Code Analyzer
            </Link>
            <Link
              href="/app/history"
              className="flex items-center gap-2 px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-medium text-lg transition-colors border border-white/10"
            >
              📊 View Otari Audit Trail
            </Link>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-3xl mx-auto">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 text-center"
              >
                <p className="text-2xl font-bold text-white mb-0.5">
                  {s.value}
                </p>
                <p className="text-xs text-indigo-400 font-mono">{s.sub}</p>
                <p className="text-xs text-zinc-500 mt-1 font-mono uppercase">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Architecture Evolution: Why Otari Gateway Solved Everything ── */}
        <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/5">
          <div className="text-center mb-14">
            <span className="text-xs font-mono text-indigo-400 tracking-widest uppercase">
              MozFest 2026 Core Innovation
            </span>
            <h2 className="text-4xl font-bold text-white mt-3">
              The Otari Gateway Transformation
            </h2>
            <p className="text-zinc-400 mt-4 max-w-2xl mx-auto text-sm leading-relaxed">
              Raw single-endpoint LLM calls fail in real production: models
              hallucinate runtime bugs, lack access to live CVE databases, leak
              secrets in prompts, and exhaust budgets. Migrating to Mozilla
              Otari.ai solved every bottleneck.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {OTARI_FEATURES.map((feat) => (
              <div
                key={feat.title}
                className="bg-gradient-to-b from-white/[0.03] to-white/[0.01] border border-white/10 hover:border-indigo-500/30 rounded-2xl p-6 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{feat.icon}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                      {feat.badge}
                    </span>
                  </div>
                  <h3 className="font-semibold text-white text-base mb-2">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── The Wow Gap: Raw Prompting vs Otari Scaffolding ── */}
        <section className="max-w-5xl mx-auto px-6 py-20 border-t border-white/5">
          <div className="text-center mb-12">
            <span className="text-xs font-mono text-emerald-400 tracking-widest uppercase">
              Measurable Verification
            </span>
            <h2 className="text-4xl font-bold text-white mt-3">
              Runtime Truth Over Hallucinations
            </h2>
            <p className="text-zinc-400 mt-4 max-w-xl mx-auto text-sm">
              Instead of guessing if an off-by-one error or regex hang exists,
              Otari executes the assertion inside a secure sandbox container.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-sm font-medium text-red-400">
                  Raw LLM (Unchecked Inference)
                </span>
              </div>
              <div className="bg-red-500/5 border border-red-500/15 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-black/20 border-b border-red-500/10">
                  <span className="text-xs text-zinc-500 font-mono">
                    raw-endpoint.json
                  </span>
                </div>
                <pre className="p-5 text-xs font-mono text-zinc-400 leading-relaxed overflow-x-auto whitespace-pre-wrap">
                  {WOW_BEFORE}
                </pre>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">
                  TinyFlow with Mozilla Otari Tools
                </span>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-black/20 border-b border-emerald-500/10">
                  <span className="text-xs text-emerald-400 font-mono">
                    otari-verified-output.json
                  </span>
                </div>
                <pre className="p-5 text-xs font-mono text-emerald-200/90 leading-relaxed overflow-x-auto whitespace-pre-wrap">
                  {WOW_AFTER}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* ── Open-Weight Model Registry ── */}
        <section className="max-w-5xl mx-auto px-6 py-20 border-t border-white/5">
          <div className="text-center mb-12">
            <span className="text-xs font-mono text-indigo-400 tracking-widest uppercase">
              Gateway Registry
            </span>
            <h2 className="text-4xl font-bold text-white mt-3">
              Open-Weight Model Roster
            </h2>
            <p className="text-zinc-400 mt-4 max-w-xl mx-auto text-sm">
              Configured in Otari Gateway with deterministic fallback cascades.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {MODELS.map((m) => (
              <div
                key={m.name}
                className={`bg-gradient-to-b ${m.color} border ${m.border} rounded-2xl p-6 flex flex-col gap-3`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-mono ${m.badgeColor}`}>
                    {m.badge}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {m.params}
                  </span>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-mono">
                    {m.role}
                  </p>
                  <p className="text-lg font-bold text-white mt-0.5">
                    {m.name}
                  </p>
                  <p className="text-[10px] text-indigo-300 font-mono mt-0.5">
                    ↳ Fallback: {m.fallback}
                  </p>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed flex-1">
                  {m.desc}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono pt-2 border-t border-white/5">
                  <span className="text-emerald-400">●</span> Routed via
                  api.otari.ai
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── How It Works ── */}
        <section
          id="how-it-works"
          className="max-w-5xl mx-auto px-6 py-20 border-t border-white/5"
        >
          <div className="text-center mb-12">
            <span className="text-xs font-mono text-indigo-400 tracking-widest uppercase">
              Pipeline
            </span>
            <h2 className="text-4xl font-bold text-white mt-3">
              Five-Stage Otari Pipeline
            </h2>
            <p className="text-zinc-400 mt-4 max-w-xl mx-auto text-sm">
              Each stage delegates to specialized open-weight models through the
              Otari gateway proxy.
            </p>
          </div>
          <div className="space-y-3">
            {STEPS.map((step) => (
              <div
                key={step.num}
                className="flex items-start gap-5 bg-white/[0.02] border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-colors"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col items-center justify-center text-xl">
                  {step.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-xs font-mono text-zinc-500">
                      {step.num}
                    </span>
                    <h3 className="font-semibold text-white text-sm">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="max-w-5xl mx-auto px-6 py-24 text-center border-t border-white/5">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Test the Otari AI Gateway Live
          </h2>
          <p className="text-base md:text-lg text-zinc-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Experience automatic model fallbacks, sandboxed microVM bug
            verification, CVE lookups, and per-user budget enforcement.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-semibold text-lg transition-all hover:scale-105 shadow-2xl shadow-indigo-900/40"
            >
              ✨ Launch Live Analyzer
            </Link>
            <Link
              href="/app/history"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-2xl font-medium text-lg transition-colors border border-white/10"
            >
              📊 Inspect Gateway Receipts
            </Link>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-white/5 py-8">
          <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-600 font-mono">
            <div className="text-center md:text-left">
              <p>
                TinyFlow AI · Mozilla Otari Hackathon (MozFest 2026) · Open
                Source
              </p>
              <p className="mt-1 text-zinc-500">
                Gateway: https://api.otari.ai/v1 · Models: Qwen 3.5 9B · Qwen 3
                32B · Qwen 3.6 35B MoE
              </p>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/sanjaysah101/tinyflow-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                GitHub Repo
              </a>
              <Link href="/app" className="hover:text-white transition-colors">
                Analyzer
              </Link>
              <Link
                href="/app/history"
                className="hover:text-white transition-colors"
              >
                History
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
