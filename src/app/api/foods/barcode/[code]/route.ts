import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { foods } from "@/db/schema";
import { getOpenFoodFactsByBarcode } from "@/lib/food-sources/openfoodfacts";
import { upsertFoods } from "@/lib/food-sources/cache";

// Barcode lookup has exactly one possible source — USDA has no barcode index
// at all — so this deliberately ignores DISABLE_EXTERNAL_FOOD_APIS (which
// only ever gated text search): with no other source to fall back to,
// honoring that flag here would just make barcode scanning silently do
// nothing while it's set.
const BARCODE_PATTERN = /^\d{6,14}$/;

// Same shape /api/foods/[id] and /api/foods/search return — a scanned
// product is a genuine catalog row now (cached below), not a one-off.
function toFoodSearchResult(row: typeof foods.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    source: row.source,
    category: row.category,
    baseUnit: row.baseUnit,
    caloriesPer100: row.caloriesPer100,
    proteinPer100: row.proteinPer100,
    carbsPer100: row.carbsPer100,
    fatPer100: row.fatPer100,
    servingSize: row.servingSize,
    servingUnit: row.servingUnit,
    servingLabel: row.servingLabel,
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  if (!BARCODE_PATTERN.test(code)) {
    return NextResponse.json({ error: "Invalid barcode" }, { status: 400 });
  }

  // Cached at scan time, not log time — a barcode is an exact key, so
  // existence in `foods` under this (source, externalId) is the complete
  // signal that OFF has already been asked and doesn't need to be again.
  // Simpler than text search's cache-skip: that needs the separate
  // searched_queries table since a query can legitimately come back with
  // zero matches; a barcode lookup either produced a row or it didn't.
  const [cachedRow] = await db
    .select()
    .from(foods)
    .where(and(eq(foods.source, "openfoodfacts"), eq(foods.externalId, code)))
    .limit(1);

  if (cachedRow) {
    return NextResponse.json({ food: toFoodSearchResult(cachedRow) });
  }

  let normalized;
  try {
    normalized = await getOpenFoodFactsByBarcode(code);
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach Open Food Facts. Try again in a moment." },
      { status: 502 },
    );
  }

  if (!normalized) {
    return NextResponse.json({ error: "No product found for that barcode" }, { status: 404 });
  }

  const [savedRow] = await upsertFoods([normalized]);
  return NextResponse.json({ food: toFoodSearchResult(savedRow) });
}
