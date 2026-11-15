import { prisma } from "../lib/prisma";
import { embedText } from "../lib/search";
import {
  lookupSemanticAnswer,
  semanticCacheThreshold,
  storeSemanticAnswerEmbedding,
} from "../lib/semantic-cache";
import { tutorAnswerCacheKey } from "../lib/tutor";

// Uses a dedicated hint level so the test never reads or deletes a real cached
// answer, and never needs an authenticated request.
const TEST_LEVEL = 99;
const NEXT_LEVEL = 100;
const OLD_VERSION_LEVEL = 101;
const BASE_QUESTION = "What is the key idea behind the optimal approach?";
const PARAPHRASE = "What's the key idea of the optimal approach?";
const RELATED = "What are the time and space complexity of the solution?";
const UNRELATED = "How do I reverse a singly linked list?";
const CACHE_KEY = tutorAnswerCacheKey(BASE_QUESTION);

let failures = 0;

function check(name: string, passed: boolean, detail: string) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!passed) failures += 1;
}

async function main() {
  const problem = await prisma.problem.findUnique({
    where: { slug: "01-matrix" },
    select: { id: true, title: true },
  });
  if (!problem) throw new Error("Test problem 01-matrix is missing.");

  await prisma.answerCache.deleteMany({
    where: { problemId: problem.id, hintLevel: { in: [TEST_LEVEL, NEXT_LEVEL, OLD_VERSION_LEVEL] } },
  });

  const answer = `Semantic cache test answer for ${problem.title}.`;
  await prisma.answerCache.create({
    data: {
      problemId: problem.id,
      hintLevel: TEST_LEVEL,
      queryText: CACHE_KEY,
      answer,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const embedding = await embedText(BASE_QUESTION, "RETRIEVAL_QUERY");
  if (!embedding) throw new Error("GEMINI_API_KEY is required to embed the test question.");
  await storeSemanticAnswerEmbedding(
    problem.id,
    TEST_LEVEL,
    CACHE_KEY,
    embedding,
  );

  const stored = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*)::bigint AS count
    FROM "answer_cache"
    WHERE "problemId" = ${problem.id}
      AND "hintLevel" = ${TEST_LEVEL}
      AND "queryText" = ${CACHE_KEY}
      AND "queryEmbedding" IS NOT NULL
  `;
  check(
    "stores the question embedding",
    Number(stored[0]?.count ?? 0) === 1,
    "one row has a non-null queryEmbedding",
  );

  const near = await lookupSemanticAnswer(problem.id, TEST_LEVEL, PARAPHRASE);
  check(
    "matches a near-duplicate question",
    near.hit?.answer === answer,
    `similarity ${near.bestSimilarity?.toFixed(4) ?? "n/a"} · threshold ${semanticCacheThreshold}`,
  );

  const related = await lookupSemanticAnswer(problem.id, TEST_LEVEL, RELATED);
  check(
    "does not match a different intent",
    related.hit === null,
    `similarity ${related.bestSimilarity?.toFixed(4) ?? "n/a"} · threshold ${semanticCacheThreshold}`,
  );

  const unrelated = await lookupSemanticAnswer(problem.id, TEST_LEVEL, UNRELATED);
  check(
    "does not match an unrelated question",
    unrelated.hit === null,
    `similarity ${unrelated.bestSimilarity?.toFixed(4) ?? "n/a"} · threshold ${semanticCacheThreshold}`,
  );

  const wrongLevel = await lookupSemanticAnswer(problem.id, NEXT_LEVEL, PARAPHRASE);
  check(
    "does not cross hint levels",
    wrongLevel.hit === null,
    "no row exists at the adjacent level",
  );

  const oldVersionKey = "__ask_v1__semantic_test__";
  await prisma.answerCache.create({
    data: {
      problemId: problem.id,
      hintLevel: OLD_VERSION_LEVEL,
      queryText: oldVersionKey,
      answer,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  await storeSemanticAnswerEmbedding(
    problem.id,
    OLD_VERSION_LEVEL,
    oldVersionKey,
    embedding,
  );
  const oldVersion = await lookupSemanticAnswer(
    problem.id,
    OLD_VERSION_LEVEL,
    PARAPHRASE,
  );
  check(
    "does not reuse an older prompt version",
    oldVersion.hit === null,
    "queryText prefix is filtered by TUTOR_PROMPT_VERSION",
  );

  await prisma.answerCache.updateMany({
    where: { problemId: problem.id, hintLevel: TEST_LEVEL },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  const expired = await lookupSemanticAnswer(problem.id, TEST_LEVEL, PARAPHRASE);
  check(
    "ignores expired entries",
    expired.hit === null,
    "expired row is filtered by expiresAt > now()",
  );

  await prisma.answerCache.deleteMany({
    where: { problemId: problem.id, hintLevel: { in: [TEST_LEVEL, NEXT_LEVEL, OLD_VERSION_LEVEL] } },
  });

  if (failures > 0) {
    throw new Error(`${failures} semantic cache check(s) failed.`);
  }
  console.log("\nAll semantic cache checks passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
