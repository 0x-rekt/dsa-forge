import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  DashboardNav,
  DashboardSection,
  DashboardStats,
  PracticeLoop,
  dashboardPanel,
} from "@/components/forge/dashboard";
import { DashboardRefresh } from "@/components/forge/dashboard-refresh";
import { SearchDemo } from "@/components/forge/search-demo";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/progress";

export const instant = false;

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const user = session.user;
  const dashboard = await getDashboardData(user.id);
  const recommendation = dashboard.recommendations[0];
  return (
    <div className="grid min-h-svh bg-[#fff5d6] text-black md:grid-cols-[248px_minmax(0,1fr)]">
      <DashboardNav user={user} />
      <main className="min-w-0 bg-white px-4 py-7 sm:px-8 sm:py-9 md:px-10 lg:px-16">
        <header className="mx-auto mb-8 flex max-w-[1160px] flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-extrabold text-[#4e4a3e]">
              DSA Forge / Personal practice
            </p>
            <h1 className="text-[clamp(2rem,3vw,2.7rem)] font-extrabold leading-none tracking-[-.055em]">
              Practice overview
            </h1>
            <p className="mt-3 max-w-[48ch] text-[15px] text-[#464646]">
              Your progress is built from attempts, hints, and verified runs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DashboardRefresh />
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-3 border-4 border-black bg-black px-4 py-2 font-extrabold text-white transition-transform hover:translate-x-1 hover:translate-y-1 focus-visible:outline-4 focus-visible:outline-[#ff4332] focus-visible:outline-offset-4"
              href="/dashboard#search"
            >
              Find a problem →
            </Link>
          </div>
        </header>
        <DashboardStats stats={dashboard.stats} />
        <section
          className="mx-auto mb-6 grid max-w-[1160px] gap-5 border-4 border-black bg-[#d4bdff] p-5 sm:p-7"
          id="search"
          aria-labelledby="dashboard-search-title"
        >
          <div className="grid items-end gap-4 md:grid-cols-[.8fr_1.2fr]">
            <h2
              className="m-0 max-w-[12ch] text-[clamp(2rem,4vw,3.7rem)] font-extrabold leading-none tracking-[-.07em]"
              id="dashboard-search-title"
            >
              Find the problem you mean
            </h2>
            <p className="m-0 max-w-[48ch] font-bold text-[#464646]">
              Describe the problem in your own words. Search combines meaning
              and keywords, then takes you straight to the problem workspace.
            </p>
          </div>
          <SearchDemo />
        </section>
        <div className="mx-auto grid max-w-[1160px] items-start gap-4 md:grid-cols-[1.35fr_.85fr]">
          <section
            className={`${dashboardPanel} bg-[#ffed00]`}
            aria-labelledby="recommendation-title"
          >
            <div className="flex min-h-[88px] justify-between gap-4 border-b-2 border-black p-5">
              <div>
                <h2
                  id="recommendation-title"
                  className="text-[21px] font-extrabold leading-none tracking-[-.04em]"
                >
                  Recommended next
                </h2>
                <p className="mt-2 max-w-[42ch] text-[13px] font-bold text-[#474747]">
                  {recommendation
                    ? "A next problem selected from your weakest tracked patterns."
                    : "Submit a solution to start building recommendations."}
                </p>
              </div>
              <span
                className="text-3xl font-extrabold leading-none"
                aria-hidden="true"
              >
                →
              </span>
            </div>
            <div className="flex min-h-48 flex-col justify-between gap-6 p-5">
              <div>
                {recommendation ? (
                  <>
                    <span className="text-[13px] font-extrabold">
                      {recommendation.patterns
                        .map(({ pattern }) => pattern.name)
                        .join(" · ")}{" "}
                      · {recommendation.difficulty}
                    </span>
                    <h3 className="mt-2 text-[clamp(2rem,4vw,3.7rem)] font-extrabold leading-none tracking-[-.07em]">
                      {recommendation.title}
                    </h3>
                    <p className="mt-4 max-w-[50ch] font-bold">
                      Practice a problem from the pattern area where your recent
                      submissions need more work.
                    </p>
                  </>
                ) : (
                  <>
                    <span className="text-[13px] font-extrabold">
                      Your next problem
                    </span>
                    <h3 className="mt-2 text-[clamp(2rem,4vw,3.7rem)] font-extrabold leading-none tracking-[-.07em]">
                      No recommendation yet
                    </h3>
                    <p className="mt-4 max-w-[50ch] font-bold">
                      Submit a Python solution and DSA Forge will use the result
                      to recommend your next practice problem.
                    </p>
                  </>
                )}
              </div>
              {recommendation ? (
                <Link
                  className="w-fit font-extrabold underline decoration-2 underline-offset-4"
                  href={`/problems/${recommendation.slug}/practice`}
                >
                  Practice this problem ↗
                </Link>
              ) : (
                <Link
                  className="w-fit font-extrabold underline decoration-2 underline-offset-4"
                  href="/dashboard#search"
                >
                  Find a problem ↗
                </Link>
              )}
            </div>
          </section>
          <DashboardSection
            title="Weak patterns"
            description="Appears after you submit attempts."
            className="bg-[#d4bdff]"
          >
            <div className="grid min-h-48 content-center gap-3 p-5">
              {dashboard.weakPatterns.length ? (
                dashboard.weakPatterns.map((item) => (
                  <div
                    className="flex items-center justify-between gap-4 border-b-2 border-black pb-3 last:border-b-0 last:pb-0"
                    key={item.patternId}
                  >
                    <span className="font-extrabold">{item.pattern.name}</span>
                    <span className="text-sm font-bold">
                      {item.weaknessScore}% weak
                    </span>
                  </div>
                ))
              ) : (
                <>
                  <strong>Nothing to rank yet.</strong>
                  <span className="max-w-[34ch] text-sm font-bold text-[#484848]">
                    Your hint use and failed runs will shape this list.
                  </span>
                </>
              )}
            </div>
          </DashboardSection>
          <DashboardSection
            title="Recent attempts"
            description="Every run gets a verdict and a pattern."
            className="min-h-80"
          >
            <div className="grid min-h-48 content-center gap-3 p-5">
              {dashboard.recentAttempts.length ? (
                dashboard.recentAttempts.map((attempt) => (
                  <div
                    className="flex items-center justify-between gap-4 border-b-2 border-black pb-3 last:border-b-0 last:pb-0"
                    key={attempt.id}
                  >
                    <div>
                      <Link
                        className="font-extrabold underline underline-offset-2"
                        href={`/problems/${attempt.problem.slug}/practice`}
                      >
                        {attempt.problem.title}
                      </Link>
                      <p className="mt-1 text-xs font-bold text-[#484848]">
                        {attempt.language} · {attempt.hintsUsed} hints ·{" "}
                        {attempt.verdict}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[#4e4e4e]">
                      {attempt.executionMs ? `${attempt.executionMs} ms` : "—"}
                    </span>
                  </div>
                ))
              ) : (
                <>
                  <span className="h-1 w-12 bg-black" aria-hidden="true" />
                  <strong>
                    Your first submitted attempt will appear here.
                  </strong>
                  <span className="max-w-[34ch] text-sm font-bold text-[#484848]">
                    Running or generating code does not count as progress.
                    Submit your own code to create a history.
                  </span>
                  <Link
                    className="mt-2 w-fit font-extrabold underline decoration-2 underline-offset-4"
                    href="/dashboard#search"
                  >
                    Search problems ↗
                  </Link>
                </>
              )}
            </div>
          </DashboardSection>
          <PracticeLoop />
        </div>
      </main>
    </div>
  );
}
