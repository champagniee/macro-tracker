import type { NormalizedFood } from "./types";
import { sanitizeNullableText } from "./sanitize";

const OFF_BASE_URL = "https://world.openfoodfacts.org";
const FIELDS = "code,product_name,brands,serving_size,nutriments";

interface OffProduct {
  code: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: Record<string, number | string | undefined>;
}

interface OffSearchResponse {
  products: OffProduct[];
}

interface OffProductResponse {
  status: number;
  product?: OffProduct;
}

function getUserAgent() {
  return process.env.OFF_USER_AGENT?.trim() || "MacroTracker/0.1 (no contact set)";
}

function num(nutriments: OffProduct["nutriments"], key: string): number | undefined {
  const value = nutriments?.[key];
  return typeof value === "number" ? value : undefined;
}

// OFF reports per-100g under `_100g`-suffixed keys — the bare key is ambiguous
// (per-100g for most products, but per-serving for some), so always use the
// suffixed key. `energy_100g` is kJ; `energy-kcal_100g` is the kcal value we want.
function normalizeOffProduct(product: OffProduct): NormalizedFood | null {
  const calories = num(product.nutriments, "energy-kcal_100g");
  const protein = num(product.nutriments, "proteins_100g");
  const carbs = num(product.nutriments, "carbohydrates_100g");
  const fat = num(product.nutriments, "fat_100g");

  if (calories === undefined || protein === undefined || carbs === undefined || fat === undefined) {
    return null;
  }

  const fiber = num(product.nutriments, "fiber_100g");
  const sugars = num(product.nutriments, "sugars_100g");
  const sodiumGrams = num(product.nutriments, "sodium_100g");
  const micros: Record<string, number> = {};
  if (fiber !== undefined) micros.fiber_g = fiber;
  if (sugars !== undefined) micros.sugars_g = sugars;
  if (sodiumGrams !== undefined) micros.sodium_mg = sodiumGrams * 1000;

  const name = sanitizeNullableText(product.product_name);
  if (!name) return null;

  return {
    source: "openfoodfacts",
    externalId: product.code,
    name,
    brand: sanitizeNullableText(product.brands?.split(",")[0]),
    baseUnit: "g",
    caloriesPer100: calories,
    proteinPer100: protein,
    carbsPer100: carbs,
    fatPer100: fat,
    servingSize: null,
    servingUnit: null,
    servingLabel: sanitizeNullableText(product.serving_size),
    micros: Object.keys(micros).length > 0 ? micros : null,
  };
}

export async function searchOpenFoodFacts(query: string, limit = 15): Promise<NormalizedFood[]> {
  const url = new URL(`${OFF_BASE_URL}/cgi/search.pl`);
  url.searchParams.set("search_terms", query);
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(limit));
  url.searchParams.set("fields", FIELDS);

  const res = await fetch(url, {
    headers: { "User-Agent": getUserAgent() },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`Open Food Facts search failed: ${res.status}`);
  }

  const data: OffSearchResponse = await res.json();
  return data.products
    .map(normalizeOffProduct)
    .filter((food): food is NormalizedFood => food !== null);
}

export async function getOpenFoodFactsByBarcode(barcode: string): Promise<NormalizedFood | null> {
  const url = new URL(`${OFF_BASE_URL}/api/v2/product/${encodeURIComponent(barcode)}.json`);
  url.searchParams.set("fields", FIELDS);

  const res = await fetch(url, {
    headers: { "User-Agent": getUserAgent() },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`Open Food Facts lookup failed: ${res.status}`);
  }

  const data: OffProductResponse = await res.json();
  if (data.status !== 1 || !data.product) return null;
  return normalizeOffProduct(data.product);
}
