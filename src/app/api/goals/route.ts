import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { macroGoals } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { goalsSchema } from "@/lib/entries/validation";
import { DEFAULT_GOALS } from "@/lib/mock-data";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in to view goals" }, { status: 401 });
  }

  const goals = await db.query.macroGoals.findFirst({ where: eq(macroGoals.userId, session.sub) });

  return NextResponse.json({ goals: goals ?? DEFAULT_GOALS });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in to update goals" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = goalsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const [goals] = await db
    .insert(macroGoals)
    .values({ ...parsed.data, userId: session.sub })
    .onConflictDoUpdate({
      target: macroGoals.userId,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();

  return NextResponse.json({ goals });
}
