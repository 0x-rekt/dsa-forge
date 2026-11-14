import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "../lib/prisma";
import { searchProblems, type SearchMode } from "../lib/search";

type QueryType = "reworded" | "exact-title" | "pasted-statement" | "partial";
type GoldenSeed = { slug: string; queries: string[] };
type GoldenCase = {
  query: string;
  expectedSlugs: string[];
  type: QueryType;
};

const QUERY_TYPES: QueryType[] = [
  "reworded",
  "exact-title",
  "pasted-statement",
  "partial",
];

// Two human-written rewordings per problem. Exact-title and pasted-statement
// cases are generated from the database at run time, so this file stays
// reviewable instead of hardcoding 104 more strings.
const paraphraseSeeds: GoldenSeed[] = [
  { slug: "two-sum", queries: ["find two numbers that add to a target", "array pair with a required sum"] },
  { slug: "add-two-numbers", queries: ["add two numbers represented by linked lists", "sum linked list digits"] },
  { slug: "longest-substring-without-repeating-characters", queries: ["longest substring with no repeated characters", "largest window of unique characters"] },
  { slug: "median-of-two-sorted-arrays", queries: ["find the median of two sorted arrays", "combine two ordered arrays to get their middle value"] },
  { slug: "longest-palindrome", queries: ["find the longest palindrome in a string", "largest symmetric sequence of characters"] },
  { slug: "reverse-integer", queries: ["reverse the digits of an integer", "read a number backwards"] },
  { slug: "palindrome-number", queries: ["check whether an integer reads the same backwards", "determine if a number is a palindrome"] },
  { slug: "container-with-most-water", queries: ["choose two lines that hold the most water", "maximum area between vertical lines"] },
  { slug: "integer-to-roman", queries: ["convert a number into Roman numerals", "represent an integer as a Roman numeral"] },
  { slug: "longest-common-prefix", queries: ["find the shared prefix of strings", "common beginning among words"] },
  { slug: "3sum", queries: ["find three numbers that sum to zero", "three element zero sum combinations"] },
  { slug: "valid-parentheses", queries: ["check if brackets are balanced", "validate parentheses and brackets"] },
  { slug: "add-two-numbers-ii", queries: ["add two numbers represented by linked lists", "sum linked lists when digits are stored forward"] },
  { slug: "generate-parentheses", queries: ["generate all valid parentheses strings", "balanced bracket combinations"] },
  { slug: "remove-duplicates-from-sorted-array", queries: ["remove duplicates in place from a sorted array", "deduplicate an ordered array without extra space"] },
  { slug: "find-the-index-of-the-first-occurrence-in-a-string", queries: ["find the first occurrence of one string in another", "locate a substring inside a string"] },
  { slug: "search-insert-position", queries: ["find where a value belongs in a sorted array", "binary search insertion index"] },
  { slug: "valid-palindrome", queries: ["check whether a string reads the same backwards", "validate a phrase as a palindrome ignoring punctuation"] },
  { slug: "combination-sum-iv", queries: ["count ordered combinations that add to a target", "number of ways to reach a target using values"] },
  { slug: "first-missing-positive", queries: ["find the smallest missing positive integer", "first absent positive number in an array"] },
  { slug: "trapping-rain-water", queries: ["calculate rain trapped between bars", "water collected by elevation heights"] },
  { slug: "rotate-image", queries: ["rotate a matrix in place", "turn a square image ninety degrees"] },
  { slug: "group-anagrams", queries: ["group words made from the same letters", "cluster anagrams together"] },
  { slug: "maximum-subarray", queries: ["maximum sum contiguous subarray", "best sum over a continuous array segment"] },
  { slug: "jump-game-ii", queries: ["minimum jumps needed to reach the end", "fewest array jumps to the last index"] },
  { slug: "merge-intervals", queries: ["merge overlapping intervals", "combine intersecting ranges"] },
  { slug: "unique-paths", queries: ["count paths through a grid", "number of ways to reach the bottom right"] },
  { slug: "minimum-path-sum", queries: ["minimum cost path through a grid", "least sum route from top left to bottom right"] },
  { slug: "climbing-stairs", queries: ["count ways to climb stairs one or two steps", "number of staircase combinations"] },
  { slug: "01-matrix", queries: ["distance from every cell to the nearest zero", "find nearest zero for each matrix position"] },
  { slug: "search-a-2d-matrix", queries: ["search for a value in a sorted matrix", "find a target in ordered two dimensional data"] },
  { slug: "sort-colors", queries: ["sort an array of three colors in place", "group red white and blue values"] },
  { slug: "word-search", queries: ["find a word by walking adjacent grid cells", "search for a word in a character board"] },
  { slug: "binary-tree-preorder-traversal", queries: ["traverse a binary tree in preorder", "root left right tree traversal"] },
  { slug: "binary-tree-level-order-traversal-ii", queries: ["traverse a binary tree level by level", "breadth first order of tree nodes"] },
  { slug: "maximum-depth-of-binary-tree", queries: ["find the height of a binary tree", "maximum number of levels in a tree"] },
  { slug: "validate-binary-search-tree", queries: ["check if a binary tree is a valid BST", "validate binary search tree ordering"] },
  { slug: "balanced-binary-tree", queries: ["check whether a binary tree is height balanced", "determine if tree heights differ by at most one"] },
  { slug: "binary-tree-vertical-order-traversal", queries: ["group tree nodes by vertical columns", "vertical traversal of a binary tree"] },
  { slug: "best-time-to-buy-and-sell-stock", queries: ["maximum profit from buying and selling stock once", "best single stock transaction"] },
  { slug: "single-number-ii", queries: ["find the number that appears once when others repeat three times", "unique value among triples"] },
  { slug: "linked-list-cycle", queries: ["detect a cycle in a linked list", "check if linked list pointers loop"] },
  { slug: "reverse-linked-list", queries: ["reverse a singly linked list", "flip linked list node direction"] },
  { slug: "word-break", queries: ["split a string into dictionary words", "can a sentence be segmented into known words"] },
  { slug: "course-schedule", queries: ["determine if courses can be completed with prerequisites", "detect a cycle in course dependencies"] },
  { slug: "all-paths-from-source-lead-to-destination", queries: ["check whether every path in a directed graph reaches the destination", "validate graph paths do not end in a dead end"] },
  { slug: "number-of-islands", queries: ["count connected groups of land in a grid", "number of islands in a binary map"] },
  { slug: "accounts-merge", queries: ["merge accounts that share email addresses", "combine connected user accounts"] },
  { slug: "coin-change", queries: ["fewest coins needed for an amount", "minimum coins to make a target value"] },
  { slug: "house-robber", queries: ["maximize money robbed from houses without adjacent choices", "non adjacent house maximum sum"] },
  { slug: "product-of-array-except-self", queries: ["product of every array value except itself", "array products without division"] },
  { slug: "sliding-window-maximum", queries: ["maximum value in every sliding window", "largest number for each fixed size window"] },
];

// Deliberately vague "I'm stuck on ..." descriptions. These are the queries a
// confused user actually types, and they are the hardest for both retrieval
// paths: no exact wording, no full problem context.
const partialSeeds: GoldenSeed[] = [
  { slug: "two-sum", queries: ["i'm stuck on the one where two numbers add up to a target"] },
  { slug: "valid-parentheses", queries: ["stuck on the brackets balancing question"] },
  { slug: "number-of-islands", queries: ["i don't get the grid problem that counts separate land areas"] },
  { slug: "best-time-to-buy-and-sell-stock", queries: ["stuck on the max profit from one stock trade problem"] },
  { slug: "coin-change", queries: ["i can't solve the fewest coins for an amount question"] },
  { slug: "house-robber", queries: ["stuck on the robber problem where adjacent houses are off limits"] },
  { slug: "merge-intervals", queries: ["the meeting ranges question where overlaps get combined"] },
  { slug: "linked-list-cycle", queries: ["stuck on detecting whether a linked list loops back"] },
  { slug: "rotate-image", queries: ["the square grid rotation problem in ninety degree turns"] },
  { slug: "course-schedule", queries: ["i'm stuck on whether all courses can finish given prerequisites"] },
  { slug: "sliding-window-maximum", queries: ["the problem about the largest value in each moving window"] },
  { slug: "trapping-rain-water", queries: ["stuck on how much water gets caught between vertical bars"] },
  { slug: "word-break", queries: ["can this string be split into dictionary words question"] },
  { slug: "generate-parentheses", queries: ["i'm stuck generating every balanced bracket string"] },
  { slug: "climbing-stairs", queries: ["the staircase question counting ways with one or two steps"] },
];

const PASTED_STATEMENT_CHARS = 320;

function statementExcerpt(statement: string) {
  const collapsed = statement.replace(/\s+/g, " ").trim();
  if (collapsed.length <= PASTED_STATEMENT_CHARS) return collapsed;

  const cut = collapsed.slice(0, PASTED_STATEMENT_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

async function buildGoldenSet() {
  const slugs = [...new Set(paraphraseSeeds.map((seed) => seed.slug))];
  const problems = await prisma.problem.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, title: true, statement: true },
  });
  const bySlug = new Map(problems.map((problem) => [problem.slug, problem]));
  const missing = slugs.filter((slug) => !bySlug.has(slug));

  if (missing.length > 0) {
    throw new Error(
      `Golden set contains slugs missing from the database: ${missing.join(", ")}`,
    );
  }

  const reworded: GoldenCase[] = paraphraseSeeds.flatMap(({ slug, queries }) =>
    queries.map((query) => ({
      query,
      expectedSlugs: [slug],
      type: "reworded" as const,
    })),
  );
  const exactTitle: GoldenCase[] = [];
  const pastedStatement: GoldenCase[] = [];

  for (const slug of slugs) {
    const problem = bySlug.get(slug);
    if (!problem) continue;

    exactTitle.push({
      query: problem.title,
      expectedSlugs: [slug],
      type: "exact-title",
    });

    const excerpt = statementExcerpt(problem.statement);
    if (excerpt) {
      pastedStatement.push({
        query: excerpt,
        expectedSlugs: [slug],
        type: "pasted-statement",
      });
    }
  }

  const partial: GoldenCase[] = partialSeeds.flatMap(({ slug, queries }) =>
    queries.map((query) => ({
      query,
      expectedSlugs: [slug],
      type: "partial" as const,
    })),
  );

  const cases = [...reworded, ...exactTitle, ...pastedStatement, ...partial];
  const typeCounts = Object.fromEntries(
    QUERY_TYPES.map((type) => [
      type,
      cases.filter((testCase) => testCase.type === type).length,
    ]),
  ) as Record<QueryType, number>;

  return { cases, typeCounts };
}

function reciprocalRank(results: string[], expected: string[]) {
  const rank = results.findIndex((slug) => expected.includes(slug));
  return rank === -1 ? 0 : 1 / (rank + 1);
}

function recallAt(results: string[], expected: string[], k: number) {
  const returned = new Set(results.slice(0, k));
  return expected.filter((slug) => returned.has(slug)).length / expected.length;
}

type MetricTotals = {
  count: number;
  top1: number;
  recall5: number;
  recall8: number;
  mrr: number;
};

function emptyTotals(): MetricTotals {
  return { count: 0, top1: 0, recall5: 0, recall8: 0, mrr: 0 };
}

function addResult(
  totals: MetricTotals,
  resultSlugs: string[],
  expected: string[],
) {
  totals.count += 1;
  totals.top1 += expected.includes(resultSlugs[0]) ? 1 : 0;
  totals.recall5 += recallAt(resultSlugs, expected, 5);
  totals.recall8 += recallAt(resultSlugs, expected, 8);
  totals.mrr += reciprocalRank(resultSlugs, expected);
}

function summarize(totals: MetricTotals) {
  const divisor = Math.max(totals.count, 1);
  return {
    queries: totals.count,
    top1Accuracy: Number((totals.top1 / divisor).toFixed(3)),
    recallAt5: Number((totals.recall5 / divisor).toFixed(3)),
    recallAt8: Number((totals.recall8 / divisor).toFixed(3)),
    mrr: Number((totals.mrr / divisor).toFixed(3)),
  };
}

function rerankDelayMs() {
  const argument = process.argv.find((value) =>
    value.startsWith("--delay-ms="),
  );
  if (!argument) return 0;

  const delay = Number(argument.slice("--delay-ms=".length));
  if (!Number.isFinite(delay) || delay < 0) {
    throw new Error("--delay-ms must be a non-negative number.");
  }
  return delay;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ALL_MODES: SearchMode[] = ["keyword", "vector", "hybrid", "reranked"];

function selectedModes() {
  const argument = process.argv.find((value) =>
    value.startsWith("--modes="),
  );
  if (!argument) return ALL_MODES;

  const requested = argument
    .slice("--modes=".length)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!requested.length) {
    throw new Error("--modes must include at least one mode.");
  }

  const invalid = requested.filter(
    (mode) => !ALL_MODES.includes(mode as SearchMode),
  );
  if (invalid.length) {
    throw new Error(
      `Unknown search mode(s): ${invalid.join(", ")}. Use ${ALL_MODES.join(", ")}.`,
    );
  }

  return [...new Set(requested)] as SearchMode[];
}

async function main() {
  const delayMs = rerankDelayMs();
  const modes = selectedModes();
  const { cases: goldenCases, typeCounts } = await buildGoldenSet();
  const expectedSlugs = [
    ...new Set(goldenCases.flatMap((testCase) => testCase.expectedSlugs)),
  ];

  console.log(
    `Evaluating ${goldenCases.length} golden queries (${QUERY_TYPES.map(
      (type) => `${type}: ${typeCounts[type]}`,
    ).join(", ")})`,
  );
  if (delayMs > 0) {
    console.log(`Waiting ${delayMs} ms between reranked queries.`);
  }
  const summaries = [];

  for (const mode of modes) {
    const overall = emptyTotals();
    const byType = new Map<QueryType, MetricTotals>(
      QUERY_TYPES.map((type) => [type, emptyTotals()]),
    );
    let rerankedAvailable = 0;
    let rerankFailures = 0;

    console.log(`Running ${mode}...`);

    for (const [index, testCase] of goldenCases.entries()) {
      if (mode === "reranked" && delayMs > 0) await sleep(delayMs);
      if (mode === "reranked" && (index + 1) % 50 === 0) {
        console.log(`${mode}: ${index + 1}/${goldenCases.length}`);
      }
      const response = await searchProblems(prisma, testCase.query, {}, mode);
      if (mode === "reranked" && !response.rerankingAvailable) {
        rerankFailures += 1;
      }
      const resultSlugs = response.results.map((result) => result.slug);
      addResult(overall, resultSlugs, testCase.expectedSlugs);
      const typeTotals = byType.get(testCase.type);
      if (typeTotals) addResult(typeTotals, resultSlugs, testCase.expectedSlugs);
      rerankedAvailable += response.rerankingAvailable ? 1 : 0;
    }

    const summary = {
      mode,
      ...summarize(overall),
      rerankingAvailableQueries: rerankedAvailable,
      ...(mode === "reranked" ? { rerankFailures } : {}),
      byType: Object.fromEntries(
        QUERY_TYPES.map((type) => [
          type,
          summarize(byType.get(type) ?? emptyTotals()),
        ]),
      ),
    };
    summaries.push(summary);
    console.log(JSON.stringify({ summary }));

    if (mode === "reranked" && rerankFailures > 0) {
      console.warn(
        `${rerankFailures} reranked queries fell back to RRF results. ` +
          "Increase --delay-ms before treating this row as a reranked measurement.",
      );
    }
  }

  console.log("\nPer-type results");
  console.log(
    "mode".padEnd(10) +
      "type".padEnd(20) +
      "n".padStart(5) +
      "top1".padStart(8) +
      "r@5".padStart(8) +
      "r@8".padStart(8) +
      "mrr".padStart(8),
  );
  for (const summary of summaries) {
    for (const type of QUERY_TYPES) {
      const metrics = summary.byType[type];
      console.log(
        summary.mode.padEnd(10) +
          type.padEnd(20) +
          String(metrics.queries).padStart(5) +
          metrics.top1Accuracy.toFixed(3).padStart(8) +
          metrics.recallAt5.toFixed(3).padStart(8) +
          metrics.recallAt8.toFixed(3).padStart(8) +
          metrics.mrr.toFixed(3).padStart(8),
      );
    }
  }

  if (modes.length !== ALL_MODES.length) {
    console.log(
      `Partial run (${modes.join(", ")}); leaving reports/search-evaluation.json unchanged.`,
    );
    return;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    queryCount: goldenCases.length,
    targetCount: expectedSlugs.length,
    rerankDelayMs: delayMs,
    typeCounts,
    summaries,
  };
  await mkdir("reports", { recursive: true });
  await writeFile("reports/search-evaluation.json", `${JSON.stringify(report, null, 2)}\n`);
  console.log("Wrote reports/search-evaluation.json");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
