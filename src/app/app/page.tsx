"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bug,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  Cpu,
  DollarSign,
  Eye,
  EyeOff,
  FlaskConical,
  Globe,
  History,
  Key,
  Layers,
  Lightbulb,
  Lock,
  RefreshCw,
  RotateCcw,
  Route,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = "critical" | "high" | "medium" | "low";

interface Issue {
  line?: number;
  title: string;
  description: string;
  severity: Severity;
  fix: string;
  sandboxVerified?: boolean;
  executionOutput?: string;
  citations?: string[];
  cve?: string;
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
  otariVerificationSummary?: {
    sandboxVerifiedCount: number;
    cveCheckedCount: number;
    guardrailsPassed: boolean;
  };
}

interface Metrics {
  latencyMs: number;
  language: string;
  modelsUsed: Array<{ name: string; role: string; params: string }>;
  tier: string;
  estimatedCost: string;
}

interface OtariTelemetry {
  authTier?: "byok" | "server_otari" | "failover_gateway";
  gatewayUrl?: string;
  modelsByRole?: {
    router: string;
    specialists: Array<{
      category: string;
      model: string;
      fallback?: boolean;
      tools?: string[];
    }>;
    synthesizer: string;
  };
  fallbacksTriggered?: number;
  codeExecutionRuns?: Array<{ snippet: string; output: string }>;
  webSearchQueries?: string[];
  guardrailsStatus?: {
    passed: boolean;
    redactedCount: number;
    actions?: string[];
  };
  budget?: {
    analysisCostUsd: number;
    userSpentUsd: number;
    userLimitUsd: number;
  };
}

type PipelineStep =
  | "idle"
  | "routing"
  | "analyzing"
  | "synthesizing"
  | "done"
  | "error";

interface StepEvent {
  step: PipelineStep;
  message: string;
  model?: string;
  categories?: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  Severity,
  { color: string; bg: string; label: string }
> = {
  critical: {
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    label: "CRITICAL",
  },
  high: {
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    label: "HIGH",
  },
  medium: {
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    label: "MEDIUM",
  },
  low: {
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    label: "LOW",
  },
};

const CATEGORY_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
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
  {
    id: "routing",
    label: "Guardrails & Route",
    model: "alibaba/qwen3.5-9b",
    icon: Route,
  },
  {
    id: "retrieving",
    label: "RAG Retrieval",
    model: "alibaba/qwen3-embedding-0.6b",
    icon: Search,
  },
  {
    id: "analyzing",
    label: "Specialists + Tools",
    model: "alibaba/qwen3-32b",
    icon: FlaskConical,
  },
  {
    id: "synthesizing",
    label: "Otari Synthesis",
    model: "alibaba/qwen3.6-35b-a3b",
    icon: Layers,
  },
  { id: "done", label: "Complete", model: "", icon: CheckCircle2 },
];

function getStepStatus(
  stepId: string,
  currentStep: PipelineStep,
  completedSteps: string[],
) {
  if (completedSteps.includes(stepId)) return "done";
  if (
    currentStep === stepId ||
    (stepId === "retrieving" && currentStep === "analyzing")
  )
    return "active";
  if (currentStep === "done") return "done";
  return "pending";
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function IssueCard({
  issue,
  fallbackTriggered = false,
}: {
  issue: Issue;
  fallbackTriggered?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[issue.severity];

  const hasSecretOrInjection =
    issue.title.toLowerCase().includes("secret") ||
    issue.title.toLowerCase().includes("key") ||
    issue.title.toLowerCase().includes("injection") ||
    issue.description.toLowerCase().includes("guardrail") ||
    issue.description.toLowerCase().includes("redacted");

  return (
    <motion.div
      layout
      className={`border rounded-xl p-4 cursor-pointer ${cfg.bg} hover:border-white/20 transition-colors`}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start gap-3">
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono mt-0.5 shrink-0 ${cfg.bg} ${cfg.color}`}
        >
          {cfg.label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {issue.line && (
              <span className="text-xs font-mono text-zinc-500">
                L{issue.line}
              </span>
            )}
            <p className="font-medium text-sm text-white truncate">
              {issue.title}
            </p>
          </div>

          {/* Otari Capability Badges */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {issue.sandboxVerified && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                <Terminal className="w-3 h-3 text-emerald-400" />
                Sandbox Verified via Otari Code Exec
              </span>
            )}
            {issue.citations?.length || issue.cve ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                <Globe className="w-3 h-3 text-cyan-400" />
                {issue.cve
                  ? `${issue.cve} Checked via Otari Web Search`
                  : "CVE Checked via Otari Web Search"}
              </span>
            ) : null}
            {fallbackTriggered && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-violet-500/15 border border-violet-500/30 text-violet-300">
                <Cpu className="w-3 h-3 text-violet-400" />
                Fallback Model Used
              </span>
            )}
            {hasSecretOrInjection && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 border border-amber-500/30 text-amber-300">
                <ShieldCheck className="w-3 h-3 text-amber-400" />
                Guardrail Redacted
              </span>
            )}
          </div>

          <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2">
            {issue.description}
          </p>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-zinc-500 flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {issue.description}
              </p>

              {/* Sandbox verification details */}
              {issue.executionOutput && (
                <div className="bg-black/50 border border-emerald-500/25 rounded-lg p-3">
                  <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400 mb-1">
                    <span className="flex items-center gap-1">
                      <Terminal className="w-3.5 h-3.5" />
                      Otari Sandbox Code Execution Output
                    </span>
                    <span className="text-zinc-500 text-[10px]">
                      Isolated MicroVM
                    </span>
                  </div>
                  <pre className="text-xs font-mono text-emerald-200/90 whitespace-pre-wrap break-all">
                    {issue.executionOutput}
                  </pre>
                </div>
              )}

              {/* Citations if available */}
              {issue.citations && issue.citations.length > 0 && (
                <div className="bg-black/40 border border-cyan-500/25 rounded-lg p-3">
                  <p className="text-[11px] font-mono text-cyan-400 mb-1.5 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" />
                    Otari Web Search Citations & CVE Advisories:
                  </p>
                  <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside">
                    {issue.citations.map((c, i) => (
                      <li key={i} className="truncate font-mono text-[11px]">
                        <a
                          href={
                            c.startsWith("http")
                              ? c
                              : `https://cve.mitre.org/cgi-bin/cvename.cgi?name=${c}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-300 hover:underline inline-flex items-center gap-1"
                        >
                          {c}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                <p className="text-xs font-medium text-emerald-400 mb-1 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" />
                  Fix
                </p>
                <p className="text-xs text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap">
                  {issue.fix}
                </p>
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

  // Otari Feature Controls State
  const [featureModelPreset, setFeatureModelPreset] = useState<
    "default" | "fallback"
  >("default");
  const [sandboxExecEnabled, setSandboxExecEnabled] = useState(true);
  const [cveSearchEnabled, setCveSearchEnabled] = useState(true);
  const [guardrailsEnabled, setGuardrailsEnabled] = useState(true);
  const [userSpend, setUserSpend] = useState(0.0);
  const [userLimit, setUserLimit] = useState(0.5);
  const [budgetExceededAlert, setBudgetExceededAlert] = useState<string | null>(
    null,
  );
  const [otariTelemetry, setOtariTelemetry] = useState<OtariTelemetry | null>(
    null,
  );
  const [guardrailAlerts, setGuardrailAlerts] = useState<string[]>([]);

  // ─── BYOK (Bring Your Own Key) State ────────────────────────
  const [byokModalOpen, setByokModalOpen] = useState(false);
  const [byokApiKey, setByokApiKey] = useState("");
  const [byokBaseUrl, setByokBaseUrl] = useState("https://api.otari.ai/v1");
  const [showKey, setShowKey] = useState(false);
  const [isByokActive, setIsByokActive] = useState(false);
  const [byokTestStatus, setByokTestStatus] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("tinyflow_byok_api_key") || "";
      const savedUrl =
        localStorage.getItem("tinyflow_byok_base_url") ||
        "https://api.otari.ai/v1";
      if (savedKey) {
        setByokApiKey(savedKey);
        setIsByokActive(true);
      }
      if (savedUrl) {
        setByokBaseUrl(savedUrl);
      }
    }
  }, []);

  const handleSaveByok = () => {
    if (typeof window !== "undefined") {
      if (byokApiKey.trim()) {
        localStorage.setItem("tinyflow_byok_api_key", byokApiKey.trim());
        localStorage.setItem("tinyflow_byok_base_url", byokBaseUrl.trim());
        setIsByokActive(true);
      } else {
        localStorage.removeItem("tinyflow_byok_api_key");
        localStorage.removeItem("tinyflow_byok_base_url");
        setIsByokActive(false);
      }
    }
    setByokModalOpen(false);
  };

  const handleClearByok = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("tinyflow_byok_api_key");
      localStorage.removeItem("tinyflow_byok_base_url");
    }
    setByokApiKey("");
    setByokBaseUrl("https://api.otari.ai/v1");
    setIsByokActive(false);
    setByokTestStatus(null);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setByokTestStatus(null);
    try {
      const headers: Record<string, string> = {};
      if (byokApiKey) headers["x-otari-api-key"] = byokApiKey.trim();
      if (byokBaseUrl) headers["x-otari-base-url"] = byokBaseUrl.trim();

      const res = await fetch("/api/models", { headers });
      const data = await res.json();
      if (res.ok && data.status === "connected") {
        setByokTestStatus(
          `Connected! Found ${data.modelsCount} models on ${data.gateway}.`,
        );
      } else if (res.ok) {
        setByokTestStatus(
          `Gateway reachable (${data.modelsCount} models in open-weight catalog).`,
        );
      } else {
        setByokTestStatus(
          `Gateway error: ${data.error || "Could not verify credentials"}`,
        );
      }
    } catch (err: unknown) {
      setByokTestStatus(
        `Connection error: ${(err as Error)?.message || String(err)}`,
      );
    } finally {
      setTestingConnection(false);
    }
  };

  const handleAnalyze = useCallback(async () => {
    if (!code.trim()) return;
    setReport(null);
    setMetrics(null);
    setError(null);
    setBudgetExceededAlert(null);
    setGuardrailAlerts([]);
    setCompletedSteps([]);
    setPipelineStep("routing");
    setStepMessage("Initializing Mozilla Otari AI Gateway & Guardrails check…");

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-user-id": "demo-user-1",
        "x-user-budget-limit": (userLimit || 0.5).toString(),
      };
      if (byokApiKey) headers["x-otari-api-key"] = byokApiKey.trim();
      if (byokBaseUrl) headers["x-otari-base-url"] = byokBaseUrl.trim();

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers,
        body: JSON.stringify({
          code,
          userId: "demo-user-1",
          userBudgetLimit: userLimit || 0.5,
          testFallbackMode: featureModelPreset === "fallback",
          apiKey: byokApiKey || undefined,
          baseUrl: byokBaseUrl || undefined,
        }),
      });

      if (res.status === 429) {
        const errJson = await res.json().catch(() => ({}));
        const msg =
          errJson.message ||
          `Per-User Budget Exceeded ($${userLimit.toFixed(2)} limit reached). Otari Gateway locked access.`;
        setBudgetExceededAlert(msg);
        setError(msg);
        setPipelineStep("error");
        return;
      }

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
                if (data.guardrailTriggered && data.guardrailActions) {
                  setGuardrailAlerts(data.guardrailActions);
                }
                if (data.otari_telemetry) {
                  setOtariTelemetry((prev) => ({
                    ...prev,
                    ...data.otari_telemetry,
                  }));
                }
              } else if (currentEvent === "specialists_done") {
                setCompletedSteps((p) => [...p, "analyzing"]);
                if (data.otari_telemetry) {
                  setOtariTelemetry((prev) => ({
                    ...prev,
                    ...data.otari_telemetry,
                  }));
                }
              } else if (currentEvent === "done") {
                setReport(data.report as Report);
                setMetrics(data.metrics as Metrics);
                if (data.otari_telemetry) {
                  setOtariTelemetry(data.otari_telemetry as OtariTelemetry);
                  if (data.otari_telemetry.budget?.userSpentUsd != null) {
                    setUserSpend(
                      Number(data.otari_telemetry.budget.userSpentUsd),
                    );
                  } else if (data.metrics?.costUsd != null) {
                    setUserSpend((prev) =>
                      Number((prev + data.metrics.costUsd).toFixed(4)),
                    );
                  }
                  if (data.otari_telemetry.budget?.userLimitUsd != null) {
                    setUserLimit(data.otari_telemetry.budget.userLimitUsd);
                  }
                } else if (data.metrics?.costUsd != null) {
                  setUserSpend((prev) =>
                    Number((prev + data.metrics.costUsd).toFixed(4)),
                  );
                }
                setActiveCategory(
                  data.report.categories[0]?.name ?? "security",
                );
                setPipelineStep("done");
                setCompletedSteps([
                  "routing",
                  "retrieving",
                  "analyzing",
                  "synthesizing",
                  "done",
                ]);
                setStepMessage(
                  "Analysis complete via Mozilla Otari AI Gateway!",
                );
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
  }, [code, featureModelPreset, userLimit, byokApiKey, byokBaseUrl]);

  const handleNewAnalysis = useCallback(() => {
    setReport(null);
    setMetrics(null);
    setError(null);
    setBudgetExceededAlert(null);
    setGuardrailAlerts([]);
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
  const isRunning =
    pipelineStep !== "idle" &&
    pipelineStep !== "done" &&
    pipelineStep !== "error";
  const pipelineProgress =
    (completedSteps.length / PIPELINE_STEPS.length) * 100;

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
              <Link
                href="/"
                className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
              <Separator orientation="vertical" className="h-4 bg-white/10" />
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                </div>
                <span className="font-semibold text-white">TinyFlow AI</span>
                <span className="text-xs text-indigo-400 hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                  Powered by Mozilla Otari.ai
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* BYOK Config Trigger Button */}
              <button
                type="button"
                onClick={() => setByokModalOpen(true)}
                className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border bg-white/5 hover:bg-white/10 text-white transition-colors border-white/10 hover:border-indigo-500/40"
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">BYOK Config</span>
                {isByokActive ? (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    BYOK Active
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-500 hidden md:inline">
                    Default
                  </span>
                )}
              </button>

              <Link
                href="/app/history"
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10"
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:block">History</span>
              </Link>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Otari Online
                </span>
              </div>
            </div>
          </header>

          {/* ── Otari Gateway Feature Controls & Live Telemetry Bar ── */}
          <div className="bg-gradient-to-r from-indigo-950/40 via-violet-950/20 to-black/40 border border-indigo-500/20 rounded-2xl p-4 shadow-xl backdrop-blur-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Otari Gateway Live Controls
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  (MozFest 2026 Rubric Features)
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-zinc-400 font-mono">
                  Endpoint:
                </span>
                <span className="text-[11px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 truncate max-w-[260px]">
                  {byokBaseUrl}
                </span>
                {isByokActive && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Using Custom BYOK Key
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
              {/* Control 1: Model Preset & Fallback Mode with Clean Wrapping */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-zinc-400 font-medium">
                      Model Routing
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Open-Weight
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1 text-[10px] font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      Router: qwen3.5-9b
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      Spec: qwen3-32b
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
                      Synth: qwen3.6-35b
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFeatureModelPreset("default")}
                    className={`flex-1 text-[10px] py-1 px-2 rounded-lg font-mono transition-colors border ${
                      featureModelPreset === "default"
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-white/5 text-zinc-400 border-white/10 hover:text-white"
                    }`}
                  >
                    Primary Chain
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeatureModelPreset("fallback")}
                    className={`flex-1 text-[10px] py-1 px-2 rounded-lg font-mono transition-colors border ${
                      featureModelPreset === "fallback"
                        ? "bg-amber-600 text-white border-amber-500"
                        : "bg-white/5 text-zinc-400 border-white/10 hover:text-white"
                    }`}
                  >
                    Force Fallback
                  </button>
                </div>
              </div>

              {/* Control 2: Sandbox Code Execution */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-zinc-400 font-medium">
                      Otari Code Exec
                    </span>
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-xs text-white">Sandbox Verification</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    MicroVM execution for loop & logic bugs
                  </p>
                </div>
                <div className="mt-2.5">
                  <button
                    type="button"
                    onClick={() => setSandboxExecEnabled(!sandboxExecEnabled)}
                    className={`w-full text-[10px] py-1 px-2 rounded-lg font-mono transition-colors border flex items-center justify-center gap-1.5 ${
                      sandboxExecEnabled
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-white/5 text-zinc-500 border-white/10"
                    }`}
                  >
                    <Check className="w-3 h-3" />
                    {sandboxExecEnabled
                      ? "Tool Enabled: code_execution"
                      : "Disabled"}
                  </button>
                </div>
              </div>

              {/* Control 3: Live CVE Web Search & Guardrails */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-zinc-400 font-medium">
                      CVE Search & Guardrails
                    </span>
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <p className="text-xs text-white">Live Advisories & Safety</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Web search tools + secret redaction
                  </p>
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCveSearchEnabled(!cveSearchEnabled)}
                    className={`flex-1 text-[10px] py-1 px-1 rounded-lg font-mono transition-colors border ${
                      cveSearchEnabled
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                        : "bg-white/5 text-zinc-500 border-white/10"
                    }`}
                  >
                    web_search
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuardrailsEnabled(!guardrailsEnabled)}
                    className={`flex-1 text-[10px] py-1 px-1 rounded-lg font-mono transition-colors border ${
                      guardrailsEnabled
                        ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
                        : "bg-white/5 text-zinc-500 border-white/10"
                    }`}
                  >
                    Guardrails
                  </button>
                </div>
              </div>

              {/* Control 4: Per-User Budget Simulator with Fixed Initial Cap */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-zinc-400 font-medium">
                      Per-User Budget Cap
                    </span>
                    <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs font-mono font-bold text-white">
                      ${userSpend.toFixed(4)}
                    </p>
                    <span className="text-[10px] font-mono text-zinc-400">
                      Cap: ${(userLimit || 0.5).toFixed(2)}
                    </span>
                  </div>
                  {/* Budget bar */}
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        userSpend >= (userLimit || 0.5)
                          ? "bg-red-500"
                          : "bg-emerald-400"
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          (userSpend / Math.max(userLimit || 0.5, 0.001)) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setUserLimit(0.001);
                    }}
                    className="flex-1 text-[10px] py-1 px-1.5 rounded-lg font-mono transition-colors border bg-red-500/10 text-red-300 border-red-500/20 hover:bg-red-500/20"
                    title="Simulate 429 Rate Limit / Budget Cap"
                  >
                    Test 429 Lock
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUserLimit(0.5);
                      setBudgetExceededAlert(null);
                    }}
                    className="flex-1 text-[10px] py-1 px-1.5 rounded-lg font-mono transition-colors border bg-white/5 text-zinc-300 border-white/10 hover:text-white"
                  >
                    Reset ($0.50)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* BYOK Configuration Modal */}
          <AnimatePresence>
            {byokModalOpen && (
              <div
                role="dialog"
                aria-modal="true"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setByokModalOpen(false);
                }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-[#121217] border border-white/15 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <Key className="w-5 h-5 text-amber-400" />
                      <div>
                        <h3 className="font-semibold text-white text-base">
                          Judge-Proof BYOK & Gateway Config
                        </h3>
                        <p className="text-xs text-zinc-400">
                          Bring Your Own Key or switch between gateways
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Close modal"
                      onClick={() => setByokModalOpen(false)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-zinc-300 block mb-1">
                        Otari API Key (or OpenRouter Key)
                      </label>
                      <div className="relative">
                        <input
                          type={showKey ? "text" : "password"}
                          value={byokApiKey}
                          onChange={(e) => setByokApiKey(e.target.value)}
                          placeholder="otari_... or sk-..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-white transition-colors"
                        >
                          {showKey ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        Saved only in your browser&apos;s localStorage. Never
                        sent to third parties.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-zinc-300 block mb-1">
                        Gateway Base URL
                      </label>
                      <input
                        type="text"
                        value={byokBaseUrl}
                        onChange={(e) => setByokBaseUrl(e.target.value)}
                        placeholder="https://api.otari.ai/v1"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500"
                      />
                      <div className="flex gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setByokBaseUrl("https://api.otari.ai/v1")
                          }
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                        >
                          Otari (api.otari.ai/v1)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setByokBaseUrl("https://openrouter.ai/api/v1")
                          }
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
                        >
                          OpenRouter Failover
                        </button>
                      </div>
                    </div>

                    {byokTestStatus && (
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 text-xs font-mono text-zinc-300">
                        {byokTestStatus}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testingConnection}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-xs font-medium transition-colors border border-white/10"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${testingConnection ? "animate-spin" : ""}`}
                      />
                      Test Connection
                    </button>

                    <div className="flex items-center gap-2">
                      {isByokActive && (
                        <button
                          type="button"
                          onClick={handleClearByok}
                          className="px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
                        >
                          Clear Key
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveByok}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors shadow-lg shadow-indigo-950/50"
                      >
                        Save Configuration
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Budget 429 Alert Banner */}
          {budgetExceededAlert && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3"
            >
              <div className="p-2 rounded-xl bg-red-500/20 text-red-400 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono text-red-400 uppercase">
                    HTTP 429: Otari Per-User Budget Limit Enforced
                  </span>
                </div>
                <p className="text-xs text-zinc-300 mt-1">
                  {budgetExceededAlert}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Mozilla Otari AI Gateway tracks cumulative token costs per
                  client fingerprint and rejects excessive inference requests to
                  protect infrastructure budgets.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUserLimit(0.5);
                  setBudgetExceededAlert(null);
                }}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors shrink-0"
              >
                Reset User Budget
              </button>
            </motion.div>
          )}

          {/* Guardrails Intervention Banner */}
          {guardrailAlerts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3"
            >
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold font-mono text-amber-400 uppercase">
                  Otari Guardrails Triggered & Neutralized Threats
                </span>
                <p className="text-xs text-zinc-300 mt-1">
                  The Otari Gateway intercepted dangerous payloads before
                  dispatching to downstream specialist agents:
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {guardrailAlerts.map((action, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    >
                      {action}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

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
                    <span className="text-xs text-zinc-500 font-mono ml-2">
                      code-to-review.js
                    </span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger
                      onClick={copyCode}
                      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors bg-transparent border-0 cursor-pointer"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
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
                  <span className="text-xs text-zinc-600 font-mono">
                    {code.length} chars
                  </span>
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    Otari Distributed Pipeline
                  </h3>
                  <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    SSE Realtime
                  </span>
                </div>

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
                    const status = getStepStatus(
                      step.id,
                      pipelineStep,
                      completedSteps,
                    );
                    const StepIcon = step.icon;
                    return (
                      <div
                        key={step.id}
                        className="flex items-center gap-3 py-1"
                      >
                        {/* Icon + connector */}
                        <div className="relative flex flex-col items-center">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border transition-all ${
                              status === "done"
                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                : status === "active"
                                  ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400 animate-pulse"
                                  : "bg-white/5 border-white/10 text-zinc-600"
                            }`}
                          >
                            {status === "done" ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <StepIcon className="w-3.5 h-3.5" />
                            )}
                          </div>
                          {i < PIPELINE_STEPS.length - 1 && (
                            <div
                              className={`w-px h-4 mt-1 transition-colors ${
                                status === "done"
                                  ? "bg-emerald-500/30"
                                  : "bg-white/5"
                              }`}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pb-3">
                          <p
                            className={`text-sm font-medium ${status === "pending" ? "text-zinc-600" : "text-white"}`}
                          >
                            {step.label}
                          </p>
                          {step.model && (
                            <p
                              className={`text-xs font-mono ${status === "pending" ? "text-zinc-700" : "text-zinc-500"}`}
                            >
                              {step.model}
                            </p>
                          )}
                        </div>
                        {status === "active" && (
                          <div className="flex gap-1 pb-3">
                            {[0, 1, 2].map((j) => (
                              <div
                                key={j}
                                className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                                style={{ animationDelay: `${j * 100}ms` }}
                              />
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
                    <p className="text-xs text-indigo-300 mt-3 flex items-center gap-1.5 font-mono">
                      <Sparkles className="w-3.5 h-3.5" />
                      {stepMessage}
                    </p>
                  </>
                )}

                {error && !budgetExceededAlert && (
                  <>
                    <Separator className="bg-white/5 mt-2" />
                    <p className="text-xs text-red-400 mt-3 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {error}
                    </p>
                  </>
                )}
              </div>

              {/* Otari Performance & Gateway Receipts */}
              {metrics && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/[0.02] border border-white/10 rounded-2xl p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                      Otari Gateway Receipts
                    </h3>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                      Audited by Otari Telemetry
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-black/30 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-zinc-500 text-xs mb-1">
                        <Clock className="w-3 h-3" /> Latency
                      </div>
                      <p className="text-white font-mono font-semibold">
                        {(metrics.latencyMs / 1000).toFixed(1)}s
                      </p>
                    </div>
                    <div className="bg-black/30 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-zinc-500 text-xs mb-1">
                        <DollarSign className="w-3 h-3" /> Cost (Open-Weight)
                      </div>
                      <p className="text-emerald-400 font-mono font-semibold">
                        {metrics.estimatedCost}
                      </p>
                    </div>
                  </div>

                  {/* Otari Features Telemetry breakdown */}
                  {otariTelemetry && (
                    <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 mb-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 flex items-center gap-1.5">
                          <Terminal className="w-3 h-3 text-emerald-400" />
                          Sandbox Executions:
                        </span>
                        <span className="font-mono text-white">
                          {otariTelemetry.codeExecutionRuns?.length ?? 0}{" "}
                          verified
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 flex items-center gap-1.5">
                          <Globe className="w-3 h-3 text-cyan-400" />
                          Live CVE Queries:
                        </span>
                        <span className="font-mono text-white">
                          {otariTelemetry.webSearchQueries?.length ?? 0} checked
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 flex items-center gap-1.5">
                          <ShieldCheck className="w-3 h-3 text-violet-400" />
                          Guardrails Status:
                        </span>
                        <span className="font-mono text-emerald-400">
                          {otariTelemetry.guardrailsStatus?.redactedCount
                            ? `${otariTelemetry.guardrailsStatus.redactedCount} threats redacted`
                            : "Passed (100% clean)"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 flex items-center gap-1.5">
                          <Cpu className="w-3 h-3 text-amber-400" />
                          Fallback Failovers:
                        </span>
                        <span className="font-mono text-amber-300">
                          {otariTelemetry.fallbacksTriggered ?? 0} triggered
                        </span>
                      </div>
                      {otariTelemetry.authTier && (
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                          <span className="text-zinc-400 flex items-center gap-1.5">
                            <Key className="w-3 h-3 text-indigo-400" />
                            Auth Gateway Tier:
                          </span>
                          <span className="font-mono text-indigo-300 uppercase">
                            {otariTelemetry.authTier}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    {metrics.modelsUsed.map((m) => (
                      <div
                        key={m.name}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Cpu className="w-3 h-3 text-zinc-500" />
                          <span className="text-zinc-400">{m.role}</span>
                        </div>
                        <span className="font-mono text-white">
                          {m.params} params
                        </span>
                      </div>
                    ))}
                    <Separator className="bg-white/5" />
                    <div className="flex items-center justify-between text-xs pt-0.5">
                      <span className="text-zinc-500">Tier</span>
                      <span className="text-amber-400 font-mono">
                        {metrics.tier}
                      </span>
                    </div>
                  </div>
                  <Separator className="bg-white/5 mt-3" />
                  <div className="mt-3">
                    <Link
                      href="/app/history"
                      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-indigo-400 transition-colors"
                    >
                      <History className="w-3 h-3" />
                      View all past analyses in history →
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
                  <h2 className="text-xl font-semibold text-white mb-2">
                    Ready for Multi-Model Analysis
                  </h2>
                  <p className="text-sm text-zinc-400 max-w-sm leading-relaxed">
                    Paste your code on the left and click Analyze. Mozilla Otari
                    AI Gateway routes through Qwen 3.5 9B, Qwen 3 32B, and Qwen
                    3.6 35B with microVM runtime verification.
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-xs">
                    {[
                      {
                        icon: <Shield className="w-4 h-4" />,
                        label: "Security + CVE",
                        color: "text-red-400",
                      },
                      {
                        icon: <Bug className="w-4 h-4" />,
                        label: "Bugs + Sandbox",
                        color: "text-orange-400",
                      },
                      {
                        icon: <Zap className="w-4 h-4" />,
                        label: "Performance",
                        color: "text-yellow-400",
                      },
                      {
                        icon: <Code2 className="w-4 h-4" />,
                        label: "Code Style",
                        color: "text-blue-400",
                      },
                    ].map((c) => (
                      <div
                        key={c.label}
                        className={`flex items-center gap-2 text-xs bg-white/[0.02] border border-white/[0.08] rounded-lg px-3 py-2 ${c.color}`}
                      >
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
                  <p className="text-sm text-zinc-500 mt-2 font-mono">
                    Otari Gateway · Open-weight model inference & tool
                    execution…
                  </p>
                </div>
              )}

              {report && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-4"
                >
                  {/* Overall risk banner */}
                  <div
                    className={`rounded-2xl p-5 border ${
                      report.overallRisk === "clean"
                        ? "bg-emerald-500/10 border-emerald-500/20"
                        : report.overallRisk === "critical"
                          ? "bg-red-500/10 border-red-500/20"
                          : report.overallRisk === "high"
                            ? "bg-orange-500/10 border-orange-500/20"
                            : "bg-yellow-500/10 border-yellow-500/20"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle
                        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${riskCfg?.color}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-xs font-bold font-mono ${riskCfg?.color}`}
                          >
                            {riskCfg?.label.toUpperCase()}
                          </span>
                          <span className="text-xs text-zinc-500">
                            · {report.totalIssues} issues found
                          </span>
                        </div>
                        <p className="text-white font-medium text-sm">
                          {report.headline}
                        </p>
                        <p className="text-xs text-zinc-400 mt-1.5 flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          Top priority:{" "}
                          <span className="text-white ml-0.5">
                            {report.topPriority}
                          </span>
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
                  <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-y-auto">
                    <Tabs
                      value={activeCategory}
                      onValueChange={setActiveCategory}
                      className="gap-0"
                    >
                      {/* Tab list */}
                      <div className="border-b border-white/5 px-2 pt-2 pb-0 overflow-x-auto">
                        <TabsList
                          variant="line"
                          className="h-auto gap-0.5 flex-nowrap pb-2 w-max min-w-full justify-start"
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
                                  <span
                                    className={`text-[10px] rounded-full px-1.5 py-0 font-mono leading-4 ${
                                      isActive
                                        ? "bg-indigo-500/30 text-indigo-300"
                                        : "bg-white/10 text-zinc-400"
                                    }`}
                                  >
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
                        <TabsContent
                          key={cat.name}
                          value={cat.name}
                          className="p-4 m-0 flex-none"
                        >
                          <ScrollArea className="max-h-[480px]">
                            <div className="space-y-3 pr-2">
                              <p className="text-sm text-zinc-400 pb-2 border-b border-white/5 flex items-start gap-1.5">
                                {cat.safe ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                ) : (
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                )}
                                {cat.summary}
                              </p>
                              {cat.issues.length === 0 ? (
                                <div className="flex items-center gap-2 text-emerald-400 text-sm py-4">
                                  <CheckCircle2 className="w-5 h-5" />
                                  No {cat.name} issues found
                                </div>
                              ) : (
                                cat.issues.map((issue, i) => (
                                  <IssueCard
                                    key={i}
                                    issue={issue}
                                    fallbackTriggered={Boolean(
                                      otariTelemetry?.fallbacksTriggered &&
                                        otariTelemetry.fallbacksTriggered > 0,
                                    )}
                                  />
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </div>

                  {/* Synthesis / Pipeline Status */}
                  {report.knownLimitations
                    .toLowerCase()
                    .includes("fallback active") ? (
                    <div className="flex items-start gap-2 text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-400" />
                      <p>{report.knownLimitations}</p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-xs text-emerald-400/90 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-400" />
                      <div>
                        <span className="font-semibold text-emerald-300 font-mono block">
                          Synthesized by Otari Open-Weight Pipeline
                        </span>
                        <p className="text-zinc-400 mt-0.5">
                          {report.knownLimitations}
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
