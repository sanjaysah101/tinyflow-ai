import { createClient } from "@/utils/supabase/server";
import { openrouter, MODELS } from "@/lib/openrouter";
import { embed } from "ai";

export interface VulnerabilityPattern {
  id: number;
  category: string;
  language: string;
  pattern_name: string;
  description: string;
  example_code: string | null;
  fix_suggestion: string | null;
  severity: string;
  similarity: number;
}

/**
 * Generate an embedding vector for a given text using nomic-embed-text.
 */
export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openrouter.embedding(MODELS.embedding),
    value: text,
  });
  return embedding;
}

/**
 * Retrieve the most relevant vulnerability patterns from Supabase pgvector
 * for a given code snippet and category.
 */
export async function retrievePatterns(
  codeSnippet: string,
  category: string,
  language: string,
  topK = 4,
): Promise<VulnerabilityPattern[]> {
  const supabase = await createClient();

  // Build a query string that combines the code context with the category
  const queryText = `${category} vulnerability in ${language} code: ${codeSnippet.slice(0, 500)}`;

  let embedding: number[];
  try {
    embedding = await embedText(queryText);
  } catch {
    // If embedding fails (rate limit), return empty — specialist will work without RAG context
    console.warn(`[RAG] Embedding failed for category ${category}, proceeding without context`);
    return [];
  }

  const { data, error } = await supabase.rpc("match_vulnerability_patterns", {
    query_embedding: embedding,
    match_count: topK,
    filter_category: category,
    filter_language: language === "unknown" ? null : language,
  });

  if (error) {
    console.error("[RAG] Supabase RPC error:", error.message);
    return [];
  }

  return (data as VulnerabilityPattern[]) ?? [];
}

/**
 * Format retrieved patterns into a concise context block for the specialist prompt.
 */
export function formatPatternsAsContext(patterns: VulnerabilityPattern[]): string {
  if (patterns.length === 0) {
    return "No specific patterns retrieved. Rely on your training knowledge.";
  }

  return patterns
    .map(
      (p, i) =>
        `[Pattern ${i + 1}] ${p.pattern_name} (${p.severity.toUpperCase()})\n` +
        `Description: ${p.description}\n` +
        (p.fix_suggestion ? `Fix: ${p.fix_suggestion}` : ""),
    )
    .join("\n\n");
}
