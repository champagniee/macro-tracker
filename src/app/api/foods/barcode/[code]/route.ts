import { NextResponse } from "next/server";
import { getOpenFoodFactsByBarcode } from "@/lib/food-sources/openfoodfacts";

// Barcode lookup has exactly one possible source — USDA has no barcode index
// at all — so this deliberately ignores DISABLE_EXTERNAL_FOOD_APIS (which
// only ever gated text search): with no other source to fall back to,
// honoring that flag here would just make barcode scanning silently do
// nothing while it's set.
//
// No caching yet (upsertFoods) — a scanned product isn't written to `foods`
// here. It flows through the Add Food form exactly like a hand-typed or
// AI-estimated food, and gets saved as a real custom food only if/when the
// user actually logs it, via the existing auto-save path in
// resolveCurrentForm. Real OFF-sourced caching (checking `foods` for this
// barcode before ever calling OFF) is a deliberately separate follow-up.
const BARCODE_PATTERN = /^\d{6,14}$/;

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  if (!BARCODE_PATTERN.test(code)) {
    return NextResponse.json({ error: "Invalid barcode" }, { status: 400 });
  }

  try {
    const food = await getOpenFoodFactsByBarcode(code);
    if (!food) {
      return NextResponse.json({ error: "No product found for that barcode" }, { status: 404 });
    }
    return NextResponse.json({ food });
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach Open Food Facts. Try again in a moment." },
      { status: 502 },
    );
  }
}
