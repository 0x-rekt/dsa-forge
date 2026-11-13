import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { runPythonCode } from "@/lib/code-runner";
import { prisma } from "@/lib/prisma";
import { rebuildPatternStats } from "@/lib/progress";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const MAX_CODE_LENGTH = 100_000;

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Sign in to submit code." }, { status: 401 });
  }

  const rateLimit = await enforceRateLimit(session.user.id, "attempts:create", {
    limit: 20,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object") {
    return Response.json(
      { error: "Request body must be an object." },
      { status: 400 },
    );
  }

  const payload = body as Record<string, unknown>;
  const slug = typeof payload.slug === "string" ? payload.slug.trim() : "";
  const language =
    typeof payload.language === "string" ? payload.language.trim() : "";
  const code = typeof payload.code === "string" ? payload.code : "";
  const hintsUsed =
    typeof payload.hintsUsed === "number" && Number.isInteger(payload.hintsUsed)
      ? Math.max(0, Math.min(4, payload.hintsUsed))
      : 0;

  if (!slug || language !== "python" || !code.trim()) {
    return Response.json(
      { error: "A problem slug, Python language, and code are required." },
      { status: 400 },
    );
  }
  if (code.length > MAX_CODE_LENGTH) {
    return Response.json(
      { error: "Code must be 100,000 characters or fewer." },
      { status: 400 },
    );
  }

  try {
    const problem = await prisma.problem.findUnique({
      where: { slug },
      select: {
        id: true,
        patterns: { select: { pattern: { select: { name: true } } } },
        testCases: {
          select: {
            id: true,
            input: true,
            expectedOutput: true,
            isHidden: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!problem)
      return Response.json({ error: "Problem not found." }, { status: 404 });
    if (!problem.testCases.length)
      return Response.json(
        { error: "This problem has no tests for submission." },
        { status: 422 },
      );

    const hintState = await prisma.hintState.findUnique({
      where: {
        userId_problemId: {
          userId: session.user.id,
          problemId: problem.id,
        },
      },
      select: { currentLevel: true },
    });

    const run = await runPythonCode(
      code,
      problem.testCases,
      problem.patterns.map(({ pattern }) => pattern.name),
      problem.testCases[0]?.input,
    );

    const attempt = await prisma.attempt.create({
      data: {
        userId: session.user.id,
        problemId: problem.id,
        language,
        code,
        verdict: run.verdict,
        hintsUsed: hintState?.currentLevel ?? hintsUsed,
        executionMs: run.executionMs,
      },
    });

    await rebuildPatternStats(session.user.id);

    return Response.json({
      submitted: true,
      attemptId: attempt.id,
      language,
      verdict: run.verdict,
      results: run.results,
      executionMs: run.executionMs,
    });
  } catch (error) {
    console.error("Code submission failed", error);
    return Response.json(
      { error: "Code submission is temporarily unavailable." },
      { status: 503 },
    );
  }
}
