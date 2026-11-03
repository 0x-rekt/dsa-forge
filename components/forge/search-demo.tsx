"use client";

import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DisplayResult } from "./types";

type ApiResult = {
  chunkId: string;
  slug: string;
  title: string;
  difficulty: string;
  tags: string[];
  matchedSections: string[];
  whyMatched: string;
};

const fallbackResults: DisplayResult[] = [
  {
    id: "fallback-longest-substring",
    title: "Longest Substring Without Repeating Characters",
    pattern: "sliding window",
    difficulty: "Medium",
    detail:
      "Keep a moving window of unique characters. When a repeat appears, move the left edge past its previous position.",
  },
  {
    id: "fallback-two-sum",
    title: "Two Sum",
    pattern: "hash map",
    difficulty: "Easy",
    detail:
      "Store values already seen and check whether the complement exists before adding the current number.",
  },
  {
    id: "fallback-number-of-islands",
    title: "Number of Islands",
    pattern: "graph traversal",
    difficulty: "Medium",
    detail:
      "Walk each unvisited land cell with DFS or BFS, marking the connected component as visited.",
  },
];

export function SearchDemo({
  onResults,
}: {
  onResults: (results: DisplayResult[]) => void;
}) {
  const [query, setQuery] = useState("array values add to a target");
  const [results, setResults] = useState(fallbackResults);
  const [status, setStatus] = useState<"ready" | "loading" | "error" | "empty">(
    "ready",
  );
  const [error, setError] = useState("");
  const result = results[0];

  async function findProblem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 2) {
      setStatus("error");
      setError("Describe the problem in at least two characters.");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const payload = (await response.json()) as {
        results?: ApiResult[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(payload.error ?? "Search is temporarily unavailable.");
      const next = (payload.results ?? []).map((item) => ({
        id: item.chunkId,
        slug: item.slug,
        title: item.title,
        pattern: item.tags[0] ?? "Pattern match",
        difficulty: item.difficulty,
        detail: `${item.whyMatched}. ${item.matchedSections.join(", ")} material matched.`,
        tags: item.tags,
        whyMatched: item.whyMatched,
      }));
      setResults(next);
      onResults(next);
      setStatus(next.length ? "ready" : "empty");
    } catch (requestError) {
      setStatus("error");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Search is temporarily unavailable.",
      );
    }
  }

  const statusText =
    status === "loading"
      ? "Searching"
      : status === "error"
        ? "Needs attention"
        : status === "empty"
          ? "No match"
          : "Ready";
  return (
    <div
      className="w-full border-4 border-black bg-[#fff5d6] text-black"
      data-ui
    >
      <div className="flex justify-between border-x-0 border-t-0 border-b-4 border-black px-4 py-4 text-[13px] font-extrabold sm:px-5">
        <span>Problem search</span>
        <Badge>{statusText}</Badge>
      </div>
      <form
        className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-[1fr_auto] sm:gap-2 sm:p-5"
        onSubmit={findProblem}
      >
        <label className="sr-only" htmlFor="problem-search">
          Describe a DSA problem
        </label>
        <input
          className="h-12 min-w-0 border-4 border-black bg-white px-3 font-sans text-[15px] outline-none focus-visible:outline-4 focus-visible:outline-[#ff4332] focus-visible:outline-offset-2"
          id="problem-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Describe a problem"
        />
        <Button
          className="h-12 w-full px-4 sm:w-auto"
          variant="forge"
          disabled={status === "loading"}
          type="submit"
        >
          {status === "loading" ? "Finding" : "Find"}
        </Button>
      </form>
      <div
        className="flex flex-col gap-4 border-t-4 border-black p-4 sm:p-5"
        aria-live="polite"
        aria-busy={status === "loading"}
      >
        {status === "error" ? (
          <p className="border-2 border-black bg-[#ff4332] p-3 text-[13px] font-bold">
            {error}
          </p>
        ) : status === "empty" || !result ? (
          <p className="text-[13px] font-bold">
            No strong match yet. Try adding a constraint or a sample input.
          </p>
        ) : (
          <>
            <div>
              <span className="text-[13px] font-extrabold">Best match</span>
              <strong className="mt-1 block text-[clamp(1.2rem,2vw,1.8rem)] leading-none">
                {result.title}
              </strong>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="field">{result.pattern}</Badge>
              <Badge variant="field">{result.difficulty}</Badge>
              {result.tags?.slice(1, 3).map((tag) => (
                <Badge variant="field" key={tag}>
                  {tag}
                </Badge>
              ))}
            </div>
            {result.whyMatched && (
              <p className="border-t-2 border-black pt-3 text-[13px] font-bold">
                {result.whyMatched}
              </p>
            )}
            {results.length > 1 && (
              <a
                className="w-fit text-[13px] font-extrabold underline decoration-2 underline-offset-4"
                href="#retrieval-results"
              >
                See all {results.length} matching chunks below ↘
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export { fallbackResults };
