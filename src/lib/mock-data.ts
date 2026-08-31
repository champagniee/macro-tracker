import type { FoodEntry, MacroGoals, MealType } from "./types";

export const DEFAULT_GOALS: MacroGoals = {
  calories: 2200,
  protein: 150,
  carbs: 230,
  fat: 70,
};

export const MEAL_ORDER: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snacks"];

export const INITIAL_ENTRIES: FoodEntry[] = [
  {
    id: "seed-1",
    name: "Greek Yogurt",
    serving: "1 cup",
    meal: "Breakfast",
    calories: 150,
    protein: 20,
    carbs: 9,
    fat: 4,
  },
  {
    id: "seed-2",
    name: "Blueberries",
    serving: "1/2 cup",
    meal: "Breakfast",
    calories: 42,
    protein: 1,
    carbs: 11,
    fat: 0,
  },
  {
    id: "seed-3",
    name: "Grilled Chicken Breast",
    serving: "6 oz",
    meal: "Lunch",
    calories: 280,
    protein: 52,
    carbs: 0,
    fat: 6,
  },
  {
    id: "seed-4",
    name: "Jasmine Rice",
    serving: "1 cup",
    meal: "Lunch",
    calories: 205,
    protein: 4,
    carbs: 45,
    fat: 0,
  },
  {
    id: "seed-5",
    name: "Almonds",
    serving: "1 oz",
    meal: "Snacks",
    calories: 164,
    protein: 6,
    carbs: 6,
    fat: 14,
  },
];

export const QUICK_ADD_SUGGESTIONS: Omit<FoodEntry, "id" | "meal">[] = [
  { name: "Banana", serving: "1 medium", calories: 105, protein: 1, carbs: 27, fat: 0 },
  { name: "Egg", serving: "1 large", calories: 72, protein: 6, carbs: 0, fat: 5 },
  { name: "Protein Shake", serving: "1 scoop", calories: 120, protein: 24, carbs: 3, fat: 1 },
  { name: "Oatmeal", serving: "1 cup cooked", calories: 158, protein: 6, carbs: 27, fat: 3 },
  { name: "Salmon", serving: "6 oz", calories: 350, protein: 39, carbs: 0, fat: 21 },
  { name: "Avocado", serving: "1/2", calories: 120, protein: 1, carbs: 6, fat: 11 },
];

export interface HistoryDay {
  date: string;
  label: string;
  calories: number;
  goal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const HISTORY: HistoryDay[] = [
  { date: "2026-08-30", label: "Sunday", calories: 2140, goal: 2200, protein: 148, carbs: 210, fat: 68 },
  { date: "2026-08-29", label: "Saturday", calories: 2360, goal: 2200, protein: 132, carbs: 260, fat: 74 },
  { date: "2026-08-28", label: "Friday", calories: 2080, goal: 2200, protein: 155, carbs: 198, fat: 65 },
  { date: "2026-08-27", label: "Thursday", calories: 1990, goal: 2200, protein: 160, carbs: 180, fat: 60 },
  { date: "2026-08-26", label: "Wednesday", calories: 2210, goal: 2200, protein: 145, carbs: 225, fat: 71 },
  { date: "2026-08-25", label: "Tuesday", calories: 2270, goal: 2200, protein: 138, carbs: 245, fat: 73 },
  { date: "2026-08-24", label: "Monday", calories: 2050, goal: 2200, protein: 150, carbs: 205, fat: 62 },
];
