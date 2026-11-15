"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { NAV_LINKS } from "./nav-links";

// The nav is the one piece of chrome on every page, so it uses the same focus
// treatment as the rest of the forge: a thick red ring, never a thin outline.
const focusRing =
  "focus-visible:outline-4 focus-visible:outline-[#ff4332] focus-visible:outline-offset-4";

const linkClass = `inline-flex min-h-11 items-center px-3 font-extrabold hover:bg-black hover:text-[#ffed00] ${focusRing}`;

// Flat plates, as everywhere else: 4px black border, solid fill, and a press
// that moves the whole plate rather than fading it.
const plateClass = `inline-flex min-h-12 items-center justify-center gap-2 border-4 border-black bg-black px-5 font-extrabold text-white transition-transform duration-0 hover:translate-x-1 hover:translate-y-1 active:translate-x-2 active:translate-y-2 ${focusRing}`;

// The phone sheet is a real overlay, the one thing in the nav that may float.
const sheetClass = "relative z-20 mt-2 border-4 border-black bg-white shadow-[8px_8px_0_#000] md:hidden"; // taste-skill-ignore: the phone menu is a real overlay

export function LandingNav() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Escape closes the sheet and returns focus to the control that opened it.
  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  // A route change from inside the sheet should not leave it hanging open.
  function closeMenu() {
    setMenuOpen(false);
  }

  async function handleSignOut() {
    setMenuOpen(false);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  const initials =
    user?.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "U";

  return (
    <header className="mx-auto w-[calc(100%-32px)] max-w-[1440px] pt-2 sm:pt-3">
      <nav
        className="flex min-h-[56px] items-center gap-2 sm:min-h-[64px]"
        aria-label="Primary navigation"
      >
        <Link
          className={`group flex shrink-0 items-center gap-2.5 font-extrabold no-underline ${focusRing}`}
          href="/"
          aria-label="DSA Forge home"
        >
          <span
            className="grid h-11 w-11 place-items-center bg-black text-[26px] leading-none text-white transition-colors duration-150 group-hover:bg-[#ffed00] group-hover:text-black"
            aria-hidden="true"
          >
            +
          </span>
          <span className="hidden text-[19px] leading-none tracking-[-.03em] min-[360px]:inline">
            DSA Forge
          </span>
        </Link>

        <div className="ml-auto hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link className={linkClass} key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop account: one plate for the dashboard, one quiet text action. */}
        <div className="ml-4 hidden items-center gap-2 md:flex">
          {isPending ? (
            <span
              className="h-12 w-28 border-4 border-black bg-[#d4bdff]"
              role="status"
              aria-label="Checking sign-in status"
            />
          ) : user ? (
            <>
              <Link
                className={`flex min-h-12 items-center gap-2 border-4 border-black bg-white py-1 pl-1 pr-3 font-extrabold hover:bg-[#ffed00] ${focusRing}`}
                href="/dashboard"
                aria-label={`Open dashboard for ${user.name}`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden border-2 border-black bg-[#d4bdff] text-xs">
                  {user.image ? (
                    <Image
                      src={user.image}
                      alt=""
                      width={32}
                      height={32}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span aria-hidden="true">{initials}</span>
                  )}
                </span>
                <span className="max-w-[14ch] truncate text-[15px]">
                  {user.name}
                </span>
              </Link>
              <button
                className={`inline-flex min-h-11 items-center px-2 text-[15px] font-extrabold hover:bg-black hover:text-[#ffed00] ${focusRing}`}
                type="button"
                onClick={handleSignOut}
              >
                Log out
              </button>
            </>
          ) : (
            <Link className={plateClass} href="/sign-in">
              Sign in <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>

        {/* Phone: the links fold into the sheet; the action stays in the row. */}
        <div className="ml-auto flex items-center gap-2 md:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            className={`inline-flex min-h-11 items-center border-4 border-black bg-white px-3 text-[15px] font-extrabold hover:bg-[#ffed00] ${focusRing}`}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
          {isPending ? (
            <span
              className="h-11 w-11 border-4 border-black bg-[#d4bdff]"
              role="status"
              aria-label="Checking sign-in status"
            />
          ) : user ? (
            <Link
              className={`grid h-11 w-11 shrink-0 place-items-center overflow-hidden border-4 border-black bg-white ${focusRing}`}
              href="/dashboard"
              aria-label={`Open dashboard for ${user.name}`}
            >
              {user.image ? (
                <Image
                  src={user.image}
                  alt=""
                  width={44}
                  height={44}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-xs font-extrabold" aria-hidden="true">
                  {initials}
                </span>
              )}
            </Link>
          ) : (
            <Link
              className={`inline-flex min-h-11 items-center border-4 border-black bg-black px-3 text-[15px] font-extrabold text-white ${focusRing}`}
              href="/sign-in"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>

      {menuOpen ? (
        <div
          id="mobile-navigation"
          className={sheetClass}
        >
          <nav
            className="grid [&>*]:border-b-2 [&>*]:border-black [&>*:last-child]:border-b-0"
            aria-label="Mobile navigation"
          >
            {NAV_LINKS.map((link) => (
              <Link
                className={`flex min-h-14 items-center px-5 text-lg font-extrabold hover:bg-[#ffed00] ${focusRing}`}
                key={link.href}
                href={link.href}
                onClick={closeMenu}
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  className={`flex min-h-14 items-center px-5 text-lg font-extrabold hover:bg-[#ffed00] ${focusRing}`}
                  href="/dashboard"
                  onClick={closeMenu}
                >
                  Dashboard
                </Link>
                <button
                  className={`flex min-h-14 items-center px-5 text-left text-lg font-extrabold hover:bg-black hover:text-[#ffed00] ${focusRing}`}
                  type="button"
                  onClick={handleSignOut}
                >
                  Log out
                </button>
              </>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
