export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snacks";

export interface FoodEntry {
  id: string;
  name: string;
  serving: string;
  meal: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  // Back-reference to the foods catalog row this was logged from, if any —
  // present on rows returned by the API, absent on entries built purely from
  // manual form input.
  foodId?: string | null;
}

export interface MacroGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
