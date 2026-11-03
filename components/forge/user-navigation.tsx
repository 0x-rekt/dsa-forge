"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function UserNavigation() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession()
  const user = session?.user;
  const initials =
    user?.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "U";
  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }
  if (isPending)
    return (
      <span
        className="h-12 w-24 border-4 border-black bg-[#d4bdff]"
        aria-label="Checking sign-in status"
      />
    );
  if (!user)
    return (
      <Link
        className="inline-flex h-12 items-center justify-center gap-3 border-4 border-black bg-black px-5 font-extrabold text-white transition-transform hover:translate-x-1 hover:translate-y-1 focus-visible:outline-4 focus-visible:outline-[#ff4332] focus-visible:outline-offset-4"
        href="/sign-in"
      >
        Sign in <span aria-hidden="true">→</span>
      </Link>
    );
  return (
    <div className="flex items-stretch gap-2">
      <Link
        className="flex min-w-0 items-center gap-2 border-4 border-black bg-white px-3 py-2 font-extrabold hover:bg-[#ffed00]"
        href="/dashboard"
        aria-label={`Open dashboard for ${user.name}`}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden border-2 border-black bg-[#d4bdff] text-xs">
          {user.image ? (
            <Image
              src={user.image}
              alt={`${user.name} avatar`}
              width={32}
              height={32}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <span aria-hidden="true">{initials}</span>
          )}
        </span>
        <span className="hidden max-w-[15ch] truncate sm:inline">
          {user.name}
        </span>
      </Link>
      <Link
        className="inline-flex min-h-12 items-center border-4 border-black bg-[#ffed00] px-3 font-extrabold text-black transition-transform hover:translate-x-1 hover:translate-y-1 focus-visible:outline-4 focus-visible:outline-[#ff4332] focus-visible:outline-offset-4"
        href="/dashboard"
      >
        Dashboard
      </Link>
      <Button
        variant="forge"
        className="h-auto min-h-0 px-3 py-2 text-sm"
        onClick={handleSignOut}
      >
        Log out
      </Button>
    </div>
  );
}
