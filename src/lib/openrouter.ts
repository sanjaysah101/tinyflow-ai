// ────────────────────────────────────────────────────────────
// Otari Gateway Bridge (Legacy OpenRouter Compatibility Layer)
// MozFest 2026 - Mozilla Otari Hackathon
// ────────────────────────────────────────────────────────────
// Re-exports and routes all calls through src/lib/otari.ts so existing
// pipeline imports and components continue working seamlessly.

import {
  type CallOtariEmbeddingsOptions,
  type CallOtariEmbeddingsResult,
  type CallOtariOptions,
  type CallOtariResult,
  callOtari,
  callOtariEmbeddings,
  extractJsonFromContent,
  FALLBACK_CHAIN,
  getOtariProvider,
  OTARI_MODELS,
  OtariBudgetExceededError,
  type OtariGuardrailsOptions,
  type OtariMessage,
  type OtariModelKey,
  type OtariRole,
  type OtariTool,
  type OtariUsage,
  type OtariUserBudgetOptions,
  otari,
  stripMarkdownCodeFences,
} from "./otari";

/**
 * Re-export Otari provider as openrouter for seamless backward compatibility.
 * All pipeline calls to openrouter(...) or openrouter.embedding(...) now route
 * through Mozilla's Otari gateway.
 */
export const openrouter = otari;

/**
 * Model registry mapped directly to Otari's open-weight models.
 */
export const MODELS = OTARI_MODELS;

export type ModelKey = keyof typeof MODELS;

// Forward all Otari exports for convenience
export {
  otari,
  OTARI_MODELS,
  FALLBACK_CHAIN,
  callOtari,
  callOtariEmbeddings,
  getOtariProvider,
  OtariBudgetExceededError,
  stripMarkdownCodeFences,
  extractJsonFromContent,
};

export type {
  OtariRole,
  OtariModelKey,
  CallOtariOptions,
  CallOtariResult,
  CallOtariEmbeddingsOptions,
  CallOtariEmbeddingsResult,
  OtariMessage,
  OtariTool,
  OtariGuardrailsOptions,
  OtariUserBudgetOptions,
  OtariUsage,
};
