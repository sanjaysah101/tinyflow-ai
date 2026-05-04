-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Vulnerability patterns knowledge base
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

-- Analysis history
CREATE TABLE IF NOT EXISTS analysis_history (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  code_snippet TEXT NOT NULL,
  language TEXT DEFAULT 'unknown',
  report JSONB,
  models_used TEXT[],
  total_tokens INT DEFAULT 0,
  latency_ms INT DEFAULT 0
);

-- Vector similarity search function
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

-- Create index on pattern_name for seed deduplication
CREATE INDEX IF NOT EXISTS idx_vulnerability_patterns_name ON vulnerability_patterns(pattern_name);