import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { updateNameSchema } from "@/lib/auth/validation";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  // `name` isn't in the session JWT (unlike id/email) so an edit in Settings
  // shows up immediately instead of only after the token is re-issued at
  // next login — costs one extra DB read per app load.
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.sub),
    columns: { id: true, email: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateNameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const [user] = await db
    .update(users)
    .set({ name: parsed.data.name, updatedAt: new Date() })
    .where(eq(users.id, session.sub))
    .returning({ id: users.id, email: users.email, name: users.name });

  return NextResponse.json({ user });
}
