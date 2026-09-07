import { z } from "zod";
import { FOOD_CATEGORIES } from "./categories";

export const customFoodSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  brand: z.string().trim().optional(),
  servingSize: z.number().positive("Serving size must be greater than 0"),
  servingUnit: z.enum(["g", "ml", "pcs"]),
  servingLabel: z.string().trim().optional(),
  // Cosmetic-only (icon/color) — optional since not every creation path has a
  // source to classify it from (a hand-typed food with no LLM call involved).
  category: z.enum(FOOD_CATEGORIES).optional(),
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
});
