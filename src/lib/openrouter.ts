import { createOpenAI } from "@ai-sdk/openai";

export const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    "HTTP-Referer": "https://tinyflow-ai.vercel.app",
    "X-Title": "TinyFlow AI - Garage Inference 2026",
  },
});

// ────────────────────────────────────────────────────────────
// Model registry - all Tier 1 (<=4B params, free on OpenRouter)
// ────────────────────────────────────────────────────────────
export const MODELS = {
  /** 1B - Fastest. Used only for routing / classification */
  router: "meta-llama/llama-3.2-1b-instruct:free",

  /** 1.5B - Code-specialized. Used for per-category deep analysis */
  specialist: "qwen/qwen-2.5-coder-1.5b-instruct:free",

  /** 3.8B - Best quality in Tier 1. Used for final synthesis only */
  synthesizer: "microsoft/phi-3-mini-4k-instruct:free",

  /** Embedding model - 768-dim, best-in-class for free tier */
  embedding: "nomic-ai/nomic-embed-text-v1.5:free",
} as const;

export type ModelKey = keyof typeof MODELS;
