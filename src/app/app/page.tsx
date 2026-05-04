"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Shield, Bug, Zap, Code2, ChevronRight,
  Copy, Check, AlertTriangle, Info, ArrowLeft,
  Activity, Clock, DollarSign, Cpu, History, RotateCcw,
  CheckCircle2, Route, Search, FlaskConical, Layers,
  Lightbulb, Target,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = "critical" | "high" | "medium" | "low";

interface Issue {
  line?: number;
  title: string;
  description: string;
  severity: Severity;
  fix: string;
}

interface CategoryReport {
  name: "security" | "bugs" | "performance" | "style";
  issueCount: number;
  safe: boolean;
  summary: string;
  issues: Issue[];
}

interface Report {
  overallRisk: "critical" | "high" | "medium" | "low" | "clean";
  headline: string;
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  topPriority: string;
  categories: CategoryReport[];
  knownLimitations: string;
}

interface Metrics {
  latencyMs: number;
  language: string;
  modelsUsed: Array<{ name: string; role: string; params: string }>;
  tier: string;
  estimatedCost: string;
}

type PipelineStep = "idle" | "routing" | "analyzing" | "synthesizing" | "done" | "error";

interface StepEvent {
  step: PipelineStep;
  message: string;
  model?: string;
  categories?: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; label: string }> = {
  critical: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "CRITICAL" },
  high: { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", label: "HIGH" },
  medium: { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "MEDIUM" },
  low: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: "LOW" },
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  security: Shield,
  bugs: Bug,
  performance: Zap,
  style: Code2,
};

const RISK_CONFIG: Record<string, { color: string; label: string }> = {
  critical: { color: "text-red-400", label: "Critical Risk" },
  high: { color: "text-orange-400", label: "High Risk" },
  medium: { color: "text-yellow-400", label: "Medium Risk" },
  low: { color: "text-blue-400", label: "Low Risk" },
  clean: { color: "text-emerald-400", label: "Clean!" },
};

const EXAMPLE_CODE = `async function getUserData(userId) {
  // Fetch user from database
  const query = "SELECT * FROM users WHERE id = " + userId;
  const user = await db.execute(query);
  
  // Display user info
  document.getElementById('profile').innerHTML = user.bio;
  
  // Cache result
  const cache = [];
  for (let i = 0; i <= user.posts.length; i++) {
    cache += JSON.stringify(user.posts[i]);
  }
  
  const API_KEY = "sk-prod-1234567890abcdef";
  return fetch('https://api.example.com', {
    headers: { Authorization: API_KEY }
  });
}`;

// ─── Pipeline Steps ───────────────────────────────────────────────────────────

const PIPELINE_STEPS: Array<{
  id: string;
  label: string;
  model: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "routing",      label: "Route & Classify",    model: "llama-3.2-1b",          icon: Route        },
  { id: "retrieving",   label: "RAG Retrieval",        model: "nomic-embed-text",       icon: Search       },
  { id: "analyzing",    label: "Specialist Analysis",  model: "qwen-2.5-coder-1.5b",   icon: FlaskConical },
  { id: "synthesizing", label: "Synthesize Report",    model: "phi-3-mini",             icon: Layers       },
  { id: "done",         label: "Complete",             model: "",                       icon: CheckCircle2 },
];

function getStepStatus(stepId: string, currentStep: PipelineStep, completedSteps: string[]) {
  if (completedSteps.includes(stepId)) return "done";
  if (currentStep === stepId || (stepId === "retrieving" && currentStep === "analyzing")) return "active";
  if (currentStep === "done") return "done";
  return "pending";
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function IssueCard({ issue }: { issue: Issue }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[issue.severity];

  return (
    <motion.div
      layout
      className={`border rounded-xl p-4 cursor-pointer ${cfg.bg} hover:border-white/20 transition-colors`}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start gap-3">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono mt-0.5 shrink-0 ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {issue.line && (
              <span className="text-xs font-mono text-zinc-500">L{issue.line}</span>
            )}
            <p className="font-medium text-sm text-white truncate">{issue.title}</p>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{issue.description}</p>
        </div>
        <ChevronRight className={`w-4 h-4 text-zinc-500 flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-xs text-zinc-300 leading-relaxed mb-2">{issue.description}</p>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                <p className="text-xs font-medium text-emerald-400 mb-1 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" />
                  Fix
                </p>
                <p className="text-xs text-zinc-300 leading-relaxed font-mono">{issue.fix}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main App Page ────────────────────────────────────────────────────────────

export default function AppPage() {
  const [code, setCode] = useState(EXAMPLE_CODE);
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>("idle");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [stepMessage, setStepMessage] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("security");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    if (!code.trim()) return;
    setReport(null);
    setMetrics(null);
    setError(null);
    setCompletedSteps([]);
    setPipelineStep("routing");
    setStepMessage("Starting analysis pipeline…");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const raw = line.slice(6).trim();
            try {
              const data = JSON.parse(raw);

              if (currentEvent === "step") {
                const evt = data as StepEvent;
                setPipelineStep(evt.step);
                setStepMessage(evt.message);
              } else if (currentEvent === "router_done") {
                setCompletedSteps((p) => [...p, "routing", "retrieving"]);
              } else if (currentEvent === "specialists_done") {
                setCompletedSteps((p) => [...p, "analyzing"]);
              } else if (currentEvent === "done") {
                setReport(data.report as Report);
                setMetrics(data.metrics as Metrics);
                setActiveCategory(data.report.categories[0]?.name ?? "security");
                setPipelineStep("done");
                setCompletedSteps(["routing", "retrieving", "analyzing", "synthesizing", "done"]);
                setStepMessage("Analysis complete!");
              } else if (currentEvent === "error") {
                throw new Error(data.message);
              }
            } catch {
              // Skip malformed SSE data
            }
          }
        }
      }
    } catch (err: unknown) {
      setError(String(err));
      setPipelineStep("error");
    }
  }, [code]);

  const handleNewAnalysis = useCallback(() => {
    setReport(null);
    setMetrics(null);
    setError(null);
    setCompletedSteps([]);
    setPipelineStep("idle");
    setStepMessage("");
    setCode("");
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const riskCfg = report ? RISK_CONFIG[report.overallRisk] : null;
  const isRunning = pipelineStep !== "idle" && pipelineStep !== "done" && pipelineStep !== "error";
  const pipelineProgress = (completedSteps.length / PIPELINE_STEPS.length) * 100;

  return (
    <TooltipProvider delay={400}>
      <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans">
        {/* Ambient glow */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/8 blur-[120px] rounded-full" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-600/8 blur-[120px] rounded-full" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6 min-h-screen">

          {/* Header */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors text-sm">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
              <Separator orientation="vertical" className="h-4 bg-white/10" />
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                </div>
                <span className="font-semibold text-white">TinyFlow AI</span>
                <span className="text-xs text-zinc-500 hidden sm:block">— Code Oracle</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/app/history"
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10"
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:block">History</span>
              </Link>
              <div className="hidden md:flex items-center gap-2 text-xs font-mono">
                <span className="px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  Tier 1 (≤4B params) · $0.00
                </span>
              </div>
            </div>
          </header>

          {/* Main Grid */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── Left: Code Input + Pipeline ── */}
            <div className="flex flex-col gap-4">

              {/* Code editor */}
              <div className="flex flex-col bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/20">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/50" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                      <div className="w-3 h-3 rounded-full bg-green-500/50" />
                    </div>
                    <span className="text-xs text-zinc-500 font-mono ml-2">code-to-review.js</span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger
                      onClick={copyCode}
                      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors bg-transparent border-0 cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied!" : "Copy"}
                    </TooltipTrigger>
                    <TooltipContent>Copy code to clipboard</TooltipContent>
                  </Tooltip>
                </div>
                <textarea
                  className="flex-1 bg-transparent font-mono text-sm text-zinc-300 p-4 resize-none outline-none min-h-[320px] placeholder:text-zinc-600 leading-relaxed"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste your code here…"
                  spellCheck={false}
                />
                <div className="px-4 py-3 border-t border-white/5 bg-black/20 flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-600 font-mono">{code.length} chars</span>
                  <div className="flex items-center gap-2">
                    {(pipelineStep === "done" || pipelineStep === "error") && (
                      <motion.button
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={handleNewAnalysis}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-xl text-sm font-medium transition-colors border border-white/10"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        New
                      </motion.button>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleAnalyze}
                      disabled={isRunning}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-900/30"
                    >
                      <Sparkles className="w-4 h-4" />
                      Analyze Code
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Pipeline visualization */}
              <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Live Pipeline
                </h3>

                {/* Progress bar */}
                {pipelineStep !== "idle" && (
                  <div className="w-full h-0.5 bg-white/5 rounded-full overflow-hidden mb-4">
                    <motion.div
                      className="h-full bg-indigo-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${pipelineProgress}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  {PIPELINE_STEPS.map((step, i) => {
                    const status = getStepStatus(step.id, pipelineStep, completedSteps);
                    const StepIcon = step.icon;
                    return (
                      <div key={step.id} className="flex items-center gap-3 py-1">
                        {/* Icon + connector */}
                        <div className="relative flex flex-col items-center">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border transition-all ${
                            status === "done"
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                              : status === "active"
                              ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400 animate-pulse"
                              : "bg-white/5 border-white/10 text-zinc-600"
                          }`}>
                            {status === "done"
                              ? <Check className="w-3.5 h-3.5" />
                              : <StepIcon className="w-3.5 h-3.5" />
                            }
                          </div>
                          {i < PIPELINE_STEPS.length - 1 && (
                            <div className={`w-px h-4 mt-1 transition-colors ${
                              status === "done" ? "bg-emerald-500/30" : "bg-white/5"
                            }`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pb-3">
                          <p className={`text-sm font-medium ${status === "pending" ? "text-zinc-600" : "text-white"}`}>
                            {step.label}
                          </p>
                          {step.model && (
                            <p className={`text-xs font-mono ${status === "pending" ? "text-zinc-700" : "text-zinc-500"}`}>
                              {step.model}
                            </p>
                          )}
                        </div>
                        {status === "active" && (
                          <div className="flex gap-1 pb-3">
                            {[0, 1, 2].map((j) => (
                              <div key={j} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${j * 100}ms` }} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {stepMessage && pipelineStep !== "idle" && (
                  <>
                    <Separator className="bg-white/5 mt-2" />
                    <p className="text-xs text-indigo-300 mt-3">{stepMessage}</p>
                  </>
                )}

                {error && (
                  <>
                    <Separator className="bg-white/5 mt-2" />
                    <p className="text-xs text-red-400 mt-3 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {error}
                    </p>
                  </>
                )}
              </div>

              {/* Metrics receipts */}
              {metrics && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/[0.02] border border-white/10 rounded-2xl p-5"
                >
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    Performance Receipts
                  </h3>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-black/30 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-zinc-500 text-xs mb-1">
                        <Clock className="w-3 h-3" /> Latency
                      </div>
                      <p className="text-white font-mono font-semibold">{(metrics.latencyMs / 1000).toFixed(1)}s</p>
                    </div>
                    <div className="bg-black/30 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-zinc-500 text-xs mb-1">
                        <DollarSign className="w-3 h-3" /> Cost
                      </div>
                      <p className="text-emerald-400 font-mono font-semibold">{metrics.estimatedCost}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {metrics.modelsUsed.map((m) => (
                      <div key={m.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-3 h-3 text-zinc-500" />
                          <span className="text-zinc-400">{m.role}</span>
                        </div>
                        <span className="font-mono text-white">{m.params} params</span>
                      </div>
                    ))}
                    <Separator className="bg-white/5" />
                    <div className="flex items-center justify-between text-xs pt-0.5">
                      <span className="text-zinc-500">Tier</span>
                      <span className="text-amber-400 font-mono">{metrics.tier}</span>
                    </div>
                  </div>
                  <Separator className="bg-white/5 mt-3" />
                  <div className="mt-3">
                    <Link
                      href="/app/history"
                      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-indigo-400 transition-colors"
                    >
                      <History className="w-3 h-3" />
                      View all past analyses →
                    </Link>
                  </div>
                </motion.div>
              )}
            </div>

            {/* ── Right: Report ── */}
            <div className="flex flex-col gap-4">
              {!report && pipelineStep === "idle" && (
                <div className="flex-1 flex flex-col items-center justify-center bg-white/[0.02] border border-white/10 rounded-2xl p-10 text-center">
                  <div className="p-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-4">
                    <Sparkles className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-2">Ready to analyze</h2>
                  <p className="text-sm text-zinc-400 max-w-xs leading-relaxed">
                    Paste your code on the left and click Analyze. Three tiny models (1B, 1.5B, 3.8B) will review it in parallel.
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-xs">
                    {[
                      { icon: <Shield className="w-4 h-4" />, label: "Security", color: "text-red-400" },
                      { icon: <Bug className="w-4 h-4" />, label: "Bugs", color: "text-orange-400" },
                      { icon: <Zap className="w-4 h-4" />, label: "Performance", color: "text-yellow-400" },
                      { icon: <Code2 className="w-4 h-4" />, label: "Style", color: "text-blue-400" },
                    ].map((c) => (
                      <div key={c.label} className={`flex items-center gap-2 text-xs bg-white/[0.02] border border-white/[0.08] rounded-lg px-3 py-2 ${c.color}`}>
                        {c.icon}
                        <span className="text-zinc-400">{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isRunning && (
                <div className="flex-1 flex flex-col items-center justify-center bg-white/[0.02] border border-white/10 rounded-2xl p-10 text-center">
                  <div className="w-16 h-16 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin mb-6" />
                  <p className="text-white font-medium">{stepMessage}</p>
                  <p className="text-sm text-zinc-500 mt-2">Tiny models working hard…</p>
                </div>
              )}

              {report && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-4"
                >
                  {/* Overall risk banner */}
                  <div className={`rounded-2xl p-5 border ${
                    report.overallRisk === "clean"
                      ? "bg-emerald-500/10 border-emerald-500/20"
                      : report.overallRisk === "critical"
                      ? "bg-red-500/10 border-red-500/20"
                      : report.overallRisk === "high"
                      ? "bg-orange-500/10 border-orange-500/20"
                      : "bg-yellow-500/10 border-yellow-500/20"
                  }`}>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${riskCfg?.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold font-mono ${riskCfg?.color}`}>
                            {riskCfg?.label.toUpperCase()}
                          </span>
                          <span className="text-xs text-zinc-500">· {report.totalIssues} issues found</span>
                        </div>
                        <p className="text-white font-medium text-sm">{report.headline}</p>
                        <p className="text-xs text-zinc-400 mt-1.5 flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          Top priority: <span className="text-white ml-0.5">{report.topPriority}</span>
                        </p>
                      </div>
                    </div>

                    {/* Issue count pills */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {report.criticalCount > 0 && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/20">
                          {report.criticalCount} critical
                        </span>
                      )}
                      {report.highCount > 0 && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/20">
                          {report.highCount} high
                        </span>
                      )}
                      {report.mediumCount > 0 && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/20">
                          {report.mediumCount} medium
                        </span>
                      )}
                      {report.lowCount > 0 && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/20">
                          {report.lowCount} low
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category tabs */}
                  <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
                    <Tabs value={activeCategory} onValueChange={setActiveCategory} className="gap-0">
                      {/* Tab list */}
                      <div className="border-b border-white/5 px-2 pt-2 pb-0">
                        <TabsList
                          variant="line"
                          className="h-auto gap-0.5 flex-wrap pb-2 w-full justify-start"
                        >
                          {report.categories.map((cat) => {
                            const Icon = CATEGORY_ICONS[cat.name] ?? Code2;
                            const isActive = activeCategory === cat.name;
                            return (
                              <TabsTrigger
                                key={cat.name}
                                value={cat.name}
                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 h-auto text-sm font-medium text-zinc-400 hover:text-white border border-transparent data-active:bg-indigo-500/20 data-active:text-white data-active:border-indigo-500/30 transition-all"
                              >
                                <Icon className="w-3.5 h-3.5" />
                                <span className="capitalize">{cat.name}</span>
                                {cat.issueCount > 0 && (
                                  <span className={`text-[10px] rounded-full px-1.5 py-0 font-mono leading-4 ${
                                    isActive ? "bg-indigo-500/30 text-indigo-300" : "bg-white/10 text-zinc-400"
                                  }`}>
                                    {cat.issueCount}
                                  </span>
                                )}
                              </TabsTrigger>
                            );
                          })}
                        </TabsList>
                      </div>

                      {/* Tab panels */}
                      {report.categories.map((cat) => (
                        <TabsContent key={cat.name} value={cat.name} className="p-4 m-0 flex-none">
                          <ScrollArea className="max-h-[480px]">
                            <div className="space-y-3 pr-2">
                              <p className="text-sm text-zinc-400 pb-2 border-b border-white/5 flex items-start gap-1.5">
                                {cat.safe
                                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                  : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                }
                                {cat.summary}
                              </p>
                              {cat.issues.length === 0 ? (
                                <div className="flex items-center gap-2 text-emerald-400 text-sm py-4">
                                  <CheckCircle2 className="w-5 h-5" />
                                  No {cat.name} issues found
                                </div>
                              ) : (
                                cat.issues.map((issue, i) => (
                                  <IssueCard key={i} issue={issue} />
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </div>

                  {/* Known limitations */}
                  <div className="flex items-start gap-2 text-xs text-zinc-500 bg-white/[0.02] border border-white/10 rounded-xl p-3">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-zinc-600" />
                    <p>{report.knownLimitations}</p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
