CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "ProblemDifficulty" AS ENUM ('Easy', 'Medium', 'Hard');
CREATE TYPE "ProblemChunkSection" AS ENUM ('statement', 'approach', 'complexity', 'code', 'editorial');
CREATE TYPE "AttemptVerdict" AS ENUM ('passed', 'failed', 'error', 'timeout', 'unverified');

CREATE TABLE "problem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "difficulty" "ProblemDifficulty" NOT NULL,
    "platform" TEXT,
    "sourceUrl" TEXT,
    "constraints" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "problem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "problem_chunk" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "section" "ProblemChunkSection" NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768),
    "tsv" tsvector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "problem_chunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pattern" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "pattern_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "problem_pattern" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    CONSTRAINT "problem_pattern_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "test_case" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "test_case_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "verdict" "AttemptVerdict" NOT NULL,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "timeSpentSec" INTEGER,
    "executionMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hint_state" (
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "currentLevel" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hint_state_pkey" PRIMARY KEY ("userId", "problemId")
);

CREATE TABLE "user_pattern_stat" (
    "userId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "passes" INTEGER NOT NULL DEFAULT 0,
    "averageHints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weaknessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_pattern_stat_pkey" PRIMARY KEY ("userId", "patternId")
);

CREATE TABLE "answer_cache" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "hintLevel" INTEGER NOT NULL,
    "queryText" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "answer_cache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rate_limit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "query_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "problemId" TEXT,
    "query" TEXT NOT NULL,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "retrievalMs" INTEGER,
    "llmMs" INTEGER,
    "totalMs" INTEGER,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "query_log_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "problem_slug_key" ON "problem"("slug");
CREATE INDEX "problem_difficulty_idx" ON "problem"("difficulty");
CREATE INDEX "problem_platform_idx" ON "problem"("platform");
CREATE INDEX "problem_chunk_problemId_section_idx" ON "problem_chunk"("problemId", "section");
CREATE INDEX "problem_chunk_tsv_idx" ON "problem_chunk" USING GIN ("tsv");
CREATE UNIQUE INDEX "pattern_name_key" ON "pattern"("name");
CREATE UNIQUE INDEX "problem_pattern_problemId_patternId_key" ON "problem_pattern"("problemId", "patternId");
CREATE INDEX "problem_pattern_patternId_idx" ON "problem_pattern"("patternId");
CREATE INDEX "test_case_problemId_sortOrder_idx" ON "test_case"("problemId", "sortOrder");
CREATE INDEX "attempt_userId_createdAt_idx" ON "attempt"("userId", "createdAt");
CREATE INDEX "attempt_problemId_createdAt_idx" ON "attempt"("problemId", "createdAt");
CREATE INDEX "user_pattern_stat_userId_weaknessScore_idx" ON "user_pattern_stat"("userId", "weaknessScore");
CREATE UNIQUE INDEX "answer_cache_problemId_hintLevel_queryText_key" ON "answer_cache"("problemId", "hintLevel", "queryText");
CREATE INDEX "answer_cache_problemId_hintLevel_idx" ON "answer_cache"("problemId", "hintLevel");
CREATE INDEX "answer_cache_expiresAt_idx" ON "answer_cache"("expiresAt");
CREATE UNIQUE INDEX "rate_limit_userId_endpoint_windowStart_key" ON "rate_limit"("userId", "endpoint", "windowStart");
CREATE INDEX "rate_limit_userId_windowStart_idx" ON "rate_limit"("userId", "windowStart");
CREATE INDEX "query_log_userId_createdAt_idx" ON "query_log"("userId", "createdAt");
CREATE INDEX "query_log_createdAt_idx" ON "query_log"("createdAt");

ALTER TABLE "problem_chunk" ADD CONSTRAINT "problem_chunk_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "problem_pattern" ADD CONSTRAINT "problem_pattern_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "problem_pattern" ADD CONSTRAINT "problem_pattern_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "pattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "test_case" ADD CONSTRAINT "test_case_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hint_state" ADD CONSTRAINT "hint_state_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hint_state" ADD CONSTRAINT "hint_state_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_pattern_stat" ADD CONSTRAINT "user_pattern_stat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_pattern_stat" ADD CONSTRAINT "user_pattern_stat_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "pattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "answer_cache" ADD CONSTRAINT "answer_cache_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rate_limit" ADD CONSTRAINT "rate_limit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "query_log" ADD CONSTRAINT "query_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "query_log" ADD CONSTRAINT "query_log_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
