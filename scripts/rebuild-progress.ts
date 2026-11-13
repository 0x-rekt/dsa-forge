import { prisma } from "../lib/prisma";
import { rebuildPatternStats } from "../lib/progress";

async function main() {
  const users = await prisma.user.findMany({ select: { id: true } });

  for (const user of users) {
    await rebuildPatternStats(user.id);
  }

  console.log(`Rebuilt pattern stats for ${users.length} users.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
