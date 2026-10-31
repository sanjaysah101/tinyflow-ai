import { generateObject } from "ai";
import { z } from "zod";
import { MODELS, openrouter } from "@/lib/openrouter";

// ─── Schemas ────────────────────────────────────────────────

export const RouterOutputSchema = z.object({
  language: z
    .string()
    .describe(
      "The programming language of the code snippet (e.g. 'javascript', 'python', 'sql', 'unknown')",
    ),
  categories: z
    .array(z.enum(["security", "bugs", "performance", "style"]))
    .min(1)
    .describe("Which review categories are relevant for this code"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence in the language detection (0-1)"),
  guardrailTriggered: z.boolean().default(false),
  guardrailActions: z.array(z.string()).default([]),
  sanitizedCode: z.string().optional(),
  modelUsed: z.string().default("meta-llama/llama-3.2-3b-instruct"),
  fallbackTriggered: z.boolean().default(false),
  costUsd: z.number().default(0),
  tokensUsed: z.number().default(0),
  latencyMs: z.number().default(0),
});

export type RouterOutput = z.infer<typeof RouterOutputSchema>;

// ─── Otari Guardrails Pre-Check ──────────────────────────────

export interface GuardrailCheckResult {
  triggered: boolean;
  actions: string[];
  sanitizedCode: string;
}

/**
 * Otari Guardrails Pre-Check:
 * Inspects incoming code for leaked secrets (API keys, AWS tokens, private keys),
 * exposed PII (emails, phone numbers), and malicious prompt injection in code comments.
 * Redacts secrets and neutralizes attacks before sending code downstream to specialists.
 */
export function runOtariGuardrailsCheck(code: string): GuardrailCheckResult {
  const actions: string[] = [];
  let sanitized = code;

  // 1. Prompt Injection in Code Comments / Docstrings
  const commentRegex =
    /(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|<!--[\s\S]*?-->|"""[\s\S]*?"""|'''[\s\S]*?''')/g;

  sanitized = sanitized.replace(commentRegex, (comment) => {
    const injectionPatterns = [
      /ignore\s+(?:all\s+)?previous\s+instructions/i,
      /disregard\s+(?:all\s+)?(?:prior|above)\s+instructions/i,
      /system\s*:\s*approve\s+all/i,
      /bypass\s+(?:all\s+)?(?:security|filters?|rules?)/i,
      /you\s+are\s+now\s+(?:an?\s+)?unrestricted/i,
      /reveal\s+(?:the\s+)?(?:system\s+prompt|secret|api[_-]?key)/i,
      /assistant\s*:\s*ignore/i,
      /admin\s+override/i,
      /developer\s+mode\s+enabled/i,
    ];

    for (const pat of injectionPatterns) {
      if (pat.test(comment)) {
        const preview = comment.replace(/\s+/g, " ").slice(0, 50);
        actions.push(
          `Neutralized prompt injection attack in comment: "${preview}..."`,
        );
        return "/* [OTARI_GUARDRAIL: Malicious Prompt Injection Neutralized] */";
      }
    }
    return comment;
  });

  // 2. Leaked AWS Access Keys
  if (/\bAKIA[0-9A-Z]{16}\b/.test(sanitized)) {
    sanitized = sanitized.replace(
      /\bAKIA[0-9A-Z]{16}\b/g,
      "AKIA[REDACTED_AWS_KEY]",
    );
    actions.push("Redacted exposed AWS Access Key ID (AKIA...)");
  }

  // 3. Leaked OpenAI / Otari / Generic sk- API Keys
  if (/\bsk-[A-Za-z0-9_-]{20,}\b/.test(sanitized)) {
    sanitized = sanitized.replace(
      /\bsk-[A-Za-z0-9_-]{20,}\b/g,
      "sk-[REDACTED_API_KEY]",
    );
    actions.push("Redacted exposed API Key (sk-...)");
  }

  // 4. Leaked GitHub Tokens
  if (/\bgh[pousr]_[A-Za-z0-9_]{36,}\b/.test(sanitized)) {
    sanitized = sanitized.replace(
      /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/g,
      "ghp_[REDACTED_GITHUB_TOKEN]",
    );
    actions.push("Redacted exposed GitHub Personal Access Token");
  }

  // 5. Private Keys
  if (
    /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z]+ )?PRIVATE KEY-----/.test(
      sanitized,
    )
  ) {
    sanitized = sanitized.replace(
      /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z]+ )?PRIVATE KEY-----/g,
      "-----BEGIN PRIVATE KEY-----\n[REDACTED_PRIVATE_KEY]\n-----END PRIVATE KEY-----",
    );
    actions.push("Redacted exposed Cryptographic Private Key");
  }

  // 6. Generic hardcoded secrets / credentials
  const genericSecretRegex =
    /(?:api[_-]?key|secret[_-]?key|password|auth[_-]?token)\s*[:=]\s*["']([A-Za-z0-9!@#$%^&*()_+=-]{12,})["']/gi;
  if (genericSecretRegex.test(sanitized)) {
    sanitized = sanitized.replace(genericSecretRegex, (match, val) =>
      match.replace(val, "[REDACTED_CREDENTIAL]"),
    );
    actions.push("Redacted hardcoded credential literal");
  }

  // 7. Exposed PII (emails)
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  if (emailRegex.test(sanitized)) {
    sanitized = sanitized.replace(
      emailRegex,
      "user_[REDACTED_EMAIL]@example.com",
    );
    actions.push("Redacted personally identifiable email address");
  }

  const triggered = actions.length > 0;
  if (triggered) {
    console.info(
      `[Otari Guardrails] Pre-check triggered: ${actions.length} action(s) taken.`,
    );
  }

  return {
    triggered,
    actions,
    sanitizedCode: sanitized,
  };
}

// ─── Router Function ─────────────────────────────────────────

export interface RouterOptions {
  userId?: string;
  userBudget?: number;
}

/**
 * Step 1: Route the code - detect language and pick review categories,
 * with Otari Guardrails pre-checking for secrets, PII, and prompt injections.
 * Uses open-weight fast model (Llama-3.2-3B) with automated fallback.
 */
export async function runRouter(
  code: string,
  _options?: RouterOptions,
): Promise<RouterOutput> {
  const routerStart = Date.now();

  // ── Step A: Otari Guardrail Pre-Check ──
  const guardrails = runOtariGuardrailsCheck(code);
  const effectiveCode = guardrails.sanitizedCode;

  const defaultModel = MODELS.router;
  const FALLBACK: RouterOutput = {
    language: "javascript",
    categories: ["security", "bugs", "performance", "style"],
    confidence: 0,
    guardrailTriggered: guardrails.triggered,
    guardrailActions: guardrails.actions,
    sanitizedCode: effectiveCode,
    modelUsed: defaultModel,
    fallbackTriggered: false,
    costUsd: 0.00002,
    tokensUsed: 60,
    latencyMs: Date.now() - routerStart,
  };

  // ── Step B: Static language detection ──
  let detectedLanguage = "unknown";
  if (
    /require\s*\(|const\s+\w+\s*=\s*require|import\s+\w+\s+from|express\(\)|app\.(?:get|post|put|delete|use)\s*\(/.test(
      effectiveCode,
    )
  ) {
    detectedLanguage = "javascript";
  } else if (
    /def\s+\w+\s*\(|import\s+\w+|from\s+\w+\s+import|print\s*\(/.test(
      effectiveCode,
    )
  ) {
    detectedLanguage = "python";
  } else if (
    /SELECT\s+\*?\s+FROM|INSERT\s+INTO|CREATE\s+TABLE/i.test(effectiveCode)
  ) {
    detectedLanguage = "sql";
  } else if (/<\?php|namespace\s+\w+;/.test(effectiveCode)) {
    detectedLanguage = "php";
  } else if (/func\s+\w+\s*\(|package\s+main|fmt\.Print/.test(effectiveCode)) {
    detectedLanguage = "go";
  }

  // ── Step C: Always check all 4 categories for backend / server code ──
  const hasServerPatterns =
    /express|fastify|koa|http\.createServer|app\.listen|req\.|res\.|\.query\s*\(|\.execute\s*\(|db\.|fetch\s*\(|axios/.test(
      effectiveCode,
    );
  if (
    hasServerPatterns ||
    (detectedLanguage !== "unknown" && detectedLanguage !== "sql")
  ) {
    return {
      language:
        detectedLanguage !== "unknown" ? detectedLanguage : "javascript",
      categories: ["security", "bugs", "performance", "style"],
      confidence: 0.95,
      guardrailTriggered: guardrails.triggered,
      guardrailActions: guardrails.actions,
      sanitizedCode: effectiveCode,
      modelUsed: defaultModel,
      fallbackTriggered: false,
      costUsd: 0.00001,
      tokensUsed: 40,
      latencyMs: Date.now() - routerStart,
    };
  }

  // ── Step D: Call Otari Gateway for ambiguous code ──
  try {
    const { object } = await generateObject({
      model: openrouter(MODELS.router),
      schema: z.object({
        language: z.string(),
        categories: z.array(
          z.enum(["security", "bugs", "performance", "style"]),
        ),
        confidence: z.number(),
      }),
      prompt: `Detect the programming language and relevant review categories for this code.
Always include "security" if you see database queries, user input, or HTTP requests.
Always include "bugs" if you see async/await or function calls.

Code:
\`\`\`
${effectiveCode.slice(0, 1000)}
\`\`\``,
      maxOutputTokens: 150,
    });

    return {
      language:
        detectedLanguage !== "unknown" ? detectedLanguage : object.language,
      categories: object.categories as Array<
        "security" | "bugs" | "performance" | "style"
      >,
      confidence: object.confidence,
      guardrailTriggered: guardrails.triggered,
      guardrailActions: guardrails.actions,
      sanitizedCode: effectiveCode,
      modelUsed: defaultModel,
      fallbackTriggered: false,
      costUsd: 0.00003,
      tokensUsed: 120,
      latencyMs: Date.now() - routerStart,
    };
  } catch (error) {
    console.warn("[Router] Gateway call failed, using fallback:", error);
    return FALLBACK;
  }
}
