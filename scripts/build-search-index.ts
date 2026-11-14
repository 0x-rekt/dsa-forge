import { prisma } from "../lib/prisma";

async function main() {
  const updated = await prisma.$executeRaw`
    UPDATE "problem_chunk"
    SET "tsv" = to_tsvector('english', "content")
  `;

  const populated = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "problem_chunk"
    WHERE "tsv" IS NOT NULL
  `;

  console.log(`Updated full-text vectors for ${updated} problem chunks.`);
  console.log(`Chunks with populated tsv: ${populated[0]?.count ?? 0}.`);
  console.log(
    "Search indexes (GIN on tsv, HNSW on embedding) are managed by Prisma migrations.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
