import { NextResponse } from "next/server";
import { db } from "@/db";
import { issueReports } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { createIssueReportSchema } from "@/lib/reports/validation";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in to send a report" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createIssueReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const [report] = await db
    .insert(issueReports)
    .values({ userId: session.sub, description: parsed.data.description })
    .returning({ id: issueReports.id, createdAt: issueReports.createdAt });

  return NextResponse.json({ report }, { status: 201 });
}
