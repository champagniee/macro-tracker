import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { recipes, users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { createRecipeSchema } from "@/lib/recipes/validation";
import { getRecipeIngredientDetailsBatch, sumRecipeMacros } from "@/lib/recipes/macros";
import { createRecipe, RecipeIngredientNotFoundError } from "@/lib/recipes/create-recipe";

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

  // Own recipes (any visibility) plus everyone else's public ones — a recipe
  // someone else made private never appears here at all.
  const visibility = or(eq(recipes.userId, session.sub), eq(recipes.isPublic, true));

  const rows = await db
    .select({
      id: recipes.id,
      userId: recipes.userId,
      name: recipes.name,
      servings: recipes.servings,
      isPublic: recipes.isPublic,
      createdAt: recipes.createdAt,
      updatedAt: recipes.updatedAt,
      ownerName: users.name,
    })
    .from(recipes)
    .innerJoin(users, eq(users.id, recipes.userId))
    .where(nameMatches ? and(visibility, nameMatches) : visibility);

  // One query for every recipe's ingredients instead of one query per recipe —
  // Neon's HTTP driver has no connection pooling, so each query is a real
  // network round trip; this turns N+1 round trips into 2 for the whole list.
  const ingredientsByRecipe = await getRecipeIngredientDetailsBatch(rows.map((recipe) => recipe.id));

  const withMacros = rows.map((recipe) => {
    const ingredients = ingredientsByRecipe.get(recipe.id) ?? [];
    return {
      ...recipe,
      isOwner: recipe.userId === session.sub,
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

  try {
    const recipe = await createRecipe(session.sub, parsed.data);
    return NextResponse.json({ recipe }, { status: 201 });
  } catch (err) {
    if (err instanceof RecipeIngredientNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
