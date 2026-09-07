import { randomUUID } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { recipes, recipeIngredients, foods } from "@/db/schema";
import { getRecipeIngredientDetails, sumRecipeMacros } from "@/lib/recipes/macros";
import type { z } from "zod";
import type { createRecipeSchema } from "@/lib/recipes/validation";

// Extracted out of POST /api/recipes so the create_recipe MCP tool can share
// the exact same logic (the neon-http transaction workaround) instead of
// reimplementing it — same pattern as search-foods.ts.

export class RecipeIngredientNotFoundError extends Error {
  constructor() {
    super("One or more ingredients reference a food that doesn't exist");
  }
}

type CreateRecipeInput = z.infer<typeof createRecipeSchema>;

export async function createRecipe(userId: string, input: CreateRecipeInput) {
  const { name, servings, ingredients, isPublic } = input;

  // Foods are shared/public across all users (same as search results), so the
  // only thing left to check is that every referenced id actually exists.
  const foodIds = [...new Set(ingredients.map((i) => i.foodId))];
  const referencedFoods = await db
    .select({ id: foods.id })
    .from(foods)
    .where(inArray(foods.id, foodIds));

  if (referencedFoods.length !== foodIds.length) {
    throw new RecipeIngredientNotFoundError();
  }

  // neon-http doesn't support real transactions, so the recipe id is generated
  // up front and the ingredient insert is compensated with a delete on failure
  // rather than relying on a rollback.
  const recipeId = randomUUID();
  await db.insert(recipes).values({ id: recipeId, userId, name, servings, isPublic });

  try {
    await db.insert(recipeIngredients).values(
      ingredients.map((ing, index) => ({
        recipeId,
        foodId: ing.foodId,
        amount: ing.amount,
        amountLabel: ing.amountLabel || null,
        sortOrder: index,
      })),
    );
  } catch (err) {
    await db.delete(recipes).where(eq(recipes.id, recipeId));
    throw err;
  }

  const details = await getRecipeIngredientDetails(recipeId);
  const macros = sumRecipeMacros(details, servings);

  return { id: recipeId, userId, name, servings, isPublic, ingredients: details, macros };
}
