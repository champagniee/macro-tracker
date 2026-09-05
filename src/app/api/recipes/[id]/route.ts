import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { recipes } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { getRecipeIngredientDetails, sumRecipeMacros } from "@/lib/recipes/macros";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in to view recipes" }, { status: 401 });
  }

  const { id } = await params;

  const recipe = await db.query.recipes.findFirst({
    where: and(eq(recipes.id, id), eq(recipes.userId, session.sub)),
  });
  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  const ingredients = await getRecipeIngredientDetails(recipe.id);
  const macros = sumRecipeMacros(ingredients, recipe.servings);

  return NextResponse.json({ recipe: { ...recipe, ingredients, macros } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in to delete recipes" }, { status: 401 });
  }

  const { id } = await params;

  const deleted = await db
    .delete(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, session.sub)))
    .returning({ id: recipes.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
