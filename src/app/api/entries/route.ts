import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { foodEntries } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { createEntrySchema } from "@/lib/entries/validation";
import { dayRangeUtc, todayUtcString } from "@/lib/entries/date-range";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in to view entries" }, { status: 401 });
  }

  const dateStr = request.nextUrl.searchParams.get("date") || todayUtcString();
  const range = dayRangeUtc(dateStr);
  if (!range) {
    return NextResponse.json({ error: "Invalid date, expected YYYY-MM-DD" }, { status: 400 });
  }

  const entries = await db
    .select()
    .from(foodEntries)
    .where(
      and(
        eq(foodEntries.userId, session.sub),
        gte(foodEntries.loggedAt, range.start),
        lt(foodEntries.loggedAt, range.end),
      ),
    )
    .orderBy(asc(foodEntries.loggedAt));

  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in to log food" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const [entry] = await db
    .insert(foodEntries)
    .values({ ...parsed.data, userId: session.sub })
    .returning();

  return NextResponse.json({ entry }, { status: 201 });
}
