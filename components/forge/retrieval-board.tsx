"use client";

import { useState } from "react";
import type { DisplayResult } from "./types";

export function RetrievalBoard({ items }: { items: DisplayResult[] }) {
  const [active, setActive] = useState(1);
  const selectedIndex = Math.min(active, Math.max(items.length - 1, 0));
  const result = items[selectedIndex];
  return (
    <div className="border-4 border-black bg-black text-white" data-ui>
      <div className="flex justify-between px-5 py-3 text-sm font-extrabold">
        <span>Matches from your words</span>
        <span>{items.length} found</span>
      </div>
      <div className="grid gap-1">
        {items.map((item, index) => (
          <button
            className={`grid min-h-[64px] grid-cols-[1fr_auto] items-center gap-2 px-3.5 py-3.5 text-left font-sans sm:min-h-[74px] sm:grid-cols-[1fr_180px_120px] sm:gap-4 sm:px-5 sm:py-4 ${selectedIndex === index ? "bg-[#ffed00] text-black" : "bg-[#252525] text-white hover:bg-[#3b3b3b]"}`}
            key={item.title}
            onClick={() => setActive(index)}
            type="button"
          >
            <span className="text-[clamp(1.05rem,2vw,1.5rem)] font-extrabold leading-tight">
              {item.title}
            </span>
            <span className="hidden text-sm font-bold sm:block">
              {item.pattern}
            </span>
            <span className="bg-[#ff4332] px-2 py-1 text-sm font-bold text-black sm:justify-self-end">
              {item.difficulty}
            </span>
          </button>
        ))}
      </div>
      <div className="grid gap-6 bg-[#ff4332] p-5 text-black md:grid-cols-[.7fr_1.3fr]">
        <div>
          <span className="text-[13px] font-extrabold">Why it matches</span>
          <strong className="mt-1 block text-2xl">
            {result?.whyMatched ?? result?.pattern}
          </strong>
        </div>
        <p className="m-0 max-w-[56ch] font-bold">
          {result?.detail ?? "No results yet."}
        </p>
      </div>
    </div>
  );
}
