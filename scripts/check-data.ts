import { prisma } from "../lib/prisma";

// Guardrails for the two data fixes:
//   1. seeder placeholder chunks must not be in the search index;
//   2. every problem exposes one sample and hides the rest.
// Run after seeding or migrating to catch a regression before an eval does.

let failures = 0;

function check(name: string, passed: boolean, detail: string) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!passed) failures += 1;
}

async function main() {
  const placeholderChunks = await prisma.problemChunk.count({
    where: {
      OR: [
        {
          section: "approach",
          content: {
            contains: "pattern to transform the problem statement into a solution.",
          },
        },
        {
          section: "complexity",
          content: {
            contains:
              "Complexity depends on the constraints and the chosen implementation.",
          },
        },
      ],
    },
  });
  check(
    "no seeder placeholder chunks",
    placeholderChunks === 0,
    `${placeholderChunks} placeholder chunk(s)`,
  );

  const problems = await prisma.problem.count();
  const withoutTests = await prisma.problem.count({
    where: { testCases: { none: {} } },
  });
  check(
    "every problem has test cases",
    withoutTests === 0,
    `${problems - withoutTests}/${problems} problems have tests`,
  );

  const withoutVisible = await prisma.problem.count({
    where: { testCases: { none: { isHidden: false } } },
  });
  check(
    "every problem exposes a visible sample",
    withoutVisible === 0,
    `${problems - withoutVisible}/${problems} problems have a visible test`,
  );

  const multiWithoutHidden = await prisma.$queryRaw<
    Array<{ count: bigint }>
  >`
    SELECT count(*)::bigint AS count
    FROM (
      SELECT "problemId"
      FROM "test_case"
      GROUP BY "problemId"
      HAVING count(*) > 1 AND count(*) FILTER (WHERE "isHidden") = 0
    ) AS uncovered
  `;
  check(
    "multi-test problems hide their extra cases",
    Number(multiWithoutHidden[0]?.count ?? 0) === 0,
    `${multiWithoutHidden[0]?.count ?? 0} problem(s) expose every case`,
  );

  const missingEmbedding = await prisma.$queryRaw<
    Array<{ count: bigint }>
  >`SELECT count(*)::bigint AS count FROM "problem_chunk" WHERE "embedding" IS NULL`;
  check(
    "every chunk is embedded",
    Number(missingEmbedding[0]?.count ?? 0) === 0,
    `${missingEmbedding[0]?.count ?? 0} chunk(s) lack an embedding`,
  );

  const missingTsv = await prisma.$queryRaw<
    Array<{ count: bigint }>
  >`SELECT count(*)::bigint AS count FROM "problem_chunk" WHERE "tsv" IS NULL`;
  check(
    "every chunk has a full-text vector",
    Number(missingTsv[0]?.count ?? 0) === 0,
    `${missingTsv[0]?.count ?? 0} chunk(s) lack a tsv`,
  );

  if (failures > 0) throw new Error(`${failures} data check(s) failed.`);
  console.log("\nAll data checks passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
