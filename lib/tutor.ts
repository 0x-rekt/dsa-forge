import { GoogleGenAI } from "@google/genai";
import { PrismaClient } from "@/app/generated/prisma/client";
import { searchProblems } from "@/lib/search";

export const tutorModel =
  process.env.GEMINI_TUTOR_MODEL ?? "gemini-2.5-flash";
const MAX_SOURCES = 8;
export const TUTOR_CACHE_DAYS = 30;

export type TutorCitation = {
  id: string;
  label: string;
  title: string;
  slug: string;
  section: string;
  excerpt: string;
  content: string;
};

export type TutorContext = {
  problem: {
    id: string;
    slug: string;
    title: string;
    difficulty: string;
    tags: string[];
  };
  sources: TutorCitation[];
  promptContext: string;
};

function excerpt(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 240
    ? `${normalized.slice(0, 237).trimEnd()}...`
    : normalized;
}

export async function getTutorContext(
  prisma: PrismaClient,
  slug: string,
  question: string,
) {
  const problem = await prisma.problem.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      patterns: {
        select: { pattern: { select: { name: true } } },
        orderBy: { pattern: { name: "asc" } },
      },
      chunks: {
        select: { id: true, section: true, content: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!problem) return null;

  const search = await searchProblems(
    prisma,
    `${problem.title}\n${question}`,
    {},
    "reranked",
  );
  const rankedChunks = search.results.filter(
    (result) => result.problemId === problem.id,
  );
  const chunks = (rankedChunks.length
    ? rankedChunks.map((result) => ({
        id: result.chunkId,
        section: result.section,
        content: result.content,
      }))
    : problem.chunks
  ).slice(0, MAX_SOURCES);

  const sources = chunks.map((chunk, index) => ({
    id: chunk.id,
    label: `Source ${index + 1}`,
    title: problem.title,
    slug: problem.slug,
    section: chunk.section,
    excerpt: excerpt(chunk.content),
    content: chunk.content,
  }));

  const promptContext = chunks
    .map((chunk, index) => `[Source ${index + 1} | ${chunk.section}]\n${chunk.content}`)
    .join("\n\n");

  return {
    problem: {
      id: problem.id,
      slug: problem.slug,
      title: problem.title,
      difficulty: problem.difficulty,
      tags: problem.patterns.map(({ pattern }) => pattern.name),
    },
    sources,
    promptContext,
  } satisfies TutorContext;
}

export function requireTutorApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  return apiKey;
}

export function normalizeTutorQuestion(question: string) {
  return question.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function tutorAnswerCacheKey(question: string) {
  return `__ask__${normalizeTutorQuestion(question)}`;
}

export function buildTutorPrompt(
  context: TutorContext,
  question: string,
  hintLevel?: number,
) {
  const levelInstruction =
    hintLevel === undefined
      ? "Answer the question directly, teaching step by step and explaining time and space complexity when relevant."
      : `Give only hint level ${hintLevel}:
- Level 1: name the relevant pattern or topic, without revealing the solution.
- Level 2: explain the central idea in one or two sentences.
- Level 3: give a step-by-step approach or pseudocode, but do not provide executable code.
- Level 4: provide the complete solution and explain it.
Do not reveal details from a higher level than requested.`;

  return `You are the DSA Forge tutor for the problem "${context.problem.title}".
Difficulty: ${context.problem.difficulty}
Patterns: ${context.problem.tags.join(", ") || "Not specified"}

${levelInstruction}

Grounding rules:
- Use only the supplied sources. Do not invent constraints, examples, APIs, or facts.
- If the sources do not support the requested answer, say that the indexed material is insufficient.
- Refer to supporting sources inline using the supplied labels, such as [Source 1].
- Never claim that code was tested or verified.
- Keep the response concise and useful for a learner.

User question:
${question}

Indexed sources:
${context.promptContext}`;
}

export function createTutorModel(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}
