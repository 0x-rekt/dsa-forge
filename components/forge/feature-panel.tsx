import type { ReactNode } from "react";

export function FeaturePanel({
  title,
  copy,
  body,
  tone,
}: {
  title: string;
  copy: string;
  body: ReactNode;
  tone: string;
}) {
  return (
    <article
      className={`flex min-h-[360px] flex-col justify-between gap-6 border-4 border-black p-6 md:min-h-[420px] ${tone}`}
    >
      <div>
        <h3 className="mb-2 text-[25px] font-extrabold leading-none tracking-[-.04em]">
          {title}
        </h3>
        <p className="m-0 max-w-[31ch] font-bold">{copy}</p>
      </div>
      {body}
    </article>
  );
}

export function HintFragment() {
  return (
    <div className="border-4 border-black bg-[#fff5d6] p-4 text-black" data-ui>
      <div className="flex justify-between text-[13px] font-extrabold">
        <span>Hint ladder</span>
        <span>2 / 4</span>
      </div>
      <div className="my-5 flex gap-1">
        {[1, 2, 3, 4].map((step) => (
          <span
            className={`h-3 flex-1 border-2 border-black ${step < 3 ? "bg-[#ff4332]" : "bg-[#d4bdff]"}`}
            key={step}
          />
        ))}
      </div>
      <p className="m-0 text-[15px]">
        Try a window that grows with the right edge and shrinks when a duplicate
        appears.
      </p>
      <button
        className="mt-4 border-[3px] border-black bg-black px-3 py-2 text-sm font-extrabold text-white"
        type="button"
      >
        Ask for the next hint
      </button>
    </div>
  );
}

export function CodeFragment() {
  return (
    <div className="border-4 border-black bg-white p-4 text-black" data-ui>
      <div className="flex justify-between text-[13px] font-extrabold">
        <span>Python solution</span>
        <span className="bg-[#ffed00] px-1">Passed</span>
      </div>
      <pre className="-mx-4 mt-4 overflow-auto border-y-[3px] border-black bg-[#f4f4f4] p-4 text-[13px] leading-snug">{`seen = set()\nfor value in nums:\n    if target - value in seen:\n        return True\n    seen.add(value)`}</pre>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-extrabold">
        <span>Sample 01</span>
        <span>Edge case 04</span>
        <span className="bg-[#ffed00] px-1">All checks passed</span>
      </div>
    </div>
  );
}
