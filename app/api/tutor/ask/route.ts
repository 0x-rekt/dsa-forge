import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { elapsedMs, errorMessage, recordQueryLog } from "@/lib/query-log";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  lookupSemanticAnswer,
  storeSemanticAnswerEmbedding,
} from "@/lib/semantic-cache";
import {
  buildTutorPrompt,
  createTutorModel,
  getTutorContext,
  requireTutorApiKey,
  tutorAnswerCacheKey,
  TUTOR_CACHE_DAYS,
  tutorModel,
} from "@/lib/tutor";

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json(
      { error: "Sign in to use the tutor." },
      { status: 401 },
    );
  }

  const rateLimit = await enforceRateLimit(session.user.id, "tutor:ask", {
    limit: 10,
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
    typeof payload.question === "string" ? payload.question.trim() : "";

  if (!slug || !question) {
    return Response.json(
      { error: "Both slug and question are required." },
      { status: 400 },
    );
  }
  if (slug.length > 200 || question.length > 1000) {
    return Response.json(
      { error: "Slug or question exceeds the allowed length." },
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
        source: "tutor-ask",
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
        source: "tutor-ask",
        retrievalMs,
        error: "No indexed material for this question.",
      });
      return Response.json(
        { error: "There is not enough indexed material to answer this question." },
        { status: 422 },
      );
    }

    const cacheKey = tutorAnswerCacheKey(question);
    const cachedAnswer = await prisma.answerCache.findUnique({
      where: {
        problemId_hintLevel_queryText: {
          problemId: context.problem.id,
          hintLevel: 0,
          queryText: cacheKey,
        },
      },
      select: { answer: true, expiresAt: true },
    });

    if (cachedAnswer && cachedAnswer.expiresAt <= new Date()) {
      await prisma.answerCache.delete({
        where: {
          problemId_hintLevel_queryText: {
            problemId: context.problem.id,
            hintLevel: 0,
            queryText: cacheKey,
          },
        },
      });
    }

    let cacheHit:
      | { answer: string; kind: "exact" | "semantic"; similarity?: number }
      | null =
      cachedAnswer && cachedAnswer.expiresAt > new Date()
        ? { answer: cachedAnswer.answer, kind: "exact" }
        : null;
    // Reuse the lookup embedding when the answer has to be generated, so a
    // semantic miss costs one embedding call rather than two.
    let questionEmbedding: string | null = null;

    if (!cacheHit) {
      const semantic = await lookupSemanticAnswer(
        context.problem.id,
        0,
        question,
      );
      questionEmbedding = semantic.embedding;
      if (semantic.hit) {
        cacheHit = {
          answer: semantic.hit.answer,
          kind: "semantic",
          similarity: semantic.hit.similarity,
        };
      }
    }

    if (cacheHit) {
      const hit = cacheHit;
      const encoder = new TextEncoder();
      const cachedReadable = new ReadableStream({
        start(controller) {
          const send = (event: string, data: unknown) =>
            controller.enqueue(encoder.encode(sse(event, data)));
          send("start", {
            problem: context.problem,
            citations: context.sources,
            cached: true,
            cacheType: hit.kind,
            ...(hit.similarity === undefined
              ? {}
              : { similarity: hit.similarity }),
          });
          send("token", { text: hit.answer });
          send("done", { cached: true });
          controller.close();
        },
      });

      const totalMs = elapsedMs(startedAt);
      await recordQueryLog(prisma, {
        userId: session.user.id,
        problemId: context.problem.id,
        query: question,
        source: "tutor-ask",
        cacheHit: true,
        retrievalMs,
        totalMs,
        ttftMs: totalMs,
      });

      return new Response(cachedReadable, {
        headers: {
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
          "X-Cache": "HIT",
        },
      });
    }

    const apiKey = requireTutorApiKey();
    const model = createTutorModel(apiKey);
    const llmStartedAt = performance.now();
    const stream = await model.models.generateContentStream({
      model: tutorModel,
      contents: buildTutorPrompt(context, question),
    });

    const embeddingForCache = questionEmbedding;
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) =>
          controller.enqueue(encoder.encode(sse(event, data)));

        send("start", {
          problem: context.problem,
          citations: context.sources,
        });

        try {
          let answer = "";
          let tokensIn: number | undefined;
          let tokensOut: number | undefined;
          let ttftMs: number | undefined;
          for await (const chunk of stream) {
            const text = chunk.text;
            if (text) {
              ttftMs ??= elapsedMs(startedAt);
              answer += text;
              send("token", { text });
            }
            const usage = chunk.usageMetadata;
            if (usage) {
              tokensIn = usage.promptTokenCount ?? tokensIn;
              tokensOut = usage.candidatesTokenCount ?? tokensOut;
            }
          }
          if (answer.trim()) {
            await prisma.answerCache.upsert({
              where: {
                problemId_hintLevel_queryText: {
                  problemId: context.problem.id,
                  hintLevel: 0,
                  queryText: cacheKey,
                },
              },
              update: {
                answer: answer.trim(),
                expiresAt: new Date(
                  Date.now() + TUTOR_CACHE_DAYS * 24 * 60 * 60 * 1000,
                ),
              },
              create: {
                problemId: context.problem.id,
                hintLevel: 0,
                queryText: cacheKey,
                answer: answer.trim(),
                expiresAt: new Date(
                  Date.now() + TUTOR_CACHE_DAYS * 24 * 60 * 60 * 1000,
                ),
              },
            });

            if (embeddingForCache) {
              await storeSemanticAnswerEmbedding(
                context.problem.id,
                0,
                cacheKey,
                embeddingForCache,
              );
            }
          }
          send("done", {});
          await recordQueryLog(prisma, {
            userId: session.user.id,
            problemId: context.problem.id,
            query: question,
            source: "tutor-ask",
            retrievalMs,
            llmMs: elapsedMs(llmStartedAt),
            totalMs: elapsedMs(startedAt),
            ttftMs,
            tokensIn,
            tokensOut,
          });
          controller.close();
        } catch (error) {
          console.error("Tutor stream failed", error);
          await recordQueryLog(prisma, {
            userId: session.user.id,
            problemId: context.problem.id,
            query: question,
            source: "tutor-ask",
            retrievalMs,
            llmMs: elapsedMs(llmStartedAt),
            totalMs: elapsedMs(startedAt),
            error: errorMessage(error),
          });
          send("error", { error: "The tutor stream was interrupted." });
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    await recordQueryLog(prisma, {
      userId: session.user.id,
      query: question,
      source: "tutor-ask",
      error: errorMessage(error),
    });
    if (error instanceof Error && error.message === "GEMINI_API_KEY is not configured.") {
      return Response.json(
        { error: "Tutor is not configured. Set GEMINI_API_KEY first." },
        { status: 503 },
      );
    }
    console.error("Tutor request failed", error);
    return Response.json(
      { error: "Tutor is temporarily unavailable." },
      { status: 500 },
    );
  }
}
