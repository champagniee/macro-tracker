import type { NormalizedFood } from "./types";
import { sanitizeNullableText, sanitizeText } from "./sanitize";

const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";

// Stable across every dataType (Foundation, SR Legacy, Branded, Survey).
const NUTRIENT_ID = {
  ENERGY_KCAL: 1008,
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
  const calories = nutrientValue(food.foodNutrients, NUTRIENT_ID.ENERGY_KCAL);
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
  return data.foods
    .map(normalizeUsdaFood)
    .filter((food): food is NormalizedFood => food !== null);
}
