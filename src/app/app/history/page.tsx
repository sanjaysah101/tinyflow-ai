"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  Code2,
  ChevronDown,
  ChevronUp,
  History,
  Activity,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  BarChart2,
  Timer,
  ScanSearch,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

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

const RISK_STYLE: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  critical: { label: "Critical", color: "text-red-400",     bg: "bg-red-500/10 border-red-500/25",       dot: "bg-red-400"     },
  high:     { label: "High",     color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/25", dot: "bg-orange-400"  },
  medium:   { label: "Medium",   color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/25", dot: "bg-yellow-400"  },
  low:      { label: "Low",      color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/25",     dot: "bg-blue-400"    },
  clean:    { label: "Clean",    color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25", dot: "bg-emerald-400" },
};

function RiskBadge({ risk }: { risk: string }) {
  const cfg = RISK_STYLE[risk] ?? RISK_STYLE.low;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function IssuePill({ count, label, color }: { count: number; label: string; color: string }) {
  if (count === 0) return null;
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${color}`}>
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
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mb-2 ${stat.bg}`}>
        <Icon className={`w-4 h-4 ${stat.color}`} />
      </div>
      <p className="text-2xl font-bold text-white font-mono">{stat.value}</p>
      <p className="text-[10px] text-zinc-600 mt-0.5 uppercase tracking-wider">{stat.label}</p>
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

// ─── Analysis Card ────────────────────────────────────────────

function AnalysisCard({ item, index }: { item: HistoryItem; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const r = item.report;

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
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-600 shrink-0">
          <Clock className="w-3 h-3" />
          <span className="font-mono">{timeAgo(item.createdAt)}</span>
        </div>
      </div>

      {/* Headline */}
      {r?.headline && (
        <p className="text-sm text-zinc-300 leading-snug mb-3 line-clamp-2">{r.headline}</p>
      )}

      {/* Issue counts */}
      {r && r.totalIssues > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <IssuePill count={r.criticalCount} label="critical" color="bg-red-500/10 border-red-500/20 text-red-400" />
          <IssuePill count={r.highCount}     label="high"     color="bg-orange-500/10 border-orange-500/20 text-orange-400" />
          <IssuePill count={r.mediumCount}   label="medium"   color="bg-yellow-500/10 border-yellow-500/20 text-yellow-400" />
          <IssuePill count={r.lowCount}      label="low"      color="bg-blue-500/10 border-blue-500/20 text-blue-400" />
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-zinc-600 font-mono">
          {item.latencyMs != null && (
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {(item.latencyMs / 1000).toFixed(1)}s
            </span>
          )}
          {r && (
            <span className="flex items-center gap-1">
              <ScanSearch className="w-3 h-3" />
              {r.totalIssues} issue{r.totalIssues !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {item.codeSnippet && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white transition-colors"
          >
            <Code2 className="w-3.5 h-3.5" />
            {expanded ? "Hide Code" : "View Code"}
            {expanded
              ? <ChevronUp className="w-3 h-3" />
              : <ChevronDown className="w-3 h-3" />
            }
          </button>
        )}
      </div>

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

  const uniqueLangs = new Set(items.map((i) => i.language).filter(Boolean)).size;
  const totalIssues = items.reduce((s, i) => s + ((i.report as HistoryReport | null)?.totalIssues ?? 0), 0);

  const stats: StatItem[] = [
    { label: "Total Analyses", value: total.toString(),           icon: BarChart2,  color: "text-indigo-400", bg: "bg-indigo-500/10"  },
    { label: "Avg Latency",    value: `${avgLatency.toFixed(1)}s`, icon: Timer,      color: "text-violet-400", bg: "bg-violet-500/10"  },
    { label: "Languages",      value: uniqueLangs.toString(),      icon: Code2,      color: "text-blue-400",   bg: "bg-blue-500/10"    },
    { label: "Issues Found",   value: totalIssues.toString(),      icon: ScanSearch, color: "text-rose-400",   bg: "bg-rose-500/10"    },
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
            <Link href="/app" className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" />
              Back to Analyzer
            </Link>
            <Separator orientation="vertical" className="h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                <History className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="font-semibold text-white">Analysis History</span>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
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

        {/* Hackathon note */}
        <div className="flex items-start gap-2 mb-6 bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-300/70">
            All analyses run at{" "}
            <span className="text-amber-300 font-mono font-semibold">$0.00</span>{" "}
            using Tier 1 models (≤4B params) via OpenRouter free tier.
            These are the actual receipts.
          </p>
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
            <p className="text-white font-medium mb-1">Could not load history</p>
            <p className="text-sm text-zinc-500 mb-4">{error}</p>
            <button
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
            <h2 className="text-xl font-semibold text-white mb-2">No analyses yet</h2>
            <p className="text-sm text-zinc-400 max-w-xs leading-relaxed mb-6">
              Run your first code analysis to see the history here, including cost receipts and metrics.
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
