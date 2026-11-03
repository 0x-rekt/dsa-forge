import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const instant = false;

const dashboardStats = [
  { label: "Attempts", value: "0", detail: "No attempts yet" },
  { label: "Solved", value: "0", detail: "Verified passes" },
  { label: "Hints used", value: "0", detail: "Across all problems" },
  { label: "Patterns tracked", value: "0", detail: "Builds from attempts" },
];

const practiceSteps = [
  { title: "Find", copy: "Search by the words you remember." },
  { title: "Think", copy: "Use hints without skipping the work." },
  { title: "Verify", copy: "Run code against the cases that matter." },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const user = session.user;
  const userInitials = initials(user.name);

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
        <Link className="dashboard-brand" href="/" aria-label="DSA Forge home">
          <span className="dashboard-brand__mark" aria-hidden="true">+</span>
          <span>DSA Forge</span>
        </Link>

        <div className="dashboard-scope">
          <span>Personal practice</span>
          <strong>{user.name}</strong>
        </div>

        <nav className="dashboard-nav" aria-label="Workspace">
          <span className="dashboard-nav__label">Workspace</span>
          <Link className="dashboard-nav__item dashboard-nav__item--active" href="/dashboard" aria-current="page">Overview</Link>
          <Link className="dashboard-nav__item" href="/#search">Find a problem</Link>
          <Link className="dashboard-nav__item" href="/#hints">Hint ladder</Link>
          <Link className="dashboard-nav__item" href="/#verify">Verification</Link>
        </nav>

        <div className="dashboard-sidebar__bottom">
          <div className="dashboard-user">
            <span className="dashboard-user__avatar" aria-hidden="true">{userInitials}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
          </div>
          <Link className="dashboard-back" href="/">Back to forge <span aria-hidden="true">↗</span></Link>
        </div>
      </aside>

      <main className="dashboard-canvas">
        <header className="dashboard-titlebar">
          <div>
            <p className="dashboard-breadcrumb">DSA Forge / Personal practice</p>
            <h1>Practice overview</h1>
            <p className="dashboard-titlebar__description">Your progress is built from attempts, hints, and verified runs.</p>
          </div>
          <Link className="dashboard-primary" href="/#search">Find a problem <span aria-hidden="true">→</span></Link>
        </header>

        <section className="dashboard-stats" aria-label="Practice totals">
          {dashboardStats.map((stat) => (
            <div className="dashboard-stat" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.detail}</small>
            </div>
          ))}
        </section>

        <div className="dashboard-content-grid">
          <section className="dashboard-panel dashboard-recommendation" aria-labelledby="recommendation-title">
            <div className="dashboard-panel__heading">
              <div>
                <h2 id="recommendation-title">Recommended next</h2>
                <p>Start with a classic pattern and make the first attempt count.</p>
              </div>
              <span className="dashboard-panel__mark" aria-hidden="true">→</span>
            </div>
            <div className="dashboard-problem">
              <div>
                <span className="dashboard-problem__pattern">Hash map · Easy</span>
                <h3>Two Sum</h3>
                <p>Find two numbers in an array that add to a target without checking every pair.</p>
              </div>
              <Link className="dashboard-panel__link" href="/#search">Find this problem <span aria-hidden="true">↗</span></Link>
            </div>
          </section>

          <section className="dashboard-panel dashboard-patterns" aria-labelledby="patterns-title">
            <div className="dashboard-panel__heading">
              <div>
                <h2 id="patterns-title">Weak patterns</h2>
                <p>Appears after you submit attempts.</p>
              </div>
            </div>
            <div className="dashboard-empty dashboard-empty--compact">
              <strong>Nothing to rank yet.</strong>
              <span>Your hint use and failed runs will shape this list.</span>
            </div>
          </section>

          <section className="dashboard-panel dashboard-attempts" aria-labelledby="attempts-title">
            <div className="dashboard-panel__heading">
              <div>
                <h2 id="attempts-title">Recent attempts</h2>
                <p>Every run gets a verdict and a pattern.</p>
              </div>
              <span className="dashboard-panel__count">0 attempts</span>
            </div>
            <div className="dashboard-empty">
              <span className="dashboard-empty__line" aria-hidden="true" />
              <strong>Your first attempt will appear here.</strong>
              <span>Search for a problem to start building a useful history.</span>
              <Link className="dashboard-panel__link" href="/#search">Search problems <span aria-hidden="true">↗</span></Link>
            </div>
          </section>

          <section className="dashboard-panel dashboard-loop" aria-labelledby="loop-title">
            <div className="dashboard-panel__heading">
              <div>
                <h2 id="loop-title">The practice loop</h2>
                <p>What DSA Forge will measure as you work.</p>
              </div>
            </div>
            <ol className="dashboard-loop__list">
              {practiceSteps.map((step) => (
                <li key={step.title}>
                  <strong>{step.title}</strong>
                  <span>{step.copy}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>
    </div>
  );
}
