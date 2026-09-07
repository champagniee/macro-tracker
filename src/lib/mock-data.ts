import type { MacroGoals, MealType } from "./types";

export const DEFAULT_GOALS: MacroGoals = {
  calories: 2200,
  protein: 150,
  carbs: 230,
  fat: 70,
};

export const MEAL_ORDER: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snacks"];

// Meal to default to based on the current time — used by the single global
// "Add Food" button, which has no meal context of its own. Per-meal-section
// add buttons already pass their own meal explicitly and don't use this.
export function mealForTime(date: Date = new Date()): MealType {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return "Breakfast";
  if (hour >= 11 && hour < 14) return "Lunch";
  if (hour >= 17 && hour < 21) return "Dinner";
  return "Snacks";
}

// Time-based greeting for the Today page header.
export function greetingForTime(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// A user's `name` is a free-typed display name (defaults to first name at
// signup, editable to anything afterward) — only the first word is used for
// greetings/headers so a full name doesn't overflow tight UI.
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
