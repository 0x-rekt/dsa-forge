import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../lib/prisma";

type DatasetRow = {
  task_id?: unknown;
  problem?: unknown;
  constraints?: unknown;
  difficulty?: unknown;
  tags?: unknown;
  test_cases?: unknown;
  solution?: unknown;
};

type NormalizedTestCase = { input: string; expectedOutput: string };
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const datasetPath = path.resolve(process.argv[2] ?? path.resolve(scriptDirectory, "../data/train.parquet"));

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return String(value);
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}

function asList(value: unknown): unknown[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed : [];
}

function asTags(value: unknown): string[] {
  return asList(value).map((tag) => asText(tag).trim()).filter(Boolean);
}

function titleFromTaskId(taskId: string) {
  const title = taskId
    .replace(/^\d+[-_]?/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
  return title || `Problem ${taskId}`;
}

function formatValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value ?? null);
}

function normalizeTestCases(value: unknown): NormalizedTestCase[] {
  return asList(value).flatMap((testCase) => {
    if (!testCase || typeof testCase !== "object") return [];
    const item = testCase as Record<string, unknown>;
    const input = item.kwargs ?? item.kwargs_json ?? item.input ?? item.input_expr;
    const expected = item.expected ?? item.expected_json ?? item.output ?? item.expectedOutput;
    if (input === undefined || expected === undefined) return [];
    return [{ input: formatValue(parseJson(input)), expectedOutput: formatValue(parseJson(expected)) }];
  });
}

function chunkContent(label: string, value: unknown) {
  const content = asText(value).trim();
  return content ? `${label}\n\n${content}` : "";
}

async function seedRow(row: DatasetRow) {
  const slug = asText(row.task_id).trim();
  const statement = asText(row.problem).trim();
  if (!slug || !statement) return false;

  const difficulty = asText(row.difficulty).trim();
  if (!["Easy", "Medium", "Hard"].includes(difficulty)) {
    throw new Error(`Unsupported difficulty for ${slug}: ${difficulty || "missing"}`);
  }

  const problem = await prisma.problem.upsert({
    where: { slug },
    update: {
      title: titleFromTaskId(slug), statement,
      difficulty: difficulty as "Easy" | "Medium" | "Hard",
      constraints: asText(row.constraints).trim() || null,
      platform: "LeetCode", sourceUrl: `https://leetcode.com/problems/${slug}/`,
    },
    create: {
      slug, title: titleFromTaskId(slug), statement,
      difficulty: difficulty as "Easy" | "Medium" | "Hard",
      constraints: asText(row.constraints).trim() || null,
      platform: "LeetCode", sourceUrl: `https://leetcode.com/problems/${slug}/`,
    },
  });

  await prisma.problemPattern.deleteMany({ where: { problemId: problem.id } });
  for (const tag of asTags(row.tags)) {
    const pattern = await prisma.pattern.upsert({ where: { name: tag }, update: {}, create: { name: tag } });
    await prisma.problemPattern.create({ data: { problemId: problem.id, patternId: pattern.id } });
  }

  await prisma.problemChunk.deleteMany({ where: { problemId: problem.id } });
  const chunks = [
    { section: "statement" as const, content: chunkContent("Problem statement", statement) },
    { section: "editorial" as const, content: chunkContent("Constraints", row.constraints) },
    { section: "code" as const, content: chunkContent("Reference solution", row.solution) },
  ].filter((chunk) => chunk.content);
  if (chunks.length) await prisma.problemChunk.createMany({ data: chunks.map((chunk) => ({ problemId: problem.id, ...chunk })) });

  await prisma.testCase.deleteMany({ where: { problemId: problem.id } });
  const testCases = normalizeTestCases(row.test_cases);
  if (testCases.length) {
    await prisma.testCase.createMany({
      data: testCases.map((testCase, sortOrder) => ({ ...testCase, problemId: problem.id, sortOrder, isHidden: false })),
    });
  }
  return true;
}

async function main() {
  console.log(`Reading ${datasetPath}`);
  const { asyncBufferFromFile, parquetReadObjects } = await import("hyparquet");
  const file = await asyncBufferFromFile(datasetPath);
  const rows = await parquetReadObjects({ file });
  let processed = 0;
  let skipped = 0;

  for (const row of rows) {
    if (await seedRow(row as DatasetRow)) processed += 1;
    else skipped += 1;
    if ((processed + skipped) % 100 === 0) console.log(`Processed ${processed + skipped} rows (${processed} imported, ${skipped} skipped)`);
  }

  await prisma.$disconnect();
  console.log(`Done: ${processed} imported, ${skipped} skipped`);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
