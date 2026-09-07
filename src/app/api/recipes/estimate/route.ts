import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { estimateRecipe } from "@/lib/llm/estimate-recipe";
import { createCustomFood } from "@/lib/food-sources/create-custom-food";
import { estimateErrorMessage } from "@/lib/llm/error-message";

const estimateRequestSchema = z.object({
  description: z.string().trim().min(2, "Describe the dish in a bit more detail"),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in to get an estimate" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = estimateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    const estimate = await estimateRecipe(parsed.data.description);

    // Each decomposed ingredient becomes a real custom food (same "custom
    // content is first-class" reasoning as hand-typed foods in the Add Food
    // sheet) — this is what lets the ingredient list reuse the exact same
    // FoodSearchResult-shaped UI/math the recipe sheet already has for
    // search-picked ingredients, instead of a second parallel ingredient shape.
    const ingredients = await Promise.all(
      estimate.ingredients.map(async (ing) => {
        const food = await createCustomFood(session.sub, {
          name: ing.name,
          servingSize: ing.amount,
          servingUnit: ing.unit,
          servingLabel: ing.amountLabel,
          category: ing.category,
          calories: ing.calories,
          protein: ing.protein,
          carbs: ing.carbs,
          fat: ing.fat,
        });
        return {
          food: {
            id: food.id,
            name: food.name,
            brand: food.brand,
            source: food.source,
            baseUnit: food.baseUnit,
            category: food.category,
            caloriesPer100: food.caloriesPer100,
            proteinPer100: food.proteinPer100,
            carbsPer100: food.carbsPer100,
            fatPer100: food.fatPer100,
            servingSize: food.servingSize,
            servingUnit: food.servingUnit,
            servingLabel: food.servingLabel,
          },
          amount: ing.amount,
          amountLabel: ing.amountLabel,
        };
      }),
    );

    return NextResponse.json({ name: estimate.name, servings: estimate.servings, ingredients });
  } catch (err) {
    // Covers a missing GEMINI_API_KEY, the model being rate-limited/overloaded
    // after retries, a malformed response, or an empty ingredient list — none
    // of these should ever 500. Surfaces the real cause (temporary debugging
    // aid) instead of one generic message.
    console.error("estimate_recipe failed:", err);
    return NextResponse.json({ error: estimateErrorMessage(err) }, { status: 502 });
  }
}
