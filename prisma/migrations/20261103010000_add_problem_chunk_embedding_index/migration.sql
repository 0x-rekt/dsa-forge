CREATE INDEX IF NOT EXISTS "problem_chunk_embedding_hnsw_idx"
ON "problem_chunk" USING hnsw ("embedding" vector_cosine_ops);
