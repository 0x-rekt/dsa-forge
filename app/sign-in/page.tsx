"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "@/lib/auth-client";

export default function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<"google" | "github" | null>(null);

  async function handleSignIn(nextProvider: "google" | "github") {
    setError(null);
    setProvider(nextProvider);

    try {
      const result = await signIn.social({
        provider: nextProvider,
        callbackURL: "/dashboard",
      });

      if (result.error) {
        setError(result.error.message ?? "Unable to sign in.");
      }
    } catch {
      setError("The sign-in service is unavailable. Try again in a moment.");
    } finally {
      setProvider(null);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-frame">
        <section className="auth-story" aria-labelledby="auth-title">
          <Link className="auth-brand" href="/" aria-label="Back to DSA Forge home">
            <span className="auth-brand__mark" aria-hidden="true">+</span>
            <span>DSA Forge</span>
          </Link>

          <div className="auth-story__copy">
            <h1 id="auth-title">Keep the thinking.</h1>
            <p>Sign in to search problems, climb the hint ladder, and keep a record of the patterns you are learning.</p>
          </div>

          <div className="auth-loop" aria-label="The DSA Forge learning loop">
            <div className="auth-loop__item auth-loop__item--yellow"><strong>Find</strong><span>the pattern</span></div>
            <div className="auth-loop__item auth-loop__item--paper"><strong>Think</strong><span>with a hint</span></div>
            <div className="auth-loop__item auth-loop__item--red"><strong>Verify</strong><span>your code</span></div>
          </div>

          <Link className="auth-back" href="/">← Back to home</Link>
        </section>

        <section className="auth-form-panel" aria-labelledby="auth-form-title">
          <div className="auth-form-panel__topline">
            <span>Member access</span>
            <span aria-hidden="true">{"//"}</span>
          </div>

          <div className="auth-form-panel__copy">
            <h2 id="auth-form-title">Sign in to start</h2>
            <p>Use the account you already trust. Your practice stays attached to your profile.</p>
          </div>

          <div className="auth-actions">
            <button
              className="auth-provider auth-provider--google"
              disabled={provider !== null}
              onClick={() => handleSignIn("google")}
              type="button"
            >
              <span className="auth-provider__symbol" aria-hidden="true">G</span>
              <span>{provider === "google" ? "Connecting to Google…" : "Continue with Google"}</span>
              <span aria-hidden="true">→</span>
            </button>
            <button
              className="auth-provider auth-provider--github"
              disabled={provider !== null}
              onClick={() => handleSignIn("github")}
              type="button"
            >
              <span className="auth-provider__symbol" aria-hidden="true">GH</span>
              <span>{provider === "github" ? "Connecting to GitHub…" : "Continue with GitHub"}</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <p className="auth-note">No password to remember. OAuth keeps the account setup short so you can get back to the problem.</p>

          {error ? (
            <p className="auth-error" role="alert">{error}</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
