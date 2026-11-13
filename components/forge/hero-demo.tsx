"use client";

import Link from "next/link";
import { useState } from "react";

const hints = [
  {
    label: "Pattern",
    copy: "This is a hash-map problem. Keep the values you have already seen and check for the complement before you store the next one.",
  },
  {
    label: "Approach",
    copy: "One pass. For each number, ask whether target − number is already in the map. If it is, you have both indexes.",
  },
  {
    label: "Edge case",
    copy: "A number cannot pair with itself, so check for the complement before adding the current index to the map.",
  },
  {
    label: "Your turn",
    copy: "That is enough to write the loop. Open Two Sum and try it in the practice editor.",
  },
];

export function HeroDemo() {
  const [level, setLevel] = useState(0);
  const atEnd = level === hints.length - 1;
  const hint = hints[level];

  return (
    <div
      className="grid h-full gap-2 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-[auto_1fr]"
    >
      <div
        className="hero-rise hero-delay-2 flex flex-col bg-black p-5 text-white"
        data-ui
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-extrabold text-[#ffed00]">
            Problem search
          </span>
          <span className="border-2 border-white px-2 py-0.5 text-[13px] font-extrabold">
            Matched
          </span>
        </div>
        <p className="mt-5 text-[13px] font-bold text-[#d4bdff]">
          You described
        </p>
        <p className="mt-1 text-[17px] font-bold leading-snug">
          “two numbers in an array that add to a target”
        </p>
        <div className="mt-5 bg-white p-4 text-black">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-extrabold">Best match</span>
            <span className="border-2 border-black bg-[#ffed00] px-2 py-0.5 text-[13px] font-extrabold">
              Easy
            </span>
          </div>
          <Link
            className="mt-2 block w-fit text-[28px] font-extrabold leading-none tracking-[-.05em] underline decoration-2 underline-offset-4 hover:bg-[#ffed00]"
            href="/problems/two-sum"
          >
            Two Sum
          </Link>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="border-2 border-black bg-[#d4bdff] px-2 py-1 text-[13px] font-extrabold">
              hash map
            </span>
            <span className="border-2 border-black bg-[#fff5d6] px-2 py-1 text-[13px] font-extrabold">
              array
            </span>
          </div>
        </div>
        <Link
          className="mt-auto w-fit pt-5 text-sm font-extrabold underline decoration-2 underline-offset-4 hover:text-[#ffed00]"
          href="/problems/two-sum"
        >
          Open the problem <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div
        className="hero-rise hero-delay-3 flex flex-col bg-white p-5 text-black"
        data-ui
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-extrabold">Hint ladder</span>
          <span className="text-[13px] font-extrabold tabular-nums">
            {level + 1} / {hints.length}
          </span>
        </div>
        <div className="mt-4 flex gap-1.5" aria-hidden="true">
          {hints.map((item, index) => (
            <span
              className={`h-3 flex-1 border-2 border-black ${
                index <= level ? "bg-[#ff4332]" : "bg-[#d4bdff]"
              }`}
              key={item.label}
            />
          ))}
        </div>
        <div
          className="mt-5 min-h-[112px] flex-1"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="hint-enter" key={level}>
            <strong className="block text-[13px] font-extrabold">
              {hint.label}
            </strong>
            <span className="mt-1 block max-w-[34ch] text-[15px] leading-relaxed">
              {hint.copy}
            </span>
          </p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          {atEnd ? (
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 border-4 border-black bg-black px-4 py-2 text-sm font-extrabold text-white transition-transform hover:translate-x-1 hover:translate-y-1 focus-visible:outline-4 focus-visible:outline-[#ff4332] focus-visible:outline-offset-4"
              href="/problems/two-sum"
            >
              Open Two Sum <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 border-4 border-black bg-[#ff4332] px-4 py-2 text-sm font-extrabold text-black transition-transform hover:translate-x-1 hover:translate-y-1 focus-visible:outline-4 focus-visible:outline-[#ff4332] focus-visible:outline-offset-4 active:translate-x-2 active:translate-y-2"
              onClick={() => setLevel((current) => current + 1)}
              type="button"
            >
              Reveal next hint <span aria-hidden="true">→</span>
            </button>
          )}
          {level > 0 ? (
            <button
              className="text-sm font-extrabold underline decoration-2 underline-offset-4"
              onClick={() => setLevel(0)}
              type="button"
            >
              Start over
            </button>
          ) : null}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 bg-black px-4 py-3 text-white">
          <span className="text-[13px] font-extrabold">
            Python · sample + edge cases
          </span>
          <span className="border-2 border-black bg-[#ffed00] px-2 py-0.5 text-[13px] font-extrabold text-black">
            Verified
          </span>
        </div>
      </div>
    </div>
  );
}