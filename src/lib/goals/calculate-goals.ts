import type { MacroGoals } from "@/lib/types";

// Deterministic biometric goal calculator — no LLM involved, since this is
// pure arithmetic (Mifflin-St Jeor) and more reliable/instant than an
// estimate. Shared by the Settings UI calculator and the MCP calculate_goals
// tool so both produce identical numbers.

export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalDirection = "lose" | "maintain" | "gain";

export interface GoalCalculatorInputs {
  sex: Sex;
  age: number; // years
  weightKg: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  goalDirection: GoalDirection;
}

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (little/no exercise)",
  light: "Light (1-3 days/week)",
  moderate: "Moderate (3-5 days/week)",
  active: "Active (6-7 days/week)",
  very_active: "Very active (physical job or 2x/day training)",
};

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Calorie offset from TDEE for each goal direction — a moderate, sustainable
// ~0.45kg/week pace rather than an aggressive deficit/surplus.
const GOAL_CALORIE_ADJUSTMENT: Record<GoalDirection, number> = {
  lose: -500,
  maintain: 0,
  gain: 300,
};

// Protein target scales with bodyweight and goal (higher while cutting to
// preserve lean mass); fat is a fixed share of calories; carbs fill the rest.
const PROTEIN_PER_KG: Record<GoalDirection, number> = {
  lose: 2.2,
  maintain: 2.0,
  gain: 1.8,
};

const FAT_SHARE_OF_CALORIES = 0.28;

export function calculateGoals(inputs: GoalCalculatorInputs): MacroGoals {
  const { sex, age, weightKg, heightCm, activityLevel, goalDirection } = inputs;

  const bmr =
    sex === "male"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel];
  const calories = Math.max(Math.round(tdee + GOAL_CALORIE_ADJUSTMENT[goalDirection]), 0);

  const protein = Math.round(weightKg * PROTEIN_PER_KG[goalDirection]);
  const fat = Math.round((calories * FAT_SHARE_OF_CALORIES) / 9);
  const remainingCalories = Math.max(calories - protein * 4 - fat * 9, 0);
  const carbs = Math.round(remainingCalories / 4);

  return { calories, protein, carbs, fat };
}

export function lbToKg(lb: number): number {
  return lb * 0.45359237;
}

export function inToCm(inches: number): number {
  return inches * 2.54;
}
