import Link from "next/link";
import { UserNavigation } from "./user-navigation";

export function LandingNav() {
  return (
    <nav
      className="mx-auto grid min-h-[72px] w-[calc(100%-16px)] max-w-[1440px] grid-cols-[52px_1fr_auto] items-stretch gap-2 pt-2 sm:w-[calc(100%-32px)]"
      aria-label="Primary navigation"
    >
      <Link
        className="grid place-items-center bg-black p-3 font-extrabold text-white no-underline"
        href="/"
        aria-label="DSA Forge home"
      >
        <span className="text-[27px] leading-none">+</span>
        <span className="sr-only">DSA Forge</span>
      </Link>
      <div className="hidden items-center justify-end gap-[clamp(18px,3vw,48px)] px-6 font-bold md:flex">
        <a href="#search">Search</a>
        <a href="#hints">Hints</a>
        <a href="#verify">Verify</a>
        <a href="#practice">Practice</a>
      </div>
      <UserNavigation />
    </nav>
  );
}
