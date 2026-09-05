import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { recipeIngredients, foods } from "@/db/schema";

// Postgres `real` (single-precision float) plus chained arithmetic produces noise
// like 150.00000400000002 — round it away rather than leaking it into API responses.
function round(value: number) {
  return Math.round(value * 100) / 100;
}

export interface RecipeIngredientDetail {
  id: string;
  foodId: string;
  foodName: string;
  foodBrand: string | null;
  amount: number;
  amountLabel: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface RecipeMacros {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  perServingCalories: number;
  perServingProtein: number;
  perServingCarbs: number;
  perServingFat: number;
}

const ingredientSelection = {
  id: recipeIngredients.id,
  recipeId: recipeIngredients.recipeId,
  foodId: recipeIngredients.foodId,
  amount: recipeIngredients.amount,
  amountLabel: recipeIngredients.amountLabel,
  sortOrder: recipeIngredients.sortOrder,
  foodName: foods.name,
  foodBrand: foods.brand,
  caloriesPer100: foods.caloriesPer100,
  proteinPer100: foods.proteinPer100,
  carbsPer100: foods.carbsPer100,
  fatPer100: foods.fatPer100,
};

function toIngredientDetail(row: {
  id: string;
  foodId: string;
  amount: number;
  amountLabel: string | null;
  foodName: string;
  foodBrand: string | null;
  caloriesPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
}): RecipeIngredientDetail {
  const factor = row.amount / 100;
  return {
    id: row.id,
    foodId: row.foodId,
    foodName: row.foodName,
    foodBrand: row.foodBrand,
    amount: row.amount,
    amountLabel: row.amountLabel,
    calories: round(row.caloriesPer100 * factor),
    protein: round(row.proteinPer100 * factor),
    carbs: round(row.carbsPer100 * factor),
    fat: round(row.fatPer100 * factor),
  };
}

export async function getRecipeIngredientDetails(recipeId: string): Promise<RecipeIngredientDetail[]> {
  const rows = await db
    .select(ingredientSelection)
    .from(recipeIngredients)
    .innerJoin(foods, eq(recipeIngredients.foodId, foods.id))
    .where(eq(recipeIngredients.recipeId, recipeId))
    .orderBy(recipeIngredients.sortOrder);

  return rows.map(toIngredientDetail);
}

// Fetches ingredients for many recipes in one query instead of one query per
// recipe — Neon's HTTP driver has no connection pooling, so each query pays a
// real per-request round trip; N recipes previously meant N+1 round trips for
// a list page alone.
export async function getRecipeIngredientDetailsBatch(
  recipeIds: string[],
): Promise<Map<string, RecipeIngredientDetail[]>> {
  const byRecipe = new Map<string, RecipeIngredientDetail[]>();
  if (recipeIds.length === 0) return byRecipe;

  const rows = await db
    .select(ingredientSelection)
    .from(recipeIngredients)
    .innerJoin(foods, eq(recipeIngredients.foodId, foods.id))
    .where(inArray(recipeIngredients.recipeId, recipeIds))
    .orderBy(recipeIngredients.sortOrder);

  for (const row of rows) {
    const list = byRecipe.get(row.recipeId) ?? [];
    list.push(toIngredientDetail(row));
    byRecipe.set(row.recipeId, list);
  }

  return byRecipe;
}

export function sumRecipeMacros(ingredients: RecipeIngredientDetail[], servings: number): RecipeMacros {
  const totals = ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + ing.calories,
      protein: acc.protein + ing.protein,
      carbs: acc.carbs + ing.carbs,
      fat: acc.fat + ing.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return {
    totalCalories: round(totals.calories),
    totalProtein: round(totals.protein),
    totalCarbs: round(totals.carbs),
    totalFat: round(totals.fat),
    perServingCalories: round(totals.calories / servings),
    perServingProtein: round(totals.protein / servings),
    perServingCarbs: round(totals.carbs / servings),
    perServingFat: round(totals.fat / servings),
  };
}
