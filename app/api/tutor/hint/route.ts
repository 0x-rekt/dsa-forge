import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { elapsedMs, errorMessage, recordQueryLog } from "@/lib/query-log";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  buildTutorPrompt,
  createTutorModel,
  getTutorContext,
  requireTutorApiKey,
  tutorModel,
  TUTOR_PROMPT_VERSION,
} from "@/lib/tutor";

const MIN_LEVEL = 1;
const MAX_LEVEL = 4;
const HINT_CACHE_DAYS = 30;

function hintCacheKey(level: number) {
  return `__hint_v${TUTOR_PROMPT_VERSION}_level_${level}__`;
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json(
      { error: "Sign in to use the progressive hint ladder." },
      { status: 401 },
    );
  }

  const rateLimit = await enforceRateLimit(session.user.id, "tutor:hint", {
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
  const question =
    typeof payload.question === "string" && payload.question.trim()
      ? payload.question.trim()
      : "Help me solve this problem.";
  const action = payload.action === "previous" ? "previous" : "next";

  if (!slug) {
    return Response.json({ error: "Slug is required." }, { status: 400 });
  }
  if (question.length > 1000) {
    return Response.json(
      { error: "Question must be 1000 characters or fewer." },
      { status: 400 },
    );
  }

  try {
    const startedAt = performance.now();
    const context = await getTutorContext(prisma, slug);
    const retrievalMs = elapsedMs(startedAt);

    if (!context) {
      await recordQueryLog(prisma, {
        userId: session.user.id,
        query: question,
        source: "tutor-hint",
        retrievalMs,
        error: "Problem not found.",
      });
      return Response.json({ error: "Problem not found." }, { status: 404 });
    }
    if (!context.sources.length) {
      await recordQueryLog(prisma, {
        userId: session.user.id,
        problemId: context.problem.id,
        query: question,
        source: "tutor-hint",
        retrievalMs,
        error: "No indexed material for this problem.",
      });
      return Response.json(
        { error: "There is not enough indexed material to generate a hint." },
        { status: 422 },
      );
    }

    const state = await prisma.hintState.findUnique({
      where: {
        userId_problemId: {
          userId: session.user.id,
          problemId: context.problem.id,
        },
      },
      select: { currentLevel: true },
    });
    const currentLevel = state?.currentLevel ?? 0;
    const nextLevel =
      action === "previous"
        ? Math.max(0, currentLevel - 1)
        : Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, currentLevel + 1));

    if (nextLevel === 0) {
      await prisma.hintState.upsert({
        where: {
          userId_problemId: {
            userId: session.user.id,
            problemId: context.problem.id,
          },
        },
        update: { currentLevel: 0 },
        create: {
          userId: session.user.id,
          problemId: context.problem.id,
          currentLevel: 0,
        },
      });

      return Response.json({
        level: 0,
        maxLevel: MAX_LEVEL,
        hint: null,
        citations: [],
        message: "The hint ladder is back at its starting point.",
      });
    }

    const cacheKey = hintCacheKey(nextLevel);
    const cachedHint = await prisma.answerCache.findUnique({
      where: {
        problemId_hintLevel_queryText: {
          problemId: context.problem.id,
          hintLevel: nextLevel,
          queryText: cacheKey,
        },
      },
      select: {
        answer: true,
        expiresAt: true,
      },
    });

    if (cachedHint && cachedHint.expiresAt > new Date()) {
      await prisma.hintState.upsert({
        where: {
          userId_problemId: {
            userId: session.user.id,
            problemId: context.problem.id,
          },
        },
        update: { currentLevel: nextLevel },
        create: {
          userId: session.user.id,
          problemId: context.problem.id,
          currentLevel: nextLevel,
        },
      });

      await recordQueryLog(prisma, {
        userId: session.user.id,
        problemId: context.problem.id,
        query: question,
        source: "tutor-hint",
        cacheHit: true,
        retrievalMs,
        totalMs: elapsedMs(startedAt),
      });

      return Response.json({
        problem: context.problem,
        level: nextLevel,
        maxLevel: MAX_LEVEL,
        hint: cachedHint.answer,
        citations: context.sources,
        cached: true,
      });
    }

    if (cachedHint) {
      await prisma.answerCache.delete({
        where: {
          problemId_hintLevel_queryText: {
            problemId: context.problem.id,
            hintLevel: nextLevel,
            queryText: cacheKey,
          },
        },
      });
    }

    const apiKey = requireTutorApiKey();
    const llmStartedAt = performance.now();
    const response = await createTutorModel(apiKey).models.generateContent({
      model: tutorModel,
      contents: buildTutorPrompt(context, question, nextLevel),
    });
    const llmMs = elapsedMs(llmStartedAt);
    const hint = response.text?.trim();
    if (!hint) {
      throw new Error("Tutor returned an empty hint.");
    }

    await prisma.hintState.upsert({
      where: {
        userId_problemId: {
          userId: session.user.id,
          problemId: context.problem.id,
        },
      },
      update: { currentLevel: nextLevel },
      create: {
        userId: session.user.id,
        problemId: context.problem.id,
        currentLevel: nextLevel,
      },
    });

    await prisma.answerCache.upsert({
      where: {
        problemId_hintLevel_queryText: {
          problemId: context.problem.id,
          hintLevel: nextLevel,
          queryText: cacheKey,
        },
      },
      update: {
        answer: hint,
        expiresAt: new Date(
          Date.now() + HINT_CACHE_DAYS * 24 * 60 * 60 * 1000,
        ),
      },
      create: {
        problemId: context.problem.id,
        hintLevel: nextLevel,
        queryText: cacheKey,
        answer: hint,
        expiresAt: new Date(
          Date.now() + HINT_CACHE_DAYS * 24 * 60 * 60 * 1000,
        ),
      },
    });

    await recordQueryLog(prisma, {
      userId: session.user.id,
      problemId: context.problem.id,
      query: question,
      source: "tutor-hint",
      retrievalMs,
      llmMs,
      totalMs: elapsedMs(startedAt),
      tokensIn: response.usageMetadata?.promptTokenCount,
      tokensOut: response.usageMetadata?.candidatesTokenCount,
    });

    return Response.json({
      problem: context.problem,
      level: nextLevel,
      maxLevel: MAX_LEVEL,
      hint,
      citations: context.sources,
      cached: false,
    });
  } catch (error) {
    await recordQueryLog(prisma, {
      userId: session.user.id,
      query: question,
      source: "tutor-hint",
      error: errorMessage(error),
    });
    if (error instanceof Error && error.message === "GEMINI_API_KEY is not configured.") {
      return Response.json(
        { error: "Tutor is not configured. Set GEMINI_API_KEY first." },
        { status: 503 },
      );
    }
    console.error("Hint request failed", error);
    return Response.json(
      { error: "Hint generation is temporarily unavailable." },
      { status: 500 },
    );
  }
}
