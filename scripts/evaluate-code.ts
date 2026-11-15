import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { generateAndVerifyPython } from "../lib/code-generation";
import { prisma } from "../lib/prisma";
import { getTutorContext, tutorModel } from "../lib/tutor";

// The PRD's code row: pass rate with and without the retry loop. This uses the
// same generation and Vercel Sandbox path as `/api/code/generate`, so the
// numbers describe production behaviour rather than a separate implementation.

const REQUEST = "Provide a correct, efficient solution for this problem.";
const DEFAULT_LIMIT = 12;

type CaseResult = {
  slug: string;
  title: string;
  difficulty: string;
  tests: number;
  verdict: "passed" | "failed" | "error" | "timeout" | null;
  attempts: number;
  firstAttemptPassed: boolean;
  finalPassed: boolean;
  executionMs: number;
  setupMs: number;
  tokensIn: number;
  tokensOut: number;
  failure: {
    testCase: number;
    isHidden: boolean;
    stderr: string;
  } | null;
  generationError?: string;
};

type Checkpoint = {
  limit: number;
  model: string;
  cases: CaseResult[];
};

const CHECKPOINT_PATH = "reports/code-evaluation.checkpoint.json";

async function loadCheckpoint() {
  try {
    return JSON.parse(await readFile(CHECKPOINT_PATH, "utf8")) as Checkpoint;
  } catch {
    return null;
  }
}

async function saveCheckpoint(checkpoint: Checkpoint) {
  await mkdir("reports", { recursive: true });
  await writeFile(CHECKPOINT_PATH, `${JSON.stringify(checkpoint, null, 2)}\n`);
}

function argument(name: string) {
  const prefix = `--${name}=`;
  const match = process.argv.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function positiveIntegerArgument(name: string, fallback: number) {
  const raw = argument(name);
  if (raw === undefined) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer.`);
  }
  return value;
}

function delayArgument(name: string, fallback: number) {
  const raw = argument(name);
  if (raw === undefined) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${name} must be a non-negative integer.`);
  }
  return value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function mean(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rate(numerator: number, denominator: number) {
  if (denominator === 0) return null;
  return numerator / denominator;
}

async function selectProblems(limit: number) {
  const all = await prisma.problem.findMany({
    where: { testCases: { some: {} } },
    select: { slug: true, title: true, difficulty: true },
    orderBy: { slug: "asc" },
  });

  if (all.length <= limit) return all;

  const stride = all.length / limit;
  const picked = new Map<string, (typeof all)[number]>();
  for (let index = 0; index < limit; index += 1) {
    const problem = all[Math.floor(index * stride)];
    picked.set(problem.slug, problem);
  }
  return [...picked.values()];
}

async function evaluateProblem(
  slug: string,
): Promise<CaseResult> {
  const problem = await prisma.problem.findUnique({
    where: { slug },
    select: {
      title: true,
      difficulty: true,
      patterns: { select: { pattern: { select: { name: true } } } },
      testCases: {
        select: {
          id: true,
          input: true,
          expectedOutput: true,
          isHidden: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!problem) {
    return {
      slug,
      title: slug,
      difficulty: "Unknown",
      tests: 0,
      verdict: null,
      attempts: 0,
      firstAttemptPassed: false,
      finalPassed: false,
      executionMs: 0,
      setupMs: 0,
      tokensIn: 0,
      tokensOut: 0,
      failure: null,
      generationError: "Problem not found.",
    };
  }

  const base = {
    slug,
    title: problem.title,
    difficulty: problem.difficulty,
    tests: problem.testCases.length,
    verdict: null,
    attempts: 0,
    firstAttemptPassed: false,
    finalPassed: false,
    executionMs: 0,
    setupMs: 0,
    tokensIn: 0,
    tokensOut: 0,
    failure: null,
  } satisfies CaseResult;

  if (!problem.testCases.length) {
    return { ...base, generationError: "No tests for this problem." };
  }

  try {
    const context = await getTutorContext(prisma, slug);
    if (!context || !context.sources.length) {
      return { ...base, generationError: "No indexed material for this problem." };
    }

    const run = await generateAndVerifyPython(
      context,
      REQUEST,
      problem.testCases,
      problem.patterns.map(({ pattern }) => pattern.name),
      problem.testCases[0]?.input,
    );
    const failed = run.results.find((result) => !result.passed);

    return {
      ...base,
      verdict: run.verdict,
      attempts: run.attempts,
      firstAttemptPassed: run.verdict === "passed" && run.attempts === 1,
      finalPassed: run.verdict === "passed",
      executionMs: run.executionMs,
      setupMs: run.setupMs,
      tokensIn: run.tokensIn,
      tokensOut: run.tokensOut,
      failure: failed
        ? {
            testCase: failed.testCase,
            isHidden: failed.isHidden,
            stderr: failed.stderr,
          }
        : null,
    };
  } catch (error) {
    return {
      ...base,
      generationError: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function reviewMarkdown(generatedAt: string, cases: CaseResult[]) {
  const lines = [
    "# Generated code evaluation",
    "",
    `Generated ${generatedAt} · ${cases.length} sampled problems · model \`${tutorModel}\`.`,
    "",
    "Each case starts from the production prompt, runs in the production Vercel",
    "Sandbox, and gets at most two repair retries. `Attempts` counts the first",
    "generation plus repairs.",
    "",
  ];

  for (const entry of cases) {
    lines.push(
      `## ${entry.title} (${entry.difficulty})`,
      "",
      `**Slug:** \`${entry.slug}\``,
      "",
      `**Tests:** ${entry.tests}`,
      "",
    );

    if (entry.generationError) {
      lines.push(`**Generation failed:** ${entry.generationError}`, "");
      continue;
    }

    lines.push(
      `**Verdict:** ${entry.verdict} · attempts ${entry.attempts} · first attempt ${entry.firstAttemptPassed ? "passed" : "failed"} · execution ${entry.executionMs} ms · sandbox setup ${entry.setupMs} ms`,
      "",
    );

    if (entry.failure) {
      lines.push(
        entry.failure.isHidden
          ? `**Failure:** hidden test ${entry.failure.testCase} failed.`
          : `**Failure:** visible test ${entry.failure.testCase} failed.${entry.failure.stderr ? ` ${entry.failure.stderr}` : ""}`,
        "",
      );
    }
  }

  return lines.join("\n");
}

async function main() {
  const limit = positiveIntegerArgument("limit", DEFAULT_LIMIT);
  const delayMs = delayArgument("delay-ms", 1500);
  const fullRun = limit === DEFAULT_LIMIT;
  const fresh = process.argv.includes("--fresh");
  const problems = await selectProblems(limit);
  if (problems.length === 0) throw new Error("No problems with tests to evaluate.");

  console.log(
    `Evaluating ${problems.length} generated solutions with ${tutorModel} (max 2 retries)`,
  );

  if (fresh) await rm(CHECKPOINT_PATH, { force: true });
  const checkpoint =
    fullRun && !fresh ? await loadCheckpoint() : null;
  const reusable =
    checkpoint && checkpoint.limit === limit && checkpoint.model === tutorModel
      ? new Map(checkpoint.cases.map((entry) => [entry.slug, entry]))
      : new Map<string, CaseResult>();

  if (reusable.size > 0) {
    console.log(
      `Resuming from checkpoint; reusing ${reusable.size} case(s). Pass --fresh to ignore it.`,
    );
  }

  const cases: CaseResult[] = [];
  for (const [index, problem] of problems.entries()) {
    const previous = reusable.get(problem.slug);
    if (previous) {
      cases.push(previous);
      continue;
    }

    if (index > 0 && delayMs > 0) await sleep(delayMs);
    console.log(`${index + 1}/${problems.length} ${problem.slug}`);
    cases.push(await evaluateProblem(problem.slug));

    if (fullRun) {
      await saveCheckpoint({ limit, model: tutorModel, cases });
    }
  }

  const completed = cases.filter((entry) => entry.verdict !== null);
  const firstPasses = completed.filter((entry) => entry.firstAttemptPassed);
  const finalPasses = completed.filter((entry) => entry.finalPassed);
  const executions = completed
    .map((entry) => entry.executionMs)
    .sort((a, b) => a - b);
  const setups = completed
    .map((entry) => entry.setupMs)
    .sort((a, b) => a - b);

  const summary = {
    requested: problems.length,
    completed: completed.length,
    generationFailures: cases.length - completed.length,
    firstAttemptPassRate: rate(firstPasses.length, completed.length),
    finalPassRate: rate(finalPasses.length, completed.length),
    retryLift:
      rate(finalPasses.length, completed.length) === null ||
      rate(firstPasses.length, completed.length) === null
        ? null
        : Number(
            (
              (rate(finalPasses.length, completed.length) ?? 0) -
              (rate(firstPasses.length, completed.length) ?? 0)
            ).toFixed(4),
          ),
    averageAttempts: mean(completed.map((entry) => entry.attempts)),
    p50ExecutionMs: percentile(executions, 0.5),
    p95ExecutionMs: percentile(executions, 0.95),
    p50SetupMs: percentile(setups, 0.5),
    p95SetupMs: percentile(setups, 0.95),
    tokensIn: completed.reduce((sum, entry) => sum + entry.tokensIn, 0),
    tokensOut: completed.reduce((sum, entry) => sum + entry.tokensOut, 0),
  };

  console.log("\nCode generation quality");
  console.log(
    JSON.stringify(
      summary,
      (key, value) =>
        typeof value === "number" && !Number.isInteger(value)
          ? Number(value.toFixed(4))
          : value,
      2,
    ),
  );

  const complete = summary.generationFailures === 0;
  if (!complete) {
    console.warn(
      "Some cases failed before a verdict; treat the aggregate as degraded.",
    );
  }
  if (!fullRun) {
    console.warn(
      `Limit ${limit} is not the default ${DEFAULT_LIMIT}; writing a partial report.`,
    );
  }

  const generatedAt = new Date().toISOString();
  await mkdir("reports", { recursive: true });
  const suffix = complete && fullRun ? "" : ".partial";
  const jsonPath = `reports/code-evaluation${suffix}.json`;
  const reviewPath = `reports/code-review${suffix}.md`;

  await writeFile(
    jsonPath,
    JSON.stringify(
      {
        generatedAt,
        model: tutorModel,
        maxRetries: 2,
        complete,
        summary,
        cases,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    reviewPath,
    reviewMarkdown(generatedAt, cases) + "\n",
  );
  console.log(`\nWrote ${jsonPath} and ${reviewPath}`);
  if (fullRun) await rm(CHECKPOINT_PATH, { force: true });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
