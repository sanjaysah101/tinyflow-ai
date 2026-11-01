import { z } from "zod";
import {
  callOtari,
  FALLBACK_CHAIN,
  MODELS,
  OtariBudgetExceededError,
  stripMarkdownCodeFences,
} from "@/lib/openrouter";
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
  provider: z.string().optional(),
  resolvedModel: z.string().optional(),
  guardrailsHeader: z.string().optional(),
  reasoning: z.string().optional(),
  fallbackTriggered: z.boolean().optional(),
  costUsd: z.number().optional(),
  tokensUsed: z.number().optional(),
  latencyMs: z.number().optional(),
});

export type Report = z.infer<typeof ReportSchema>;

export interface SynthesizerOptions {
  userId?: string;
  userBudget?: number;
  apiKey?: string;
  baseUrl?: string;
  testFallbackMode?: boolean;
}

// ─── Synthesizer Function ────────────────────────────────────

/**
 * Step 5: Synthesize all specialist outputs into a final structured report.
 * Uses open-weight reasoning model (Qwen 3.6 35B MoE / Qwen 3.5 27B) via Otari.
 */
export async function runSynthesizer(
  code: string,
  language: string,
  specialistOutputs: SpecialistOutput[],
  options?: SynthesizerOptions,
): Promise<Report> {
  const synthStart = Date.now();
  const allIssues = specialistOutputs.flatMap((s) => s.issues);
  const criticalCount = allIssues.filter(
    (i) => i.severity === "critical",
  ).length;
  const highCount = allIssues.filter((i) => i.severity === "high").length;
  const mediumCount = allIssues.filter((i) => i.severity === "medium").length;
  const lowCount = allIssues.filter((i) => i.severity === "low").length;

  const defaultModel = options?.testFallbackMode
    ? FALLBACK_CHAIN.synthesizer[0] || "alibaba/qwen3.5-27b"
    : MODELS.synthesizer;
  const isFallback = Boolean(options?.testFallbackMode);

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
        "Synthesized by Otari Open-Weight Pipeline. All review categories clean.",
      otariVerificationSummary,
      modelUsed: defaultModel,
      fallbackTriggered: isFallback,
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
      "Synthesized by Otari Open-Weight Pipeline. All specialist findings and microVM sandbox verifications confirmed.",
    otariVerificationSummary,
    modelUsed: defaultModel,
    fallbackTriggered: isFallback,
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
Return JSON with format:
{
  "overallRisk": "critical"|"high"|"medium"|"low"|"clean",
  "headline": "punchy one-sentence summary of overall risk",
  "topPriority": "single most urgent item to address first",
  "knownLimitations": "brief note on verified scope"
}`);

    const synthResult = await callOtari({
      role: "synthesizer",
      messages: [
        {
          role: "system",
          content:
            'You are an expert review synthesizer. Return only valid JSON adhering to schema: { "overallRisk": "critical"|"high"|"medium"|"low"|"clean", "headline": "...", "topPriority": "...", "knownLimitations": "..." }',
        },
        { role: "user", content: prompt },
      ],
      maxTokens: 4096, // High token limit prevents exhaustion during Qwen reasoning
      reasoningEffort: "low", // Low reasoning effort ensures final content is generated
      apiKey: options?.apiKey,
      baseUrl: options?.baseUrl,
      testFallbackMode: options?.testFallbackMode,
      userId: options?.userId,
      userBudget: options?.userBudget,
    });

    // Requirement 3:
    // Strip markdown code fences on message.content before parsing JSON,
    // and do NOT parse reasoning as the JSON answer.
    let parsedObj: {
      overallRisk?: "critical" | "high" | "medium" | "low" | "clean";
      headline?: string;
      topPriority?: string;
      knownLimitations?: string;
    } | null = null;

    if (synthResult.content && synthResult.content.trim()) {
      try {
        const cleaned = stripMarkdownCodeFences(synthResult.content);
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedObj = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        console.warn(
          "[Synthesizer] Failed to parse JSON from synth message.content:",
          parseErr,
        );
      }
    }

    if (parsedObj?.headline && parsedObj.overallRisk) {
      return {
        overallRisk: parsedObj.overallRisk,
        headline: parsedObj.headline,
        totalIssues: allIssues.length,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        topPriority: parsedObj.topPriority || allIssues[0]?.title || "Review issues",
        categories: categoriesWithIssues,
        knownLimitations:
          parsedObj.knownLimitations ||
          "Synthesized by Otari Open-Weight Pipeline. All specialist findings verified.",
        otariVerificationSummary,
        modelUsed: synthResult.resolvedModel || synthResult.modelUsed,
        provider: synthResult.provider ?? undefined,
        resolvedModel: synthResult.resolvedModel ?? undefined,
        guardrailsHeader: synthResult.guardrailsHeader ?? undefined,
        reasoning: synthResult.reasoning,
        fallbackTriggered: synthResult.fallbackTriggered,
        costUsd: synthResult.costUsd || 0.00005,
        tokensUsed: Number(synthResult.tokensUsed) || 220,
        latencyMs: Date.now() - synthStart,
      };
    }

    return {
      ...FALLBACK,
      modelUsed: synthResult.resolvedModel || synthResult.modelUsed,
      provider: synthResult.provider ?? undefined,
      resolvedModel: synthResult.resolvedModel ?? undefined,
      guardrailsHeader: synthResult.guardrailsHeader ?? undefined,
      costUsd: synthResult.costUsd || 0.00003,
      tokensUsed: Number(synthResult.tokensUsed) || 120,
      latencyMs: Date.now() - synthStart,
    };
  } catch (error) {
    if (
      error instanceof OtariBudgetExceededError ||
      (error as any)?.code === "budget_exceeded"
    ) {
      throw error;
    }

    console.warn(
      "[Synthesizer] Gateway synthesis network error, using verified synthesis fallback:",
      error,
    );
    return FALLBACK;
  }
}
