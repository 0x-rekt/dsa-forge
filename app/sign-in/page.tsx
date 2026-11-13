import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/forge/sign-in-form";
import { auth } from "@/lib/auth";

export const instant = false;

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session?.user) {
    redirect("/dashboard");
  }

  return <SignInForm />;
}
