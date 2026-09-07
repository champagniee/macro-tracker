import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { recipes, users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { getRecipeIngredientDetails, sumRecipeMacros } from "@/lib/recipes/macros";
import { updateRecipeVisibilitySchema } from "@/lib/recipes/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in to view recipes" }, { status: 401 });
  }

  const { id } = await params;

  // Fetched by id alone (not AND'd with ownership) since a public recipe must
  // be viewable by non-owners too — the visibility check happens after, so a
  // private recipe belonging to someone else still 404s instead of leaking
  // that it exists.
  const row = await db
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
    .where(eq(recipes.id, id))
    .then((rows) => rows[0]);

  if (!row || (row.userId !== session.sub && !row.isPublic)) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  const ingredients = await getRecipeIngredientDetails(row.id);
  const macros = sumRecipeMacros(ingredients, row.servings);

  return NextResponse.json({
    recipe: { ...row, isOwner: row.userId === session.sub, ingredients, macros },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in to update a recipe" }, { status: 401 });
  }

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateRecipeVisibilitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const existing = await db.query.recipes.findFirst({ where: eq(recipes.id, id) });
  if (!existing) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }
  if (existing.userId !== session.sub) {
    return NextResponse.json({ error: "You can only change visibility on your own recipes" }, { status: 403 });
  }

  const [updated] = await db
    .update(recipes)
    .set({ isPublic: parsed.data.isPublic, updatedAt: new Date() })
    .where(eq(recipes.id, id))
    .returning({ id: recipes.id, isPublic: recipes.isPublic });

  return NextResponse.json({ recipe: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in to delete recipes" }, { status: 401 });
  }

  const { id } = await params;

  // Owner-only regardless of visibility — a public recipe can be viewed and
  // quick-logged by anyone, but only its creator can delete it.
  const deleted = await db
    .delete(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, session.sub)))
    .returning({ id: recipes.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
