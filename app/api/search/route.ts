import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { elapsedMs, errorMessage, recordQueryLog } from "@/lib/query-log";
import { searchProblems } from "@/lib/search";

const difficulties = new Set(["Easy", "Medium", "Hard"]);

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Sign in to search problems." }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const query = typeof payload.query === "string" ? payload.query.trim() : "";
  const difficulty = typeof payload.difficulty === "string" ? payload.difficulty : undefined;
  const pattern = typeof payload.pattern === "string" ? payload.pattern.trim() : undefined;
  const platform = typeof payload.platform === "string" ? payload.platform.trim() : undefined;

  if (query.length < 2) {
    return Response.json({ error: "Query must be at least 2 characters long." }, { status: 400 });
  }

  if (query.length > 500) {
    return Response.json({ error: "Query must be 500 characters or fewer." }, { status: 400 });
  }

  if (difficulty && !difficulties.has(difficulty)) {
    return Response.json({ error: "Difficulty must be Easy, Medium, or Hard." }, { status: 400 });
  }

  try {
    const startedAt = performance.now();
    const search = await searchProblems(prisma, query, {
      difficulty: difficulty as "Easy" | "Medium" | "Hard" | undefined,
      pattern: pattern || undefined,
      platform: platform || undefined,
    });
    const retrievalMs = elapsedMs(startedAt);

    await recordQueryLog(prisma, {
      userId: session.user.id,
      query,
      source: "search",
      retrievalMs,
      totalMs: retrievalMs,
    });

    return Response.json({
      query,
      ...search,
    });
  } catch (error) {
    await recordQueryLog(prisma, {
      userId: session.user.id,
      query,
      source: "search",
      error: errorMessage(error),
    });
    console.error("Search failed", error);
    return Response.json({ error: "Search is temporarily unavailable." }, { status: 500 });
  }
}
