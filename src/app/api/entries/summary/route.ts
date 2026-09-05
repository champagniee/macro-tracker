import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { foodEntries, macroGoals } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { DEFAULT_GOALS } from "@/lib/mock-data";
import { dayRangeUtc, todayUtcString } from "@/lib/entries/date-range";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in to view history" }, { status: 401 });
  }

  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get("days")) || 7, 1), 31);

  const todayRange = dayRangeUtc(todayUtcString())!;
  const rangeStart = new Date(todayRange.end.getTime() - days * 24 * 60 * 60 * 1000);

  const [entries, goalRow] = await Promise.all([
    db
      .select()
      .from(foodEntries)
      .where(and(eq(foodEntries.userId, session.sub), gte(foodEntries.loggedAt, rangeStart))),
    db.query.macroGoals.findFirst({ where: eq(macroGoals.userId, session.sub) }),
  ]);

  const goal = goalRow ?? DEFAULT_GOALS;

  const totalsByDate = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
  for (const entry of entries) {
    const dateKey = entry.loggedAt.toISOString().slice(0, 10);
    const current = totalsByDate.get(dateKey) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    current.calories += entry.calories;
    current.protein += entry.protein;
    current.carbs += entry.carbs;
    current.fat += entry.fat;
    totalsByDate.set(dateKey, current);
  }

  const history = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(todayRange.start.getTime() - i * 24 * 60 * 60 * 1000);
    const dateKey = d.toISOString().slice(0, 10);
    const totals = totalsByDate.get(dateKey) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    history.push({
      date: dateKey,
      label: d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
      goal: goal.calories,
      ...totals,
    });
  }

  return NextResponse.json({ history });
}
