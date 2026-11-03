"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const searchResults = [
  {
    title: "Longest Substring Without Repeating Characters",
    pattern: "sliding window",
    difficulty: "Medium",
    detail:
      "Keep a moving window of unique characters. When a repeat appears, move the left edge past its previous position.",
  },
  {
    title: "Two Sum",
    pattern: "hash map",
    difficulty: "Easy",
    detail:
      "Store values already seen and check whether the complement exists before adding the current number.",
  },
  {
    title: "Number of Islands",
    pattern: "graph traversal",
    difficulty: "Medium",
    detail:
      "Walk each unvisited land cell with DFS or BFS, marking the connected component as visited.",
  },
];

function SearchDemo() {
  const [query, setQuery] = useState("array values add to a target");
  const [active, setActive] = useState(1);
  const result = searchResults[active];

  function findProblem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = query.toLowerCase().includes("island")
      ? 2
      : query.toLowerCase().includes("substring")
        ? 0
        : 1;
    setActive(next);
  }

  return (
    <div className="forge-ui forge-search" data-ui>
      <div className="forge-ui__topline"><span>Problem search</span><span className="forge-ui__status">Ready</span></div>
      <form className="forge-search__form" onSubmit={findProblem}>
        <label className="sr-only" htmlFor="problem-search">Describe a DSA problem</label>
        <input id="problem-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Describe a problem" />
        <button type="submit">Find</button>
      </form>
      <div className="forge-search__result" aria-live="polite">
        <div><span className="forge-ui__eyebrow">Best match</span><strong>{result.title}</strong></div>
        <div className="forge-search__meta"><span>{result.pattern}</span><span>{result.difficulty}</span></div>
      </div>
    </div>
  );
}

function RetrievalBoard() {
  const [active, setActive] = useState(1);
  const result = searchResults[active];

  return (
    <div className="retrieval-board" data-ui>
      <div className="retrieval-board__head"><span>Matches from your words</span><span>3 found</span></div>
      <div className="retrieval-board__rows">
        {searchResults.map((item, index) => (
          <button className={`retrieval-row${active === index ? " is-active" : ""}`} key={item.title} onClick={() => setActive(index)} type="button">
            <span className="retrieval-row__title">{item.title}</span>
            <span className="retrieval-row__pattern">{item.pattern}</span>
            <span className="retrieval-row__difficulty">{item.difficulty}</span>
          </button>
        ))}
      </div>
      <div className="retrieval-board__detail">
        <div><span className="forge-ui__eyebrow">Why it matches</span><strong>{result.pattern}</strong></div>
        <p>{result.detail}</p>
      </div>
    </div>
  );
}

function HintFragment() {
  return (
    <div className="hint-fragment" data-ui>
      <div className="hint-fragment__head"><span>Hint ladder</span><span>2 / 4</span></div>
      <div className="hint-fragment__track"><span className="is-current" /><span className="is-current" /><span /><span /></div>
      <p>Try a window that grows with the right edge and shrinks when a duplicate appears.</p>
      <button type="button">Ask for the next hint</button>
    </div>
  );
}

function CodeFragment() {
  return (
    <div className="code-fragment" data-ui>
      <div className="code-fragment__head"><span>Python solution</span><span className="code-fragment__pass">Passed</span></div>
      <pre>{`seen = set()\nfor value in nums:\n    if target - value in seen:\n        return True\n    seen.add(value)`}</pre>
      <div className="code-fragment__tests"><span>Sample 01</span><span>Edge case 04</span><span>All checks passed</span></div>
    </div>
  );
}

function UserNavigation() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;
  const initials = user?.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "U";

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  if (isPending) {
    return <span className="forge-nav__loading" aria-label="Checking sign-in status" />;
  }

  if (!user) {
    return <Link className="forge-button forge-button--dark" href="/sign-in">Sign in <span aria-hidden="true">→</span></Link>;
  }

  return (
    <div className="forge-nav__account">
      <Link className="forge-nav__profile" href="/dashboard" aria-label={`Open dashboard for ${user.name}`}>
        <span
          className="forge-nav__avatar"
          aria-hidden="true"
          style={user.image ? { backgroundImage: `url(${user.image})` } : undefined}
        >
          {!user.image && initials}
        </span>
        <span className="forge-nav__profile-name">{user.name}</span>
      </Link>
      <button className="forge-button forge-button--dark forge-nav__logout" type="button" onClick={handleSignOut}>
        Log out
      </button>
    </div>
  );
}

export default function Home() {
  return (
    <main className="forge-page">
      <nav className="forge-nav" aria-label="Primary navigation">
        <Link className="forge-mark" href="/" aria-label="DSA Forge home"><span className="forge-mark__symbol">+</span><span>DSA Forge</span></Link>
        <div className="forge-nav__links"><a href="#search">Search</a><a href="#hints">Hints</a><a href="#verify">Verify</a><a href="#practice">Practice</a></div>
        <UserNavigation />
      </nav>

      <section className="forge-hero" aria-labelledby="hero-title">
        <div className="hero-tile hero-tile--name"><h1 id="hero-title">DSA Forge</h1><p>Practice the thinking, not just the answer.</p></div>
        <div className="hero-tile hero-tile--search"><SearchDemo /></div>
        <div className="hero-tile hero-tile--statement"><p>Grounded explanations, progressive hints, and code checked against tests.</p><a className="text-link" href="#how-it-works">See the loop <span aria-hidden="true">↘</span></a></div>
        <div className="hero-tile hero-tile--action"><span className="hero-tile__mark" aria-hidden="true">{"//"}</span><p>Find the pattern hiding inside the problem.</p><Link className="forge-button forge-button--paper" href="/sign-in">Open the forge</Link></div>
      </section>

      <section className="forge-intro" id="search" aria-labelledby="intro-title">
        <p className="forge-lead" id="intro-title">Most coding help stops at the answer. DSA Forge keeps the struggle useful by turning every question into a path you can follow.</p>
        <div className="intro-columns">
          <p><strong>For interview prep.</strong> Search by the words you remember, then open the problem that fits the shape of your thinking.</p>
          <p><strong>For the next move.</strong> Hints arrive in levels, from pattern name to plain-language approach to working code.</p>
          <p><strong>For fewer false wins.</strong> Generated Python runs against sample and edge cases before it earns a green light.</p>
          <p><strong>For a record of practice.</strong> Attempts and hints reveal the patterns that deserve another hour.</p>
        </div>
      </section>

      <section className="forge-section forge-section--cream" id="practice" aria-labelledby="showcase-title">
        <div className="section-heading section-heading--split"><h2 id="showcase-title">Search that names the pattern</h2><p>Describe the problem in your own words. Hybrid search combines meaning and keywords, then shows why each result belongs.</p></div>
        <RetrievalBoard />
      </section>

      <section className="forge-section forge-section--violet" id="hints" aria-labelledby="features-title">
        <div className="section-heading"><h2 id="features-title">What the forge checks</h2></div>
        <div className="feature-board">
          <article className="feature-cell feature-cell--yellow"><div><h3>Sources stay visible</h3><p>Every explanation points back to the problem material it used.</p></div><div className="citation-fragment" data-ui><span>Source chunk</span><strong>Statement · constraints</strong><p>“The window may move only forward.”</p></div></article>
          <article className="feature-cell feature-cell--paper"><div><h3>Hints leave room to think</h3><p>Ask for the next nudge only when you need it. Go back when you want another try.</p></div><HintFragment /></article>
          <article className="feature-cell feature-cell--red"><div><h3>Tests close the gap</h3><p>Code is not called verified until it has faced the cases that matter.</p></div><CodeFragment /></article>
          <article className="feature-cell feature-cell--paper"><div><h3>Weak spots become visible</h3><p>Practice history turns repeated friction into a pattern you can name.</p></div><div className="progress-fragment" data-ui><div><span>Sliding window</span><strong>72%</strong></div><div className="progress-fragment__bar"><span style={{ width: "72%" }} /></div><div><span>Graph traversal</span><strong>41%</strong></div><div className="progress-fragment__bar"><span style={{ width: "41%" }} /></div></div></article>
          <article className="feature-cell feature-cell--black"><div><h3>Answers stay focused</h3><p>No confident guesswork when the database has no good match.</p></div><div className="fallback-fragment" data-ui><span>Retrieval confidence</span><strong>Not enough evidence</strong><p>Try adding the constraint or a sample input.</p></div></article>
          <article className="feature-cell feature-cell--yellow"><div><h3>Practice has a next page</h3><p>Recommendations follow the patterns where you need more reps.</p></div><div className="recommendation-fragment" data-ui><span>Recommended next</span><strong>Minimum Window Substring</strong><p>Pattern match · Medium</p></div></article>
        </div>
      </section>

      <section className="forge-section forge-section--black" id="how-it-works" aria-labelledby="how-title">
        <div className="section-heading section-heading--light"><h2 id="how-title">From stuck to solved</h2><p>The loop is deliberately small: find the shape, take a hint, try the code, learn from the result.</p></div>
        <div className="stage-bar" data-ui>
          <div className="stage-bar__step stage-bar__step--yellow"><strong>Find</strong><p>Search the problem by meaning and words.</p></div>
          <div className="stage-bar__step stage-bar__step--paper"><strong>Think</strong><p>Climb the hint ladder without skipping the work.</p></div>
          <div className="stage-bar__step stage-bar__step--violet"><strong>Try</strong><p>Write the approach in your own editor.</p></div>
          <div className="stage-bar__step stage-bar__step--red"><strong>Verify</strong><p>Run it on cases before you trust it.</p></div>
        </div>
      </section>

      <section className="forge-proof" id="verify" aria-labelledby="proof-title">
        <div className="proof-tile proof-tile--feature"><h2 id="proof-title">Built around the hard parts</h2><p>Good DSA practice has friction. The product should make that friction legible, not hide it.</p></div>
        <div className="proof-tile"><strong>Grounded</strong><span>answers tied to source chunks</span></div>
        <div className="proof-tile"><strong>Progressive</strong><span>help that waits for your next ask</span></div>
        <div className="proof-tile"><strong>Verified</strong><span>Python checked against test cases</span></div>
        <div className="proof-tile"><strong>Personal</strong><span>practice shaped by weak patterns</span></div>
        <div className="proof-tile"><strong>Measured</strong><span>retrieval, latency, cost, and quality</span></div>
      </section>

      <section className="forge-cta" aria-labelledby="cta-title"><div className="cta-tile cta-tile--field" aria-hidden="true" /><div className="cta-tile cta-tile--main"><h2 id="cta-title">Start with the problem you have</h2><p>Bring the question you cannot quite name. DSA Forge will help you find the next useful move.</p><a className="forge-button forge-button--dark" href="/sign-in">Start solving <span aria-hidden="true">→</span></a></div><div className="cta-tile cta-tile--paper" aria-hidden="true"><span>?</span></div></section>

      <footer className="forge-footer"><div className="forge-footer__wordmark" aria-label="DSA Forge">FORGE</div><div className="forge-footer__links"><div><a href="#search">Search</a><a href="#hints">Hints</a></div><div><a href="#verify">Verification</a><a href="#practice">Practice</a></div><div><a href="/sign-in">Sign in</a><a href="/dashboard">Dashboard</a></div></div><div className="forge-footer__base"><span>© 2026 DSA Forge</span><span>Built for better attempts.</span></div></footer>
    </main>
  );
}
