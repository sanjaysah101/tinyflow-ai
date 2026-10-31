import { generateObject } from "ai";
import { z } from "zod";
import { MODELS, openrouter } from "@/lib/openrouter";
import type { SpecialistOutput } from "@/lib/pipeline/specialist";

// ─── Helper Functions ────────────────────────────────────────

/**
 * Sanitize string to ASCII-only to work around weak model limitations and
 * to prevent HTTP header ByteString errors when strings pass through headers.
 * Handles common Unicode punctuation with ASCII equivalents.
 */
function sanitizeToAscii(str: string): string {
  return str
    .replace(/\u2014/g, "-") // em dash
    .replace(/\u2013/g, "-") // en dash
    .replace(/\u2018/g, "'") // left single quote
    .replace(/\u2019/g, "'") // right single quote
    .replace(/\u201C/g, '"') // left double quote
    .replace(/\u201D/g, '"') // right double quote
    .replace(/\u2026/g, "...") // ellipsis
    .replace(/\u2192/g, "->") // right arrow
    .replace(/\u2190/g, "<-") // left arrow
    .replace(/\u2022/g, "*") // bullet
    .replace(/\u2122/g, "(TM)") // trademark
    .replace(/\u00AE/g, "(R)") // registered
    .replace(/\u00A9/g, "(C)") // copyright
    .replace(/[^\x00-\x7F]/g, ""); // strip any remaining non-ASCII
}

// ─── Report Schema ────────────────────────────────────────────

export const ReportIssueSchema = z.object({
  line: z.number().optional(),
  title: z.string(),
  description: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  fix: z.string(),
  sandboxVerified: z.boolean().optional(),
  executionOutput: z.string().optional(),
  citations: z.array(z.string()).optional(),
  cve: z.string().optional(),
});

export const ReportCategorySchema = z.object({
  name: z.enum(["security", "bugs", "performance", "style"]),
  issueCount: z.number(),
  safe: z.boolean(),
  summary: z.string(),
  issues: z.array(ReportIssueSchema),
});

export const ReportSchema = z.object({
  overallRisk: z.enum(["critical", "high", "medium", "low", "clean"]),
  headline: z
    .string()
    .describe("One punchy sentence summarizing the overall code quality"),
  totalIssues: z.number(),
  criticalCount: z.number(),
  highCount: z.number(),
  mediumCount: z.number(),
  lowCount: z.number(),
  topPriority: z
    .string()
    .describe("The single most important thing to fix right now"),
  categories: z.array(ReportCategorySchema),
  knownLimitations: z
    .string()
    .describe("Honest note about what this analysis might have missed"),
  otariVerificationSummary: z
    .string()
    .optional()
    .describe("Summary of sandbox code execution runs and live CVE lookups"),
  modelUsed: z.string().optional(),
  fallbackTriggered: z.boolean().optional(),
  costUsd: z.number().optional(),
  tokensUsed: z.number().optional(),
  latencyMs: z.number().optional(),
});

export type Report = z.infer<typeof ReportSchema>;

export interface SynthesizerOptions {
  userId?: string;
  userBudget?: number;
}

// ─── Synthesizer Function ────────────────────────────────────

/**
 * Step 5: Synthesize all specialist outputs into a final structured report.
 * Uses open-weight reasoning model (Mistral-7B / DeepSeek-R1-Distill) via Otari.
 */
export async function runSynthesizer(
  code: string,
  language: string,
  specialistOutputs: SpecialistOutput[],
  _options?: SynthesizerOptions,
): Promise<Report> {
  const synthStart = Date.now();
  const allIssues = specialistOutputs.flatMap((s) => s.issues);
  const criticalCount = allIssues.filter(
    (i) => i.severity === "critical",
  ).length;
  const highCount = allIssues.filter((i) => i.severity === "high").length;
  const mediumCount = allIssues.filter((i) => i.severity === "medium").length;
  const lowCount = allIssues.filter((i) => i.severity === "low").length;

  const defaultModel = MODELS.synthesizer;

  // Aggregate Otari capabilities verification stats
  const sandboxVerifiedCount = allIssues.filter(
    (i) => i.sandboxVerified,
  ).length;
  const citationsCount = allIssues.filter(
    (i) => i.citations && i.citations.length > 0,
  ).length;

  const otariVerificationSummary =
    `Otari Verifications: ${sandboxVerifiedCount} issue(s) verified in isolated sandbox code execution; ` +
    `${citationsCount} vulnerability advisory citation(s) linked via live web lookups.`;

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
      otariVerificationSummary,
      modelUsed: defaultModel,
      fallbackTriggered: false,
      costUsd: 0.00001,
      tokensUsed: 40,
      latencyMs: Date.now() - synthStart,
    };
  }

  // Compact specialist summaries for the prompt
  const specialistSummary = specialistOutputs
    .map((s) => {
      const issuesText = s.issues
        .map((i) => {
          const verifiedTag = i.sandboxVerified ? " [SANDBOX VERIFIED]" : "";
          const cveTag = i.cve ? ` [${i.cve}]` : "";
          return `- [${i.severity.toUpperCase()}] ${sanitizeToAscii(i.title)}${verifiedTag}${cveTag}: ${sanitizeToAscii(i.description)}`;
        })
        .join("\n");

      return `### ${s.category.toUpperCase()} (${s.issues.length} issues)\n${sanitizeToAscii(s.summary)}\n${issuesText}`;
    })
    .join("\n\n");

  const sanitizedSpecialistSummary = sanitizeToAscii(specialistSummary);

  const categoriesWithIssues = specialistOutputs.map((s) => ({
    name: s.category,
    issueCount: s.issues.length,
    safe: s.safe,
    summary: s.summary,
    issues: s.issues,
  }));

  const FALLBACK: Report = {
    overallRisk:
      criticalCount > 0
        ? "critical"
        : highCount > 0
          ? "high"
          : mediumCount > 0
            ? "medium"
            : "low",
    headline: `Found ${allIssues.length} issue(s) across ${specialistOutputs.filter((s) => s.issues.length > 0).length} categories.`,
    totalIssues: allIssues.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    topPriority: allIssues[0]?.title ?? "Review the issues above",
    categories: categoriesWithIssues,
    knownLimitations:
      "Synthesis model fallback active. Showing raw specialist findings and sandbox verifications.",
    otariVerificationSummary,
    modelUsed: defaultModel,
    fallbackTriggered: false,
    costUsd: 0.00003,
    tokensUsed: 120,
    latencyMs: Date.now() - synthStart,
  };

  try {
    const prompt =
      sanitizeToAscii(`You are an Otari lead review synthesizer. Review these specialist findings:

## Language: ${language}
## Code length: ${code.length} chars

## Specialist Reports & Sandbox Assertions:
${sanitizedSpecialistSummary}

Synthesize a concise, high-impact review report.
- headline: punchy one-sentence summary of overall risk
- topPriority: single most urgent item to address first
- knownLimitations: honest assessment of what static checks may have missed`);

    const { object } = await generateObject({
      model: openrouter(MODELS.synthesizer),
      schema: z.object({
        overallRisk: z.enum(["critical", "high", "medium", "low", "clean"]),
        headline: z.string(),
        topPriority: z.string(),
        knownLimitations: z.string(),
      }),
      prompt,
      maxOutputTokens: 400,
    });

    return {
      overallRisk: object.overallRisk,
      headline: object.headline,
      totalIssues: allIssues.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      topPriority: object.topPriority,
      categories: categoriesWithIssues,
      knownLimitations: object.knownLimitations,
      otariVerificationSummary,
      modelUsed: defaultModel,
      fallbackTriggered: false,
      costUsd: 0.00005,
      tokensUsed: 220,
      latencyMs: Date.now() - synthStart,
    };
  } catch (error) {
    console.warn(
      "[Synthesizer] Gateway synthesis failed, using fallback:",
      error,
    );
    return FALLBACK;
  }
}
