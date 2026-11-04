"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

type Citation = {
  id: string;
  label: string;
  title: string;
  slug: string;
  section: string;
  excerpt: string;
  content: string;
};

type HintRecord = {
  answer: string;
  citations: Citation[];
};

type TutorPanelProps = {
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  showLauncher?: boolean;
  slug: string;
  title: string;
};

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code className="bg-[#eeeae5] px-1 py-0.5 text-[0.9em]" key={index}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(
      <ul className="my-3 list-disc space-y-2 pl-5" key={`list-${blocks.length}`}>
        {listItems.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }
    const listMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (listMatch) {
      listItems.push(listMatch[1]);
      return;
    }
    flushList();
    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      blocks.push(
        <h4 className="mt-4 font-extrabold first:mt-0" key={`heading-${index}`}>
          {renderInline(headingMatch[1])}
        </h4>,
      );
      return;
    }
    blocks.push(
      <p className="my-3 first:mt-0 last:mb-0" key={`paragraph-${index}`}>
        {renderInline(trimmed)}
      </p>,
    );
  });
  flushList();

  return <div>{blocks}</div>;
}

function parseEvent(block: string) {
  const event = block.match(/^event:\s*(.+)$/m)?.[1]?.trim() ?? "message";
  const data = block.match(/^data:\s*(.+)$/m)?.[1];
  if (!data) return null;

  try {
    return { event, data: JSON.parse(data) as Record<string, unknown> };
  } catch {
    return null;
  }
}

export function TutorPanel({
  onOpenChange,
  open: controlledOpen,
  showLauncher = true,
  slug,
  title,
}: TutorPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (nextOpen: boolean) => {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  const [question, setQuestion] = useState("");
  const [tutorAnswer, setTutorAnswer] = useState("");
  const [tutorCitations, setTutorCitations] = useState<Citation[]>([]);
  const [hintAnswer, setHintAnswer] = useState("");
  const [hintCitations, setHintCitations] = useState<Citation[]>([]);
  const [hintHistory, setHintHistory] = useState<Record<number, HintRecord>>(
    {},
  );
  const [hintLevel, setHintLevel] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [error, setError] = useState("");
  const [authRequired, setAuthRequired] = useState(false);

  async function askTutor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || loading) return;

    setLoading(true);
    setError("");
    setAuthRequired(false);
    setTutorAnswer("");
    setTutorCitations([]);

    try {
      const response = await fetch("/api/tutor/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, question: trimmedQuestion }),
      });

      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "The tutor could not answer right now.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const result = await reader.read();
        buffer += decoder.decode(result.value, { stream: !result.done });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const parsed = parseEvent(block);
          if (!parsed) continue;
          if (parsed.event === "start") {
            setTutorCitations((parsed.data.citations as Citation[]) ?? []);
          } else if (parsed.event === "token") {
            setTutorAnswer((current) => `${current}${String(parsed.data.text ?? "")}`);
          } else if (parsed.event === "error") {
            throw new Error(String(parsed.data.error ?? "Tutor stream failed."));
          }
        }

        if (result.done) break;
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tutor request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function getHint(action: "next" | "previous") {
    if (hintLoading) return;
    const targetLevel =
      action === "previous"
        ? Math.max(0, hintLevel - 1)
        : Math.min(4, Math.max(1, hintLevel + 1));

    if (targetLevel > 0 && hintHistory[targetLevel]) {
      setHintLevel(targetLevel);
      setHintAnswer(hintHistory[targetLevel].answer);
      setHintCitations(hintHistory[targetLevel].citations);
      return;
    }

    setHintLoading(true);
    setError("");
    setAuthRequired(false);

    try {
      const response = await fetch("/api/tutor/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          question: question.trim() || `Help me solve ${title}.`,
          action,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | {
            error?: string;
            level?: number;
            hint?: string | null;
            citations?: Citation[];
          }
        | null;

      if (response.status === 401) {
        setAuthRequired(true);
        throw new Error("Sign in to save and advance your hint ladder.");
      }
      if (!response.ok) {
        throw new Error(body?.error ?? "The hint could not be generated.");
      }

      setHintLevel(body?.level ?? 0);
      setHintAnswer(body?.hint ?? "");
      setHintCitations(body?.citations ?? []);
      if (body?.level && body.hint) {
        setHintHistory((current) => ({
          ...current,
          [body.level!]: {
            answer: body.hint!,
            citations: body.citations ?? [],
          },
        }));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Hint request failed.");
    } finally {
      setHintLoading(false);
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      swipeDirection="right"
    >
      {showLauncher ? (
        <section
          id="tutor"
          className="mt-12 border-y-2 border-black bg-[#d4bdff] px-5 py-6 sm:px-7"
          aria-labelledby="tutor-launcher-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <h2 id="tutor-launcher-title" className="text-xl font-extrabold tracking-[-.04em]">
                Need a nudge?
              </h2>
              <p className="mt-2 max-w-[55ch] text-sm font-bold">
                Open the tutor beside the problem and ask without losing your place.
              </p>
            </div>
            <DrawerTrigger render={<Button className="min-h-11" variant="forge" />}>
              Ask the tutor →
            </DrawerTrigger>
          </div>
        </section>
      ) : null}

      <DrawerContent>
        <DrawerHeader className="items-start justify-between gap-5 border-b-2 border-black bg-[#d4bdff] p-5 sm:flex-row sm:p-7">
              <div>
                <DrawerTitle className="text-2xl tracking-[-.04em]">
                  Ask the tutor
                </DrawerTitle>
                <DrawerDescription className="mt-2 max-w-[38ch] font-bold leading-relaxed">
                  Grounded in the indexed material for {title}.
                </DrawerDescription>
              </div>
              <DrawerClose
                render={
                  <Button
                    aria-label="Close tutor"
                    className="min-h-0 px-0 py-0 font-extrabold underline decoration-2 underline-offset-4"
                    variant="link"
                  />
                }
              >
                Close
              </DrawerClose>
        </DrawerHeader>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
              <form className="grid gap-3" onSubmit={askTutor}>
                <label className="font-extrabold" htmlFor="tutor-question">
                  Your question
                </label>
                <textarea
                  className="min-h-28 resize-y border-2 border-black bg-white p-3 text-[15px] leading-relaxed outline-none focus-visible:outline-4 focus-visible:outline-[#ff4332] focus-visible:outline-offset-2"
                  id="tutor-question"
                  maxLength={1000}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Why does the hash map approach work?"
                  value={question}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    className="min-h-11"
                    disabled={loading}
                    type="submit"
                    variant="forge"
                  >
                    {loading ? "Thinking..." : "Ask the tutor →"}
                  </Button>
                  <span className="text-xs font-bold">Streaming response</span>
                </div>
              </form>

              <div className="mt-8 border-t-2 border-black pt-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-extrabold">Progressive hints</h3>
                  <span className="text-sm font-bold">{hintLevel} / 4</span>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-1" aria-label="Hint progress">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      className={`h-2 ${level <= hintLevel ? "bg-black" : "bg-white"}`}
                      key={level}
                    />
                  ))}
                </div>
                <Button
                  className="mt-5 min-h-11 w-full"
                  disabled={hintLoading || hintLevel === 4}
                  onClick={() => getHint("next")}
                  type="button"
                  variant="forge"
                >
                  {hintLoading ? "Generating..." : hintLevel ? "Next hint →" : "Get first hint →"}
                </Button>
              </div>

              {tutorAnswer ? (
                  <div className="mt-8 bg-white p-5" aria-live="polite">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-extrabold">Tutor response</h3>
                    </div>
                    <div className="mt-4 text-[15px] leading-[1.7]">
                      <MarkdownContent content={tutorAnswer} />
                    </div>
                  </div>
                ) : null}

                {tutorCitations.length ? (
                  <div className="mt-6">
                    <h3 className="font-extrabold">Tutor sources</h3>
                    <ul className="mt-2 grid gap-2 text-sm">
                      {tutorCitations.map((citation) => (
                        <li key={citation.id}>
                          <span className="font-bold">
                            [{citation.label}] {citation.section}
                          </span>
                          <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                            {citation.content}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {hintAnswer ? (
                  <div className="mt-8 bg-white p-5" aria-live="polite">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-extrabold">Hint level {hintLevel} of 4</h3>
                      <div className="flex gap-3">
                        <button
                          className="font-extrabold underline decoration-2 underline-offset-4 disabled:opacity-40"
                          disabled={hintLoading || hintLevel === 1}
                          onClick={() => getHint("previous")}
                          type="button"
                        >
                          Previous
                        </button>
                        <button
                          className="font-extrabold underline decoration-2 underline-offset-4 disabled:opacity-40"
                          disabled={hintLoading || hintLevel === 4}
                          onClick={() => getHint("next")}
                          type="button"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 text-[15px] leading-[1.7]">
                      <MarkdownContent content={hintAnswer} />
                    </div>
                  </div>
                ) : null}

                {hintCitations.length ? (
                  <div className="mt-6">
                    <h3 className="font-extrabold">Hint sources</h3>
                    <ul className="mt-2 grid gap-2 text-sm">
                      {hintCitations.map((citation) => (
                        <li key={citation.id}>
                          <span className="font-bold">
                            [{citation.label}] {citation.section}
                          </span>
                          <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                            {citation.content}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

              {error ? (
                <div className="mt-6 border-2 border-[#ff4332] bg-white p-4 text-sm font-bold" role="alert">
                  <p>{error}</p>
                  {authRequired ? (
                    <Link
                      className="mt-2 inline-block underline decoration-2 underline-offset-4"
                      href="/sign-in"
                    >
                      Sign in to continue →
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
      </DrawerContent>
    </Drawer>
  );
}
