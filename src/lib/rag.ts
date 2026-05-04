import { db, vulnerabilityPatterns } from "@/lib/db";
import { openrouter, MODELS } from "@/lib/openrouter";
import { embed } from "ai";
import { and, eq, or } from "drizzle-orm";

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

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, value, idx) => sum + value * (b[idx] ?? 0), 0);
  const magA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const magB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  return magA === 0 || magB === 0 ? 0 : dot / (magA * magB);
}

/**
 * Retrieve the most relevant vulnerability patterns from the database for a given code snippet and category.
 */
export async function retrievePatterns(
  codeSnippet: string,
  category: string,
  language: string,
  topK = 4,
): Promise<VulnerabilityPattern[]> {
  // Build a query string that combines the code context with the category
  const queryText = `${category} vulnerability in ${language} code: ${codeSnippet.slice(0, 500)}`;

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(queryText);
  } catch {
    console.warn(`[RAG] Embedding failed for category ${category}, proceeding without context`);
    return [];
  }

  const patterns = await db
    .select()
    .from(vulnerabilityPatterns)
    .where(
      and(
        eq(vulnerabilityPatterns.category, category),
        or(
          eq(vulnerabilityPatterns.language, language),
          eq(vulnerabilityPatterns.language, "any"),
        ),
      ),
    );

  const scored = patterns
    .filter((pattern) => Array.isArray(pattern.embedding) && pattern.embedding.length > 0)
    .map((pattern) => ({
      ...pattern,
      similarity: cosineSimilarity(queryEmbedding, pattern.embedding ?? []),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return scored.map((pattern) => ({
    id: Number(pattern.id),
    category: pattern.category ?? "unknown",
    language: pattern.language ?? "unknown",
    pattern_name: pattern.patternName ?? "unknown pattern",
    description: pattern.description ?? "No description available.",
    example_code: pattern.exampleCode ?? null,
    fix_suggestion: pattern.fixSuggestion ?? null,
    severity: pattern.severity ?? "medium",
    similarity: pattern.similarity,
  }));
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
