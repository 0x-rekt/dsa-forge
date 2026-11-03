import { prisma } from "../lib/prisma";
import { searchProblems, type SearchMode } from "../lib/search";

type GoldenCase = {
  query: string;
  expectedSlugs: string[];
};

const goldenCases: GoldenCase[] = [
  {
    query: "cycle",
    expectedSlugs: [
      "linked-list-cycle",
      "shortest-cycle-in-a-graph",
      "longest-cycle-in-a-graph",
      "detect-cycles-in-2d-grid",
      "circular-array-loop",
    ],
  },
  {
    query: "find two numbers in an array that add to a target",
    expectedSlugs: ["two-sum"],
  },
  {
    query: "longest substring with no repeated characters",
    expectedSlugs: ["longest-substring-without-repeating-characters"],
  },
  {
    query: "count connected groups of land in a grid",
    expectedSlugs: ["number-of-islands"],
  },
  {
    query: "valid parentheses brackets",
    expectedSlugs: ["valid-parentheses"],
  },
  {
    query: "level order traversal of a binary tree",
    expectedSlugs: ["binary-tree-level-order-traversal-ii"],
  },
  {
    query: "merge overlapping intervals",
    expectedSlugs: ["merge-intervals"],
  },
  {
    query: "maximum sum contiguous subarray",
    expectedSlugs: ["maximum-subarray"],
  },
];

function reciprocalRank(results: string[], expected: string[]) {
  const rank = results.findIndex((slug) => expected.includes(slug));
  return rank === -1 ? 0 : 1 / (rank + 1);
}

async function main() {
  const expectedSlugs = goldenCases.flatMap((testCase) => testCase.expectedSlugs);
  const knownProblems = await prisma.problem.findMany({
    where: { slug: { in: expectedSlugs } },
    select: { slug: true },
  });
  const knownSlugs = new Set(knownProblems.map((problem) => problem.slug));
  const missingSlugs = expectedSlugs.filter((slug) => !knownSlugs.has(slug));

  if (missingSlugs.length > 0) {
    throw new Error(`Golden set contains slugs missing from the database: ${missingSlugs.join(", ")}`);
  }

  console.log(`Evaluating ${goldenCases.length} queries`);
  const modes: SearchMode[] = ["keyword", "vector", "hybrid", "reranked"];
  for (const mode of modes) {
    let recallAt5 = 0;
    let recallAt8 = 0;
    let mrr = 0;
    let top1 = 0;

    for (const testCase of goldenCases) {
      const response = await searchProblems(prisma, testCase.query, {}, mode);
      const resultSlugs = response.results.map((result) => result.slug);
      const expected = new Set(testCase.expectedSlugs);
      recallAt5 += resultSlugs.slice(0, 5).some((slug) => expected.has(slug)) ? 1 : 0;
      recallAt8 += resultSlugs.slice(0, 8).some((slug) => expected.has(slug)) ? 1 : 0;
      mrr += reciprocalRank(resultSlugs, testCase.expectedSlugs);
      top1 += expected.has(resultSlugs[0]) ? 1 : 0;

      console.log(JSON.stringify({ mode, query: testCase.query, returned: resultSlugs }));
    }

    const total = goldenCases.length;
    console.log(JSON.stringify({
      summary: {
        mode,
        queries: total,
        top1Accuracy: Number((top1 / total).toFixed(3)),
        recallAt5: Number((recallAt5 / total).toFixed(3)),
        recallAt8: Number((recallAt8 / total).toFixed(3)),
        mrr: Number((mrr / total).toFixed(3)),
      },
    }));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
