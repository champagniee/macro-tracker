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
}

export interface MacroGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
