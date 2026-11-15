import type { PrismaClient } from "@/app/generated/prisma/client";

export type QueryLogSource = "search" | "tutor-ask" | "tutor-hint";

type QueryLogEntry = {
  userId?: string | null;
  problemId?: string | null;
  query: string;
  source: QueryLogSource;
  cacheHit?: boolean;
  retrievalMs?: number;
  llmMs?: number;
  totalMs?: number;
  ttftMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
};

const MAX_QUERY_LENGTH = 1000;
const MAX_ERROR_LENGTH = 500;

function duration(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

export function elapsedMs(startedAt: number) {
  return duration(startedAt);
}

// Observability must never break the request it is measuring, so every log
// write is best-effort.
export async function recordQueryLog(
  prisma: PrismaClient,
  entry: QueryLogEntry,
) {
  try {
    await prisma.queryLog.create({
      data: {
        ...entry,
        query: entry.query.slice(0, MAX_QUERY_LENGTH),
        error: entry.error?.slice(0, MAX_ERROR_LENGTH),
      },
    });
  } catch (error) {
    console.warn("Failed to write query log.", error);
  }
}

export function errorMessage(error: unknown) {
  let message = error instanceof Error ? error.message : String(error);

  // SDK errors often stringify a JSON payload. Unwrap the nested message so the
  // log and the report carry a sentence rather than an escaped blob.
  for (let depth = 0; depth < 3; depth += 1) {
    const trimmed = message.trim();
    if (!trimmed.startsWith("{")) break;
    try {
      const parsed = JSON.parse(trimmed) as {
        error?: { message?: unknown };
        message?: unknown;
      };
      const next = parsed.error?.message ?? parsed.message;
      if (typeof next !== "string" || next === message) break;
      message = next;
    } catch {
      break;
    }
  }

  return message.replace(/\s+/g, " ").trim().slice(0, MAX_ERROR_LENGTH);
}