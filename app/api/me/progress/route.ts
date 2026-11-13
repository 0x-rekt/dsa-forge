import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/progress";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Sign in to view your progress." }, { status: 401 });
  }

  try {
    const dashboard = await getDashboardData(session.user.id);
    return Response.json({
      stats: dashboard.stats,
      weakPatterns: dashboard.weakPatterns,
      recentAttempts: dashboard.recentAttempts,
    });
  } catch (error) {
    console.error("Progress lookup failed", error);
    return Response.json(
      { error: "Progress is temporarily unavailable." },
      { status: 503 },
    );
  }
}
