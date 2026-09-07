import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { foods } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

// Fetch a single food by id — needed to re-hydrate a "Recently logged" chip
// that's already linked to a real catalog food (search results already carry
// their own data client-side; a recent-chip re-log only has the entry's
// snapshot + a foodId, not the food's own servingSize/baseUnit for the Amount
// field). Same public-vs-custom visibility rule as /api/foods/search: a
// custom food is only visible to its own owner, everything else is public.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  const [food] = await db.select().from(foods).where(eq(foods.id, id));
  if (!food || (food.source === "custom" && food.userId !== session?.sub)) {
    return NextResponse.json({ error: "Food not found" }, { status: 404 });
  }

  return NextResponse.json({
    food: {
      id: food.id,
      name: food.name,
      brand: food.brand,
      source: food.source,
      baseUnit: food.baseUnit,
      caloriesPer100: food.caloriesPer100,
      proteinPer100: food.proteinPer100,
      carbsPer100: food.carbsPer100,
      fatPer100: food.fatPer100,
      servingSize: food.servingSize,
      servingUnit: food.servingUnit,
      servingLabel: food.servingLabel,
    },
  });
}
