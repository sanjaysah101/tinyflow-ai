"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  Cpu,
  DollarSign,
  Globe,
  RefreshCw,
  ScanSearch,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LogoIcon } from "@/components/logo";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────

interface HistoryReport {
  overallRisk: "critical" | "high" | "medium" | "low" | "clean";
  headline: string;
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  topPriority: string;
  otariVerificationSummary?: {
    sandboxVerifiedCount: number;
    cveCheckedCount: number;
    guardrailsPassed: boolean;
  };
  otari_telemetry?: {
    authTier?: "byok" | "server_otari" | "failover_gateway" | string;
    gatewayUrl?: string;
    modelsByRole?: {
      router?: string;
      specialists?: string[];
      synthesizer?: string;
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
  };
}

interface HistoryItem {
  id: number;
  createdAt: string | null;
  codeSnippet: string | null;
  language: string | null;
  report: HistoryReport | null;
  modelsUsed: string[] | null;
  totalTokens: number | null;
  latencyMs: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Unknown";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const RISK_STYLE: Record<
  string,
  { label: string; color: string; bg: string; dot: string }
> = {
  critical: {
    label: "Critical",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/25",
    dot: "bg-red-400",
  },
  high: {
    label: "High",
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/25",
    dot: "bg-orange-400",
  },
  medium: {
    label: "Medium",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/25",
    dot: "bg-yellow-400",
  },
  low: {
    label: "Low",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/25",
    dot: "bg-blue-400",
  },
  clean: {
    label: "Clean",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/25",
    dot: "bg-emerald-400",
  },
};

function RiskBadge({ risk }: { risk: string }) {
  const cfg = RISK_STYLE[risk] ?? RISK_STYLE.low;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function IssuePill({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  if (count === 0) return null;
  return (
    <span
      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${color}`}
    >
      {count} {label}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────

interface StatItem {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}

function StatCard({ stat }: { stat: StatItem }) {
  const Icon = stat.icon;
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 text-center">
      <div
        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mb-2 ${stat.bg}`}
      >
        <Icon className={`w-4 h-4 ${stat.color}`} />
      </div>
      <p className="text-2xl font-bold text-white font-mono">{stat.value}</p>
      <p className="text-[10px] text-zinc-600 mt-0.5 uppercase tracking-wider font-mono">
        {stat.label}
      </p>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24 bg-white/5" />
        <Skeleton className="h-5 w-16 rounded-full bg-white/5" />
      </div>
      <Skeleton className="h-3 w-3/4 bg-white/5" />
      <div className="flex gap-2">
        <Skeleton className="h-4 w-12 rounded bg-white/5" />
        <Skeleton className="h-4 w-12 rounded bg-white/5" />
      </div>
    </div>
  );
}

// ─── Analysis Card with Otari Metrics ─────────────────────────

function AnalysisCard({ item, index }: { item: HistoryItem; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const r = item.report;

  // Extract Otari Telemetry & Metrics
  const telemetry = r?.otari_telemetry;
  const sandboxRuns =
    telemetry?.codeExecutionRuns?.length ??
    r?.otariVerificationSummary?.sandboxVerifiedCount ??
    0;
  const webSearches =
    telemetry?.webSearchQueries?.length ??
    r?.otariVerificationSummary?.cveCheckedCount ??
    0;
  const fallbacksCount = telemetry?.fallbacksTriggered ?? 0;
  const guardrailRedacted = telemetry?.guardrailsStatus?.redactedCount ?? 0;
  const costUsd = telemetry?.budget?.analysisCostUsd ?? 0.0;

  // Determine models used
  const routerModel =
    telemetry?.modelsByRole?.router ??
    item.modelsUsed?.[0] ??
    "alibaba/qwen3.5-9b";
  const specialistModel =
    (typeof telemetry?.modelsByRole?.specialists?.[0] === "object"
      ? (telemetry?.modelsByRole?.specialists?.[0] as { model?: string })?.model
      : telemetry?.modelsByRole?.specialists?.[0]) ??
    item.modelsUsed?.[1] ??
    "alibaba/qwen3-32b";
  const synthesizerModel =
    telemetry?.modelsByRole?.synthesizer ??
    item.modelsUsed?.[2] ??
    "alibaba/qwen3.6-35b-a3b";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white/[0.02] border border-white/10 hover:border-white/20 rounded-2xl p-5 transition-colors group"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {item.language && (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
              <Code2 className="w-3 h-3" />
              {item.language}
            </span>
          )}
          {r && <RiskBadge risk={r.overallRisk} />}
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            Otari Gateway Run #{item.id}
          </span>
          {telemetry?.authTier && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 uppercase">
              {telemetry.authTier}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-600 shrink-0 font-mono">
          <Clock className="w-3 h-3" />
          <span>{timeAgo(item.createdAt)}</span>
        </div>
      </div>

      {/* Headline */}
      {r?.headline && (
        <p className="text-sm text-zinc-300 leading-snug mb-3 line-clamp-2">
          {r.headline}
        </p>
      )}

      {/* Otari Gateway Capability Badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.03] border border-white/10 text-zinc-300">
          <Terminal className="w-3 h-3 text-emerald-400" />
          {sandboxRuns} Sandbox Runs
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.03] border border-white/10 text-zinc-300">
          <Globe className="w-3 h-3 text-cyan-400" />
          {webSearches} CVE Checks
        </span>
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${
            fallbacksCount > 0
              ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
              : "bg-white/[0.03] border-white/10 text-zinc-300"
          }`}
        >
          <Cpu className="w-3 h-3 text-amber-400" />
          {fallbacksCount > 0
            ? `${fallbacksCount} Fallback Used`
            : "Primary Chain"}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.03] border border-white/10 text-zinc-300">
          <ShieldCheck className="w-3 h-3 text-violet-400" />
          {guardrailRedacted > 0
            ? `${guardrailRedacted} Guardrail Redactions`
            : "Guardrails Passed"}
        </span>
        {costUsd > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            <DollarSign className="w-3 h-3" />${costUsd.toFixed(4)}
          </span>
        )}
      </div>

      {/* Issue counts */}
      {r && r.totalIssues > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <IssuePill
            count={r.criticalCount}
            label="critical"
            color="bg-red-500/10 border-red-500/20 text-red-400"
          />
          <IssuePill
            count={r.highCount}
            label="high"
            color="bg-orange-500/10 border-orange-500/20 text-orange-400"
          />
          <IssuePill
            count={r.mediumCount}
            label="medium"
            color="bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
          />
          <IssuePill
            count={r.lowCount}
            label="low"
            color="bg-blue-500/10 border-blue-500/20 text-blue-400"
          />
        </div>
      )}

      {r?.overallRisk === "clean" && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 mb-3">
          <CheckCircle2 className="w-3.5 h-3.5" />
          No issues found
        </div>
      )}

      {/* Bottom row: metrics + expand */}
      <Separator className="bg-white/5 mb-3" />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
          {item.latencyMs != null && (
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-zinc-400" />
              {(item.latencyMs / 1000).toFixed(1)}s
            </span>
          )}
          {r && (
            <span className="flex items-center gap-1">
              <ScanSearch className="w-3 h-3 text-zinc-400" />
              {r.totalIssues} issue{r.totalIssues !== 1 ? "s" : ""}
            </span>
          )}
          {item.totalTokens != null && item.totalTokens > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1">
              {item.totalTokens.toLocaleString()} tokens
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowTelemetry((v) => !v)}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <Cpu className="w-3.5 h-3.5" />
            {showTelemetry ? "Hide Models" : "Otari Models"}
          </button>

          {item.codeSnippet && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white transition-colors"
            >
              <Code2 className="w-3.5 h-3.5" />
              {expanded ? "Hide Code" : "View Code"}
              {expanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Otari Model breakdown dropdown */}
      <AnimatePresence>
        {showTelemetry && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-white/5 space-y-2 text-xs font-mono">
              <div className="bg-black/30 rounded-xl p-3 space-y-1.5 border border-white/5">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-zinc-500">Gateway Endpoint:</span>
                  <span className="text-indigo-300">
                    {telemetry?.gatewayUrl ?? "https://api.otari.ai/v1"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-zinc-500">Router (Open-Weight):</span>
                  <span className="text-white truncate max-w-[240px]">
                    {routerModel}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-zinc-500">
                    Specialist (Open-Weight):
                  </span>
                  <span className="text-white truncate max-w-[240px]">
                    {specialistModel}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-zinc-500">
                    Synthesizer (Open-Weight):
                  </span>
                  <span className="text-white truncate max-w-[240px]">
                    {synthesizerModel}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Code preview */}
      <AnimatePresence>
        {expanded && item.codeSnippet && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-white/5">
              <pre className="bg-black/40 rounded-xl p-4 overflow-x-auto text-xs font-mono text-zinc-400 leading-relaxed max-h-64 overflow-y-auto">
                {item.codeSnippet}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/history?limit=50");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.history ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Aggregate stats ──
  const avgLatency =
    items.length > 0
      ? items.reduce((s, i) => s + (i.latencyMs ?? 0), 0) / items.length / 1000
      : 0;

  const totalSandboxRuns = items.reduce((sum, item) => {
    const runs =
      item.report?.otari_telemetry?.codeExecutionRuns?.length ??
      item.report?.otariVerificationSummary?.sandboxVerifiedCount ??
      0;
    return sum + runs;
  }, 0);

  const totalIssues = items.reduce(
    (s, i) => s + ((i.report as HistoryReport | null)?.totalIssues ?? 0),
    0,
  );

  const stats: StatItem[] = [
    {
      label: "Total Analyses",
      value: total.toString(),
      icon: BarChart2,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
    },
    {
      label: "Avg Latency",
      value: `${avgLatency.toFixed(1)}s`,
      icon: Timer,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      label: "Sandbox Executions",
      value: totalSandboxRuns > 0 ? totalSandboxRuns.toString() : "Active",
      icon: Terminal,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Issues Audited",
      value: totalIssues.toString(),
      icon: ScanSearch,
      color: "text-rose-400",
      bg: "bg-rose-500/10",
    },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-indigo-600/6 blur-[130px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-violet-600/6 blur-[130px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/app"
              className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Analyzer
            </Link>
            <Separator orientation="vertical" className="h-4 bg-white/10" />
            <div className="flex items-center gap-2.5">
              <LogoIcon size="sm" />
              <div>
                <span className="font-semibold text-white">
                  Otari Gateway Audit History
                </span>
                <span className="text-xs text-zinc-500 block">
                  MozFest 2026 Verification Trail
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </header>

        {/* Stats row */}
        {!loading && items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
          >
            {stats.map((s) => (
              <StatCard key={s.label} stat={s} />
            ))}
          </motion.div>
        )}

        {/* MozFest Otari Gateway Banner */}
        <div className="flex items-start gap-3 mb-6 bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
          <Shield className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
          <div className="text-xs text-zinc-300 leading-relaxed">
            <p className="font-semibold text-white font-mono mb-0.5">
              Mozilla Otari.ai AI Gateway Telemetry Trail
            </p>
            <p className="text-zinc-400">
              Every pipeline run is routed through Mozilla Otari open-weight
              models (Llama 3.2, Qwen 2.5 Coder, Mistral 7B) with automated
              model fallbacks, sandboxed microVM code execution verification,
              live CVE web search, guardrails, and per-user budget enforcement.
            </p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-white font-medium mb-1">
              Could not load history
            </p>
            <p className="text-sm text-zinc-500 mb-4">{error}</p>
            <button
              type="button"
              onClick={load}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm transition-colors"
            >
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="p-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-4">
              <Sparkles className="w-10 h-10 text-indigo-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              No analyses logged yet
            </h2>
            <p className="text-sm text-zinc-400 max-w-xs leading-relaxed mb-6">
              Run your first code analysis with Otari Gateway to view real-time
              receipts, sandbox executions, and model telemetry here.
            </p>
            <Link
              href="/app"
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Analyze Your First Snippet
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item, i) => (
              <AnalysisCard key={item.id} item={item} index={i} />
            ))}
            {total > items.length && (
              <p className="text-center text-xs text-zinc-600 py-4 font-mono">
                Showing {items.length} of {total} analyses
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
