import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { foods } from "@/db/schema";

// Fetch a single food by id — needed to re-hydrate a "Recently logged" chip
// that's already linked to a real catalog food (search results already carry
// their own data client-side; a recent-chip re-log only has the entry's
// snapshot + a foodId, not the food's own servingSize/baseUnit for the Amount
// field), and to reconstruct a recipe's ingredients when editing one. Foods
// are public/shared across all users (same as /api/foods/search) — no
// ownership check here anymore.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [food] = await db.select().from(foods).where(eq(foods.id, id));
  if (!food) {
    return NextResponse.json({ error: "Food not found" }, { status: 404 });
  }

  return NextResponse.json({
    food: {
      id: food.id,
      name: food.name,
      brand: food.brand,
      source: food.source,
      category: food.category,
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
