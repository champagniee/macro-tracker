import type { FoodCategory } from "@/lib/food-sources/categories";

export interface FoodSearchResult {
  id: string;
  source: "usda" | "openfoodfacts" | "custom";
  name: string;
  brand: string | null;
  category: FoodCategory | null;
  baseUnit: "g" | "ml" | "pcs";
  caloriesPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  servingSize: number | null;
  servingUnit: string | null;
  servingLabel: string | null;
}

export const FOOD_SOURCE_LABEL: Record<FoodSearchResult["source"], string> = {
  usda: "USDA",
  openfoodfacts: "Open Food Facts",
  // Not "Your food" — custom foods are shared across all users, so a search
  // result under this source may well have been created by someone else.
  custom: "Custom",
};

// Search results are stored per-100 base units, but showing "148 kcal/100g"
// for a food whose own natural serving is "1 egg" is technically accurate and
// still useless to read at a glance. Scale to the food's own serving size and
// use its label when one exists (matches how selecting the result already
// scales the logged amount) — only fall back to the bare per-100 stat when a
// food genuinely has no serving info at all.
export function formatFoodStat(food: FoodSearchResult): string {
  if (food.servingSize) {
    const kcal = Math.round(food.caloriesPer100 * (food.servingSize / 100));
    const per = food.servingLabel || `${food.servingSize}${food.baseUnit}`;
    return `${kcal} kcal/${per}`;
  }
  return `${Math.round(food.caloriesPer100)} kcal/100${food.baseUnit}`;
}
