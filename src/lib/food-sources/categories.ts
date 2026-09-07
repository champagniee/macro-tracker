import { Beef, Fish, Egg, Apple, Carrot, Wheat, Cookie, CupSoda, Cake, UtensilsCrossed, HelpCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Single source of truth for the category list — z.enum() needs a literal
// tuple to infer proper string-literal types, so this is defined as a const
// array first and FoodCategory derived from it, not the other way around.
export const FOOD_CATEGORIES = [
  "meat",
  "seafood",
  "dairy_eggs",
  "fruit",
  "vegetable",
  "grain",
  "snack",
  "beverage",
  "dessert",
  "meal",
  "other",
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

interface CategoryMeta {
  label: string;
  icon: LucideIcon;
  color: string;
}

// Colors deliberately distinct from the app's semantic macro colors
// (--protein/--carbs/--fat/--calories) so a category badge next to a food
// name never reads as a macro indicator.
export const CATEGORY_META: Record<FoodCategory, CategoryMeta> = {
  meat: { label: "Meat", icon: Beef, color: "#D64545" },
  seafood: { label: "Seafood", icon: Fish, color: "#3E92CC" },
  dairy_eggs: { label: "Dairy & Eggs", icon: Egg, color: "#D6A83F" },
  fruit: { label: "Fruit", icon: Apple, color: "#D6437A" },
  vegetable: { label: "Vegetable", icon: Carrot, color: "#4CAE5C" },
  grain: { label: "Grain", icon: Wheat, color: "#B5813F" },
  snack: { label: "Snack", icon: Cookie, color: "#9C5FD6" },
  beverage: { label: "Beverage", icon: CupSoda, color: "#3FB5B0" },
  dessert: { label: "Dessert", icon: Cake, color: "#D65C8C" },
  meal: { label: "Meal", icon: UtensilsCrossed, color: "#5C6FD6" },
  other: { label: "Other", icon: HelpCircle, color: "#8E8E93" },
};
