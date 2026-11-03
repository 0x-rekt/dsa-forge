import { Prisma, PrismaClient } from "@/app/generated/prisma/client";

const RRF_K = 60;
const RESULT_LIMIT = 10;
const CANDIDATE_LIMIT = 40;
const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";

type SearchFilters = {
  difficulty?: "Easy" | "Medium" | "Hard";
  pattern?: string;
  platform?: string;
};

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

function filterSql(filters: SearchFilters) {
  const conditions: Prisma.Sql[] = [];

  if (filters.difficulty) {
    conditions.push(Prisma.sql`p."difficulty" = ${filters.difficulty}::"ProblemDifficulty"`);
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

  return conditions.length > 0 ? Prisma.sql`AND ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
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

async function keywordSearch(prisma: PrismaClient, query: string, filters: SearchFilters) {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3);
  const contentFallback = terms.length > 0
    ? Prisma.sql`OR (${Prisma.join(terms.map((term) => Prisma.sql`pc."content" ILIKE ${`%${term}%`}`), " OR ")})`
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
    ) DESC
    LIMIT ${CANDIDATE_LIMIT}
  `);
}

async function embedQuery(query: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: `models/${embeddingModel}`,
        content: { parts: [{ text: query }] },
        taskType: "RETRIEVAL_QUERY",
        outputDimensionality: 768,
      }),
    },
  );

  const body = await response.json() as { embedding?: { values?: number[] }; error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? `Embedding request failed (${response.status})`);

  const values = body.embedding?.values ?? [];
  if (values.length !== 768) throw new Error(`Expected a 768-dimensional query embedding, received ${values.length}`);
  return `[${values.join(",")}]`;
}

async function vectorSearch(prisma: PrismaClient, vector: string, filters: SearchFilters) {
  return prisma.$queryRaw<SearchRow[]>(Prisma.sql`
    SELECT ${sharedSelection}
    FROM "problem_chunk" pc
    INNER JOIN "problem" p ON p."id" = pc."problemId"
    LEFT JOIN "problem_pattern" pp ON pp."problemId" = p."id"
    LEFT JOIN "pattern" pattern ON pattern."id" = pp."patternId"
    WHERE pc."embedding" IS NOT NULL
      ${filterSql(filters)}
    GROUP BY pc."id", p."id", pc."section", pc."content"
    ORDER BY pc."embedding" <=> ${vector}::vector
    LIMIT ${CANDIDATE_LIMIT}
  `);
}

function mergeResults(keywordRows: SearchRow[], vectorRows: SearchRow[]) {
  const candidates = new Map<string, SearchCandidate>();

  function addRows(rows: SearchRow[], kind: "keyword" | "vector") {
    rows.forEach((row, index) => {
      const rank = index + 1;
      const current = candidates.get(row.problem_id) ?? {
        row,
        score: 0,
        matchedSections: new Set<string>(),
      };

      current.score += 1 / (RRF_K + rank);
      current.matchedSections.add(row.section);
      if (kind === "keyword") current.keywordRank = Math.min(current.keywordRank ?? Infinity, rank);
      else current.vectorRank = Math.min(current.vectorRank ?? Infinity, rank);
      candidates.set(row.problem_id, current);
    });
  }

  addRows(keywordRows, "keyword");
  addRows(vectorRows, "vector");

  return [...candidates.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, RESULT_LIMIT)
    .map(({ row, keywordRank, vectorRank, matchedSections, score }) => ({
      slug: row.slug,
      title: row.title,
      difficulty: row.difficulty,
      platform: row.platform,
      tags: row.tags,
      matchedSections: [...matchedSections],
      whyMatched: keywordRank && vectorRank
        ? "Matched by keywords and meaning"
        : vectorRank
          ? "Matched by meaning"
          : "Matched by problem wording",
      score: Number(score.toFixed(6)),
    }));
}

export async function searchProblems(
  prisma: PrismaClient,
  query: string,
  filters: SearchFilters = {},
) {
  const keywordRows = await keywordSearch(prisma, query, filters);
  let vectorRows: SearchRow[] = [];
  let vectorSearchAvailable = false;

  try {
    const vector = await embedQuery(query);
    if (vector) {
      vectorRows = await vectorSearch(prisma, vector, filters);
      vectorSearchAvailable = true;
    }
  } catch (error) {
    console.warn("Vector search unavailable; returning keyword results.", error);
  }

  return {
    results: mergeResults(keywordRows, vectorRows),
    keywordMatches: keywordRows.length,
    vectorMatches: vectorRows.length,
    vectorSearchAvailable,
  };
}
