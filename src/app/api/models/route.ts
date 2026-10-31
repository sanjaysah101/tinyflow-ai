import { NextResponse } from "next/server";
import { FALLBACK_CHAIN, OTARI_BASE_URL, OTARI_MODELS } from "@/lib/otari";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const byokKey = req.headers.get("x-otari-api-key");
  const byokBaseUrl = req.headers.get("x-otari-base-url");

  const apiKey =
    byokKey ||
    process.env.OTARI_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    "";
  const baseUrl = (
    byokBaseUrl ||
    process.env.OTARI_BASE_URL ||
    OTARI_BASE_URL
  ).replace(/\/+$/, "");

  try {
    if (apiKey) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "User-Agent": "TinyFlow-AI/MozFest-2026",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.models)
            ? data.models
            : Array.isArray(data)
              ? data
              : [];

        // Filter or annotate open-weight models
        const models = rawList.map((m: { id?: string; name?: string }) => ({
          id: m.id || m.name,
          name: m.name || m.id,
          tier: "open-weight",
          provider: "Otari.ai Gateway",
        }));

        return NextResponse.json({
          status: "connected",
          authTier: byokKey
            ? "byok"
            : process.env.OTARI_API_KEY
              ? "server_otari"
              : "failover_gateway",
          gateway: baseUrl,
          modelsCount: models.length,
          models,
          source: "live_gateway",
        });
      }
    }
  } catch (err) {
    console.warn(
      "[API:models] Live model catalog query timed out or failed:",
      err,
    );
  }

  // Fallback to verified Otari open-weight model roster
  return NextResponse.json({
    status: apiKey ? "ready" : "catalog_default",
    authTier: byokKey
      ? "byok"
      : process.env.OTARI_API_KEY
        ? "server_otari"
        : "failover_gateway",
    gateway: baseUrl,
    modelsCount: 7,
    models: [
      {
        id: OTARI_MODELS.router,
        name: "Qwen 3.5 9B (Router)",
        role: "router",
        tier: "open-weight",
        pricing: "$0.10/M",
      },
      {
        id: OTARI_MODELS.specialist,
        name: "Qwen 3 32B Dense (Specialist)",
        role: "specialist",
        tier: "open-weight",
        pricing: "$0.08/M",
      },
      {
        id: OTARI_MODELS.synthesizer,
        name: "Qwen 3.6 35B MoE (Synthesizer)",
        role: "synthesizer",
        tier: "open-weight",
        pricing: "$0.10/M",
      },
      {
        id: OTARI_MODELS.embedding,
        name: "Qwen 3 Embedding 0.6B",
        role: "embedding",
        tier: "open-weight",
        pricing: "$0.01/M",
      },
      {
        id: FALLBACK_CHAIN.router[0],
        name: "Qwen 3 30B MoE (Router Fallback)",
        role: "router_fallback",
        tier: "open-weight",
        pricing: "$0.15/M",
      },
      {
        id: FALLBACK_CHAIN.specialist[0],
        name: "Qwen 3 Coder 480B Turbo (Specialist Fallback)",
        role: "specialist_fallback",
        tier: "open-weight",
        pricing: "$0.45/M",
      },
      {
        id: FALLBACK_CHAIN.synthesizer[0],
        name: "Qwen 3.5 27B (Synthesizer Fallback)",
        role: "synthesizer_fallback",
        tier: "open-weight",
        pricing: "$0.12/M",
      },
    ],
    source: "catalog_registry",
  });
}
