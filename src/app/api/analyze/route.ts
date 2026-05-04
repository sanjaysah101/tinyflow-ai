import { db, analysisHistory } from "@/lib/db";
import { runRouter } from "@/lib/pipeline/router";
import { runAllSpecialists } from "@/lib/pipeline/specialist";
import { runSynthesizer } from "@/lib/pipeline/synthesizer";

export const maxDuration = 60; // Vercel max for hobby plan

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
  let body: { code: string; language?: string };

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
    return new Response(JSON.stringify({ error: "Please provide at least 10 characters of code." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
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
        // ── Step 1: Router ──────────────────────────────────
        emit("step", { step: "routing", message: "Detecting language & selecting review categories…", model: "llama-3.2-1b" });
        const routerOutput = await runRouter(cleanCode);
        const language = hintedLanguage || routerOutput.language;
        emit("router_done", { language, categories: routerOutput.categories });

        // ── Step 2: RAG + Specialist Analysis (parallel) ──
        emit("step", {
          step: "analyzing",
          message: `Running ${routerOutput.categories.length} specialist agents in parallel…`,
          model: "qwen-2.5-coder-1.5b",
          categories: routerOutput.categories,
        });
        const specialistOutputs = await runAllSpecialists(
          cleanCode,
          routerOutput.categories as Array<"security" | "bugs" | "performance" | "style">,
          language,
        );
        emit("specialists_done", {
          categories: specialistOutputs.map((s) => ({
            category: s.category,
            issueCount: s.issues.length,
            safe: s.safe,
          })),
        });

        // ── Step 3: Synthesizer ──────────────────────────────
        emit("step", { step: "synthesizing", message: "Synthesizing final report…", model: "phi-3-mini" });
        const report = await runSynthesizer(cleanCode, language, specialistOutputs);

        const latencyMs = Date.now() - analysisStart;

        // ── Persist to database via Drizzle ORM ──────────────────────────
        try {
          await db.insert(analysisHistory).values({
            codeSnippet: cleanCode.slice(0, 2000),
            language,
            report,
            modelsUsed: JSON.parse(JSON.stringify(["llama-3.2-1b-instruct", "qwen-2.5-coder-1.5b-instruct", "phi-3-mini-4k-instruct"])),
            latencyMs,
          });
        } catch (dbErr) {
          console.warn("[Analyze] Could not save to history:", dbErr);
        }

        // ── Final report ──────────────────────────────────────
        emit("done", {
          report,
          metrics: {
            latencyMs,
            language,
            modelsUsed: [
              { name: "meta-llama/llama-3.2-1b-instruct", role: "Router", params: "1B" },
              { name: "qwen/qwen-2.5-coder-1.5b-instruct", role: "Specialist", params: "1.5B" },
              { name: "microsoft/phi-3-mini-4k-instruct", role: "Synthesizer", params: "3.8B" },
            ],
            tier: "Tier 1 (≤4B params)",
            estimatedCost: "$0.00",
          },
        });
      } catch (err) {
        emit("error", { message: String(err) });
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
