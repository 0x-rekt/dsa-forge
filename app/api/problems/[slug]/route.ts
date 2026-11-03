import { prisma } from "@/lib/prisma";
import { findSimilarProblems } from "@/lib/search";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (!slug.trim()) {
    return Response.json({ error: "Problem slug is required." }, { status: 400 });
  }

  try {
    const problem = await prisma.problem.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        statement: true,
        difficulty: true,
        platform: true,
        sourceUrl: true,
        constraints: true,
        patterns: {
          select: { pattern: { select: { name: true } } },
          orderBy: { pattern: { name: "asc" } },
        },
        chunks: {
          select: {
            id: true,
            section: true,
            content: true,
          },
          orderBy: { createdAt: "asc" },
        },
        testCases: {
          where: { isHidden: false },
          select: {
            id: true,
            input: true,
            expectedOutput: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!problem) {
      return Response.json({ error: "Problem not found." }, { status: 404 });
    }

    const patternNames = problem.patterns.map(({ pattern }) => pattern.name);
    const similar = await findSimilarProblems(prisma, problem.id);

    return Response.json({
      ...problem,
      tags: patternNames,
      patterns: undefined,
      similarProblems: similar.map((item) => ({
        ...item,
        similarity: {
          sharedPatterns: item.shared_patterns,
          embeddingDistance: item.distance,
        },
      })),
    });
  } catch (error) {
    console.error("Problem lookup failed", error);
    return Response.json({ error: "Problem is temporarily unavailable." }, { status: 500 });
  }
}
