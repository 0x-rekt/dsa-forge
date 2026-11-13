import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildTutorPrompt,
  createTutorModel,
  getTutorContext,
  requireTutorApiKey,
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
    const [apiKey, context] = await Promise.all([
      Promise.resolve(requireTutorApiKey()),
      getTutorContext(prisma, slug, question),
    ]);

    if (!context) {
      return Response.json({ error: "Problem not found." }, { status: 404 });
    }
    if (!context.sources.length) {
      return Response.json(
        { error: "There is not enough indexed material to answer this question." },
        { status: 422 },
      );
    }

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
          for await (const chunk of stream) {
            const text = chunk.text;
            if (text) send("token", { text });
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
