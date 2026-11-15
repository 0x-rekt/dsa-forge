import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "../lib/prisma";
import {
  buildTutorPrompt,
  createTutorModel,
  getTutorContext,
  requireTutorApiKey,
  tutorModel,
} from "../lib/tutor";

// The PRD's answer-quality row: faithfulness and hallucination rate, judged
// against the same sources the tutor is given. The judge is a separate model
// from the answer model to reduce self-preference; a manual sample check is
// still required, which is why this script also writes a review Markdown file.

const judgeModel = process.env.GEMINI_JUDGE_MODEL ?? "gemini-3.8-flash";
const QUESTIONS = [
  "What is the key idea behind the optimal approach, and why does it work?",
  "What are the time and space complexity, and why?",
  "Walk me through the algorithm step by step.",
  "What edge cases or pitfalls should I watch for?",
];

type JudgeClaim = { text: string; supported: boolean };

type JudgeVerdict = {
  faithfulness: number;
  hallucinated: boolean;
  claims: JudgeClaim[];
  notes: string;
};

type CaseSource = {
  chunkId: string;
  section: string;
  content: string;
};

type CaseResult = {
  slug: string;
  title: string;
  difficulty: string;
  question: string;
  sources: CaseSource[];
  answer: string | null;
  answerMs: number;
  tokensIn: number | null;
  tokensOut: number | null;
  judge: JudgeVerdict | null;
  judgeMs: number;
  judgeRaw: string | null;
  generationError?: string;
  judgeError?: string;
};

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

function suffixArgument() {
  const raw = argument("suffix") ?? "";
  if (!/^[-a-z0-9.]*$/.test(raw)) {
    throw new Error("--suffix may only contain lowercase letters, digits, '.', and '-'.");
  }
  return raw;
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

function buildJudgePrompt(
  question: string,
  promptContext: string,
  answer: string,
) {
  return `You are auditing a tutor answer for faithfulness to its sources.

Question:
${question}

Sources:
${promptContext}

Answer:
${answer}

Rules:
- Split the answer into atomic factual claims.
- A claim is supported when the sources state it (paraphrase is fine) or when the supplied reference solution directly demonstrates it.
- In particular, algorithm mechanics and time/space complexity that are directly visible in the reference solution code count as supported, even if no prose states them.
- Claims about constraints, examples, APIs, or inputs that neither the prose nor the code shows are unsupported.
- General knowledge that the sources do not state counts as unsupported when it is specific to this problem.
- Do not reward style, length, or confidence.
- faithfulness is an integer 1-5: 5 = every claim supported, 1 = mostly unsupported.
- hallucinated is true if any problem-specific claim is unsupported.

Return only JSON with this shape:
{"faithfulness": 1-5, "hallucinated": true|false, "claims": [{"text": "...", "supported": true|false}], "notes": "one sentence"}`;
}

function stripFence(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

// Judges sometimes emit LaTeX such as `$O(\log n)$` inside a JSON string.
// `\l` is not a valid JSON escape and makes the whole verdict unparseable. Walk
// backslash runs so an already-escaped `\\dots` is not repaired twice; only an
// odd run whose final escape is illegal gets one extra backslash.
function repairJsonEscapes(text: string) {
  let output = "";

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "\\") {
      output += text[index];
      continue;
    }

    let runEnd = index;
    while (text[runEnd] === "\\") runEnd += 1;
    const runLength = runEnd - index;
    const next = text[runEnd] ?? "";
    const validEscape =
      /["\\/bfnrt]/.test(next) ||
      (next === "u" &&
        /^[0-9a-fA-F]{4}$/.test(text.slice(runEnd + 1, runEnd + 5)));

    output +=
      runLength % 2 === 1 && !validEscape
        ? "\\".repeat(runLength + 1)
        : "\\".repeat(runLength);
    index = runEnd - 1;
  }

  return output;
}

function parseVerdict(text: string): JudgeVerdict | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(repairJsonEscapes(stripFence(text)));
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const faithfulness = Number(record.faithfulness);
  if (!Number.isFinite(faithfulness)) return null;

  const claims: JudgeClaim[] = Array.isArray(record.claims)
    ? record.claims
        .map((claim) => {
          if (!claim || typeof claim !== "object") return null;
          const entry = claim as Record<string, unknown>;
          if (typeof entry.text !== "string") return null;
          return { text: entry.text, supported: entry.supported === true };
        })
        .filter((claim): claim is JudgeClaim => claim !== null)
    : [];

  return {
    faithfulness: Math.min(5, Math.max(1, Math.round(faithfulness))),
    hallucinated:
      record.hallucinated === true ||
      claims.some((claim) => !claim.supported),
    claims,
    notes: typeof record.notes === "string" ? record.notes : "",
  };
}

async function selectProblems(limit: number) {
  const all = await prisma.problem.findMany({
    where: { chunks: { some: {} } },
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

async function answerAndJudge(
  slug: string,
  question: string,
  ai: ReturnType<typeof createTutorModel>,
): Promise<CaseResult> {
  const context = await getTutorContext(prisma, slug);
  if (!context) {
    return {
      slug,
      title: slug,
      difficulty: "Unknown",
      question,
      sources: [],
      answer: null,
      answerMs: 0,
      tokensIn: null,
      tokensOut: null,
      judge: null,
      judgeMs: 0,
      judgeRaw: null,
      generationError: "Problem not found.",
    };
  }

  const base = {
    slug,
    title: context.problem.title,
    difficulty: context.problem.difficulty,
    question,
    sources: context.sources.map((source) => ({
      chunkId: source.id,
      section: source.section,
      content: source.content,
    })),
  };

  if (!context.sources.length) {
    return {
      ...base,
      answer: null,
      answerMs: 0,
      tokensIn: null,
      tokensOut: null,
      judge: null,
      judgeMs: 0,
      judgeRaw: null,
      generationError: "No indexed material for this problem.",
    };
  }

  let answer = "";
  let answerMs = 0;
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;

  try {
    const started = performance.now();
    const response = await ai.models.generateContent({
      model: tutorModel,
      contents: buildTutorPrompt(context, question),
    });
    answerMs = Math.round(performance.now() - started);
    answer = response.text?.trim() ?? "";
    tokensIn = response.usageMetadata?.promptTokenCount ?? null;
    tokensOut = response.usageMetadata?.candidatesTokenCount ?? null;
  } catch (error) {
    return {
      ...base,
      answer: null,
      answerMs,
      tokensIn,
      tokensOut,
      judge: null,
      judgeMs: 0,
      judgeRaw: null,
      generationError: error instanceof Error ? error.message : "Unknown error",
    };
  }

  if (!answer) {
    return {
      ...base,
      answer: null,
      answerMs,
      tokensIn,
      tokensOut,
      judge: null,
      judgeMs: 0,
      judgeRaw: null,
      generationError: "Tutor returned an empty answer.",
    };
  }

  try {
    const started = performance.now();
    const response = await ai.models.generateContent({
      model: judgeModel,
      contents: buildJudgePrompt(question, context.promptContext, answer),
      config: {
        temperature: 0,
        // The judge echoes every claim back, so a 12-15 claim answer overruns a
        // small cap and returns truncated, unparseable JSON.
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const judgeMs = Math.round(performance.now() - started);
    const raw = response.text?.trim() ?? "";
    const verdict = parseVerdict(raw);

    return verdict
      ? {
          ...base,
          answer,
          answerMs,
          tokensIn,
          tokensOut,
          judge: verdict,
          judgeMs,
          judgeRaw: raw,
        }
      : {
          ...base,
          answer,
          answerMs,
          tokensIn,
          tokensOut,
          judge: null,
          judgeMs,
          judgeRaw: raw,
          judgeError: "Judge returned unparseable JSON.",
        };
  } catch (error) {
    return {
      ...base,
      answer,
      answerMs,
      tokensIn,
      tokensOut,
      judge: null,
      judgeMs: 0,
      judgeRaw: null,
      judgeError: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function reviewMarkdown(
  generatedAt: string,
  limit: number,
  cases: CaseResult[],
) {
  const lines = [
    "# Tutor answer review",
    "",
    `Generated ${generatedAt} · ${cases.length}/${limit} sampled problems · answer \`${tutorModel}\`, judge \`${judgeModel}\` (automatic).`,
    "",
    "Confirm each verdict by reading the answer against the sources. The judge",
    "is not the answer model, but it is still a model; the manual check is the",
    "authority for the README.",
    "",
  ];

  for (const entry of cases) {
    lines.push(
      `## ${entry.title} (${entry.difficulty})`,
      "",
      `**Slug:** \`${entry.slug}\``,
      "",
      `**Question:** ${entry.question}`,
      "",
      `**Sources:** ${
        entry.sources.length
          ? entry.sources
              .map((source) => `${source.section} (${source.content.length} chars)`)
              .join(", ")
          : "none"
      }`,
      "",
    );

    if (entry.generationError) {
      lines.push(`**Generation failed:** ${entry.generationError}`, "");
      continue;
    }

    lines.push(
      "**Answer:**",
      "",
      "> " + (entry.answer ?? "").split("\n").join("\n> "),
      "",
    );

    if (entry.judge) {
      const unsupported = entry.judge.claims
        .filter((claim) => !claim.supported)
        .map((claim) => claim.text);
      lines.push(
        `**Judge:** faithfulness ${entry.judge.faithfulness}/5 · hallucinated ${entry.judge.hallucinated ? "yes" : "no"} · ${entry.judge.claims.length} claims (${unsupported.length} unsupported)`,
        "",
        entry.judge.notes ? `**Notes:** ${entry.judge.notes}` : "",
        "",
        unsupported.length
          ? "**Unsupported claims:**\n" +
            unsupported.map((claim) => `- ${claim}`).join("\n")
          : "**Unsupported claims:** none",
        "",
      );
    } else {
      lines.push(`**Judge failed:** ${entry.judgeError ?? "unknown"}`, "");
    }
  }

  return lines.join("\n");
}

async function main() {
  const limit = positiveIntegerArgument("limit", 12);
  const delayMs = delayArgument("delay-ms", 1500);
  const reportSuffix = suffixArgument();
  const apiKey = requireTutorApiKey();
  const ai = createTutorModel(apiKey);

  const problems = await selectProblems(limit);
  if (problems.length === 0) throw new Error("No indexed problems to evaluate.");

  console.log(
    `Evaluating ${problems.length} answers with ${tutorModel}, judge ${judgeModel}`,
  );

  const cases: CaseResult[] = [];
  for (const [index, problem] of problems.entries()) {
    if (index > 0 && delayMs > 0) await sleep(delayMs);
    const question = QUESTIONS[index % QUESTIONS.length];
    console.log(
      `${index + 1}/${problems.length} ${problem.slug}: ${question.slice(0, 42)}...`,
    );
    cases.push(await answerAndJudge(problem.slug, question, ai));
  }

  const answered = cases.filter((entry) => entry.answer !== null);
  const judged = cases.filter((entry) => entry.judge !== null);
  const faithfulness = judged.map((entry) => entry.judge?.faithfulness ?? 0);
  const answerLatencies = answered
    .map((entry) => entry.answerMs)
    .sort((a, b) => a - b);
  const claims = judged.flatMap((entry) => entry.judge?.claims ?? []);
  const unsupported = claims.filter((claim) => !claim.supported);
  const hallucinated = judged.filter((entry) => entry.judge?.hallucinated);
  const cited = answered.filter((entry) =>
    /\[Source \d+(?:\s*\|[^\]]*)?\]/.test(entry.answer ?? ""),
  );

  const summary = {
    requested: problems.length,
    answered: answered.length,
    judged: judged.length,
    generationFailures: cases.length - answered.length,
    judgeFailures: answered.length - judged.length,
    meanFaithfulness: mean(faithfulness),
    hallucinationRate: rate(hallucinated.length, judged.length),
    unsupportedClaimRate: rate(unsupported.length, claims.length),
    claimCount: claims.length,
    citationRate: rate(cited.length, answered.length),
    p50AnswerMs: percentile(answerLatencies, 0.5),
    p95AnswerMs: percentile(answerLatencies, 0.95),
    tokensIn: answered.reduce((sum, entry) => sum + (entry.tokensIn ?? 0), 0),
    tokensOut: answered.reduce((sum, entry) => sum + (entry.tokensOut ?? 0), 0),
  };

  console.log("\nAnswer quality");
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

  if (summary.judgeFailures > 0 || summary.generationFailures > 0) {
    console.warn(
      "Some cases failed; treat the aggregate as degraded until a clean run.",
    );
  }

  const generatedAt = new Date().toISOString();
  await mkdir("reports", { recursive: true });

  // Do not let a degraded run replace a clean report; mirror the search
  // harness's partial-run guard.
  const complete =
    summary.generationFailures === 0 && summary.judgeFailures === 0;
  const suffix = `${reportSuffix}${complete ? "" : ".partial"}`;
  const jsonPath = `reports/answer-evaluation${suffix}.json`;
  const reviewPath = `reports/answer-review${suffix}.md`;

  await writeFile(
    jsonPath,
    JSON.stringify(
      {
        generatedAt,
        answerModel: tutorModel,
        judgeModel,
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
    reviewMarkdown(generatedAt, problems.length, cases) + "\n",
  );
  console.log(`\nWrote ${jsonPath} and ${reviewPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());