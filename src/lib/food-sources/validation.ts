import { z } from "zod";

export const customFoodSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  brand: z.string().trim().optional(),
  servingSize: z.number().positive("Serving size must be greater than 0"),
  servingUnit: z.enum(["g", "ml"]),
  servingLabel: z.string().trim().optional(),
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
});
