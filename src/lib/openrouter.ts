// ────────────────────────────────────────────────────────────
// Otari Gateway Bridge (Legacy OpenRouter Compatibility Layer)
// MozFest 2026 - Mozilla Otari Hackathon
// ────────────────────────────────────────────────────────────
// Re-exports and routes all calls through src/lib/otari.ts so existing
// pipeline imports and components continue working seamlessly.

import {
  type CallOtariOptions,
  type CallOtariResult,
  callOtari,
  FALLBACK_CHAIN,
  getOtariProvider,
  OTARI_MODELS,
  type OtariGuardrailsOptions,
  type OtariMessage,
  type OtariModelKey,
  type OtariRole,
  type OtariTool,
  type OtariUsage,
  type OtariUserBudgetOptions,
  otari,
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
export { otari, OTARI_MODELS, FALLBACK_CHAIN, callOtari, getOtariProvider };

export type {
  OtariRole,
  OtariModelKey,
  CallOtariOptions,
  CallOtariResult,
  OtariMessage,
  OtariTool,
  OtariGuardrailsOptions,
  OtariUserBudgetOptions,
  OtariUsage,
};
