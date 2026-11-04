import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { LandingNav } from "@/components/forge/landing-nav";
import {
  ProblemTutor,
  StartPracticingLink,
} from "@/components/forge/problem-tutor";
import { findSimilarProblems } from "@/lib/search";
import { prisma } from "@/lib/prisma";

type ProblemPageProps = {
  params: Promise<{ slug: string }>;
};

export const instant = false;

export default async function ProblemPage({ params }: ProblemPageProps) {
  const { slug } = await params;
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
        select: { id: true, section: true, content: true },
        orderBy: { createdAt: "asc" },
      },
      testCases: {
        where: { isHidden: false },
        select: { id: true, input: true, expectedOutput: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!problem) notFound();

  const similar = await findSimilarProblems(prisma, problem.id);
  const tags = problem.patterns.map(({ pattern }) => pattern.name);
  const approach = problem.chunks.find((chunk) => chunk.section === "approach");
  const complexity = problem.chunks.find((chunk) => chunk.section === "complexity");

  return (
    <main className="min-h-svh bg-[#f4f3f1] text-black">
      <LandingNav />
      <div className="mx-auto max-w-[1440px] px-4 pb-20 sm:px-8">
        <header className="grid gap-8 border-b-2 border-black py-10 md:grid-cols-[minmax(0,1fr)_300px] md:items-end md:py-16">
          <div>
            <Link
              className="font-bold underline decoration-2 underline-offset-4"
              href="/#search"
            >
              ← Back to search
            </Link>
            <h1 className="mt-8 max-w-[18ch] text-[clamp(2.8rem,7vw,6.8rem)] font-extrabold leading-[.88] tracking-[-.075em]">
              {problem.title}
            </h1>
            <p className="mt-6 max-w-[62ch] text-lg leading-relaxed">
              Read the problem, identify its pattern, and choose your next move
              before you reach for the code.
            </p>
          </div>
          <aside className="grid gap-4 md:justify-items-end">
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Badge>{problem.difficulty}</Badge>
              {problem.platform ? <Badge variant="neutral">{problem.platform}</Badge> : null}
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              {tags.map((tag) => (
                <Badge key={tag} variant="field">
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <ProblemTutor slug={problem.slug} title={problem.title} />
              <StartPracticingLink />
            </div>
          </aside>
        </header>

        <div className="grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
          <article className="min-w-0">
            <section className="border-b-2 border-black pb-12" aria-labelledby="statement-title">
              <h2 id="statement-title" className="text-2xl font-extrabold tracking-[-.04em]">
                Problem statement
              </h2>
              <div className="prose mt-6 max-w-[75ch] whitespace-pre-line text-[17px] leading-[1.65]">
                {problem.statement}
              </div>
            </section>

            {problem.constraints ? (
              <section className="border-b-2 border-black py-12" aria-labelledby="constraints-title">
                <h2 id="constraints-title" className="text-2xl font-extrabold tracking-[-.04em]">
                  Constraints
                </h2>
                <p className="mt-5 max-w-[75ch] whitespace-pre-line text-[16px] leading-[1.6]">
                  {problem.constraints}
                </p>
              </section>
            ) : null}

            <section className="border-b-2 border-black py-12" aria-labelledby="examples-title">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 id="examples-title" className="text-2xl font-extrabold tracking-[-.04em]">
                    Public examples
                  </h2>
                  <p className="mt-2 text-sm font-bold text-[#5b5b5b]">
                    These are the visible cases available before verification.
                  </p>
                </div>
                <span className="text-sm font-bold">{problem.testCases.length} cases</span>
              </div>
              <div className="mt-6 grid gap-4">
                {problem.testCases.length ? (
                  problem.testCases.map((testCase, index) => (
                    <div className="grid gap-4 bg-white p-5 md:grid-cols-2" key={testCase.id}>
                      <div>
                        <h3 className="font-extrabold">Input {index + 1}</h3>
                        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-sm leading-relaxed">
                          <code>{testCase.input}</code>
                        </pre>
                      </div>
                      <div>
                        <h3 className="font-extrabold">Expected output</h3>
                        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-sm leading-relaxed">
                          <code>{testCase.expectedOutput}</code>
                        </pre>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="bg-white p-5 font-bold">
                    No public examples are available for this problem yet.
                  </p>
                )}
              </div>
            </section>

            <section className="grid gap-6 border-b-2 border-black py-12 md:grid-cols-2" aria-labelledby="thinking-title">
              <div>
                <h2 id="thinking-title" className="text-2xl font-extrabold tracking-[-.04em]">
                  Before you code
                </h2>
                <p className="mt-3 text-sm font-bold text-[#5b5b5b]">
                  Keep the first move grounded in the indexed material.
                </p>
              </div>
              <div className="grid gap-6">
                <div>
                  <h3 className="font-extrabold">Approach</h3>
                  <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">
                    {approach?.content.replace(/^Approach\s*/, "").trim() ??
                      "The approach will appear after the problem has been enriched."}
                  </p>
                </div>
                <div>
                  <h3 className="font-extrabold">Complexity</h3>
                  <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">
                    {complexity?.content.replace(/^Complexity\s*/, "").trim() ??
                      "Complexity notes are not available yet."}
                  </p>
                </div>
              </div>
            </section>

          </article>

          <aside className="self-start lg:sticky lg:top-6" aria-labelledby="similar-title">
            <section className="bg-white p-5">
              <h2 id="similar-title" className="text-xl font-extrabold tracking-[-.04em]">
                Similar problems
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#5b5b5b]">
                Shared patterns first, then statement meaning.
              </p>
              <div className="mt-5 grid gap-1">
                {similar.length ? (
                  similar.map((item) => (
                    <Link
                      className="grid gap-2 border-b border-[#d6d3cf] py-4 transition-transform hover:translate-x-1 focus-visible:outline-4 focus-visible:outline-[#ff4332] focus-visible:outline-offset-2"
                      href={`/problems/${item.slug}`}
                      key={item.slug}
                    >
                      <strong className="leading-tight">{item.title}</strong>
                      <span className="text-sm text-[#5b5b5b]">
                        {item.tags.join(" · ")}
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="py-4 text-sm font-bold">
                    Similar problems will appear as the index grows.
                  </p>
                )}
              </div>
            </section>
            {problem.sourceUrl ? (
              <a
                className="mt-4 block text-sm font-bold underline decoration-2 underline-offset-4"
                href={problem.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                View source problem ↗
              </a>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
