import { z } from "zod";

export const recipeIngredientSchema = z.object({
  foodId: z.string().uuid(),
  amount: z.number().positive(),
  amountLabel: z.string().trim().optional(),
});

export const createRecipeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  servings: z.number().positive().default(1),
  ingredients: z.array(recipeIngredientSchema).min(1, "Add at least one ingredient"),
  isPublic: z.boolean().default(false),
});

export const updateRecipeVisibilitySchema = z.object({
  isPublic: z.boolean(),
});
