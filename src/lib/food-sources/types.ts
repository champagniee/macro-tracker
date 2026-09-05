export type FoodSource = "usda" | "openfoodfacts" | "custom";
export type FoodBaseUnit = "g" | "ml";

// The shape every source (USDA, Open Food Facts, custom) normalizes into
// before it's cached in / read from the `foods` table.
export interface NormalizedFood {
  source: FoodSource;
  externalId: string | null;
  name: string;
  brand: string | null;
  baseUnit: FoodBaseUnit;
  caloriesPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  servingSize: number | null;
  servingUnit: string | null;
  servingLabel: string | null;
  micros: Record<string, number> | null;
}
