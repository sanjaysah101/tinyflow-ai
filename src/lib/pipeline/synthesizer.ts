import { generateObject } from "ai";
import { z } from "zod";
import { openrouter, MODELS } from "@/lib/openrouter";
import type { SpecialistOutput } from "@/lib/pipeline/specialist";

// ─── Helper Functions ────────────────────────────────────────

/**
 * Sanitize string to ASCII-only to work around weak model limitations and
 * to prevent HTTP header ByteString errors when strings pass through headers.
 * Handles common Unicode punctuation with ASCII equivalents.
 */
function sanitizeToAscii(str: string): string {
  return str
    .replace(/\u2014/g, "-")    // em dash
    .replace(/\u2013/g, "-")    // en dash
    .replace(/\u2018/g, "'")    // left single quote
    .replace(/\u2019/g, "'")    // right single quote
    .replace(/\u201C/g, '"')    // left double quote
    .replace(/\u201D/g, '"')    // right double quote
    .replace(/\u2026/g, "...")  // ellipsis
    .replace(/\u2192/g, "->")   // right arrow
    .replace(/\u2190/g, "<-")   // left arrow
    .replace(/\u2022/g, "*")    // bullet
    .replace(/\u2122/g, "(TM)") // trademark
    .replace(/\u00AE/g, "(R)")  // registered
    .replace(/\u00A9/g, "(C)")  // copyright
    .replace(/[^\x00-\x7F]/g, ""); // strip any remaining non-ASCII
}

// ─── Report Schema ────────────────────────────────────────────

export const ReportSchema = z.object({
  overallRisk: z.enum(["critical", "high", "medium", "low", "clean"]),
  headline: z.string().describe("One punchy sentence summarizing the overall code quality"),
  totalIssues: z.number(),
  criticalCount: z.number(),
  highCount: z.number(),
  mediumCount: z.number(),
  lowCount: z.number(),
  topPriority: z
    .string()
    .describe("The single most important thing to fix right now"),
  categories: z.array(
    z.object({
      name: z.enum(["security", "bugs", "performance", "style"]),
      issueCount: z.number(),
      safe: z.boolean(),
      summary: z.string(),
      issues: z.array(
        z.object({
          line: z.number().optional(),
          title: z.string(),
          description: z.string(),
          severity: z.enum(["critical", "high", "medium", "low"]),
          fix: z.string(),
        }),
      ),
    }),
  ),
  knownLimitations: z.string().describe("Honest note about what this analysis might have missed"),
});

export type Report = z.infer<typeof ReportSchema>;

// ─── Synthesizer Function ────────────────────────────────────

/**
 * Step 5: Synthesize all specialist outputs into a final structured report.
 * Uses the best Tier 1 model (phi-3-mini 3.8B) as it handles longer context.
 */
export async function runSynthesizer(
  code: string,
  language: string,
  specialistOutputs: SpecialistOutput[],
): Promise<Report> {
  const allIssues = specialistOutputs.flatMap((s) => s.issues);
  const criticalCount = allIssues.filter((i) => i.severity === "critical").length;
  const highCount = allIssues.filter((i) => i.severity === "high").length;
  const mediumCount = allIssues.filter((i) => i.severity === "medium").length;
  const lowCount = allIssues.filter((i) => i.severity === "low").length;

  // If no issues at all, short-circuit the synthesis
  if (allIssues.length === 0) {
    return {
      overallRisk: "clean",
      headline: "No issues detected. The code looks solid.",
      totalIssues: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      topPriority: "None - keep it up!",
      categories: specialistOutputs.map((s) => ({
        name: s.category,
        issueCount: 0,
        safe: true,
        summary: s.summary,
        issues: [],
      })),
      knownLimitations:
        "Static analysis only. Runtime behavior, environment-specific issues, and complex data flows are not checked.",
    };
  }

  // Compact specialist summaries for the prompt
  const specialistSummary = specialistOutputs
    .map(
      (s) =>
        `### ${s.category.toUpperCase()} (${s.issues.length} issues)\n${sanitizeToAscii(s.summary)}\n` +
        s.issues
          .map((i) => `- [${i.severity.toUpperCase()}] ${sanitizeToAscii(i.title)}: ${sanitizeToAscii(i.description)}`)
          .join("\n"),
    )
    .join("\n\n");

  const sanitizedSpecialistSummary = sanitizeToAscii(specialistSummary);

  const FALLBACK: Report = {
    overallRisk: criticalCount > 0 ? "critical" : highCount > 0 ? "high" : mediumCount > 0 ? "medium" : "low",
    headline: `Found ${allIssues.length} issue(s) across ${specialistOutputs.filter((s) => s.issues.length > 0).length} categories.`,
    totalIssues: allIssues.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    topPriority: allIssues[0]?.title ?? "Review the issues above",
    categories: specialistOutputs.map((s) => ({
      name: s.category,
      issueCount: s.issues.length,
      safe: s.safe,
      summary: s.summary,
      issues: s.issues,
    })),
    knownLimitations:
      "Synthesis model unavailable. Showing raw specialist output. Static analysis only.",
  };

  try {
    const prompt = sanitizeToAscii(`You are a senior code review lead. You have received reports from specialist reviewers. 
Synthesize them into a final, actionable code review report.

## Language: ${language}
## Code length: ${code.length} chars

## Specialist Reports:
${sanitizedSpecialistSummary}

Create a comprehensive final report. Be direct, specific, and actionable.
For topPriority: pick the single most dangerous or impactful issue to fix first.
For knownLimitations: be honest - what might static analysis miss here?`);
    const { object } = await generateObject({
      model: openrouter(MODELS.synthesizer),
      schema: ReportSchema,
      prompt,
      maxOutputTokens: 800,
    });

    return object;
  } catch (error) {
    console.warn("[Synthesizer] Failed, returning fallback report:", error);
    return FALLBACK;
  }
}
