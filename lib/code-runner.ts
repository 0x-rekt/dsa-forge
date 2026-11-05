import { Sandbox } from "@vercel/sandbox";

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
): Promise<{
  verdict: "passed" | "failed" | "error" | "timeout";
  results: CodeRunResult[];
  executionMs: number;
}> {
  const startedAt = Date.now();
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
    ]);

    const results: CodeRunResult[] = [];
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
          args: ["-c", "python3 solution.py < input.json"],
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
            executionMs: Date.now() - startedAt,
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
            executionMs: Date.now() - startedAt,
          };
        }
        throw error;
      }

      if (!results[results.length - 1].passed) {
        return {
          verdict: "failed",
          results,
          executionMs: Date.now() - startedAt,
        };
      }
    }

    return {
      verdict: "passed",
      results,
      executionMs: Date.now() - startedAt,
    };
  } finally {
    await sandbox.stop();
  }
}
