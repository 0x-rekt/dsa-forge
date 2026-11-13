import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";
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
    const context = await getTutorContext(prisma, slug, question);

    if (!context) {
      return Response.json({ error: "Problem not found." }, { status: 404 });
    }
    if (!context.sources.length) {
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

    if (cachedAnswer && cachedAnswer.expiresAt > new Date()) {
      const encoder = new TextEncoder();
      const cachedReadable = new ReadableStream({
        start(controller) {
          const send = (event: string, data: unknown) =>
            controller.enqueue(encoder.encode(sse(event, data)));
          send("start", {
            problem: context.problem,
            citations: context.sources,
            cached: true,
          });
          send("token", { text: cachedAnswer.answer });
          send("done", { cached: true });
          controller.close();
        },
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
    const stream = await model.models.generateContentStream({
      model: tutorModel,
      contents: buildTutorPrompt(context, question),
    });

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
          for await (const chunk of stream) {
            const text = chunk.text;
            if (text) {
              answer += text;
              send("token", { text });
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
          }
          send("done", {});
          controller.close();
        } catch (error) {
          console.error("Tutor stream failed", error);
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
