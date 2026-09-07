import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { customFoodSchema } from "@/lib/food-sources/validation";
import { createCustomFood } from "@/lib/food-sources/create-custom-food";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in to save a custom food" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = customFoodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const food = await createCustomFood(session.sub, parsed.data);
  return NextResponse.json({ food }, { status: 201 });
}
