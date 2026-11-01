import { analysisHistory, db } from "@/lib/db";
import { OtariBudgetExceededError } from "@/lib/openrouter";
import { runRouter } from "@/lib/pipeline/router";
import { runAllSpecialists } from "@/lib/pipeline/specialist";
import { runSynthesizer } from "@/lib/pipeline/synthesizer";

export const maxDuration = 60; // Vercel max for hobby plan

// ─── Cumulative Per-User Spend Store ─────────────────────────
// In-memory cache with database persistence fallback
const inMemoryUserSpend = new Map<string, number>();

async function getUserCumulativeSpend(userId: string): Promise<number> {
  let dbSpend = 0;
  try {
    const pastRecords = await db
      .select({ report: analysisHistory.report })
      .from(analysisHistory)
      .limit(100);

    for (const row of pastRecords) {
      const rep = row.report as Record<string, unknown> | null;
      if (rep && typeof rep === "object") {
        const telemetry = (rep as Record<string, unknown>).otari_telemetry as
          | Record<string, unknown>
          | undefined;
        const budget = telemetry?.budget as Record<string, unknown> | undefined;
        if (budget?.userId === userId) {
          dbSpend += Number(budget.analysisCostUsd || 0);
        }
      }
    }
  } catch {
    // DB unreachable or query error - use in-memory store
  }

  const memorySpend = inMemoryUserSpend.get(userId) || 0;
  return Number(Math.max(dbSpend, memorySpend).toFixed(4));
}

// ─── Input sanitization ──────────────────────────────────────

function sanitizeCode(code: string): string {
  // Strip null bytes and limit length
  return code.replace(/\0/g, "").slice(0, 8000);
}

// ─── Streaming SSE helper ────────────────────────────────────

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ─── Main API Route ──────────────────────────────────────────

export async function POST(req: Request) {
  let body: {
    code: string;
    language?: string;
    userId?: string;
    userBudgetLimit?: number;
    testFallbackMode?: boolean;
    apiKey?: string;
    baseUrl?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { code, language: hintedLanguage } = body;

  if (!code || typeof code !== "string" || code.trim().length < 10) {
    return new Response(
      JSON.stringify({
        error: "Please provide at least 10 characters of code.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // ── BYOK (Bring Your Own Key) & Gateway Base URL Resolution ──
  const byokApiKey =
    req.headers.get("x-otari-api-key") || body.apiKey || undefined;
  const byokBaseUrl =
    req.headers.get("x-otari-base-url") || body.baseUrl || undefined;
  const testFallbackMode =
    body.testFallbackMode ?? req.headers.get("x-test-fallback-mode") === "true";

  const authTier = byokApiKey
    ? "byok"
    : process.env.OTARI_API_KEY
      ? "server_otari"
      : "failover_gateway";

  // ── Per-User Budget & Spend Limit Enforcement ──
  const userId =
    req.headers.get("x-user-id") ||
    body.userId ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "demo-user";

  const defaultLimit = Number.parseFloat(
    process.env.OTARI_USER_BUDGET_LIMIT_USD || "0.50",
  );
  const userBudgetLimit =
    body.userBudgetLimit ??
    (req.headers.get("x-user-budget-limit")
      ? Number.parseFloat(req.headers.get("x-user-budget-limit")!)
      : defaultLimit);

  const previousSpend = await getUserCumulativeSpend(userId);

  if (previousSpend >= userBudgetLimit) {
    return new Response(
      JSON.stringify({
        error: "Budget Exceeded",
        message: `Per-user budget cap of $${userBudgetLimit.toFixed(2)} exceeded ($${previousSpend.toFixed(4)} spent). Otari per-user budget enforcement active.`,
        budget: {
          userId,
          userSpentUsd: previousSpend,
          userLimitUsd: userBudgetLimit,
        },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "x-otari-budget-exceeded": "true",
        },
      },
    );
  }

  const cleanCode = sanitizeCode(code);
  const analysisStart = Date.now();

  // ── Streaming response via SSE ──
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };

      try {
        // ── Step 1: Otari Router with Guardrails Pre-Check ──
        emit("step", {
          step: "routing",
          message:
            "Otari Router: checking guardrails & detecting review categories…",
          model: "Qwen-3.5-9B",
        });

        const routerOutput = await runRouter(cleanCode, {
          userId,
          userBudget: userBudgetLimit,
          apiKey: byokApiKey,
          baseUrl: byokBaseUrl,
          testFallbackMode,
        });

        const language = hintedLanguage || routerOutput.language;
        const effectiveCode = routerOutput.sanitizedCode || cleanCode;

        emit("router_done", {
          language,
          categories: routerOutput.categories,
          guardrailTriggered: routerOutput.guardrailTriggered,
          guardrailActions: routerOutput.guardrailActions,
          otari_telemetry: {
            authTier,
            provider: routerOutput.provider,
            model: routerOutput.modelUsed,
            guardrailsHeader: routerOutput.guardrailsHeader,
            costUsd: routerOutput.costUsd,
            guardrails: {
              passed: !routerOutput.guardrailTriggered,
              actions: routerOutput.guardrailActions,
            },
            modelUsed: routerOutput.modelUsed,
          },
        });

        // ── Step 2: Otari Specialists (Sandbox & CVE Web Search) ──
        emit("step", {
          step: "analyzing",
          message: `Running ${routerOutput.categories.length} Otari Specialists in parallel (CVE Web Search & Code Sandbox active)…`,
          model: "Qwen-3-32B",
          categories: routerOutput.categories,
        });

        const specialistOutputs = await runAllSpecialists(
          effectiveCode,
          routerOutput.categories as Array<
            "security" | "bugs" | "performance" | "style"
          >,
          language,
          {
            userId,
            userBudget: userBudgetLimit,
            apiKey: byokApiKey,
            baseUrl: byokBaseUrl,
            testFallbackMode,
          },
        );

        const allSandboxRuns = specialistOutputs.flatMap((s) => s.sandboxRuns);
        const allWebSearchQueries = specialistOutputs.flatMap(
          (s) => s.webSearchQueries,
        );
        const specialistFallbacks = specialistOutputs.filter(
          (s) => s.fallbackTriggered,
        ).length;

        const specialistsCost = specialistOutputs.reduce(
          (sum, s) => sum + (s.costUsd || 0.00005),
          0,
        );

        emit("specialists_done", {
          categories: specialistOutputs.map((s) => ({
            category: s.category,
            issueCount: s.issues.length,
            safe: s.safe,
            sandboxRunsCount: s.sandboxRuns.length,
            webQueriesCount: s.webSearchQueries.length,
            provider: s.provider,
            model: s.modelUsed,
            costUsd: s.costUsd,
          })),
          otari_telemetry: {
            authTier,
            provider: specialistOutputs[0]?.provider,
            model: specialistOutputs[0]?.modelUsed,
            guardrailsHeader: specialistOutputs[0]?.guardrailsHeader,
            costUsd: specialistsCost,
            codeExecutionRuns: allSandboxRuns,
            webSearchQueries: allWebSearchQueries,
          },
        });

        // ── Step 3: Otari Synthesizer ────────────────────────
        emit("step", {
          step: "synthesizing",
          message:
            "Otari Synthesizer: combining findings with verified assertions…",
          model: "Qwen-3.6-35B-MoE",
        });

        const report = await runSynthesizer(
          effectiveCode,
          language,
          specialistOutputs,
          {
            userId,
            userBudget: userBudgetLimit,
            apiKey: byokApiKey,
            baseUrl: byokBaseUrl,
            testFallbackMode,
          },
        );

        const latencyMs = Date.now() - analysisStart;

        // ── Step 4: Budget & Telemetry Aggregation ───────────
        const routerCost = routerOutput.costUsd || 0.00002;
        const synthesizerCost = report.costUsd || 0.00005;
        const analysisCostUsd = Number(
          (routerCost + specialistsCost + synthesizerCost).toFixed(6),
        );
        const newCumulativeSpend = Number(
          (previousSpend + analysisCostUsd).toFixed(4),
        );

        inMemoryUserSpend.set(userId, newCumulativeSpend);

        const totalTokens =
          (routerOutput.tokensUsed || 60) +
          specialistOutputs.reduce((sum, s) => sum + (s.tokensUsed || 180), 0) +
          (report.tokensUsed || 120);

        const totalFallbacks =
          (routerOutput.fallbackTriggered ? 1 : 0) +
          specialistFallbacks +
          (report.fallbackTriggered ? 1 : 0);

        const resolvedProvider =
          report.provider ||
          specialistOutputs.find((s) => s.provider)?.provider ||
          routerOutput.provider ||
          "Mozilla Otari Upstream";

        const resolvedModel =
          report.resolvedModel ||
          specialistOutputs.find((s) => s.resolvedModel)?.resolvedModel ||
          report.modelUsed;

        const resolvedGuardrails =
          report.guardrailsHeader ||
          specialistOutputs.find((s) => s.guardrailsHeader)?.guardrailsHeader ||
          routerOutput.guardrailsHeader ||
          "enforced";

        const otariTelemetry = {
          authTier,
          provider: resolvedProvider,
          resolvedModel,
          nativeGuardrails: resolvedGuardrails,
          modelsByRole: {
            router: routerOutput.modelUsed,
            specialists: specialistOutputs.map((s) => ({
              category: s.category,
              model: s.modelUsed,
              provider: s.provider,
              resolvedModel: s.resolvedModel,
              guardrailsHeader: s.guardrailsHeader,
              fallback: s.fallbackTriggered,
              tools: s.toolsInvoked,
              costUsd: s.costUsd,
            })),
            synthesizer: report.modelUsed || "alibaba/qwen3.6-35b-a3b",
          },
          costUsd: analysisCostUsd,
          fallbacksTriggered: totalFallbacks,
          codeExecutionRuns: allSandboxRuns,
          webSearchQueries: allWebSearchQueries,
          guardrailsStatus: {
            passed: !routerOutput.guardrailTriggered,
            redactedCount: routerOutput.guardrailActions.length,
            actions: routerOutput.guardrailActions,
            header: resolvedGuardrails,
          },
          budget: {
            userId,
            analysisCostUsd,
            userSpentUsd: newCumulativeSpend,
            userLimitUsd: userBudgetLimit,
          },
        };

        const reportWithTelemetry = {
          ...report,
          otari_telemetry: otariTelemetry,
        };

        // ── Persist to database via Drizzle ORM ──────────────
        try {
          await db.insert(analysisHistory).values({
            codeSnippet: cleanCode.slice(0, 2000),
            language,
            report: reportWithTelemetry as unknown as Record<string, unknown>,
            modelsUsed: [
              routerOutput.modelUsed,
              specialistOutputs[0]?.modelUsed || "alibaba/qwen3-32b",
              report.modelUsed || "alibaba/qwen3.6-35b-a3b",
            ],
            totalTokens,
            latencyMs,
          });
        } catch (dbErr) {
          console.warn("[Analyze] Could not save to history:", dbErr);
        }

        // ── Emit Final Done Event ────────────────────────────
        emit("done", {
          report: reportWithTelemetry,
          metrics: {
            latencyMs,
            language,
            modelsUsed: [
              {
                name: routerOutput.modelUsed,
                role: "Router (Otari)",
                params: "9B",
              },
              {
                name: specialistOutputs[0]?.modelUsed || "alibaba/qwen3-32b",
                role: "Specialist (Otari)",
                params: "32B",
              },
              {
                name: report.modelUsed || "alibaba/qwen3.6-35b-a3b",
                role: "Synthesizer (Otari)",
                params: "35B MoE",
              },
            ],
            tier: "Open-Weight (Mozilla Otari Gateway)",
            estimatedCost: `$${analysisCostUsd.toFixed(4)}`,
            costUsd: analysisCostUsd,
            provider: resolvedProvider,
            guardrails: resolvedGuardrails,
          },
          otari_telemetry: otariTelemetry,
        });
      } catch (err: unknown) {
        const isBudget =
          err instanceof OtariBudgetExceededError ||
          (err as any)?.code === "budget_exceeded" ||
          (err as any)?.status === 403;

        if (isBudget) {
          const retryAfter = (err as any)?.retryAfter ?? null;
          const msg =
            (err as any)?.message ||
            `Otari per-user budget exceeded for user "${userId}". HTTP 403 budget_exceeded.`;

          emit("budget_exceeded", {
            code: "budget_exceeded",
            status: 403,
            message: msg,
            retryAfter,
            userId,
          });
          emit("error", {
            code: "budget_exceeded",
            status: 403,
            message: msg,
            retryAfter,
          });
        } else {
          emit("error", { message: String((err as Error)?.message || err) });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
