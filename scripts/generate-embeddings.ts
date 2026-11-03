import { prisma } from "../lib/prisma";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
const dimensions = 768;
const batchSize = Number(process.env.GEMINI_EMBEDDING_BATCH_SIZE ?? 50);
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`;

type Chunk = { id: string; content: string };
type EmbeddingResponse = { embeddings?: Array<{ values?: number[] }> };

function vectorLiteral(values: number[]) {
  if (values.length !== dimensions || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Expected ${dimensions} finite embedding values, received ${values.length}`);
  }
  return `[${values.join(",")}]`;
}

async function embedBatch(chunks: Chunk[]) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey!,
    },
    body: JSON.stringify({
      requests: chunks.map((chunk) => ({
        model: `models/${model}`,
        content: { parts: [{ text: chunk.content }] },
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: dimensions,
      })),
    }),
  });

  const body = await response.json() as EmbeddingResponse & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(`Gemini embedding request failed (${response.status}): ${body.error?.message ?? "unknown error"}`);
  }

  if (!body.embeddings || body.embeddings.length !== chunks.length) {
    throw new Error(`Gemini returned ${body.embeddings?.length ?? 0} embeddings for ${chunks.length} chunks`);
  }

  return body.embeddings.map((embedding) => vectorLiteral(embedding.values ?? []));
}

async function main() {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    throw new Error("GEMINI_EMBEDDING_BATCH_SIZE must be an integer between 1 and 100");
  }

  const chunks = await prisma.$queryRaw<Chunk[]>`
    SELECT "id", "content"
    FROM "problem_chunk"
    WHERE "embedding" IS NULL
    ORDER BY "id"
  `;

  console.log(`Found ${chunks.length} chunks without embeddings.`);

  for (let offset = 0; offset < chunks.length; offset += batchSize) {
    const batch = chunks.slice(offset, offset + batchSize);
    let embeddings: string[] = [];
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        embeddings = await embedBatch(batch);
        break;
      } catch (error) {
        lastError = error;
        if (attempt === 2) throw lastError;
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }

    for (let index = 0; index < batch.length; index += 1) {
      await prisma.$executeRaw`
        UPDATE "problem_chunk"
        SET "embedding" = ${embeddings[index]}::vector
        WHERE "id" = ${batch[index].id}
      `;
    }

    console.log(`Embedded ${Math.min(offset + batch.length, chunks.length)} / ${chunks.length} chunks.`);
  }

  console.log("Embedding generation complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
