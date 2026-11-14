-- Restore the indexes dropped by the two accidental "DropIndex" migrations
-- (20261103013818_added_dsa_domain_models and
-- 20261103110508_add_problem_chunk_embedding_index).
--
-- IF NOT EXISTS keeps this safe on databases where an index was recreated
-- manually, and makes a fresh migration replay end with both indexes present.
CREATE INDEX IF NOT EXISTS "problem_chunk_tsv_idx"
ON "problem_chunk" USING GIN ("tsv");

CREATE INDEX IF NOT EXISTS "problem_chunk_embedding_hnsw_idx"
ON "problem_chunk" USING hnsw ("embedding" vector_cosine_ops);