import { prisma } from "@/lib/prisma";
import { TUTOR_PROMPT_VERSION } from "@/lib/tutor";
import { embedText } from "@/lib/search";

// The PRD calls for a semantic cache at roughly 0.95 cosine similarity. This is
// deliberately conservative: a near-duplicate question is safe to reuse, while
// a merely related question ("how does this work?" vs "what is the complexity?")
// must generate a fresh answer.
const DEFAULT_SIMILARITY = 0.95;

function similarityThreshold() {
  const raw = Number(process.env.ANSWER_CACHE_SIMILARITY);
  return Number.isFinite(raw) && raw > 0 && raw <= 1 ? raw : DEFAULT_SIMILARITY;
}

export const semanticCacheThreshold = similarityThreshold();

export type SemanticCacheHit = {
  answer: string;
  similarity: number;
};

export type SemanticCacheLookup = {
  hit: SemanticCacheHit | null;
  /**
   * The question embedding, whether or not it matched. Reuse it when storing a
   * freshly generated answer so a miss costs one embedding call, not two.
   */
  embedding: string | null;
  /** Closest similarity seen, even when it was below the threshold. */
  bestSimilarity: number | null;
};

export async function lookupSemanticAnswer(
  problemId: string,
  hintLevel: number,
  question: string,
): Promise<SemanticCacheLookup> {
  let embedding: string | null = null;

  try {
    embedding = await embedText(question, "RETRIEVAL_QUERY");
  } catch (error) {
    console.warn("Semantic cache embedding failed; falling back to generation.", error);
    return { hit: null, embedding: null, bestSimilarity: null };
  }

  if (!embedding) {
    return { hit: null, embedding: null, bestSimilarity: null };
  }

  try {
    // pgvector's <=> is cosine distance, so 1 - distance is cosine similarity.
    // Expired rows are ignored here; the exact-cache path deletes its own entry.
    const rows = await prisma.$queryRaw<
      Array<{ answer: string; similarity: number }>
    >`
      SELECT
        "answer",
        1 - ("queryEmbedding" <=> ${embedding}::vector) AS "similarity"
      FROM "answer_cache"
      WHERE "problemId" = ${problemId}
        AND "hintLevel" = ${hintLevel}
        AND "expiresAt" > now()
        AND "queryText" LIKE ${`__ask_v${TUTOR_PROMPT_VERSION}__%`}
        AND "queryEmbedding" IS NOT NULL
      ORDER BY "queryEmbedding" <=> ${embedding}::vector
      LIMIT 1
    `;

    const best = rows[0];
    if (!best) return { hit: null, embedding, bestSimilarity: null };

    const similarity = Number(best.similarity);
    if (!Number.isFinite(similarity)) {
      return { hit: null, embedding, bestSimilarity: null };
    }
    if (similarity < semanticCacheThreshold) {
      return { hit: null, embedding, bestSimilarity: similarity };
    }

    return {
      hit: { answer: best.answer, similarity },
      embedding,
      bestSimilarity: similarity,
    };
  } catch (error) {
    // A cache lookup must never take the tutor down; generate instead.
    console.warn("Semantic cache lookup failed; falling back to generation.", error);
    return { hit: null, embedding, bestSimilarity: null };
  }
}

export async function storeSemanticAnswerEmbedding(
  problemId: string,
  hintLevel: number,
  queryText: string,
  embedding: string,
) {
  try {
    await prisma.$executeRaw`
      UPDATE "answer_cache"
      SET "queryEmbedding" = ${embedding}::vector
      WHERE "problemId" = ${problemId}
        AND "hintLevel" = ${hintLevel}
        AND "queryText" = ${queryText}
    `;
  } catch (error) {
    // The exact-cache entry is still valid; only the semantic shortcut is lost.
    console.warn("Could not store the semantic cache embedding.", error);
  }
}
