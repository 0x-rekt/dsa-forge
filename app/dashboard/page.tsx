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
import { auth } from "@/lib/auth";

export const instant = false;

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const user = session.user;
  return (
    <div className="grid min-h-screen bg-[#fff5d6] text-black lg:grid-cols-[248px_minmax(0,1fr)]">
      <DashboardNav user={user} />
      <main className="min-w-0 bg-white px-5 py-9 sm:px-8 lg:px-16">
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
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-3 border-4 border-black bg-black px-4 py-2 font-extrabold text-white transition-transform hover:translate-x-1 hover:translate-y-1 focus-visible:outline-4 focus-visible:outline-[#ff4332] focus-visible:outline-offset-4"
            href="/#search"
          >
            Find a problem →
          </Link>
        </header>
        <DashboardStats />
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
                  Start with a classic pattern and make the first attempt count.
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
                <span className="text-[13px] font-extrabold">
                  Hash map · Easy
                </span>
                <h3 className="mt-2 text-[clamp(2rem,4vw,3.7rem)] font-extrabold leading-none tracking-[-.07em]">
                  Two Sum
                </h3>
                <p className="mt-4 max-w-[50ch] font-bold">
                  Find two numbers in an array that add to a target without
                  checking every pair.
                </p>
              </div>
              <Link
                className="w-fit font-extrabold underline decoration-2 underline-offset-4"
                href="/#search"
              >
                Find this problem ↗
              </Link>
            </div>
          </section>
          <DashboardSection
            title="Weak patterns"
            description="Appears after you submit attempts."
            className="bg-[#d4bdff]"
          >
            <div className="grid min-h-48 content-center gap-2 p-5">
              <strong>Nothing to rank yet.</strong>
              <span className="max-w-[34ch] text-sm font-bold text-[#484848]">
                Your hint use and failed runs will shape this list.
              </span>
            </div>
          </DashboardSection>
          <DashboardSection
            title="Recent attempts"
            description="Every run gets a verdict and a pattern."
            className="min-h-80"
          >
            <div className="grid min-h-48 content-center gap-2 p-5">
              <span className="h-1 w-12 bg-black" aria-hidden="true" />
              <strong>Your first attempt will appear here.</strong>
              <span className="max-w-[34ch] text-sm font-bold text-[#484848]">
                Search for a problem to start building a useful history.
              </span>
              <Link
                className="mt-2 w-fit font-extrabold underline decoration-2 underline-offset-4"
                href="/#search"
              >
                Search problems ↗
              </Link>
            </div>
          </DashboardSection>
          <PracticeLoop />
        </div>
      </main>
    </div>
  );
}
