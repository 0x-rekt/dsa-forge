import { Sandbox } from "@vercel/sandbox";
import { getPythonProblemContract } from "@/lib/problem-contract";

const SANDBOX_TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = 3_000;

export type CodeTest = {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  sortOrder: number;
};

export type CodeRunResult = {
  testCase: number;
  passed: boolean;
  isHidden: boolean;
  actual: string;
  expected: string | null;
  stderr: string;
  executionMs: number;
};

function normalizeOutput(value: string) {
  const trimmed = value.trim();
  try {
    return JSON.stringify(JSON.parse(trimmed));
  } catch {
    return trimmed.replace(/\s+/g, " ");
  }
}

function isTimeout(error: unknown) {
  return (
    error instanceof Error &&
    /timed out|timeout|time limit/i.test(error.message)
  );
}

export async function runPythonCode(
  code: string,
  tests: CodeTest[],
  tags: string[],
  sampleInput?: string,
): Promise<{
  verdict: "passed" | "failed" | "error" | "timeout";
  results: CodeRunResult[];
  /** Sum of per-test runtimes; excludes sandbox creation and file upload. */
  executionMs: number;
  /** Sandbox creation, upload, and runner setup, measured before the first test. */
  setupMs: number;
}> {
  const startedAt = Date.now();
  const contract = getPythonProblemContract({ tags, sampleInput });
  const sandbox = await Sandbox.create({
    image: "vercel/sandbox/python:3.14",
    networkPolicy: "deny-all",
    timeout: SANDBOX_TIMEOUT_MS,
    resources: { vcpus: 1 },
  });

  try {
    await sandbox.writeFiles([
      {
        path: "solution.py",
        content: Buffer.from(code, "utf8"),
      },
      {
        path: "runner.py",
        content: Buffer.from(
          `import json
import solution

with open("input.json", encoding="utf-8") as input_file:
    data = json.load(input_file)

${contract.invocation}
print(json.dumps(result, separators=(",", ":")))
`,
          "utf8",
        ),
      },
    ]);

    const results: CodeRunResult[] = [];
    const setupMs = Date.now() - startedAt;
    // Report code time separately from sandbox startup; a 30 s cold start would
    // otherwise be indistinguishable from a slow solution.
    const totals = () => ({
      executionMs: results.reduce(
        (total, result) => total + result.executionMs,
        0,
      ),
      setupMs,
    });
    for (let index = 0; index < tests.length; index += 1) {
      const test = tests[index];
      const testStartedAt = Date.now();

      try {
        await sandbox.writeFiles([
          {
            path: "input.json",
            content: Buffer.from(test.input, "utf8"),
          },
        ]);
        const command = await sandbox.runCommand({
          cmd: "bash",
          args: ["-c", "python3 runner.py"],
          timeoutMs: TEST_TIMEOUT_MS,
        });
        const actual = (await command.stdout()).trim();
        const stderr = (await command.stderr()).trim();
        const passed =
          command.exitCode === 0 &&
          normalizeOutput(actual) === normalizeOutput(test.expectedOutput);

        results.push({
          testCase: index + 1,
          passed,
          isHidden: test.isHidden,
          actual: test.isHidden ? "" : actual,
          expected: test.isHidden ? null : test.expectedOutput,
          stderr,
          executionMs: Date.now() - testStartedAt,
        });

        if (command.exitCode !== 0) {
          return {
            verdict: "error",
            results,
            ...totals(),
          };
        }
      } catch (error) {
        if (isTimeout(error)) {
          results.push({
            testCase: index + 1,
            passed: false,
            isHidden: test.isHidden,
            actual: "",
            expected: test.isHidden ? null : test.expectedOutput,
            stderr: "Execution timed out.",
            executionMs: Date.now() - testStartedAt,
          });
          return {
            verdict: "timeout",
            results,
            ...totals(),
          };
        }
        throw error;
      }

      if (!results[results.length - 1].passed) {
        return {
          verdict: "failed",
          results,
          ...totals(),
        };
      }
    }

    return {
      verdict: "passed",
      results,
      ...totals(),
    };
  } finally {
    await sandbox.stop();
  }
}
