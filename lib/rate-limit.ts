import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

type RateLimitOptions = {
  limit: number;
  windowMs?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  unavailable: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

const DEFAULT_WINDOW_MS = 60_000;

/** Atomically consumes one request from a user's fixed time window. */
export async function enforceRateLimit(
  userId: string,
  endpoint: string,
  { limit, windowMs = DEFAULT_WINDOW_MS }: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);

  try {
    const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
      INSERT INTO "rate_limit" ("id", "userId", "endpoint", "windowStart", "count")
      VALUES (${randomUUID()}, ${userId}, ${endpoint}, ${windowStart}, 1)
      ON CONFLICT ("userId", "endpoint", "windowStart")
      DO UPDATE SET "count" = "rate_limit"."count" + 1
      RETURNING "count"
    `;

    const count = Number(rows[0]?.count ?? 0);
    return {
      allowed: count <= limit,
      unavailable: false,
      limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((windowStartMs + windowMs - now) / 1000),
      ),
    };
  } catch (error) {
    console.error(`Rate limit check failed for ${endpoint}`, error);
    return {
      allowed: false,
      unavailable: true,
      limit,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((windowStartMs + windowMs - now) / 1000),
      ),
    };
  }
}

export function rateLimitResponse(result: RateLimitResult) {
  if (result.unavailable) {
    return Response.json(
      { error: "Request limits are temporarily unavailable." },
      { status: 503 },
    );
  }

  return Response.json(
    {
      error: "Too many requests. Please try again shortly.",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}
