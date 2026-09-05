import { z } from "zod";

export const mealSchema = z.enum(["Breakfast", "Lunch", "Dinner", "Snacks"]);

export const createEntrySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  serving: z.string().trim().min(1, "Serving is required"),
  meal: mealSchema,
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
  foodId: z.string().uuid().optional(),
});

export const goalsSchema = z.object({
  calories: z.number().positive(),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
});
