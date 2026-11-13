import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/progress";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json(
      { error: "Sign in to view recommendations." },
      { status: 401 },
    );
  }

  try {
    const dashboard = await getDashboardData(session.user.id);
    return Response.json({ recommendations: dashboard.recommendations });
  } catch (error) {
    console.error("Recommendation lookup failed", error);
    return Response.json(
      { error: "Recommendations are temporarily unavailable." },
      { status: 503 },
    );
  }
}
