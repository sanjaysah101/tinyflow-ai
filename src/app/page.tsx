import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TinyFlow AI — Enterprise Code Review with Tiny Models | Garage Inference 2026",
  description:
    "A multi-agent AI code review assistant powered entirely by ≤4B parameter models. Finds bugs, security vulnerabilities, and performance issues at $0.00 cost. Built for the Garage Inference hackathon.",
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const MODELS = [
  {
    name: "Llama 3.2 1B",
    role: "Router",
    tier: "Tier 1",
    desc: "Classifies the code language and determines which review categories matter.",
    params: "1B params",
    badge: "⚡ Lightest",
    color: "from-blue-500/20 to-blue-600/10",
    border: "border-blue-500/20",
    badgeColor: "text-blue-400",
  },
  {
    name: "Qwen 2.5 Coder 1.5B",
    role: "Specialist",
    tier: "Tier 1",
    desc: "Code-specialized model. Runs parallel agents — one per category — each answering ONE narrow question.",
    params: "1.5B params",
    badge: "🔬 Code-Expert",
    color: "from-indigo-500/20 to-indigo-600/10",
    border: "border-indigo-500/20",
    badgeColor: "text-indigo-400",
  },
  {
    name: "Phi-3 Mini",
    role: "Synthesizer",
    tier: "Tier 1",
    desc: "Best quality in Tier 1. Synthesizes all specialist reports into a single actionable report.",
    params: "3.8B params",
    badge: "🏆 Best-in-Tier",
    color: "from-violet-500/20 to-violet-600/10",
    border: "border-violet-500/20",
    badgeColor: "text-violet-400",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Paste Your Code",
    desc: "Drop any snippet — JavaScript, Python, SQL, anything. No setup, no login required.",
    icon: "📝",
  },
  {
    num: "02",
    title: "Router Classifies",
    desc: "Llama 3.2 1B detects the language and routes to only the relevant review agents. No wasted tokens.",
    icon: "🗺️",
  },
  {
    num: "03",
    title: "RAG Retrieves Context",
    desc: "We embed your code snippet and pull the top matching vulnerability patterns from our Supabase knowledge base.",
    icon: "🔍",
  },
  {
    num: "04",
    title: "Specialists Analyze in Parallel",
    desc: "Qwen 2.5 Coder 1.5B runs one agent per category simultaneously. Each agent only answers ONE narrow question.",
    icon: "🔬",
  },
  {
    num: "05",
    title: "Phi-3 Synthesizes the Report",
    desc: "The best Tier 1 model combines all specialist findings into a final, prioritized, actionable report.",
    icon: "⚗️",
  },
];

const STATS = [
  { label: "Model Size", value: "≤ 4B", sub: "Tier 1 Only" },
  { label: "Cost per Review", value: "$0.00", sub: "Free tier models" },
  { label: "Pipeline Steps", value: "5", sub: "Fully automated" },
  { label: "Categories Checked", value: "4", sub: "Security, Bugs, Perf, Style" },
];

const WOW_GAP = [
  { what: "Raw 1B model", result: "Rambling, inconsistent, misses critical SQLi" },
  { what: "TinyFlow 1B + scaffold", result: "Precise, structured, cites the exact vulnerable line" },
];

// ─── Landing Page ─────────────────────────────────────────────────────────────

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
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-sm">
              ✨
            </div>
            <span className="font-bold text-white">TinyFlow AI</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:block text-xs text-zinc-500 font-mono">Garage Inference 2026</span>
            <Link
              href="/app"
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Try it free →
            </Link>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono mb-8">
            🏆 Garage Inference 2026 · Tier 1 Submission
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.05]">
            Enterprise code review.
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-400">
              Powered by models that cost nothing.
            </span>
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Three tiny models (1B, 1.5B, 3.8B parameters) work together to find security vulnerabilities,
            bugs, performance issues, and code style problems — with the accuracy of a senior engineer.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/app"
              className="flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-semibold text-lg transition-all hover:scale-105 shadow-2xl shadow-indigo-900/30"
            >
              ✨ Analyze My Code
            </Link>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-medium text-lg transition-colors border border-white/10"
            >
              How it works ↓
            </a>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-20 max-w-3xl mx-auto">
            {STATS.map((s) => (
              <div key={s.label} className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 text-center">
                <p className="text-3xl font-bold text-white mb-1">{s.value}</p>
                <p className="text-xs text-zinc-500 font-mono">{s.sub}</p>
                <p className="text-xs text-zinc-600 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── The Wow Gap ── */}
        <section className="max-w-5xl mx-auto px-6 py-20 border-t border-white/5">
          <div className="text-center mb-12">
            <span className="text-xs font-mono text-indigo-400 tracking-widest uppercase">The Whole Point</span>
            <h2 className="text-4xl font-bold text-white mt-3">The Wow Gap</h2>
            <p className="text-zinc-400 mt-4 max-w-xl mx-auto">
              The same 1B model. Radically different outcomes. Engineering is the multiplier.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-sm font-medium text-red-400">{WOW_GAP[0].what}</span>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">&ldquo;{WOW_GAP[0].result}&rdquo;</p>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">{WOW_GAP[1].what}</span>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">&ldquo;{WOW_GAP[1].result}&rdquo;</p>
            </div>
          </div>
          <div className="mt-8 bg-white/[0.02] border border-white/10 rounded-2xl p-6 text-center">
            <p className="text-zinc-400 text-sm">
              The key insight:{" "}
              <span className="text-white font-medium">
                A tiny model that hallucinates when asked to &ldquo;review my code&rdquo; becomes precise and reliable
                when it only needs to answer ONE narrow question — with the right context already retrieved for it.
              </span>
            </p>
          </div>
        </section>

        {/* ── Models ── */}
        <section className="max-w-5xl mx-auto px-6 py-20 border-t border-white/5">
          <div className="text-center mb-12">
            <span className="text-xs font-mono text-indigo-400 tracking-widest uppercase">The Team</span>
            <h2 className="text-4xl font-bold text-white mt-3">Three Tiny Specialists</h2>
            <p className="text-zinc-400 mt-4 max-w-xl mx-auto">
              Not one smart model. Three tiny models, each doing one thing they&apos;re good at.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {MODELS.map((m, i) => (
              <div
                key={m.name}
                className={`bg-gradient-to-b ${m.color} border ${m.border} rounded-2xl p-6 flex flex-col gap-3`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-mono ${m.badgeColor}`}>{m.badge}</span>
                  <span className="text-xs text-zinc-600 font-mono">{m.tier}</span>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-mono">{m.role}</p>
                  <p className="text-lg font-bold text-white mt-0.5">{m.name}</p>
                  <p className="text-xs text-zinc-500 font-mono">{m.params}</p>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed flex-1">{m.desc}</p>
                <div className="flex items-center gap-1.5 text-xs text-zinc-600 font-mono">
                  <span className="text-emerald-500">●</span> Free on OpenRouter
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it Works ── */}
        <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-20 border-t border-white/5">
          <div className="text-center mb-12">
            <span className="text-xs font-mono text-indigo-400 tracking-widest uppercase">The Engineering</span>
            <h2 className="text-4xl font-bold text-white mt-3">How It Works</h2>
            <p className="text-zinc-400 mt-4 max-w-xl mx-auto">
              Five steps. Three models. One powerful pipeline built around the model&apos;s limitations, not despite them.
            </p>
          </div>
          <div className="space-y-4">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className="flex items-start gap-6 bg-white/[0.02] border border-white/8 rounded-2xl p-6 hover:border-white/15 transition-colors"
              >
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col items-center justify-center">
                  <span className="text-2xl">{step.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-mono text-zinc-600">{step.num}</span>
                    <h3 className="font-semibold text-white">{step.title}</h3>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Engineering Techniques ── */}
        <section className="max-w-5xl mx-auto px-6 py-20 border-t border-white/5">
          <div className="text-center mb-12">
            <span className="text-xs font-mono text-indigo-400 tracking-widest uppercase">Hackathon Criteria</span>
            <h2 className="text-4xl font-bold text-white mt-3">Engineering Scaffolding</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                title: "RAG (Retrieval-Augmented Generation)",
                desc: "24 curated vulnerability patterns stored in Supabase pgvector. nomic-embed-text embeds your code and retrieves the most relevant patterns before prompting the specialist.",
                icon: "🔍",
              },
              {
                title: "Multi-Step Pipeline",
                desc: "Route → Retrieve → Analyze (parallel) → Validate → Synthesize. Each tiny model handles ONE narrow task. No single model does everything.",
                icon: "🔄",
              },
              {
                title: "Structured Outputs + Validation",
                desc: "Every model output is validated against a Zod schema. If the tiny model outputs malformed JSON, the pipeline retries with an error-correction prompt.",
                icon: "✅",
              },
              {
                title: "Tool Use / Parallel Agents",
                desc: "Specialist agents run in parallel via Promise.allSettled(). Each agent independently handles one category, then results are merged by the synthesizer.",
                icon: "🔬",
              },
            ].map((t) => (
              <div key={t.title} className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
                <div className="text-2xl mb-3">{t.icon}</div>
                <h3 className="font-semibold text-white mb-2">{t.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="max-w-5xl mx-auto px-6 py-24 text-center border-t border-white/5">
          <h2 className="text-5xl font-bold text-white mb-6">
            Try it. It&apos;s free.
            <br />
            <span className="text-zinc-500">Like, actually free.</span>
          </h2>
          <p className="text-xl text-zinc-400 max-w-xl mx-auto mb-10 leading-relaxed">
            No API key required. No sign up. Paste your code and watch three models smaller than your phone&apos;s camera app
            find real bugs in seconds.
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-semibold text-xl transition-all hover:scale-105 shadow-2xl shadow-indigo-900/40"
          >
            ✨ Start Analyzing Code
          </Link>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-white/5 py-8 text-center text-xs text-zinc-600 font-mono">
          <p>TinyFlow AI · Garage Inference 2026 · Open Source · Tier 1 (≤4B params)</p>
          <p className="mt-1">
            Models: Llama 3.2 1B · Qwen 2.5 Coder 1.5B · Phi-3 Mini 3.8B · Nomic Embed · All via OpenRouter
          </p>
        </footer>
      </div>
    </div>
  );
}
