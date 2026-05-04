import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { pgTable, serial, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must be set for Drizzle database access.");
}

const sql = postgres(DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(sql);

export const vulnerabilityPatterns = pgTable("vulnerability_patterns", {
  id: serial("id").primaryKey(),
  category: text("category"),
  language: text("language").default("any"),
  patternName: text("pattern_name"),
  description: text("description"),
  exampleCode: text("example_code").$type<string | null>(),
  fixSuggestion: text("fix_suggestion").$type<string | null>(),
  severity: text("severity").default("medium"),
  embedding: jsonb("embedding").$type<number[] | null>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const analysisHistory = pgTable("analysis_history", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow(),
  codeSnippet: text("code_snippet"),
  language: text("language").default("unknown"),
  report: jsonb("report").$type<Record<string, unknown> | null>(),
  modelsUsed: jsonb("models_used").$type<string[]>(),
  totalTokens: integer("total_tokens").default(0),
  latencyMs: integer("latency_ms").default(0),
});
