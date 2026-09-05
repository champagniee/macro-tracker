export interface FoodSearchResult {
  id: string;
  source: "usda" | "openfoodfacts" | "custom";
  name: string;
  brand: string | null;
  baseUnit: "g" | "ml";
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
  custom: "Your food",
};
