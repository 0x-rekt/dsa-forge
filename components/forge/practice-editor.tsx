"use client";

import Editor from "@monaco-editor/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getPythonProblemContract } from "@/lib/problem-contract";

type PracticeEditorProps = {
  slug: string;
  tags: string[];
  sampleInput?: string;
};

type RunResult = {
  testCase: number;
  passed: boolean;
  isHidden: boolean;
  actual: string;
  expected: string | null;
  stderr: string;
  executionMs: number;
};

export function PracticeEditor({
  slug,
  tags,
  sampleInput,
}: PracticeEditorProps) {
  const contract = getPythonProblemContract({ tags, sampleInput });
  const starterCode = contract.starterCode;
  const [code, setCode] = useState(starterCode);
  const [codeSource, setCodeSource] = useState<
    "starter" | "user" | "generated"
  >("starter");
  const [results, setResults] = useState<RunResult[]>([]);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const passedCount = results.filter((result) => result.passed).length;
  const failedResults = results.filter((result) => !result.passed);

  async function runCode() {
    setRunning(true);
    setError("");
    setResults([]);
    setVerdict(null);

    try {
      const response = await fetch("/api/code/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, language: "python", code }),
      });
      const payload = (await response.json()) as {
        error?: string;
        verdict?: string;
        results?: RunResult[];
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to run code.");
      }

      setVerdict(payload.verdict ?? "error");
      setResults(payload.results ?? []);
    } catch (runError) {
      setError(
        runError instanceof Error ? runError.message : "Unable to run code.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function submitCode() {
    if (codeSource === "generated") return;
    setSubmitting(true);
    setError("");
    setResults([]);
    setVerdict(null);

    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, language: "python", code, hintsUsed: 0 }),
      });
      const payload = (await response.json()) as {
        error?: string;
        verdict?: string;
        results?: RunResult[];
      };
      if (!response.ok)
        throw new Error(payload.error ?? "Unable to submit code.");
      setVerdict(payload.verdict ?? "error");
      setResults(payload.results ?? []);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit code.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function generateCode() {
    setGenerating(true);
    setError("");
    setResults([]);
    setVerdict(null);

    try {
      const response = await fetch("/api/code/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          request:
            "Generate a correct Python solution for this problem and verify it against the tests.",
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        code?: string;
        verdict?: string;
        results?: RunResult[];
        attempts?: number;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to generate code.");
      }
      setCode(payload.code ?? starterCode);
      setCodeSource("generated");
      setVerdict(payload.verdict ?? "error");
      setResults(payload.results ?? []);
      if (
        payload.attempts &&
        payload.attempts > 1 &&
        payload.verdict !== "passed"
      ) {
        setError(
          `The generated solution was retried ${payload.attempts - 1} times but still did not pass all tests.`,
        );
      }
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate code.",
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-8 overflow-hidden">
      <section
        className="min-w-0 self-start overflow-hidden bg-[#171717] text-white"
        aria-labelledby="editor-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#4a4a4a] px-5 py-4">
          <div>
            <h2 id="editor-title" className="text-xl font-extrabold">
              Python editor
            </h2>
            <p className="mt-1 text-sm text-[#c7c7c7]">
              Implement Solution.{contract.methodName}(data) and return the
              answer.
            </p>
            <p className="mt-2 max-w-[70ch] text-xs text-[#a9a9a9]">
              {contract.structure}
            </p>
          </div>
          <span className="bg-[#ff4332] px-3 py-1 text-sm font-extrabold text-black">
            Python
          </span>
        </div>
        <label className="sr-only" htmlFor="practice-code">
          Python solution
        </label>
        <div
          className="h-[24rem] min-w-0 max-w-full overflow-hidden sm:h-[28rem]"
          id="practice-code"
        >
          <Editor
            defaultLanguage="python"
            height="100%"
            onChange={(value) => {
              setCode(value ?? "");
              setCodeSource("user");
            }}
            options={{
              automaticLayout: true,
              fontSize: 14,
              minimap: { enabled: false },
              padding: { top: 20, bottom: 20 },
              scrollBeyondLastLine: false,
              wordWrap: "on",
            }}
            theme="vs-dark"
            value={code}
          />
        </div>
          <div className="flex flex-col items-stretch gap-4 border-t-2 border-[#4a4a4a] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <button
            className="font-bold text-[#d5d5d5] underline underline-offset-4 hover:text-white"
            onClick={() => {
              setCode(starterCode);
              setCodeSource("starter");
            }}
            type="button"
          >
            Reset starter code
          </button>
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
            <Button
              disabled={running || generating || submitting}
              onClick={runCode}
              size="lg"
              className="w-full sm:w-auto"
              variant="forge"
            >
              {running ? "Running…" : "Run code →"}
            </Button>
            <Button
              disabled={running || generating || submitting}
              onClick={generateCode}
              size="lg"
              className="w-full sm:w-auto"
              variant="outline"
            >
              {generating ? "Generating…" : "Generate verified solution"}
            </Button>
            <Button
              disabled={
                running ||
                generating ||
                submitting ||
                codeSource === "generated"
              }
              onClick={submitCode}
              size="lg"
              className="w-full sm:w-auto"
              variant="forge"
            >
              {submitting
                ? "Submitting…"
                : codeSource === "generated"
                  ? "Edit generated code to submit"
                  : "Submit attempt"}
            </Button>
          </div>
        </div>
        {codeSource === "generated" ? (
          <p className="border-t-2 border-[#4a4a4a] px-5 py-3 text-sm font-bold text-[#ffed00]">
            This generated solution was verified for reference only. Edit it
            before submitting so your progress reflects your own attempt.
          </p>
        ) : null}
      </section>

      <section
        className="min-w-0 overflow-hidden"
        aria-labelledby="results-title"
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2
              id="results-title"
              className="text-2xl font-extrabold tracking-[-.04em]"
            >
              Verification
            </h2>
            <p className="mt-2 text-sm font-bold text-[#5b5b5b]">
              Run the visible and hidden cases in an isolated sandbox.
            </p>
          </div>
          {verdict ? <span className="font-extrabold">{verdict}</span> : null}
        </div>
        {error ? (
          <p className="mt-6 border-4 border-[#ff4332] bg-white p-4 font-bold">
            {error}
          </p>
        ) : null}
        <div className="mt-6">
          {results.length ? (
            <>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-white p-5">
                <strong
                  className={
                    verdict === "passed" ? "text-[#167a45]" : "text-[#b3261e]"
                  }
                >
                  {verdict === "passed"
                    ? "All tests passed"
                    : `${failedResults.length} test${failedResults.length === 1 ? "" : "s"} failed`}
                </strong>
                <span className="text-sm font-bold text-[#5b5b5b]">
                  {passedCount} of {results.length} completed ·{" "}
                  {results.reduce(
                    (total, result) => total + result.executionMs,
                    0,
                  )}{" "}
                  ms
                </span>
              </div>
              {failedResults.length ? (
                <div className="mt-3 max-h-56 overflow-y-auto">
                  <div className="grid gap-2">
                    {failedResults.map((result) => (
                      <div className="bg-white p-3" key={result.testCase}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <strong>
                            Test {result.testCase}
                            {result.isHidden ? " · hidden" : ""}
                          </strong>
                          <span className="font-extrabold text-[#b3261e]">
                            Failed
                          </span>
                        </div>
                        {!result.isHidden && result.actual ? (
                          <p className="mt-2 break-all text-xs text-[#5b5b5b]">
                            Output: {result.actual} · Expected:{" "}
                            {result.expected}
                          </p>
                        ) : null}
                        {result.stderr ? (
                          <p className="mt-2 break-words text-xs text-[#b3261e]">
                            {result.stderr}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="bg-white p-5 text-sm font-bold text-[#5b5b5b]">
              Your verification results will appear here.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
