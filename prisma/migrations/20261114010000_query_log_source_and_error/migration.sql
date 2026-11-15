-- Query logs gained a source label (search, tutor-ask, tutor-hint) and an
-- error column so failed requests are observable too.
ALTER TABLE "query_log" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'search';
ALTER TABLE "query_log" ADD COLUMN "error" TEXT;

CREATE INDEX "query_log_source_createdAt_idx" ON "query_log"("source", "createdAt");