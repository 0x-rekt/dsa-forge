import { prisma } from "../lib/prisma";
import type { QueryLogSource } from "../lib/query-log";

const SOURCES: QueryLogSource[] = ["search", "tutor-ask", "tutor-hint"];

type Row = {
  source: string;
  cacheHit: boolean;
  retrievalMs: number | null;
  llmMs: number | null;
  totalMs: number | null;
  ttftMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  error: string | null;
};

function argument(name: string) {
  const prefix = `--${name}=`;
  const match = process.argv.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function daysArgument() {
  const raw = argument("days");
  if (raw === undefined) return 7;

  const days = Number(raw);
  if (!Number.isInteger(days) || days <= 0) {
    throw new Error("--days must be a positive integer.");
  }
  return days;
}

function sourceArgument() {
  const raw = argument("source");
  if (raw === undefined) return undefined;
  if (!SOURCES.includes(raw as QueryLogSource)) {
    throw new Error(`--source must be one of: ${SOURCES.join(", ")}.`);
  }
  return raw as QueryLogSource;
}

// USD per million tokens. Cost is only estimated when both prices are set, so
// the report never invents a price for a model it does not know about.
function pricePerMTok(name: string) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return undefined;

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return value;
}

function priceConfig() {
  const input = pricePerMTok("GEMINI_INPUT_PRICE_PER_MTOK");
  const output = pricePerMTok("GEMINI_OUTPUT_PRICE_PER_MTOK");

  if (input === undefined && output === undefined) return undefined;
  if (input === undefined || output === undefined) {
    throw new Error(
      "Set both GEMINI_INPUT_PRICE_PER_MTOK and GEMINI_OUTPUT_PRICE_PER_MTOK, or neither.",
    );
  }
  return { input, output };
}

// Linear-interpolated percentile over an ascending array.
function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function formatMs(value: number | null) {
  return value === null ? "-" : `${Math.round(value)}`;
}

function formatRate(numerator: number, denominator: number) {
  if (denominator === 0) return "-";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function formatCost(value: number | undefined) {
  if (value === undefined) return "-";
  return value < 0.01 ? value.toFixed(4) : value.toFixed(2);
}

function summarize(
  source: string,
  rows: Row[],
  prices: ReturnType<typeof priceConfig>,
) {
  function percentiles(values: (number | null)[]) {
    const sorted = values
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);
    return { p50: percentile(sorted, 0.5), p95: percentile(sorted, 0.95) };
  }

  const totals = percentiles(rows.map((row) => row.totalMs));
  const retrievals = percentiles(rows.map((row) => row.retrievalMs));
  const llm = percentiles(rows.map((row) => row.llmMs));
  const ttft = percentiles(rows.map((row) => row.ttftMs));
  const tokensIn = rows.reduce((sum, row) => sum + (row.tokensIn ?? 0), 0);
  const tokensOut = rows.reduce((sum, row) => sum + (row.tokensOut ?? 0), 0);
  const cacheHits = rows.filter((row) => row.cacheHit).length;
  const errors = rows.filter((row) => row.error !== null).length;
  const costUsd = prices
    ? (tokensIn / 1_000_000) * prices.input +
      (tokensOut / 1_000_000) * prices.output
    : undefined;

  return {
    source,
    requests: rows.length,
    p50Total: totals.p50,
    p95Total: totals.p95,
    p50Retrieval: retrievals.p50,
    p95Retrieval: retrievals.p95,
    p50Llm: llm.p50,
    p95Llm: llm.p95,
    p50Ttft: ttft.p50,
    p95Ttft: ttft.p95,
    cacheHitRate: formatRate(cacheHits, rows.length),
    errorRate: formatRate(errors, rows.length),
    tokensIn,
    tokensOut,
    costUsd,
  };
}

async function main() {
  const days = daysArgument();
  const source = sourceArgument();
  const prices = priceConfig();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.queryLog.findMany({
    where: {
      createdAt: { gte: since },
      ...(source ? { source } : {}),
    },
    select: {
      source: true,
      cacheHit: true,
      retrievalMs: true,
      llmMs: true,
      totalMs: true,
      ttftMs: true,
      tokensIn: true,
      tokensOut: true,
      error: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(
    `Query log report — last ${days} day${days === 1 ? "" : "s"}` +
      (source ? `, source ${source}` : "") +
      ` — ${rows.length} request${rows.length === 1 ? "" : "s"}`,
  );

  if (rows.length === 0) {
    console.log("No query logs recorded yet. Use the app, then run this again.");
    return;
  }

  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const group = groups.get(row.source) ?? [];
    group.push(row);
    groups.set(row.source, group);
  }

  const summaries = [...groups.entries()]
    .map(([name, group]) => summarize(name, group, prices))
    .sort((a, b) => b.requests - a.requests);
  summaries.push(summarize("all", rows, prices));

  console.log(
    "\n" +
      "latency (ms)".padEnd(14) +
      "req".padStart(6) +
      "p50 tot".padStart(9) +
      "p95 tot".padStart(9) +
      "p50 ret".padStart(9) +
      "p95 ret".padStart(9) +
      "p50 llm".padStart(9) +
      "p95 llm".padStart(9) +
      "p50 ttft".padStart(10) +
      "p95 ttft".padStart(10),
  );
  for (const summary of summaries) {
    console.log(
      summary.source.padEnd(14) +
        String(summary.requests).padStart(6) +
        formatMs(summary.p50Total).padStart(9) +
        formatMs(summary.p95Total).padStart(9) +
        formatMs(summary.p50Retrieval).padStart(9) +
        formatMs(summary.p95Retrieval).padStart(9) +
        formatMs(summary.p50Llm).padStart(9) +
        formatMs(summary.p95Llm).padStart(9) +
        formatMs(summary.p50Ttft).padStart(10) +
        formatMs(summary.p95Ttft).padStart(10),
    );
  }

  console.log(
    "\n" +
      "usage".padEnd(14) +
      "req".padStart(6) +
      "cache".padStart(8) +
      "errors".padStart(8) +
      "tok in".padStart(10) +
      "tok out".padStart(10) +
      "est $".padStart(9),
  );
  for (const summary of summaries) {
    console.log(
      summary.source.padEnd(14) +
        String(summary.requests).padStart(6) +
        summary.cacheHitRate.padStart(8) +
        summary.errorRate.padStart(8) +
        String(summary.tokensIn).padStart(10) +
        String(summary.tokensOut).padStart(10) +
        formatCost(summary.costUsd).padStart(9),
    );
  }

  if (!prices) {
    console.log(
      "\nSet GEMINI_INPUT_PRICE_PER_MTOK and GEMINI_OUTPUT_PRICE_PER_MTOK to include estimated cost.",
    );
  }

  const errorCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.error) continue;
    const key = `${row.source}: ${row.error}`;
    errorCounts.set(key, (errorCounts.get(key) ?? 0) + 1);
  }

  if (errorCounts.size > 0) {
    console.log("\nErrors");
    for (const [message, count] of [...errorCounts.entries()].sort(
      (a, b) => b[1] - a[1],
    )) {
      console.log(`  ${String(count).padStart(4)}x ${message}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());