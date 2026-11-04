"use client";

import Link from "next/link";
import { useState } from "react";
import { TutorPanel } from "@/components/forge/tutor-panel";

type ProblemTutorProps = {
  slug: string;
  title: string;
};

export function ProblemTutor({ slug, title }: ProblemTutorProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="inline-flex min-h-11 items-center justify-center border-4 border-black bg-black px-4 font-extrabold text-white transition-transform hover:translate-x-1 hover:translate-y-1 focus-visible:outline-4 focus-visible:outline-[#ff4332] focus-visible:outline-offset-4"
        onClick={() => setOpen(true)}
        type="button"
      >
        Ask for help →
      </button>
      <TutorPanel
        onOpenChange={setOpen}
        open={open}
        showLauncher={false}
        slug={slug}
        title={title}
      />
    </>
  );
}

export function StartPracticingLink() {
  return (
    <Link
      className="inline-flex min-h-11 items-center justify-center border-2 border-black bg-white px-4 font-extrabold transition-transform hover:translate-x-1 hover:translate-y-1 focus-visible:outline-4 focus-visible:outline-[#ff4332] focus-visible:outline-offset-4"
      href="/dashboard"
    >
      Start practicing
    </Link>
  );
}
