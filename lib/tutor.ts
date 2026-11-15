import { GoogleGenAI } from "@google/genai";
import { PrismaClient } from "@/app/generated/prisma/client";

export const tutorModel =
  process.env.GEMINI_TUTOR_MODEL ?? "gemini-3.8-flash";
const MAX_SOURCES = 8;
export const TUTOR_CACHE_DAYS = 30;

// The tutor already knows which problem it is teaching, so global retrieval is
// the wrong tool for selecting context: a top-8 search can omit this problem's
// reference solution and leave the model with only the statement. Order the
// problem's own chunks instead and keep all of them (the corpus averages five).
const SECTION_PRIORITY: Record<string, number> = {
  statement: 0,
  approach: 1,
  complexity: 2,
  code: 3,
  editorial: 4,
};

const PLACEHOLDER_PATTERNS: Record<string, RegExp> = {
  approach: /pattern to transform the problem statement into a solution\.?$/i,
  complexity:
    /^Complexity depends on the constraints and the chosen implementation\.?$/i,
};

export function isPlaceholderChunk(section: string, content: string) {
  const pattern = PLACEHOLDER_PATTERNS[section];
  if (!pattern) return false;
  const body = content
    .replace(/^\s*(?:Approach|Complexity)\s*/i, "")
    .trim();
  return pattern.test(body);
}

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

  const chunks = problem.chunks
    .filter((chunk) => !isPlaceholderChunk(chunk.section, chunk.content))
    .sort(
      (left, right) =>
        (SECTION_PRIORITY[left.section] ?? 99) -
        (SECTION_PRIORITY[right.section] ?? 99),
    )
    .slice(0, MAX_SOURCES);

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

// Bump when the prompt, grounding rules, or context construction change so a
// cached answer generated under the old prompt is not served as if it were new.
export const TUTOR_PROMPT_VERSION = "2";

export function tutorAnswerCacheKey(question: string) {
  return `__ask_v${TUTOR_PROMPT_VERSION}__${normalizeTutorQuestion(question)}`;
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
- Sources are labeled by section. The statement and constraints are authoritative. A reference solution may be supplied as code.
- You may explain what the reference solution does and derive its complexity from its loops and data structures; cite that source.
- Do not attribute an inference to a source that only implies it, and never claim an editorial states something it does not.
- If the sources do not support the requested answer, say that the indexed material is insufficient. Do not fill the gap with outside knowledge.
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
