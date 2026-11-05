import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { LandingNav } from "@/components/forge/landing-nav";
import { PracticeEditor } from "@/components/forge/practice-editor";
import { prisma } from "@/lib/prisma";

type PracticePageProps = {
  params: Promise<{ slug: string }>;
};

export const instant = false;

export default async function PracticePage({ params }: PracticePageProps) {
  const { slug } = await params;
  const problem = await prisma.problem.findUnique({
    where: { slug },
    select: {
      slug: true,
      title: true,
      statement: true,
      difficulty: true,
      constraints: true,
      patterns: { select: { pattern: { select: { name: true } } } },
      testCases: {
        where: { isHidden: false },
        select: { id: true, input: true, expectedOutput: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!problem) notFound();

  const visibleTestCases = problem.testCases.slice(0, 3);

  return (
    <main className="min-h-svh overflow-x-clip bg-[#f4f3f1] text-black">
      <LandingNav />
      <div className="mx-auto min-w-0 max-w-[1700px] px-3 pb-16 sm:px-4">
        <header className="border-b-2 border-black py-6 md:py-8">
          <Link className="font-bold underline decoration-2 underline-offset-4" href={`/problems/${problem.slug}`}>
            ← Back to problem
          </Link>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="max-w-[18ch] break-words text-[clamp(2.4rem,5vw,4.8rem)] font-extrabold leading-[.9] tracking-[-.075em]">
                Practice {problem.title}
              </h1>
              <p className="mt-3 max-w-[65ch] text-base leading-relaxed">
                Implement the required function, return the answer, then verify it against the problem&apos;s cases.
              </p>
            </div>
            <Badge>{problem.difficulty}</Badge>
          </div>
        </header>

        <div className="grid min-w-0 gap-8 overflow-hidden py-6 md:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] md:gap-8 lg:gap-10">
          <aside className="min-w-0 self-start">
            <section className="bg-white p-5">
              <h2 className="text-xl font-extrabold tracking-[-.04em]">Problem brief</h2>
              <p className="mt-4 whitespace-pre-line text-[15px] leading-[1.65]">{problem.statement}</p>
              {problem.constraints ? (
                <>
                  <h3 className="mt-8 font-extrabold">Constraints</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{problem.constraints}</p>
                </>
              ) : null}
            </section>
            <section className="mt-4 bg-white p-5" aria-labelledby="examples-title">
              <div className="flex items-end justify-between gap-3">
                <h2 id="examples-title" className="text-xl font-extrabold tracking-[-.04em]">Public examples</h2>
                <span className="text-xs font-bold text-[#5b5b5b]">
                  {visibleTestCases.length} of {problem.testCases.length}
                </span>
              </div>
              <div className="mt-4">
                <div className="grid gap-4">
                {visibleTestCases.length ? visibleTestCases.map((testCase, index) => (
                  <div className="border-l-4 border-[#ff4332] pl-4" key={testCase.id}>
                    <h3 className="font-extrabold">Case {index + 1}</h3>
                    <pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-all text-xs leading-relaxed"><code>{testCase.input}</code></pre>
                    <p className="mt-2 break-all text-xs font-bold text-[#5b5b5b]">Expected: {testCase.expectedOutput}</p>
                  </div>
                )) : <p className="text-sm font-bold">No public cases are available.</p>}
                </div>
              </div>
              {problem.testCases.length > visibleTestCases.length ? (
                <p className="mt-4 text-xs font-bold text-[#5b5b5b]">
                  Showing 3 representative cases. Verification runs all {problem.testCases.length} public and hidden cases.
                </p>
              ) : null}
            </section>
          </aside>
          <div className="min-w-0 self-start">
            <PracticeEditor
              slug={problem.slug}
              sampleInput={problem.testCases[0]?.input}
              tags={problem.patterns.map(({ pattern }) => pattern.name)}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
