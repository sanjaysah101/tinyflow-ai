#!/usr/bin/env node

/**
 * Database Migration Script
 * Creates the necessary tables for TinyFlow AI
 */

import postgres from "postgres";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 1, // Single connection for migrations
});

async function runMigrations() {
  console.log("🚀 Starting database migrations...");

  try {
    // Enable pgvector extension
    console.log("📦 Enabling pgvector extension...");
    await sql`CREATE EXTENSION IF NOT EXISTS vector;`;

    // Create vulnerability_patterns table
    console.log("📋 Creating vulnerability_patterns table...");
    await sql`
      CREATE TABLE IF NOT EXISTS vulnerability_patterns (
        id BIGSERIAL PRIMARY KEY,
        category TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'any',
        pattern_name TEXT NOT NULL,
        description TEXT NOT NULL,
        example_code TEXT,
        fix_suggestion TEXT,
        severity TEXT NOT NULL DEFAULT 'medium',
        embedding VECTOR(768),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Create analysis_history table
    console.log("📊 Creating analysis_history table...");
    await sql`
      CREATE TABLE IF NOT EXISTS analysis_history (
        id BIGSERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        code_snippet TEXT NOT NULL,
        language TEXT DEFAULT 'unknown',
        report JSONB,
        models_used JSONB,
        total_tokens INT DEFAULT 0,
        latency_ms INT DEFAULT 0
      );
    `;

    // Alter models_used column to JSONB if it exists as TEXT[]
    console.log("🔧 Updating models_used column type...");
    try {
      await sql`ALTER TABLE analysis_history ALTER COLUMN models_used TYPE JSONB USING models_used::JSONB;`;
    } catch (alterErr) {
      // Column might already be JSONB or doesn't exist yet, ignore
      console.log("ℹ️  Column update skipped (might already be correct type)");
    }

    // Create vector similarity search function
    console.log("🔍 Creating vector similarity search function...");
    await sql`
      CREATE OR REPLACE FUNCTION match_vulnerability_patterns(
        query_embedding VECTOR(768),
        match_count INT DEFAULT 5,
        filter_category TEXT DEFAULT NULL,
        filter_language TEXT DEFAULT NULL
      )
      RETURNS TABLE (
        id BIGINT,
        category TEXT,
        language TEXT,
        pattern_name TEXT,
        description TEXT,
        example_code TEXT,
        fix_suggestion TEXT,
        severity TEXT,
        similarity FLOAT
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          vp.id,
          vp.category,
          vp.language,
          vp.pattern_name,
          vp.description,
          vp.example_code,
          vp.fix_suggestion,
          vp.severity,
          1 - (vp.embedding <=> query_embedding) AS similarity
        FROM vulnerability_patterns vp
        WHERE
          (filter_category IS NULL OR vp.category = filter_category)
          AND (filter_language IS NULL OR vp.language = filter_language OR vp.language = 'any')
        ORDER BY vp.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $$;
    `;

    // Create index for pattern deduplication
    console.log("🔗 Creating indexes...");
    await sql`
      CREATE INDEX IF NOT EXISTS idx_vulnerability_patterns_name
      ON vulnerability_patterns(pattern_name);
    `;

    console.log("✅ Database migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigrations();