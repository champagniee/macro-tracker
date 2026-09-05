import type { MacroGoals, MealType } from "./types";

export const DEFAULT_GOALS: MacroGoals = {
  calories: 2200,
  protein: 150,
  carbs: 230,
  fat: 70,
};

export const MEAL_ORDER: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snacks"];
