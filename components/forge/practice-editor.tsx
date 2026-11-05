"use client";

import Editor from "@monaco-editor/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type PracticeEditorProps = {
  slug: string;
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

const starterCode = `def solve(data):
    nums = data["nums"]
    target = data["target"]
    seen = {}

    for index, number in enumerate(nums):
        complement = target - number
        if complement in seen:
            return [seen[complement], index]
        seen[number] = index

    return None
`;

export function PracticeEditor({ slug }: PracticeEditorProps) {
  const [code, setCode] = useState(starterCode);
  const [results, setResults] = useState<RunResult[]>([]);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
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
      setError(runError instanceof Error ? runError.message : "Unable to run code.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-8 overflow-hidden">
      <section className="min-w-0 self-start overflow-hidden bg-[#171717] text-white" aria-labelledby="editor-title">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#4a4a4a] px-5 py-4">
          <div>
            <h2 id="editor-title" className="text-xl font-extrabold">Python editor</h2>
            <p className="mt-1 text-sm text-[#c7c7c7]">Implement solve(data) and return the answer.</p>
          </div>
          <span className="bg-[#ff4332] px-3 py-1 text-sm font-extrabold text-black">Python</span>
        </div>
        <label className="sr-only" htmlFor="practice-code">Python solution</label>
        <div className="h-[24rem] min-w-0 max-w-full overflow-hidden sm:h-[28rem]" id="practice-code">
          <Editor
            defaultLanguage="python"
            height="100%"
            onChange={(value) => setCode(value ?? "")}
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#4a4a4a] px-5 py-4">
          <button
            className="font-bold text-[#d5d5d5] underline underline-offset-4 hover:text-white"
            onClick={() => setCode(starterCode)}
            type="button"
          >
            Reset starter code
          </button>
          <Button disabled={running} onClick={runCode} size="lg" variant="forge">
            {running ? "Running…" : "Run code →"}
          </Button>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden" aria-labelledby="results-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="results-title" className="text-2xl font-extrabold tracking-[-.04em]">Verification</h2>
            <p className="mt-2 text-sm font-bold text-[#5b5b5b]">Run the visible and hidden cases in an isolated sandbox.</p>
          </div>
          {verdict ? <span className="font-extrabold">{verdict}</span> : null}
        </div>
        {error ? <p className="mt-6 border-4 border-[#ff4332] bg-white p-4 font-bold">{error}</p> : null}
        <div className="mt-6">
          {results.length ? (
            <>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-white p-5">
                <strong className={verdict === "passed" ? "text-[#167a45]" : "text-[#b3261e]"}>
                  {verdict === "passed" ? "All tests passed" : `${failedResults.length} test${failedResults.length === 1 ? "" : "s"} failed`}
                </strong>
                <span className="text-sm font-bold text-[#5b5b5b]">
                  {passedCount} of {results.length} completed · {results.reduce((total, result) => total + result.executionMs, 0)} ms
                </span>
              </div>
              {failedResults.length ? (
                <div className="mt-3 max-h-56 overflow-y-auto">
                  <div className="grid gap-2">
                    {failedResults.map((result) => (
                      <div className="bg-white p-3" key={result.testCase}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <strong>Test {result.testCase}{result.isHidden ? " · hidden" : ""}</strong>
                          <span className="font-extrabold text-[#b3261e]">Failed</span>
                        </div>
                        {!result.isHidden && result.actual ? (
                          <p className="mt-2 break-all text-xs text-[#5b5b5b]">Output: {result.actual} · Expected: {result.expected}</p>
                        ) : null}
                        {result.stderr ? <p className="mt-2 break-words text-xs text-[#b3261e]">{result.stderr}</p> : null}
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
