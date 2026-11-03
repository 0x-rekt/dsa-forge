"use client";

import Link from "next/link";
import { useState } from "react";
import { ForgeMark } from "@/components/forge/forge-mark";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";

type Provider = "google" | "github";
const panel = "border-4 border-black";
const shadow = "shadow-[8px_8px_0_#000]";

export default function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);

  async function handleSignIn(nextProvider: Provider) {
    setError(null);
    setProvider(nextProvider);
    try {
      const result = await signIn.social({
        provider: nextProvider,
        callbackURL: "/dashboard",
      });
      if (result.error) setError(result.error.message ?? "Unable to sign in.");
    } catch {
      setError("The sign-in service is unavailable. Try again in a moment.");
    } finally {
      setProvider(null);
    }
  }

  const providerClass =
    "grid min-h-[62px] w-full grid-cols-[32px_1fr_24px] items-center gap-3 px-4 py-3 text-left font-extrabold";
  return (
    <main className="grid min-h-screen place-items-center bg-[#fff5d6] px-4 py-6 text-black">
      <div
        className={`${panel} grid w-full max-w-[1080px] ${shadow} lg:grid-cols-[1.05fr_.95fr]`}
      >
        <section
          className="flex min-h-[650px] flex-col justify-between bg-[#ffed00] p-[clamp(28px,5vw,64px)]"
          aria-labelledby="auth-title"
        >
          <ForgeMark />
          <div className="max-w-[510px] py-16">
            <h1
              id="auth-title"
              className="max-w-[8ch] text-[clamp(4rem,8vw,7.5rem)] font-extrabold leading-[.84] tracking-[-.08em]"
            >
              Keep the thinking.
            </h1>
            <p className="mt-8 max-w-[33ch] text-[clamp(1.1rem,1.8vw,1.45rem)] font-bold leading-tight">
              Sign in to search problems, climb the hint ladder, and keep a
              record of the patterns you are learning.
            </p>
          </div>
          <div
            className="grid grid-cols-3 gap-1"
            aria-label="The DSA Forge learning loop"
          >
            <div
              className={`${panel} flex min-h-28 flex-col justify-between p-4`}
            >
              <strong className="text-[clamp(1.5rem,2.8vw,2.5rem)] leading-none tracking-[-.06em]">
                Find
              </strong>
              <span className="text-sm font-extrabold">the pattern</span>
            </div>
            <div
              className={`${panel} flex min-h-28 flex-col justify-between bg-[#fff5d6] p-4`}
            >
              <strong className="text-[clamp(1.5rem,2.8vw,2.5rem)] leading-none tracking-[-.06em]">
                Think
              </strong>
              <span className="text-sm font-extrabold">with a hint</span>
            </div>
            <div
              className={`${panel} flex min-h-28 flex-col justify-between bg-[#ff4332] p-4`}
            >
              <strong className="text-[clamp(1.5rem,2.8vw,2.5rem)] leading-none tracking-[-.06em]">
                Verify
              </strong>
              <span className="text-sm font-extrabold">your code</span>
            </div>
          </div>
          <Link
            className="mt-7 w-fit font-extrabold underline decoration-3 underline-offset-4"
            href="/"
          >
            ← Back to home
          </Link>
        </section>
        <section
          className="flex min-h-[650px] flex-col justify-center bg-white p-[clamp(28px,5vw,64px)]"
          aria-labelledby="auth-form-title"
        >
          <div className="mb-[clamp(56px,9vw,120px)] flex justify-between border-b-[3px] border-black pb-3 text-[13px] font-extrabold">
            <span>Member access</span>
            <span aria-hidden="true">{"//"}</span>
          </div>
          <div>
            <h2
              id="auth-form-title"
              className="max-w-[10ch] text-[clamp(2.8rem,5vw,5.3rem)] font-extrabold leading-[.88] tracking-[-.07em]"
            >
              Sign in to start
            </h2>
            <p className="mt-6 max-w-[31ch] font-bold">
              Use the account you already trust. Your practice stays attached to
              your profile.
            </p>
          </div>
          <div className="mt-10 grid gap-2">
            <Button
              className={`${providerClass} bg-[#ffed00] text-black`}
              variant="forge"
              disabled={provider !== null}
              onClick={() => handleSignIn("google")}
              type="button"
            >
              <span
                className="grid min-h-7 place-items-center bg-black text-white"
                aria-hidden="true"
              >
                G
              </span>
              <span>
                {provider === "google"
                  ? "Connecting to Google…"
                  : "Continue with Google"}
              </span>
              <span aria-hidden="true">→</span>
            </Button>
            <Button
              className={`${providerClass} bg-[#d4bdff] text-black`}
              variant="forge"
              disabled={provider !== null}
              onClick={() => handleSignIn("github")}
              type="button"
            >
              <span
                className="grid min-h-7 place-items-center bg-black text-white"
                aria-hidden="true"
              >
                GH
              </span>
              <span>
                {provider === "github"
                  ? "Connecting to GitHub…"
                  : "Continue with GitHub"}
              </span>
              <span aria-hidden="true">→</span>
            </Button>
          </div>
          <p className="mt-8 max-w-[38ch] text-[13px] font-bold leading-snug">
            No password to remember. OAuth keeps the account setup short so you
            can get back to the problem.
          </p>
          {error ? (
            <p
              className={`${panel} mt-5 bg-[#ff4332] p-3 text-sm font-extrabold`}
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
