import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const instant = false;

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <p className="text-sm text-muted-foreground">Authenticated as</p>
      <h1 className="text-3xl font-semibold">{session.user.name}</h1>
      <p className="mt-2 text-muted-foreground">{session.user.email}</p>
    </main>
  );
}
