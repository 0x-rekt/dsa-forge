"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FeaturePanel,
  CodeFragment,
  HintFragment,
} from "@/components/forge/feature-panel";
import { RetrievalBoard } from "@/components/forge/retrieval-board";
import { SearchDemo, fallbackResults } from "@/components/forge/search-demo";
import { LandingNav } from "@/components/forge/landing-nav";
import type { DisplayResult } from "@/components/forge/types";

const ink = "border-4 border-black";
const shadow = "shadow-[8px_8px_0_#000]";
const smallShadow = "shadow-[5px_5px_0_#000]";
const button =
  "inline-flex min-h-12 items-center justify-center gap-3 border-4 border-black px-5 py-3 font-extrabold transition-transform duration-0 hover:translate-x-1 hover:translate-y-1 focus-visible:outline-4 focus-visible:outline-[#ff4332] focus-visible:outline-offset-4 active:translate-x-2 active:translate-y-2";

export default function Home() {
  const [liveResults, setLiveResults] =
    useState<DisplayResult[]>(fallbackResults);
  return (
    <main className="min-h-screen overflow-x-clip bg-[#fff5d6] font-sans text-[17px] leading-relaxed text-black selection:bg-[#ffed00] [&_a]:focus-visible:outline-4 [&_a]:focus-visible:outline-[#ff4332] [&_a]:focus-visible:outline-offset-4">
      <LandingNav />
      <section
        className="mx-auto grid min-h-[min(700px,calc(100svh-88px))] w-[calc(100%-16px)] max-w-[1440px] grid-cols-1 gap-2 pb-2 sm:w-[calc(100%-32px)] md:grid-cols-2 md:grid-rows-2"
        aria-labelledby="hero-title"
      >
        <div
          className={`${ink} flex min-h-[32svh] flex-col justify-end bg-[#ffed00] p-[clamp(22px,3vw,42px)] ${shadow} md:min-h-0`}
        >
          <h1
            id="hero-title"
            className="m-0 max-w-[7ch] text-[clamp(4rem,11.5vw,11rem)] font-extrabold leading-[.82] tracking-[-.075em]"
          >
            DSA Forge
          </h1>
          <p className="mt-7 max-w-[20ch] text-[clamp(1.1rem,2vw,1.6rem)] font-bold leading-tight">
            Practice the thinking, not just the answer.
          </p>
        </div>
        <div
          id="search"
          aria-label="Problem search"
          className={`${ink} flex items-center bg-white p-[clamp(22px,3vw,42px)] ${shadow}`}
        >
          <SearchDemo onResults={setLiveResults} />
        </div>
        <div
          className={`${ink} flex flex-col justify-between bg-black p-[clamp(22px,3vw,42px)] text-white ${shadow}`}
        >
          <p className="m-0 max-w-[18ch] text-[clamp(1.5rem,2.6vw,2.45rem)] font-bold leading-none tracking-[-.035em]">
            Grounded explanations, progressive hints, and code checked against
            tests.
          </p>
          <a
            className="font-extrabold underline decoration-3 underline-offset-4"
            href="#how-it-works"
          >
            See the loop <span aria-hidden="true">↘</span>
          </a>
        </div>
        <div
          className={`${ink} flex min-h-[240px] flex-col justify-between bg-[#ff4332] p-[clamp(22px,3vw,42px)] ${shadow}`}
        >
          <span
            className="text-[clamp(2.5rem,5vw,5rem)] font-extrabold leading-none tracking-[-.12em]"
            aria-hidden="true"
          >
            {"//"}
          </span>
          <p className="m-0 max-w-[18ch] text-[clamp(1.5rem,2.6vw,2.45rem)] font-bold leading-none tracking-[-.035em]">
            Find the pattern hiding inside the problem.
          </p>
          <Link className={`${button} w-fit bg-[#fff5d6]`} href="/sign-in">
            Open the forge
          </Link>
        </div>
      </section>
      <section
        className="mx-auto w-[calc(100%-16px)] max-w-[1440px] py-[clamp(76px,11vw,150px)] sm:w-[calc(100%-32px)]"
        aria-labelledby="intro-title"
      >
        <p
          id="intro-title"
          className="m-0 max-w-[980px] text-[clamp(1.8rem,3.7vw,3.6rem)] font-bold leading-tight tracking-[-.045em]"
        >
          Most coding help stops at the answer. DSA Forge keeps the struggle
          useful by turning every question into a path you can follow.
        </p>
        <div className="mt-20 grid gap-6 md:grid-cols-4">
          <p className="m-0 max-w-[28ch] text-[15px]">
            <strong>For interview prep.</strong> Search by the words you
            remember, then open the problem that fits the shape of your
            thinking.
          </p>
          <p className="m-0 max-w-[28ch] text-[15px]">
            <strong>For the next move.</strong> Hints arrive in levels, from
            pattern name to plain-language approach to working code.
          </p>
          <p className="m-0 max-w-[28ch] text-[15px]">
            <strong>For fewer false wins.</strong> Generated Python runs against
            sample and edge cases before it earns a green light.
          </p>
          <p className="m-0 max-w-[28ch] text-[15px]">
            <strong>For a record of practice.</strong> Attempts and hints reveal
            the patterns that deserve another hour.
          </p>
        </div>
      </section>
      <section
        className={`${ink} mx-auto w-[calc(100%-16px)] max-w-[1440px] bg-white p-[clamp(72px,10vw,140px)_clamp(16px,4vw,58px)] ${shadow} sm:w-[calc(100%-32px)]`}
        id="practice"
        aria-label="Search retrieval results"
      >
        <div id="retrieval-results" className="scroll-mt-8">
          <div className="mb-14 grid items-end gap-6 md:grid-cols-[1.1fr_.9fr] md:gap-14">
            <h2
              id="showcase-title"
              className="m-0 max-w-[12ch] text-[clamp(2.8rem,6vw,6.5rem)] font-extrabold leading-[.88] tracking-[-.07em]"
            >
              Search that names the pattern
            </h2>
            <p className="m-0 max-w-[34ch] text-[19px] font-bold leading-snug">
              Describe the problem in your own words. Hybrid search combines
              meaning and keywords, then shows why each result belongs.
            </p>
          </div>
          <RetrievalBoard items={liveResults} />
        </div>
      </section>
      <section
        className={`${ink} mx-auto w-[calc(100%-16px)] max-w-[1440px] bg-[#d4bdff] p-[clamp(72px,10vw,140px)_clamp(16px,4vw,58px)] ${shadow} sm:w-[calc(100%-32px)]`}
        id="hints"
        aria-labelledby="features-title"
      >
        <h2
          id="features-title"
          className="mb-14 max-w-[12ch] text-[clamp(2.8rem,6vw,6.5rem)] font-extrabold leading-[.88] tracking-[-.07em]"
        >
          What the forge checks
        </h2>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          <FeaturePanel
            title="Sources stay visible"
            copy="Every explanation points back to the problem material it used."
            body={
              <div className={`${ink} bg-white p-4`} data-ui>
                <span className="text-[13px] font-extrabold">Source chunk</span>
                <strong className="mt-3 block text-[21px] leading-none">
                  Statement · constraints
                </strong>
                <p className="mt-3 text-sm">
                  “The window may move only forward.”
                </p>
              </div>
            }
            tone="bg-[#ffed00]"
          />
          <FeaturePanel
            title="Hints leave room to think"
            copy="Ask for the next nudge only when you need it."
            body={<HintFragment />}
            tone="bg-white"
          />
          <FeaturePanel
            title="Tests close the gap"
            copy="Code is not called verified until it has faced the cases that matter."
            body={<CodeFragment />}
            tone="bg-[#ff4332]"
          />
          <FeaturePanel
            title="Weak spots become visible"
            copy="Practice history turns repeated friction into a pattern you can name."
            body={
              <div className={`${ink} bg-white p-4`} data-ui>
                <div className="flex justify-between text-sm font-bold">
                  <span>Sliding window</span>
                  <strong>72%</strong>
                </div>
                <div className="my-2 h-3 border-2 border-black bg-[#d4bdff]">
                  <span className="block h-full w-[72%] bg-[#ff4332]" />
                </div>
                <div className="mt-4 flex justify-between text-sm font-bold">
                  <span>Graph traversal</span>
                  <strong>41%</strong>
                </div>
                <div className="my-2 h-3 border-2 border-black bg-[#d4bdff]">
                  <span className="block h-full w-[41%] bg-[#ff4332]" />
                </div>
              </div>
            }
            tone="bg-white"
          />
          <FeaturePanel
            title="Answers stay focused"
            copy="No confident guesswork when the database has no good match."
            body={
              <div className={`${ink} bg-white p-4`} data-ui>
                <span className="text-[13px] font-extrabold">
                  Retrieval confidence
                </span>
                <strong className="mt-3 block text-[21px] leading-none">
                  Not enough evidence
                </strong>
                <p className="mt-3 text-sm">
                  Try adding the constraint or a sample input.
                </p>
              </div>
            }
            tone="bg-black text-white"
          />
          <FeaturePanel
            title="Practice has a next page"
            copy="Recommendations follow the patterns where you need more reps."
            body={
              <div className={`${ink} bg-white p-4`} data-ui>
                <span className="text-[13px] font-extrabold">
                  Recommended next
                </span>
                <strong className="mt-3 block text-[21px] leading-none">
                  Minimum Window Substring
                </strong>
                <p className="mt-3 text-sm">Pattern match · Medium</p>
              </div>
            }
            tone="bg-[#ffed00]"
          />
        </div>
      </section>
      <section
        className={`${ink} mx-auto w-[calc(100%-16px)] max-w-[1440px] bg-black p-[clamp(72px,10vw,140px)_clamp(16px,4vw,58px)] text-white ${shadow} sm:w-[calc(100%-32px)]`}
        id="how-it-works"
        aria-labelledby="how-title"
      >
        <div className="mb-14 grid items-end gap-6 md:grid-cols-[1.1fr_.9fr] md:gap-14">
          <h2
            id="how-title"
            className="m-0 max-w-[12ch] text-[clamp(2.8rem,6vw,6.5rem)] font-extrabold leading-[.88] tracking-[-.07em]"
          >
            From stuck to solved
          </h2>
          <p className="m-0 max-w-[34ch] text-[19px] font-bold leading-snug">
            The loop is deliberately small: find the shape, take a hint, try the
            code, learn from the result.
          </p>
        </div>
        <div className="grid gap-1 md:grid-cols-2 lg:grid-cols-4" data-ui>
          <div className="min-h-40 bg-[#ffed00] p-6 text-black">
            <strong className="text-3xl">Find</strong>
            <p>Search the problem by meaning and words.</p>
          </div>
          <div className="min-h-40 bg-[#fff5d6] p-6 text-black">
            <strong className="text-3xl">Think</strong>
            <p>Climb the hint ladder without skipping the work.</p>
          </div>
          <div className="min-h-40 bg-[#d4bdff] p-6 text-black">
            <strong className="text-3xl">Try</strong>
            <p>Write the approach in your own editor.</p>
          </div>
          <div className="min-h-40 bg-[#ff4332] p-6 text-black">
            <strong className="text-3xl">Verify</strong>
            <p>Run it on cases before you trust it.</p>
          </div>
        </div>
      </section>
      <section
        className="mx-auto grid w-[calc(100%-16px)] max-w-[1440px] grid-cols-2 gap-2 py-[clamp(72px,10vw,140px)] sm:w-[calc(100%-32px)] md:grid-cols-[2fr_1fr_1fr]"
        id="verify"
        aria-labelledby="proof-title"
      >
        <div
          className={`${ink} col-span-2 flex min-h-72 flex-col justify-between bg-[#ffed00] p-4 sm:p-6 ${smallShadow} md:col-span-1 md:row-span-2`}
        >
          <h2
            id="proof-title"
            className="max-w-[8ch] text-[clamp(2.8rem,5vw,5.7rem)] font-extrabold leading-[.86] tracking-[-.07em]"
          >
            Built around the hard parts
          </h2>
          <p className="max-w-[31ch] font-bold">
            Good DSA practice has friction. The product should make that
            friction legible, not hide it.
          </p>
        </div>
        {[
          ["Grounded", "answers tied to source chunks"],
          ["Progressive", "help that waits for your next ask"],
          ["Verified", "Python checked against test cases"],
          ["Personal", "practice shaped by weak patterns"],
          ["Measured", "retrieval, latency, cost, and quality"],
        ].map(([title, copy]) => (
          <div
            className={`${ink} flex min-h-40 flex-col justify-between bg-white p-4 sm:min-h-48 sm:p-6 ${smallShadow}`}
            key={title}
          >
            <strong className="text-[clamp(1.7rem,2.8vw,2.8rem)] leading-none tracking-[-.05em]">
              {title}
            </strong>
            <span className="max-w-[18ch] font-bold">{copy}</span>
          </div>
        ))}
      </section>
      <section
        className="mx-auto grid w-[calc(100%-16px)] max-w-[1440px] grid-cols-2 gap-2 pb-2 sm:w-[calc(100%-32px)] md:grid-cols-[1fr_minmax(0,2.6fr)_1fr]"
        aria-labelledby="cta-title"
      >
        <div
          className={`${ink} min-h-[120px] bg-[#d4bdff] ${shadow} md:min-h-80`}
          aria-hidden="true"
        />
        <div
          className={`${ink} col-span-2 flex min-h-[330px] flex-col items-start justify-center gap-6 bg-[#ff4332] p-[clamp(24px,5vw,64px)] ${shadow} md:col-span-1 md:min-h-80`}
        >
          <h2
            id="cta-title"
            className="max-w-[9ch] text-[clamp(2.8rem,5vw,5.8rem)] font-extrabold leading-[.86] tracking-[-.07em]"
          >
            Start with the problem you have
          </h2>
          <p className="m-0 max-w-[37ch] font-bold">
            Bring the question you cannot quite name. DSA Forge will help you
            find the next useful move.
          </p>
          <Link className={`${button} bg-black text-white`} href="/sign-in">
            Start solving <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div
          className={`${ink} grid min-h-[120px] place-items-center bg-white ${shadow} md:min-h-80`}
          aria-hidden="true"
        >
          <span className="text-[12rem] font-extrabold leading-none tracking-[-.12em]">
            ?
          </span>
        </div>
      </section>
      <footer className="mx-auto w-[calc(100%-16px)] max-w-[1440px] px-0 pb-6 pt-2 sm:w-[calc(100%-32px)]">
        <div className="min-h-[clamp(170px,24vw,330px)] text-[clamp(4rem,19vw,15rem)] font-extrabold leading-[.75] tracking-[-.1em]">
          FORGE
        </div>
        <div className="grid grid-cols-2 gap-6 pb-6 pt-[42px] font-extrabold md:grid-cols-3">
          <div className="grid gap-2">
            <a href="#search">Search</a>
            <a href="#hints">Hints</a>
          </div>
          <div className="grid gap-2">
            <a href="#verify">Verification</a>
            <a href="#practice">Practice</a>
          </div>
          <div className="grid gap-2">
            <Link href="/sign-in">Sign in</Link>
            <Link href="/dashboard">Dashboard</Link>
          </div>
        </div>
        <div className="flex flex-col gap-4 border-t-[3px] border-black pt-5 text-sm font-bold md:flex-row md:justify-between">
          <span>© 2026 DSA Forge</span>
          <span>Built for better attempts.</span>
        </div>
      </footer>
    </main>
  );
}
