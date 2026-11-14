import { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import { GoogleGenAI } from "@google/genai";

const RRF_K = 60;
const RESULT_LIMIT = 8;
const CANDIDATE_LIMIT = 40;
const RERANK_CANDIDATE_LIMIT = 20;
const embeddingModel =
  process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
const rerankerModel =
  process.env.JINA_RERANK_MODEL ?? "jina-reranker-v3.5";
const sectionWeights: Record<string, number> = {
  statement: 1.5,
  approach: 1.3,
  complexity: 1.15,
  editorial: 1.1,
  code: 0.45,
};

// Keyword matching is materially weaker than embedding search on paraphrase
// queries, so the two lists must not contribute equally to RRF. Vector hits
// still need keyword support for exact names, hence a non-zero keyword weight.
function envWeight(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const sourceWeights = {
  keyword: envWeight("SEARCH_KEYWORD_WEIGHT", 0.2),
  vector: envWeight("SEARCH_VECTOR_WEIGHT", 1),
  rerank: envWeight("SEARCH_RERANK_WEIGHT", 1),
};

type SearchFilters = {
  difficulty?: "Easy" | "Medium" | "Hard";
  pattern?: string;
  platform?: string;
};

export type SearchMode = "keyword" | "vector" | "hybrid" | "reranked";

type SearchRow = {
  chunk_id: string;
  problem_id: string;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  platform: string | null;
  tags: string[];
  section: string;
  content: string;
};

type SearchCandidate = {
  row: SearchRow;
  score: number;
  keywordRank?: number;
  vectorRank?: number;
  matchedSections: Set<string>;
};

type RerankResult = {
  index: number;
  relevance_score: number;
};

function filterSql(filters: SearchFilters) {
  const conditions: Prisma.Sql[] = [];

  if (filters.difficulty) {
    conditions.push(
      Prisma.sql`p."difficulty" = ${filters.difficulty}::"ProblemDifficulty"`,
    );
  }

  if (filters.platform) {
    conditions.push(Prisma.sql`p."platform" = ${filters.platform}`);
  }

  if (filters.pattern) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1
      FROM "problem_pattern" filter_pp
      INNER JOIN "pattern" filter_pattern ON filter_pattern."id" = filter_pp."patternId"
      WHERE filter_pp."problemId" = p."id"
        AND filter_pattern."name" = ${filters.pattern}
    )`);
  }

  return conditions.length > 0
    ? Prisma.sql`AND ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;
}

const sharedSelection = Prisma.sql`
  pc."id" AS chunk_id,
  p."id" AS problem_id,
  p."slug",
  p."title",
  p."difficulty",
  p."platform",
  pc."section",
  pc."content",
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT pattern."name"), NULL)::text[] AS tags
`;

async function keywordSearch(
  prisma: PrismaClient,
  query: string,
  filters: SearchFilters,
) {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3);
  const contentFallback =
    terms.length > 0
      ? Prisma.sql`OR (${Prisma.join(
          terms.map((term) => Prisma.sql`pc."content" ILIKE ${`%${term}%`}`),
          " OR ",
        )})`
      : Prisma.empty;

  return prisma.$queryRaw<SearchRow[]>(Prisma.sql`
    SELECT ${sharedSelection}
    FROM "problem_chunk" pc
    INNER JOIN "problem" p ON p."id" = pc."problemId"
    LEFT JOIN "problem_pattern" pp ON pp."problemId" = p."id"
    LEFT JOIN "pattern" pattern ON pattern."id" = pp."patternId"
    WHERE (
      pc."tsv" @@ plainto_tsquery('english', ${query})
      OR (
        pc."tsv" IS NULL
        AND to_tsvector('english', pc."content") @@ plainto_tsquery('english', ${query})
      )
      ${contentFallback}
    )
      ${filterSql(filters)}
    GROUP BY pc."id", p."id", pc."section", pc."content"
    ORDER BY ts_rank_cd(
      COALESCE(NULLIF(pc."tsv", ''::tsvector), to_tsvector('english', pc."content")),
      plainto_tsquery('english', ${query})
    ) * CASE pc."section"
      WHEN 'statement' THEN 1.5
      WHEN 'approach' THEN 1.3
      WHEN 'complexity' THEN 1.15
      WHEN 'editorial' THEN 1.1
      ELSE 0.45
    END DESC
    LIMIT ${CANDIDATE_LIMIT}
  `);
}

async function embedQuery(query: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.embedContent({
    model: embeddingModel,
    contents: query,
    config: {
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: 768,
    },
  });

  const values = response.embeddings?.[0]?.values ?? [];
  if (values.length !== 768)
    throw new Error(
      `Expected a 768-dimensional query embedding, received ${values.length}`,
    );
  return `[${values.join(",")}]`;
}

async function vectorSearch(
  prisma: PrismaClient,
  vector: string,
  filters: SearchFilters,
) {
  return prisma.$queryRaw<SearchRow[]>(Prisma.sql`
    SELECT ${sharedSelection}
    FROM "problem_chunk" pc
    INNER JOIN "problem" p ON p."id" = pc."problemId"
    LEFT JOIN "problem_pattern" pp ON pp."problemId" = p."id"
    LEFT JOIN "pattern" pattern ON pattern."id" = pp."patternId"
    WHERE pc."embedding" IS NOT NULL
      ${filterSql(filters)}
    GROUP BY pc."id", p."id", pc."section", pc."content"
    ORDER BY (pc."embedding" <=> ${vector}::vector) /
      CASE pc."section"
        WHEN 'statement' THEN 1.5
        WHEN 'approach' THEN 1.3
        WHEN 'complexity' THEN 1.15
        WHEN 'editorial' THEN 1.1
        ELSE 0.45
      END
    LIMIT ${CANDIDATE_LIMIT}
  `);
}

function mergeResults(keywordRows: SearchRow[], vectorRows: SearchRow[]) {
  const candidates = new Map<string, SearchCandidate>();

  function addRows(rows: SearchRow[], kind: "keyword" | "vector") {
    rows.forEach((row, index) => {
      const rank = index + 1;
      const current = candidates.get(row.chunk_id) ?? {
        row,
        score: 0,
        matchedSections: new Set<string>(),
      };

      current.score +=
        (sourceWeights[kind] * (sectionWeights[row.section] ?? 1)) /
        (RRF_K + rank);
      current.matchedSections.add(row.section);
      if (kind === "keyword")
        current.keywordRank = Math.min(current.keywordRank ?? Infinity, rank);
      else current.vectorRank = Math.min(current.vectorRank ?? Infinity, rank);
      candidates.set(row.chunk_id, current);
    });
  }

  addRows(keywordRows, "keyword");
  addRows(vectorRows, "vector");

  const distinctProblems = new Set<string>();

  return [...candidates.values()]
    .sort((left, right) => {
      const scoreDelta = right.score - left.score;
      if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;

      // Equal RRF scores should resolve towards the stronger source rather
      // than the order the lists were merged in.
      const vectorDelta =
        (left.vectorRank ?? Infinity) - (right.vectorRank ?? Infinity);
      if (vectorDelta !== 0) return vectorDelta;

      const keywordDelta =
        (left.keywordRank ?? Infinity) - (right.keywordRank ?? Infinity);
      if (keywordDelta !== 0) return keywordDelta;

      return left.row.slug.localeCompare(right.row.slug);
    })
    .map(({ row, keywordRank, vectorRank, matchedSections, score }) => ({
      chunkId: row.chunk_id,
      problemId: row.problem_id,
      slug: row.slug,
      title: row.title,
      difficulty: row.difficulty,
      platform: row.platform,
      tags: row.tags,
      section: row.section,
      content: row.content,
      matchedSections: [...matchedSections],
      whyMatched:
        keywordRank && vectorRank
          ? "Matched by keywords and meaning"
          : vectorRank
            ? "Matched by meaning"
            : "Matched by problem wording",
      score: Number(score.toFixed(6)),
    }))
    .filter((result) => {
      if (distinctProblems.has(result.problemId)) return false;
      distinctProblems.add(result.problemId);
      return true;
    })
    .slice(0, CANDIDATE_LIMIT);
}

async function rerankResults(
  query: string,
  results: ReturnType<typeof mergeResults>,
) {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey || results.length === 0) {
    return { results: results.slice(0, RESULT_LIMIT), available: false };
  }

  const response = await fetch("https://api.jina.ai/v1/rerank", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: rerankerModel,
      query,
      documents: results.map(
        (result) =>
          `Title: ${result.title}\nTags: ${result.tags.join(", ")}\nSection: ${result.section}\nContent:\n${result.content}`,
      ),
      top_n: results.length,
      return_documents: false,
    }),
  });

  const body = (await response.json()) as {
    results?: RerankResult[];
    detail?: string;
  };
  if (!response.ok) {
    throw new Error(
      body.detail ?? `Reranker request failed (${response.status})`,
    );
  }

  if (!body.results)
    throw new Error("Reranker response did not include results");

  const ranked = body.results
    .filter(
      (item) =>
        Number.isInteger(item.index) &&
        item.index >= 0 &&
        item.index < results.length,
    )
    .sort((left, right) => right.relevance_score - left.relevance_score)
    .map((item, rerankIndex) => ({
      result: results[item.index],
      retrievalRank: item.index + 1,
      rerankRank: rerankIndex + 1,
    }));

  // Fuse the cross-encoder order with retrieval order instead of replacing it
  // outright. A single bad reranker decision can then demote, but not erase,
  // a strong retrieval hit.
  const fused = ranked
    .map(({ result, retrievalRank, rerankRank }) => ({
      result,
      score:
        1 / (RRF_K + retrievalRank) +
        sourceWeights.rerank / (RRF_K + rerankRank),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, RESULT_LIMIT)
    .map(({ result, score }) => ({
      ...result,
      score: Number(score.toFixed(6)),
    }));

  return { available: true, results: fused };
}

export async function searchProblems(
  prisma: PrismaClient,
  query: string,
  filters: SearchFilters = {},
  mode: SearchMode = "reranked",
) {
  const keywordPromise =
    mode === "vector"
      ? Promise.resolve([] as SearchRow[])
      : keywordSearch(prisma, query, filters);
  const embeddingPromise =
    mode === "keyword"
      ? Promise.resolve(null)
      : embedQuery(query).catch((error: unknown) => {
          console.warn(
            "Vector embedding unavailable; returning keyword results.",
            error,
          );
          return null;
        });
  const [keywordRows, vector] = await Promise.all([
    keywordPromise,
    embeddingPromise,
  ]);
  let vectorRows: SearchRow[] = [];
  let vectorSearchAvailable = false;

  try {
    if (vector) {
      vectorRows = await vectorSearch(prisma, vector, filters);
      vectorSearchAvailable = true;
    }
  } catch (error) {
    console.warn(
      "Vector search unavailable; returning keyword results.",
      error,
    );
  }

  const mergedResults =
    mode === "keyword"
      ? mergeResults(keywordRows, [])
      : mode === "vector"
        ? mergeResults([], vectorRows)
        : mergeResults(keywordRows, vectorRows);
  let rerankedResults = mergedResults.slice(0, RESULT_LIMIT);
  let rerankingAvailable = false;
  let rerankingError: string | undefined;

  try {
    if (mode !== "reranked") {
      return {
        results: rerankedResults,
        keywordMatches: keywordRows.length,
        vectorMatches: vectorRows.length,
        vectorSearchAvailable,
        rerankingAvailable: false,
      };
    }

    const reranked = await rerankResults(
      query,
      mergedResults.slice(0, RERANK_CANDIDATE_LIMIT),
    );
    rerankedResults = reranked.results;
    rerankingAvailable = reranked.available;
  } catch (error) {
    rerankingError =
      error instanceof Error ? error.message : "Reranker request failed";
    console.warn("Reranking unavailable; returning RRF results.", error);
  }

  return {
    results: rerankedResults,
    keywordMatches: keywordRows.length,
    vectorMatches: vectorRows.length,
    vectorSearchAvailable,
    rerankingAvailable,
    ...(rerankingError ? { rerankingError } : {}),
  };
}

export async function findSimilarProblems(
  prisma: PrismaClient,
  problemId: string,
  limit = 5,
) {
  return prisma.$queryRaw<
    Array<{
      slug: string;
      title: string;
      difficulty: "Easy" | "Medium" | "Hard";
      platform: string | null;
      tags: string[];
      shared_patterns: number;
      distance: number | null;
    }>
  >(Prisma.sql`
    WITH target AS (
      SELECT p."id", ARRAY_AGG(DISTINCT pp."patternId") AS pattern_ids
      FROM "problem" p
      LEFT JOIN "problem_pattern" pp ON pp."problemId" = p."id"
      WHERE p."id" = ${problemId}
      GROUP BY p."id"
    ),
    target_embedding AS (
      SELECT pc."embedding"
      FROM "problem_chunk" pc
      WHERE pc."problemId" = ${problemId}
        AND pc."section" = 'statement'
        AND pc."embedding" IS NOT NULL
      ORDER BY pc."createdAt"
      LIMIT 1
    )
    SELECT
      p."slug",
      p."title",
      p."difficulty",
      p."platform",
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT pattern."name"), NULL)::text[] AS tags,
      COUNT(DISTINCT CASE WHEN pp."patternId" = ANY(target.pattern_ids) THEN pp."patternId" END)::int AS shared_patterns,
      MIN(pc."embedding" <=> target_embedding."embedding") AS distance
    FROM "problem" p
    CROSS JOIN target
    LEFT JOIN "problem_pattern" pp ON pp."problemId" = p."id"
    LEFT JOIN "pattern" pattern ON pattern."id" = pp."patternId"
    LEFT JOIN "problem_chunk" pc
      ON pc."problemId" = p."id"
      AND pc."section" = 'statement'
      AND pc."embedding" IS NOT NULL
    LEFT JOIN target_embedding ON TRUE
    WHERE p."id" <> ${problemId}
      AND (
        pp."patternId" = ANY(target.pattern_ids)
        OR pc."embedding" IS NOT NULL
      )
    GROUP BY p."id", p."slug", p."title", p."difficulty", p."platform", target.pattern_ids
    ORDER BY
      COUNT(DISTINCT CASE WHEN pp."patternId" = ANY(target.pattern_ids) THEN pp."patternId" END) DESC,
      MIN(pc."embedding" <=> target_embedding."embedding") ASC NULLS LAST
    LIMIT ${limit}
  `);
}
