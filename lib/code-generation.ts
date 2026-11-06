import { createTutorModel, requireTutorApiKey, type TutorContext } from "@/lib/tutor";
import { runPythonCode, type CodeRunResult, type CodeTest } from "@/lib/code-runner";

const MAX_RETRIES = 2;
const MODEL = process.env.GEMINI_TUTOR_MODEL ?? "gemini-2.5-flash";

export type GeneratedCodeRun = {
  code: string;
  verdict: "passed" | "failed" | "error" | "timeout";
  results: CodeRunResult[];
  executionMs: number;
  attempts: number;
};

function cleanCode(text: string) {
  const fenced = text.match(/```(?:python|py)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? text).trim();
}

function failureFeedback(
  results: CodeRunResult[],
  tests: CodeTest[],
) {
  return results
    .filter((result) => !result.passed)
    .map((result) => {
      const test = tests[result.testCase - 1];
      if (result.isHidden) {
        return `Test ${result.testCase} failed. This test is hidden; do not infer or expose its input.`;
      }
      return [
        `Test ${result.testCase} failed.`,
        `Input: ${test?.input ?? "unavailable"}`,
        `Expected: ${result.expected ?? test?.expectedOutput ?? "unavailable"}`,
        `Actual: ${result.actual || "no output"}`,
        result.stderr ? `Error: ${result.stderr}` : "",
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

function buildGenerationPrompt(
  context: TutorContext,
  request: string,
  previousCode?: string,
  feedback?: string,
) {
  const correction = previousCode
    ? `Previous code:
<code>
${previousCode}
</code>

The previous code was executed and produced these failures:
${feedback}

Fix the implementation rather than explaining the fix.`
    : "Write the first implementation.";

  return `You are generating a Python solution for DSA Forge problem "${context.problem.title}".
Difficulty: ${context.problem.difficulty}
Patterns: ${context.problem.tags.join(", ") || "Not specified"}

Execution contract:
- Return only complete Python source code, with no Markdown fences or explanation.
- Define exactly a class named Solution with a method solve(self, data).
- Read inputs from the JSON dictionary data and return the answer; do not read stdin or print the answer.
- Use only the Python standard library.
- Do not use network, filesystem, subprocess, eval, or exec.

User request:
${request}

Grounded problem sources:
${context.promptContext}

${correction}`;
}

export async function generateAndVerifyPython(
  context: TutorContext,
  request: string,
  tests: CodeTest[],
  tags: string[],
  sampleInput?: string,
): Promise<GeneratedCodeRun> {
  const apiKey = requireTutorApiKey();
  const model = createTutorModel(apiKey);
  let code = "";
  let feedback = "";
  let totalExecutionMs = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await model.models.generateContent({
      model: MODEL,
      contents: buildGenerationPrompt(context, request, code || undefined, feedback || undefined),
    });
    code = cleanCode(response.text ?? "");
    if (!code) throw new Error("Tutor returned empty code.");

    const run = await runPythonCode(code, tests, tags, sampleInput);
    totalExecutionMs += run.executionMs;
    if (run.verdict === "passed" || attempt === MAX_RETRIES) {
      return { ...run, code, executionMs: totalExecutionMs, attempts: attempt + 1 };
    }

    feedback = failureFeedback(run.results, tests);
  }

  throw new Error("Code generation did not produce a result.");
}
