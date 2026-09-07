import type { NormalizedFood } from "./types";
import { sanitizeNullableText, sanitizeText } from "./sanitize";

const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";

// Stable across every dataType (Foundation, SR Legacy, Branded, Survey).
const NUTRIENT_ID = {
  ENERGY_KCAL: 1008,
  // Some Foundation-type entries (raw whole foods) omit 1008 entirely and only
  // report energy via calculated Atwater factors instead — verified live:
  // "Apples, fuji, with skin, raw" has protein/fat/carbs but no 1008, only 2047
  // ("Atwater General Factors") and 2048 ("Atwater Specific Factors"). Without
  // this fallback, normalizeUsdaFood silently drops the food entirely (missing
  // core macro), even though real data exists — likely affects other raw
  // Foundation foods too (bananas, etc.), not just apples. General Factors
  // (2047) is the standard 4/4/9 kcal/g convention nutrition labels use, so
  // it's preferred over the food-specific 2048 when both exist.
  ENERGY_KCAL_ATWATER_GENERAL: 2047,
  ENERGY_KCAL_ATWATER_SPECIFIC: 2048,
  PROTEIN: 1003,
  FAT: 1004,
  CARBS: 1005,
  FIBER: 1079,
  SUGARS: 2000,
  SODIUM: 1093,
} as const;

interface UsdaFoodNutrient {
  nutrientId: number;
  value: number;
}

interface UsdaSearchFood {
  fdcId: number;
  description: string;
  brandName?: string;
  brandOwner?: string;
  dataType: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients: UsdaFoodNutrient[];
}

interface UsdaSearchResponse {
  foods: UsdaSearchFood[];
}

function getApiKey() {
  return process.env.USDA_API_KEY?.trim() || "DEMO_KEY";
}

function nutrientValue(nutrients: UsdaFoodNutrient[], id: number): number | undefined {
  return nutrients.find((n) => n.nutrientId === id)?.value;
}

// USDA normalizes foodNutrients to per-100g for every dataType (verified against
// the live API), so no unit conversion is needed here beyond reading the right ids.
function normalizeUsdaFood(food: UsdaSearchFood): NormalizedFood | null {
  const calories =
    nutrientValue(food.foodNutrients, NUTRIENT_ID.ENERGY_KCAL) ??
    nutrientValue(food.foodNutrients, NUTRIENT_ID.ENERGY_KCAL_ATWATER_GENERAL) ??
    nutrientValue(food.foodNutrients, NUTRIENT_ID.ENERGY_KCAL_ATWATER_SPECIFIC);
  const protein = nutrientValue(food.foodNutrients, NUTRIENT_ID.PROTEIN);
  const carbs = nutrientValue(food.foodNutrients, NUTRIENT_ID.CARBS);
  const fat = nutrientValue(food.foodNutrients, NUTRIENT_ID.FAT);

  // Skip results missing core macros rather than caching a half-populated food.
  if (calories === undefined || protein === undefined || carbs === undefined || fat === undefined) {
    return null;
  }

  const fiber = nutrientValue(food.foodNutrients, NUTRIENT_ID.FIBER);
  const sugars = nutrientValue(food.foodNutrients, NUTRIENT_ID.SUGARS);
  const sodium = nutrientValue(food.foodNutrients, NUTRIENT_ID.SODIUM);
  const micros: Record<string, number> = {};
  if (fiber !== undefined) micros.fiber_g = fiber;
  if (sugars !== undefined) micros.sugars_g = sugars;
  if (sodium !== undefined) micros.sodium_mg = sodium;

  const name = sanitizeText(food.description);
  if (!name) return null;

  return {
    source: "usda",
    externalId: String(food.fdcId),
    name,
    brand: sanitizeNullableText(food.brandName) ?? sanitizeNullableText(food.brandOwner),
    baseUnit: "g",
    caloriesPer100: calories,
    proteinPer100: protein,
    carbsPer100: carbs,
    fatPer100: fat,
    servingSize: food.servingSize ?? null,
    servingUnit: food.servingSizeUnit ?? null,
    servingLabel: sanitizeNullableText(food.householdServingFullText),
    micros: Object.keys(micros).length > 0 ? micros : null,
  };
}

interface UsdaFoodPortion {
  gramWeight: number;
  amount: number;
  modifier?: string;
}

interface UsdaFoodDetail {
  foodPortions?: UsdaFoodPortion[];
}

// Foundation/SR Legacy entries (raw/generic foods, as opposed to packaged
// Branded products) carry no household serving info on the *search* endpoint
// at all — verified live, e.g. "Egg, whole, raw, fresh" has null servingSize
// and no householdServingFullText. USDA does have real per-size portion data
// for these ("large" = 56g, "medium" = 44g, etc.), just on the food *detail*
// endpoint instead. Prefer a "large"-modifier portion (the common US default
// reference size), else whatever's listed first.
async function fetchUsdaPortion(fdcId: number): Promise<{ servingSize: number; servingLabel: string } | null> {
  const url = new URL(`${USDA_BASE_URL}/food/${fdcId}`);
  url.searchParams.set("api_key", getApiKey());

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const data: UsdaFoodDetail = await res.json();
    const portions = (data.foodPortions ?? []).filter((p) => p.gramWeight > 0);
    if (portions.length === 0) return null;

    const best = portions.find((p) => p.modifier?.toLowerCase().includes("large")) ?? portions[0];
    const label = sanitizeText(best.modifier ? `${best.amount} ${best.modifier}` : `${best.amount} serving`);
    if (!label) return null;

    return { servingSize: best.gramWeight, servingLabel: label };
  } catch {
    return null;
  }
}

export async function searchUsda(query: string, limit = 15): Promise<NormalizedFood[]> {
  const url = new URL(`${USDA_BASE_URL}/foods/search`);
  url.searchParams.set("api_key", getApiKey());
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", String(limit));
  url.searchParams.set("dataType", "Foundation,SR Legacy,Branded");

  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) {
    throw new Error(`USDA search failed: ${res.status}`);
  }

  const data: UsdaSearchResponse = await res.json();
  const normalized = data.foods
    .map(normalizeUsdaFood)
    .filter((food): food is NormalizedFood => food !== null);

  // Only enrich results that genuinely have no serving info at all — this only
  // ever runs once per food, since the result gets cached afterward and future
  // searches read it straight from the DB without calling USDA again.
  return Promise.all(
    normalized.map(async (food) => {
      if (food.servingSize !== null || food.servingLabel !== null) return food;
      const portion = await fetchUsdaPortion(Number(food.externalId));
      if (!portion) return food;
      return { ...food, servingSize: portion.servingSize, servingUnit: "g", servingLabel: portion.servingLabel };
    }),
  );
}
