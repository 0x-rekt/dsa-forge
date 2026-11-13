import Link from "next/link";
import type { ReactNode } from "react";
import { ForgeMark } from "./forge-mark";

export const dashboardPanel = "border-4 border-black";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function DashboardNav({
  user,
}: {
  user: { name: string; email: string };
}) {
  return (
    <aside
      className={`${dashboardPanel} flex min-h-screen flex-col border-y-0 border-l-0 p-5 lg:border-r-2`}
      aria-label="Dashboard navigation"
    >
      <ForgeMark />
      <div className="my-12 hidden gap-1 border-b-2 border-black px-2 pb-5 lg:grid">
        <span className="text-xs font-extrabold text-[#4e4a3e]">
          Personal practice
        </span>
        <strong className="truncate text-[15px]">{user.name}</strong>
      </div>
      <nav
        className="mt-6 flex gap-1 overflow-x-auto lg:mt-0 lg:grid"
        aria-label="Workspace"
      >
        <span className="hidden px-2 pb-2 text-xs font-extrabold lg:block">
          Workspace
        </span>
        <Link
          className="min-h-10 shrink-0 px-3 py-2 font-bold hover:bg-white lg:[&[aria-current=page]]:border-l-2 lg:[&[aria-current=page]]:border-black lg:[&[aria-current=page]]:bg-white"
          href="/dashboard"
          aria-current="page"
        >
          Overview
        </Link>
        <Link
          className="min-h-10 shrink-0 px-3 py-2 font-bold hover:bg-white"
          href="/#search"
        >
          Find a problem
        </Link>
        <Link
          className="min-h-10 shrink-0 px-3 py-2 font-bold hover:bg-white"
          href="/#hints"
        >
          Hint ladder
        </Link>
        <Link
          className="min-h-10 shrink-0 px-3 py-2 font-bold hover:bg-white"
          href="/#verify"
        >
          Verification
        </Link>
      </nav>
      <div className="mt-auto hidden gap-6 lg:grid">
        <div className="flex min-w-0 items-center gap-2 border-t-2 border-black px-2 pt-3">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center border-2 border-black bg-[#d4bdff] text-xs font-extrabold"
            aria-hidden="true"
          >
            {initials(user.name)}
          </span>
          <span className="grid min-w-0 gap-0.5">
            <strong className="truncate text-sm">{user.name}</strong>
            <small className="truncate text-xs">{user.email}</small>
          </span>
        </div>
        <Link
          className="px-2 text-sm font-extrabold underline decoration-2 underline-offset-4"
          href="/"
        >
          Back to forge ↗
        </Link>
      </div>
    </aside>
  );
}

export function DashboardSection({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${dashboardPanel} ${className}`}>
      <div className="min-h-[88px] border-b-2 border-black p-5">
        <h2 className="text-[21px] font-extrabold leading-none tracking-[-.04em]">
          {title}
        </h2>
        <p className="mt-2 text-[13px] font-bold text-[#474747]">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

export function DashboardStats({
  stats,
}: {
  stats: {
    attempts: number;
    solved: number;
    hintsUsed: number;
    patternsTracked: number;
  };
}) {
  const cards = [
    { label: "Attempts", value: stats.attempts, detail: "Submitted solutions" },
    { label: "Solved", value: stats.solved, detail: "Verified passes" },
    {
      label: "Hints used",
      value: stats.hintsUsed,
      detail: "Highest level per problem",
    },
    {
      label: "Patterns tracked",
      value: stats.patternsTracked,
      detail: "Built from attempts",
    },
  ];
  return (
    <section
      className="mx-auto mb-6 grid max-w-[1160px] grid-cols-2 border-y-2 border-black md:grid-cols-4"
      aria-label="Practice totals"
    >
      {cards.map((stat, index) => (
        <div
          className={`grid min-h-[122px] content-center gap-1 px-5 py-4 ${index % 2 === 1 ? "border-r-0" : "border-r-2"} ${index < 2 ? "border-b-2 md:border-b-0" : ""} border-black md:border-b-0 md:border-r-2 md:last:border-r-0`}
          key={stat.label}
        >
          <span className="text-[13px] font-bold text-[#4e4e4e]">
            {stat.label}
          </span>
          <strong className="text-3xl leading-none tabular-nums">
            {stat.value}
          </strong>
          <small className="text-[13px] font-bold text-[#4e4e4e]">
            {stat.detail}
          </small>
        </div>
      ))}
    </section>
  );
}

export function PracticeLoop() {
  const steps = [
    { title: "Find", copy: "Search by the words you remember." },
    { title: "Think", copy: "Use hints without skipping the work." },
    { title: "Verify", copy: "Run code against the cases that matter." },
  ];
  return (
    <DashboardSection
      title="The practice loop"
      description="What DSA Forge will measure as you work."
      className="min-h-80 bg-[#f4f0e4]"
    >
      <ol className="m-0 list-none p-0">
        {steps.map((step) => (
          <li
            className="grid grid-cols-[72px_1fr] gap-3 border-b-2 border-black p-4 last:border-b-0"
            key={step.title}
          >
            <strong>{step.title}</strong>
            <span className="text-sm font-bold text-[#484848]">
              {step.copy}
            </span>
          </li>
        ))}
      </ol>
    </DashboardSection>
  );
}
