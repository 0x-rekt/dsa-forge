import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rebuildPatternStats } from "@/lib/progress";

// The PRD promises that users can delete their attempts. Deleting by
// id + userId means another user's attempt is indistinguishable from a
// missing one.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json(
      { error: "Sign in to delete an attempt." },
      { status: 401 },
    );
  }

  const { id } = await params;
  if (!id.trim()) {
    return Response.json(
      { error: "Attempt id is required." },
      { status: 400 },
    );
  }

  try {
    const attempt = await prisma.attempt.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });

    if (!attempt) {
      return Response.json({ error: "Attempt not found." }, { status: 404 });
    }

    await prisma.attempt.delete({ where: { id: attempt.id } });
    await rebuildPatternStats(session.user.id);

    return Response.json({ deleted: true, attemptId: attempt.id });
  } catch (error) {
    console.error("Attempt deletion failed", error);
    return Response.json(
      { error: "Attempt deletion is temporarily unavailable." },
      { status: 503 },
    );
  }
}