import { generateObject } from "ai";
import { z } from "zod";
import { openrouter, MODELS } from "@/lib/openrouter";

// ─── Schemas ────────────────────────────────────────────────

export const RouterOutputSchema = z.object({
  language: z
    .string()
    .describe("The programming language of the code snippet (e.g. 'javascript', 'python', 'sql', 'unknown')"),
  categories: z
    .array(z.enum(["security", "bugs", "performance", "style"]))
    .min(1)
    .describe("Which review categories are relevant for this code"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence in the language detection (0-1)"),
});

export type RouterOutput = z.infer<typeof RouterOutputSchema>;

// ─── Router Function ─────────────────────────────────────────

/**
 * Step 1: Route the code - detect language and pick review categories.
 * Uses the lightest model (1B) for this simple classification task.
 * Crucially, static heuristics run FIRST so the tiny model's failure
 * doesn't cause us to skip the security category on server code.
 */
export async function runRouter(code: string): Promise<RouterOutput> {
  const FALLBACK: RouterOutput = {
    language: "javascript",
    categories: ["security", "bugs", "performance", "style"],
    confidence: 0,
  };

  // ── Static language detection (runs even if the AI model fails) ──
  let detectedLanguage = "unknown";
  if (/require\s*\(|const\s+\w+\s*=\s*require|import\s+\w+\s+from|express\(\)|app\.(?:get|post|put|delete|use)\s*\(/.test(code)) {
    detectedLanguage = "javascript";
  } else if (/def\s+\w+\s*\(|import\s+\w+|from\s+\w+\s+import|print\s*\(/.test(code)) {
    detectedLanguage = "python";
  } else if (/SELECT\s+\*?\s+FROM|INSERT\s+INTO|CREATE\s+TABLE/i.test(code)) {
    detectedLanguage = "sql";
  } else if (/<\?php|namespace\s+\w+;/.test(code)) {
    detectedLanguage = "php";
  } else if (/func\s+\w+\s*\(|package\s+main|fmt\.Print/.test(code)) {
    detectedLanguage = "go";
  }

  // ── Always check all 4 categories for backend / server code ──
  // A tiny 1B model might skip "security" for code that has obvious SQLi.
  // We override it here based on code patterns - much more reliable.
  const hasServerPatterns = /express|fastify|koa|http\.createServer|app\.listen|req\.|res\.|\.query\s*\(|\.execute\s*\(|db\.|fetch\s*\(|axios/.test(code);
  if (hasServerPatterns || (detectedLanguage !== "unknown" && detectedLanguage !== "sql")) {
    return {
      language: detectedLanguage !== "unknown" ? detectedLanguage : "javascript",
      categories: ["security", "bugs", "performance", "style"],
      confidence: 0.95,
    };
  }

  // ── Fall through to AI model for ambiguous code ──
  try {
    const { object } = await generateObject({
      model: openrouter(MODELS.router),
      schema: RouterOutputSchema,
      prompt: `Detect the programming language and relevant review categories for this code.
Always include "security" if you see database queries, user input, or HTTP requests.
Always include "bugs" if you see async/await or function calls.

Code:
\`\`\`
${code.slice(0, 1000)}
\`\`\``,
      maxOutputTokens: 150,
    });

    return {
      ...object,
      language: detectedLanguage !== "unknown" ? detectedLanguage : object.language,
    };
  } catch (error) {
    console.warn("[Router] Failed, using fallback:", error);
    return FALLBACK;
  }
}
