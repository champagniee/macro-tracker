import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { recipes, recipeIngredients, foods } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { createRecipeSchema } from "@/lib/recipes/validation";
import { getRecipeIngredientDetails, getRecipeIngredientDetailsBatch, sumRecipeMacros } from "@/lib/recipes/macros";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in to view recipes" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();

  // Match each word independently (AND'd) rather than the whole phrase as one
  // substring, same reasoning as /api/foods/search — word order shouldn't matter,
  // and each word matches on an exact substring OR a pg_trgm fuzzy match so a
  // typo still finds the recipe. Fuzzy check compares word-vs-word (each word of
  // the recipe name individually), not word-vs-whole-name — see the detailed
  // comment in /api/foods/search/route.ts for why: a flat word_similarity()
  // against the whole name produced real false positives for short, repetitive
  // words like "banana".
  const FUZZY_THRESHOLD = 0.4;
  const words = q ? q.split(/\s+/).filter(Boolean) : [];

  function fuzzyWordMatch(column: PgColumn, word: string) {
    return sql`EXISTS (
      SELECT 1 FROM unnest(string_to_array(lower(${column}), ' ')) AS t(w)
      WHERE similarity(lower(${word}), t.w) > ${FUZZY_THRESHOLD}
    )`;
  }

  const nameMatches =
    words.length > 0
      ? and(
          ...words.map((word) => or(ilike(recipes.name, `%${word}%`), fuzzyWordMatch(recipes.name, word))),
        )
      : undefined;

  const rows = await db
    .select()
    .from(recipes)
    .where(nameMatches ? and(eq(recipes.userId, session.sub), nameMatches) : eq(recipes.userId, session.sub));

  // One query for every recipe's ingredients instead of one query per recipe —
  // Neon's HTTP driver has no connection pooling, so each query is a real
  // network round trip; this turns N+1 round trips into 2 for the whole list.
  const ingredientsByRecipe = await getRecipeIngredientDetailsBatch(rows.map((recipe) => recipe.id));

  const withMacros = rows.map((recipe) => {
    const ingredients = ingredientsByRecipe.get(recipe.id) ?? [];
    return {
      ...recipe,
      ingredientCount: ingredients.length,
      macros: sumRecipeMacros(ingredients, recipe.servings),
    };
  });

  return NextResponse.json({ recipes: withMacros });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in to create a recipe" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createRecipeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { name, servings, ingredients } = parsed.data;

  // An ingredient may reference any public USDA/OFF food, but a custom food can
  // only be referenced by its own owner — otherwise one user's private recipe
  // could smuggle another user's private custom food's nutrition into it.
  const foodIds = [...new Set(ingredients.map((i) => i.foodId))];
  const referencedFoods = await db
    .select({ id: foods.id, source: foods.source, userId: foods.userId })
    .from(foods)
    .where(inArray(foods.id, foodIds));

  if (referencedFoods.length !== foodIds.length) {
    return NextResponse.json(
      { error: "One or more ingredients reference a food that doesn't exist" },
      { status: 400 },
    );
  }
  const hasInaccessibleFood = referencedFoods.some(
    (food) => food.source === "custom" && food.userId !== session.sub,
  );
  if (hasInaccessibleFood) {
    return NextResponse.json(
      { error: "One or more ingredients reference a food you don't have access to" },
      { status: 403 },
    );
  }

  // neon-http doesn't support real transactions, so the recipe id is generated
  // up front and the ingredient insert is compensated with a delete on failure
  // rather than relying on a rollback.
  const recipeId = randomUUID();
  await db.insert(recipes).values({ id: recipeId, userId: session.sub, name, servings });

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

  return NextResponse.json(
    { recipe: { id: recipeId, userId: session.sub, name, servings, ingredients: details, macros } },
    { status: 201 },
  );
}
