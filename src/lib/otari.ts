import { createOpenAI } from "@ai-sdk/openai";

// ────────────────────────────────────────────────────────────
// Mozilla Otari Gateway Configuration
// MozFest 2026 - Mozilla Otari Hackathon
// ────────────────────────────────────────────────────────────

export const OTARI_BASE_URL =
  process.env.OTARI_BASE_URL || "https://api.otari.ai/v1";

export const OTARI_API_KEY =
  process.env.OTARI_API_KEY || process.env.OPENROUTER_API_KEY || "";

export const OTARI_USER_BUDGET_LIMIT_USD = Number.parseFloat(
  process.env.OTARI_USER_BUDGET_LIMIT_USD || "1.00",
);

// ────────────────────────────────────────────────────────────
// Open-Weight Model Registry
// ────────────────────────────────────────────────────────────

export const OTARI_MODELS = {
  /** Primary open-weight fast model for routing & classification */
  router: process.env.OTARI_ROUTER_MODEL || "meta-llama/llama-3.2-3b-instruct",

  /** Primary code open-weight model for per-category deep analysis */
  specialist:
    process.env.OTARI_SPECIALIST_MODEL || "Qwen/Qwen2.5-Coder-7B-Instruct",

  /** Primary reasoning / synthesis open-weight model for aggregation & final reporting */
  synthesizer:
    process.env.OTARI_SYNTHESIZER_MODEL || "mistralai/Mistral-7B-Instruct-v0.3",

  /** High-quality embedding model for RAG pattern retrieval */
  embedding:
    process.env.OTARI_EMBEDDING_MODEL || "nomic-ai/nomic-embed-text-v1.5",
} as const;

export type OtariRole = "router" | "specialist" | "synthesizer";
export type OtariModelKey = keyof typeof OTARI_MODELS;

/**
 * Fallback chains per role.
 * If the primary model fails, rate-limits, or times out,
 * Otari automatically falls back to secondary open-weight models.
 */
export const FALLBACK_CHAIN: Record<OtariRole, readonly string[]> = {
  router: [
    "meta-llama/llama-3.1-8b-instruct",
    "meta-llama/llama-3.2-1b-instruct",
  ],
  specialist: [
    "qwen/qwen-2.5-coder-32b-instruct",
    "Qwen/Qwen2.5-Coder-1.5B-Instruct",
  ],
  synthesizer: [
    "deepseek-ai/DeepSeek-R1-Distill-Qwen-14B",
    "deepseek-ai/DeepSeek-R1-Distill-Llama-8B",
    "microsoft/phi-3-mini-4k-instruct",
  ],
} as const;

// ────────────────────────────────────────────────────────────
// Model Pricing Estimates ($ per 1M tokens) for Open-Weight Models
// Used to provide real cost transparency receipts
// ────────────────────────────────────────────────────────────

const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  // Router models
  "meta-llama/llama-3.2-3b-instruct": { prompt: 0.06, completion: 0.06 },
  "meta-llama/llama-3.1-8b-instruct": { prompt: 0.1, completion: 0.1 },
  "meta-llama/llama-3.2-1b-instruct": { prompt: 0.04, completion: 0.04 },
  // Specialist models
  "Qwen/Qwen2.5-Coder-7B-Instruct": { prompt: 0.15, completion: 0.15 },
  "qwen/qwen-2.5-coder-7b-instruct": { prompt: 0.15, completion: 0.15 },
  "qwen/qwen-2.5-coder-32b-instruct": { prompt: 0.4, completion: 0.4 },
  "Qwen/Qwen2.5-Coder-1.5B-Instruct": { prompt: 0.08, completion: 0.08 },
  "qwen/qwen-2.5-coder-1.5b-instruct": { prompt: 0.08, completion: 0.08 },
  // Synthesizer models
  "mistralai/Mistral-7B-Instruct-v0.3": { prompt: 0.15, completion: 0.15 },
  "deepseek-ai/DeepSeek-R1-Distill-Qwen-14B": {
    prompt: 0.35,
    completion: 0.35,
  },
  "deepseek-ai/DeepSeek-R1-Distill-Llama-8B": {
    prompt: 0.18,
    completion: 0.18,
  },
  "microsoft/phi-3-mini-4k-instruct": { prompt: 0.1, completion: 0.1 },
};

function calculateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = MODEL_PRICING[model] || { prompt: 0.15, completion: 0.15 };
  const cost =
    (promptTokens * pricing.prompt + completionTokens * pricing.completion) /
    1_000_000;
  return Number(cost.toFixed(6));
}

// ────────────────────────────────────────────────────────────
// Vercel AI SDK Provider Instance for Otari
// ────────────────────────────────────────────────────────────

export const otari = createOpenAI({
  baseURL: OTARI_BASE_URL,
  apiKey: OTARI_API_KEY || "otari-hackathon-key",
  headers: {
    "HTTP-Referer": "https://tinyflow-ai.vercel.app",
    "X-Title": "TinyFlow AI - Mozilla Otari 2026",
    ...(process.env.OTARI_USER_BUDGET_LIMIT_USD
      ? { "x-otari-user-budget": process.env.OTARI_USER_BUDGET_LIMIT_USD }
      : {}),
  },
});

// ────────────────────────────────────────────────────────────
// Types for Otari Capabilities
// ────────────────────────────────────────────────────────────

export type OtariToolType = "code_execution" | "web_search";

export interface OtariTool {
  type: OtariToolType | string;
  [key: string]: unknown;
}

export interface OtariMessage {
  role: "system" | "user" | "assistant" | string;
  content: string;
  name?: string;
}

export interface OtariGuardrailsOptions {
  enabled?: boolean;
  piiRedaction?: boolean;
  secretRedaction?: boolean;
  exploitPrevention?: boolean;
  level?: "strict" | "moderate" | "permissive";
}

export interface OtariUserBudgetOptions {
  userId?: string;
  budgetLimitUsd?: number;
  maxTokens?: number;
}

export interface CallOtariOptions {
  role: OtariRole;
  messages: OtariMessage[];
  tools?: OtariTool[];
  guardrails?: boolean | OtariGuardrailsOptions;
  userBudget?: string | number | OtariUserBudgetOptions;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" | "text" } | Record<string, unknown>;
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface OtariUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CallOtariResult {
  content: string;
  modelUsed: string;
  fallbackTriggered: boolean;
  fallbackFrom?: string;
  toolsInvoked: ("code_execution" | "web_search")[];
  guardrailStatus: "clean" | "triggered" | "redacted" | "blocked" | "none";
  costUsd: number;
  tokensUsed: number & OtariUsage;
  latencyMs: number;
  raw?: unknown;
}

// ────────────────────────────────────────────────────────────
// Strongly-Typed callOtari Implementation
// ────────────────────────────────────────────────────────────

/**
 * Execute an inference call through Mozilla's Otari gateway with
 * automatic fallback chains, Otari Guardrails, tool invocations,
 * per-user budget enforcement, and telemetry tracking.
 */
export async function callOtari(
  options: CallOtariOptions,
): Promise<CallOtariResult> {
  const {
    role,
    messages,
    tools,
    guardrails,
    userBudget,
    temperature = 0.2,
    maxTokens,
    responseFormat,
    signal,
    timeoutMs = 30000,
    headers: extraHeaders = {},
  } = options;

  const startTime = Date.now();

  // Resolve user budget configuration
  let userId = "anonymous-user";
  let budgetLimitUsd = OTARI_USER_BUDGET_LIMIT_USD;
  let budgetMaxTokens = maxTokens;

  if (typeof userBudget === "string") {
    userId = userBudget;
  } else if (typeof userBudget === "number") {
    budgetLimitUsd = userBudget;
  } else if (userBudget && typeof userBudget === "object") {
    if (userBudget.userId) userId = userBudget.userId;
    if (userBudget.budgetLimitUsd !== undefined)
      budgetLimitUsd = userBudget.budgetLimitUsd;
    if (userBudget.maxTokens !== undefined)
      budgetMaxTokens = userBudget.maxTokens;
  }

  // Resolve guardrails configuration
  const isGuardrailsEnabled = guardrails !== false;
  const guardrailsOpts: OtariGuardrailsOptions =
    typeof guardrails === "object"
      ? guardrails
      : {
          enabled: isGuardrailsEnabled,
          piiRedaction: true,
          secretRedaction: true,
          exploitPrevention: true,
          level: "strict",
        };

  // Build candidate model list with primary first, followed by fallbacks
  const primaryModel = options.model || OTARI_MODELS[role];
  const fallbackList = FALLBACK_CHAIN[role] || [];
  const candidateModels = Array.from(new Set([primaryModel, ...fallbackList]));

  let lastError: Error | null = null;
  let fallbackTriggered = false;
  let fallbackFrom: string | undefined;

  for (let idx = 0; idx < candidateModels.length; idx++) {
    const currentModel = candidateModels[idx];

    if (idx > 0) {
      fallbackTriggered = true;
      fallbackFrom = primaryModel;
      console.warn(
        `[Otari Gateway] Falling back from ${primaryModel} to ${currentModel} for role ${role}...`,
      );
    }

    // Set up request abort controller with timeout
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    // Merge external signal if provided
    if (signal) {
      signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }

    try {
      const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OTARI_API_KEY}`,
        "User-Agent": "TinyFlow-AI/MozFest-2026",
        "x-otari-role": role,
        "x-otari-user-id": userId,
        "x-otari-user-budget": budgetLimitUsd.toString(),
        ...extraHeaders,
      };

      if (budgetMaxTokens) {
        requestHeaders["x-otari-max-tokens"] = budgetMaxTokens.toString();
      }

      if (isGuardrailsEnabled) {
        requestHeaders["x-otari-guardrails"] = "enabled";
        if (guardrailsOpts.piiRedaction) {
          requestHeaders["x-otari-guardrails-pii"] = "redact";
        }
        if (guardrailsOpts.secretRedaction) {
          requestHeaders["x-otari-guardrails-secrets"] = "redact";
        }
        if (guardrailsOpts.exploitPrevention) {
          requestHeaders["x-otari-guardrails-exploits"] = "block";
        }
      }

      const bodyPayload: Record<string, unknown> = {
        model: currentModel,
        messages,
        temperature,
        user: userId,
      };

      if (budgetMaxTokens) {
        bodyPayload.max_tokens = budgetMaxTokens;
      }

      if (responseFormat) {
        bodyPayload.response_format = responseFormat;
      }

      if (tools && tools.length > 0) {
        bodyPayload.tools = tools;
      }

      if (isGuardrailsEnabled) {
        bodyPayload.guardrails = guardrailsOpts;
      }

      const res = await fetch(`${OTARI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutHandle);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        const status = res.status;
        const errMessage = `Otari API call failed with status ${status}: ${errText}`;

        // Retryable conditions: rate limits (429), timeouts (408), or gateway/server errors (500+)
        if (
          status === 429 ||
          status === 408 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504
        ) {
          console.warn(
            `[Otari Gateway] Model ${currentModel} returned ${status}. Attempting fallback...`,
          );
          lastError = new Error(errMessage);
          continue;
        }

        // For non-retryable 4xx errors, fail immediately
        throw new Error(errMessage);
      }

      const data = await res.json();
      const latencyMs = Date.now() - startTime;

      // Extract message content
      const choice = data.choices?.[0];
      const content = choice?.message?.content || "";

      // Inspect guardrail trigger telemetry
      let guardrailStatus:
        | "clean"
        | "triggered"
        | "redacted"
        | "blocked"
        | "none" = "none";

      const headerGuardrail = res.headers.get("x-otari-guardrail-status");
      const headerRedacted = res.headers.get("x-otari-guardrail-redacted");
      const headerBlocked = res.headers.get("x-otari-guardrail-blocked");

      if (
        headerBlocked === "true" ||
        choice?.finish_reason === "content_filter"
      ) {
        guardrailStatus = "blocked";
        console.warn(
          `[Otari Guardrails] Exploit prevention BLOCKED output on model ${currentModel}`,
        );
      } else if (
        headerRedacted === "true" ||
        data.guardrail_status === "redacted"
      ) {
        guardrailStatus = "redacted";
        console.info(
          `[Otari Guardrails] PII / Secret redaction applied to output`,
        );
      } else if (
        headerGuardrail === "triggered" ||
        data.guardrail_triggered === true
      ) {
        guardrailStatus = "triggered";
        console.warn(
          `[Otari Guardrails] Guardrail triggered on model ${currentModel}`,
        );
      } else if (isGuardrailsEnabled) {
        guardrailStatus = "clean";
      }

      // Inspect tools invoked
      const toolsInvoked: ("code_execution" | "web_search")[] = [];

      const headerTools = res.headers.get("x-otari-tools-invoked");
      if (headerTools) {
        if (headerTools.includes("code_execution"))
          toolsInvoked.push("code_execution");
        if (headerTools.includes("web_search")) toolsInvoked.push("web_search");
      }

      if (Array.isArray(choice?.message?.tool_calls)) {
        for (const tc of choice.message.tool_calls) {
          const type = tc.type || tc.function?.name;
          if (
            type === "code_execution" &&
            !toolsInvoked.includes("code_execution")
          ) {
            toolsInvoked.push("code_execution");
          }
          if (type === "web_search" && !toolsInvoked.includes("web_search")) {
            toolsInvoked.push("web_search");
          }
        }
      }

      // Extract token usage
      const promptTokens = data.usage?.prompt_tokens ?? 0;
      const completionTokens = data.usage?.completion_tokens ?? 0;
      const totalTokens =
        data.usage?.total_tokens ?? promptTokens + completionTokens;

      // Extract or compute cost
      const costHeader = res.headers.get("x-otari-cost-usd");
      const costUsd = costHeader
        ? Number.parseFloat(costHeader)
        : (data.cost_usd ??
          calculateCostUsd(currentModel, promptTokens, completionTokens));

      // Construct dual-compatible tokensUsed (behaves as number primitive and object with breakdown)
      const tokensUsage: OtariUsage = {
        promptTokens,
        completionTokens,
        totalTokens,
      };

      const tokensUsed = Object.assign(
        new Number(totalTokens),
        tokensUsage,
      ) as number & OtariUsage;

      return {
        content,
        modelUsed: currentModel,
        fallbackTriggered,
        fallbackFrom,
        toolsInvoked,
        guardrailStatus,
        costUsd,
        tokensUsed,
        latencyMs,
        raw: data,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutHandle);
      const isAbort = (err as Error)?.name === "AbortError";
      const errorMsg = isAbort
        ? `Request timed out after ${timeoutMs}ms on model ${currentModel}`
        : (err as Error)?.message || String(err);

      console.warn(
        `[Otari Gateway] Error with model ${currentModel}: ${errorMsg}`,
      );
      lastError = new Error(errorMsg);
    }
  }

  // If all models in the fallback chain were exhausted
  throw new Error(
    `[Otari Gateway] All candidate models failed for role '${role}' (models tried: ${candidateModels.join(
      ", ",
    )}). Last error: ${lastError?.message || "Unknown error"}`,
  );
}
