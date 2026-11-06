import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAndVerifyPython } from "@/lib/code-generation";
import { getTutorContext } from "@/lib/tutor";

const MAX_REQUEST_LENGTH = 2_000;

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json(
      { error: "Sign in to generate code." },
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
  const requestText =
    typeof payload.request === "string" && payload.request.trim()
      ? payload.request.trim()
      : "Provide a correct solution for this problem.";

  if (!slug || requestText.length > MAX_REQUEST_LENGTH) {
    return Response.json(
      {
        error:
          "A problem slug and a request of 2,000 characters or fewer are required.",
      },
      { status: 400 },
    );
  }

  try {
    const problem = await prisma.problem.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
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
    if (!problem.testCases.length) {
      return Response.json(
        { error: "This problem has no tests for verification." },
        { status: 422 },
      );
    }

    const context = await getTutorContext(prisma, slug, requestText);
    if (!context || !context.sources.length) {
      return Response.json(
        { error: "There is not enough indexed material to generate code." },
        { status: 422 },
      );
    }

    const run = await generateAndVerifyPython(
      context,
      requestText,
      problem.testCases,
      problem.patterns.map(({ pattern }) => pattern.name),
      problem.testCases[0]?.input,
    );

    return Response.json({
      language: "python",
      code: run.code,
      verdict: run.verdict,
      attempts: run.attempts,
      maxRetries: 2,
      warning:
        run.verdict === "passed"
          ? null
          : "This generated solution did not pass all tests.",
      results: run.results,
      executionMs: run.executionMs,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "GEMINI_API_KEY is not configured."
    ) {
      return Response.json(
        { error: "Tutor is not configured. Set GEMINI_API_KEY first." },
        { status: 503 },
      );
    }
    console.error("AI code generation failed", error);
    return Response.json(
      { error: "AI code generation is temporarily unavailable." },
      { status: 503 },
    );
  }
}
