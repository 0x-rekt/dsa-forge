-- Semantic answer cache: match a near-duplicate question (cosine similarity
-- above ANSWER_CACHE_SIMILARITY, default 0.95) before calling the LLM.
-- HNSW keeps the lookup fast as the cache grows.
ALTER TABLE "answer_cache" ADD COLUMN "queryEmbedding" vector(768);

CREATE INDEX IF NOT EXISTS "answer_cache_queryEmbedding_hnsw_idx"
ON "answer_cache" USING hnsw ("queryEmbedding" vector_cosine_ops);
