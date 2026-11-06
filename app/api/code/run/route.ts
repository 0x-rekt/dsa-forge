import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runPythonCode } from "@/lib/code-runner";

const MAX_CODE_LENGTH = 100_000;

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Sign in to run code." }, { status: 401 });
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
  const language =
    typeof payload.language === "string" ? payload.language.trim() : "";
  const code = typeof payload.code === "string" ? payload.code : "";

  if (!slug || !language || !code.trim()) {
    return Response.json(
      { error: "Slug, language, and code are required." },
      { status: 400 },
    );
  }
  if (language !== "python") {
    return Response.json(
      { error: "Only Python execution is supported in this first version." },
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

    if (!problem) {
      return Response.json({ error: "Problem not found." }, { status: 404 });
    }
    if (!problem.testCases.length) {
      return Response.json(
        { error: "This problem has no test cases available for execution." },
        { status: 422 },
      );
    }

    const run = await runPythonCode(
      code,
      problem.testCases,
      problem.patterns.map(({ pattern }) => pattern.name),
      problem.testCases[0]?.input,
    );
    return Response.json({
      language,
      verdict: run.verdict,
      results: run.results,
      executionMs: run.executionMs,
    });
  } catch (error) {
    console.error("Code execution failed", error);
    return Response.json(
      { error: "Code execution is temporarily unavailable." },
      { status: 503 },
    );
  }
}
