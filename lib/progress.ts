import { prisma } from "@/lib/prisma";

type ProgressPrisma = typeof prisma;

function weaknessScore(
  failures: number,
  attempts: number,
  averageHints: number,
) {
  if (!attempts) return 0;
  const failureRate = failures / attempts;
  const hintPressure = Math.min(averageHints / 4, 1);
  // The weighted components already add up to a 0–100 percentage.
  return Number((failureRate * 70 + hintPressure * 30).toFixed(1));
}

export async function rebuildPatternStats(
  userId: string,
  client: ProgressPrisma = prisma,
) {
  const attempts = await client.attempt.findMany({
    where: { userId },
    select: {
      verdict: true,
      hintsUsed: true,
      problem: {
        select: {
          patterns: { select: { patternId: true } },
        },
      },
    },
  });

  const grouped = new Map<
    string,
    { attempts: number; passes: number; hints: number }
  >();
  for (const attempt of attempts) {
    for (const { patternId } of attempt.problem.patterns) {
      const current = grouped.get(patternId) ?? {
        attempts: 0,
        passes: 0,
        hints: 0,
      };
      current.attempts += 1;
      current.passes += attempt.verdict === "passed" ? 1 : 0;
      current.hints += attempt.hintsUsed;
      grouped.set(patternId, current);
    }
  }

  await client.$transaction(async (tx) => {
    for (const [patternId, summary] of grouped) {
      const averageHints = summary.hints / summary.attempts;
      await tx.userPatternStat.upsert({
        where: { userId_patternId: { userId, patternId } },
        create: {
          userId,
          patternId,
          attempts: summary.attempts,
          passes: summary.passes,
          averageHints,
          weaknessScore: weaknessScore(
            summary.attempts - summary.passes,
            summary.attempts,
            averageHints,
          ),
        },
        update: {
          attempts: summary.attempts,
          passes: summary.passes,
          averageHints,
          weaknessScore: weaknessScore(
            summary.attempts - summary.passes,
            summary.attempts,
            averageHints,
          ),
        },
      });
    }
  });
}

export async function getDashboardData(userId: string) {
  const [attempts, stats] = await Promise.all([
    prisma.attempt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        verdict: true,
        language: true,
        hintsUsed: true,
        executionMs: true,
        createdAt: true,
        problem: { select: { slug: true, title: true, difficulty: true } },
      },
    }),
    prisma.userPatternStat.findMany({
      where: { userId },
      orderBy: { weaknessScore: "desc" },
      take: 5,
      select: {
        patternId: true,
        attempts: true,
        passes: true,
        averageHints: true,
        weaknessScore: true,
        pattern: { select: { name: true } },
      },
    }),
  ]);

  const [attemptTotals, recommendation, hintAttempts] = await Promise.all([
    prisma.attempt.aggregate({
      where: { userId },
      _count: { _all: true },
    }),
    getRecommendation(userId, stats),
    prisma.attempt.findMany({
      where: { userId },
      select: { problemId: true, hintsUsed: true },
    }),
  ]);

  const solved = await prisma.attempt.findMany({
    where: { userId, verdict: "passed" },
    distinct: ["problemId"],
    select: { problemId: true },
  });

  // A hint level belongs to the problem session, not to each submission.
  // Submitting the same problem again must not count the same hints twice.
  const highestHintsByProblem = new Map<string, number>();
  for (const attempt of hintAttempts) {
    const highest = highestHintsByProblem.get(attempt.problemId) ?? 0;
    highestHintsByProblem.set(
      attempt.problemId,
      Math.max(highest, attempt.hintsUsed),
    );
  }
  const hintsUsed = [...highestHintsByProblem.values()].reduce(
    (total, hints) => total + hints,
    0,
  );

  return {
    stats: {
      attempts: attemptTotals._count._all,
      solved: solved.length,
      hintsUsed,
      patternsTracked: stats.length,
    },
    weakPatterns: stats,
    recentAttempts: attempts,
    recommendations: recommendation,
  };
}

async function getRecommendation(
  userId: string,
  stats: Array<{ patternId: string }>,
) {
  if (!stats.length) return [];

  return prisma.problem.findMany({
    where: {
      patterns: {
        some: { patternId: { in: stats.map((stat) => stat.patternId) } },
      },
      attempts: { none: { userId, verdict: "passed" } },
    },
    orderBy: [{ difficulty: "asc" }, { title: "asc" }],
    take: 3,
    select: {
      slug: true,
      title: true,
      difficulty: true,
      patterns: { select: { pattern: { select: { name: true } } } },
    },
  });
}
