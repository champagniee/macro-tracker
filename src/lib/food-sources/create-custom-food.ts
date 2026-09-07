import { z } from "zod";
import { db } from "@/db";
import { foods } from "@/db/schema";
import type { customFoodSchema } from "./validation";

// Extracted out of POST /api/foods/custom so the recipe-estimate route can
// create a custom food per LLM-decomposed ingredient without duplicating the
// per-serving-to-per-100 conversion — same pattern as search-foods.ts.
type CustomFoodInput = z.infer<typeof customFoodSchema>;

export async function createCustomFood(userId: string, input: CustomFoodInput) {
  const { name, brand, servingSize, servingUnit, servingLabel, category, calories, protein, carbs, fat } = input;
  const factor = 100 / servingSize;

  const [food] = await db
    .insert(foods)
    .values({
      source: "custom",
      externalId: null,
      name,
      brand: brand || null,
      baseUnit: servingUnit,
      category: category ?? null,
      caloriesPer100: calories * factor,
      proteinPer100: protein * factor,
      carbsPer100: carbs * factor,
      fatPer100: fat * factor,
      servingSize,
      servingUnit,
      servingLabel: servingLabel || null,
      userId,
    })
    .returning();

  return food;
}
