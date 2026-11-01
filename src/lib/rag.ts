import { embed } from "ai";
import { and, eq, or } from "drizzle-orm";
import { db, vulnerabilityPatterns } from "@/lib/db";
import {
  callOtariEmbeddings,
  MODELS,
  openrouter,
  OtariBudgetExceededError,
} from "@/lib/openrouter";

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
 * Generate an embedding vector for a given text using Otari gateway embeddings (passing OpenAI `user` parameter).
 */
export async function embedText(
  text: string,
  userId?: string,
): Promise<number[]> {
  try {
    const result = await callOtariEmbeddings({
      text,
      userId: userId || "anonymous-user",
      model: MODELS.embedding,
    });
    if (result.embedding && result.embedding.length > 0) {
      return result.embedding;
    }
  } catch (err: unknown) {
    if (err instanceof OtariBudgetExceededError) {
      throw err; // Propagate native 403 budget_exceeded error
    }
    console.warn(
      "[RAG] Otari native embeddings call failed, falling back to openrouter.embedding:",
      err,
    );
  }

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
  userId?: string,
): Promise<VulnerabilityPattern[]> {
  // Build a query string that combines the code context with the category
  const queryText = `${category} vulnerability in ${language} code: ${codeSnippet.slice(0, 500)}`;

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(queryText, userId);
  } catch (err) {
    if (err instanceof OtariBudgetExceededError) {
      throw err;
    }
    console.warn(
      `[RAG] Embedding failed for category ${category}, proceeding without context`,
    );
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
    .filter(
      (pattern) =>
        Array.isArray(pattern.embedding) && pattern.embedding.length > 0,
    )
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
export function formatPatternsAsContext(
  patterns: VulnerabilityPattern[],
): string {
  if (patterns.length === 0) return "";

  return patterns
    .map((p, idx) => {
      const parts = [
        `### Pattern ${idx + 1}: ${p.pattern_name} [${p.severity.toUpperCase()}]`,
        p.description,
      ];
      if (p.example_code) {
        parts.push(`Vulnerable example:\n\`\`\`\n${p.example_code}\n\`\`\``);
      }
      if (p.fix_suggestion) {
        parts.push(`Recommended fix:\n${p.fix_suggestion}`);
      }
      return parts.join("\n");
    })
    .join("\n\n");
}
