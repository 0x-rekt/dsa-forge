import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "../lib/prisma";
import { searchProblems, type SearchMode } from "../lib/search";

type GoldenSeed = { slug: string; queries: [string, string] };
type GoldenCase = { query: string; expectedSlugs: string[] };

// Two human-written descriptions per problem produce a 104-query set while
// keeping every target problem explicit and reviewable.
const goldenSeeds: GoldenSeed[] = [
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

const goldenCases: GoldenCase[] = goldenSeeds.flatMap(({ slug, queries }) =>
  queries.map((query) => ({ query, expectedSlugs: [slug] })),
);

function reciprocalRank(results: string[], expected: string[]) {
  const rank = results.findIndex((slug) => expected.includes(slug));
  return rank === -1 ? 0 : 1 / (rank + 1);
}

function recallAt(results: string[], expected: string[], k: number) {
  const returned = new Set(results.slice(0, k));
  return expected.filter((slug) => returned.has(slug)).length / expected.length;
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
  const expectedSlugs = [...new Set(goldenCases.flatMap((testCase) => testCase.expectedSlugs))];
  const knownProblems = await prisma.problem.findMany({
    where: { slug: { in: expectedSlugs } },
    select: { slug: true },
  });
  const knownSlugs = new Set(knownProblems.map((problem) => problem.slug));
  const missingSlugs = expectedSlugs.filter((slug) => !knownSlugs.has(slug));

  if (missingSlugs.length > 0) {
    throw new Error(
      `Golden set contains slugs missing from the database: ${missingSlugs.join(", ")}`,
    );
  }

  console.log(`Evaluating ${goldenCases.length} golden queries`);
  if (delayMs > 0) {
    console.log(`Waiting ${delayMs} ms between reranked queries.`);
  }
  const summaries = [];

  for (const mode of modes) {
    let recall5 = 0;
    let recall8 = 0;
    let mrr = 0;
    let top1 = 0;
    let rerankedAvailable = 0;
    let rerankFailures = 0;

    for (const [index, testCase] of goldenCases.entries()) {
      if (mode === "reranked" && delayMs > 0) await sleep(delayMs);
      if (mode === "reranked" && (index + 1) % 20 === 0) {
        console.log(`${mode}: ${index + 1}/${goldenCases.length}`);
      }
      const response = await searchProblems(prisma, testCase.query, {}, mode);
      if (mode === "reranked" && !response.rerankingAvailable) {
        rerankFailures += 1;
      }
      const resultSlugs = response.results.map((result) => result.slug);
      recall5 += recallAt(resultSlugs, testCase.expectedSlugs, 5);
      recall8 += recallAt(resultSlugs, testCase.expectedSlugs, 8);
      mrr += reciprocalRank(resultSlugs, testCase.expectedSlugs);
      top1 += testCase.expectedSlugs.includes(resultSlugs[0]) ? 1 : 0;
      rerankedAvailable += response.rerankingAvailable ? 1 : 0;
    }

    const total = goldenCases.length;
    const summary = {
      mode,
      queries: total,
      top1Accuracy: Number((top1 / total).toFixed(3)),
      recallAt5: Number((recall5 / total).toFixed(3)),
      recallAt8: Number((recall8 / total).toFixed(3)),
      mrr: Number((mrr / total).toFixed(3)),
      rerankingAvailableQueries: rerankedAvailable,
      ...(mode === "reranked" ? { rerankFailures } : {}),
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
