import { NextResponse } from "next/server";
import { db } from "@/db";
import { foods } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { customFoodSchema } from "@/lib/food-sources/validation";

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

  const { name, brand, servingSize, servingUnit, servingLabel, calories, protein, carbs, fat } = parsed.data;
  const factor = 100 / servingSize;

  const [food] = await db
    .insert(foods)
    .values({
      source: "custom",
      externalId: null,
      name,
      brand: brand || null,
      baseUnit: servingUnit,
      caloriesPer100: calories * factor,
      proteinPer100: protein * factor,
      carbsPer100: carbs * factor,
      fatPer100: fat * factor,
      servingSize,
      servingUnit,
      servingLabel: servingLabel || null,
      userId: session.sub,
    })
    .returning();

  return NextResponse.json({ food }, { status: 201 });
}
