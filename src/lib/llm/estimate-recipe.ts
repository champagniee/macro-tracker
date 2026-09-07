// Decomposes a natural-language dish description into a full recipe (name,
// servings, and a real ingredient list with per-ingredient amounts + macros)
// — unlike estimate-macros.ts, which returns one aggregate estimate for the
// whole description, a recipe needs distinct ingredients because that's how
// recipes are stored (recipe_ingredients referencing individual foods).
import { Type } from "@google/genai";
import { getGeminiClient } from "./client";
import { withGeminiRetry } from "./retry";
import { FOOD_CATEGORIES, type FoodCategory } from "@/lib/food-sources/categories";

export interface RecipeIngredientEstimate {
  name: string;
  // Cosmetic-only classification (icon/color in the UI) — see categories.ts.
  category: FoodCategory;
  amount: number;
  unit: "g" | "ml" | "pcs";
  amountLabel: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface RecipeEstimate {
  name: string;
  servings: number;
  ingredients: RecipeIngredientEstimate[];
}

const RECIPE_ESTIMATE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "A concise recipe name" },
    servings: { type: Type.NUMBER, description: "How many servings this makes, based on the description (default 1 if unspecified)" },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Ingredient name" },
          category: { type: Type.STRING, enum: [...FOOD_CATEGORIES], description: "Best-fit category for this ingredient" },
          amount: { type: Type.NUMBER, description: "Numeric amount of this ingredient used in the recipe" },
          unit: { type: Type.STRING, enum: ["g", "ml", "pcs"], description: "Unit the amount is measured in" },
          amountLabel: { type: Type.STRING, description: "Human-readable label, e.g. '2 tbsp' or '1 medium onion'" },
          calories: { type: Type.NUMBER, description: "Calories for this specific amount of this ingredient, not per-100g" },
          protein: { type: Type.NUMBER, description: "Grams of protein for this specific amount" },
          carbs: { type: Type.NUMBER, description: "Grams of carbs for this specific amount" },
          fat: { type: Type.NUMBER, description: "Grams of fat for this specific amount" },
        },
        required: ["name", "category", "amount", "unit", "amountLabel", "calories", "protein", "carbs", "fat"],
      },
    },
  },
  required: ["name", "servings", "ingredients"],
};

const SYSTEM_INSTRUCTION =
  "You decompose a dish description into a real recipe: a concise name, a servings count (default 1 " +
  "if the description doesn't say), and its actual ingredients. For each ingredient, give a realistic " +
  "amount and its macros for that specific amount — not per-100g. Only include ingredients actually " +
  "implied by the description; don't over-decompose trivial seasonings into separate entries if they'd " +
  "have negligible macros, and don't invent ingredients that weren't mentioned or implied. Give each " +
  "ingredient its own best-fit category (meat, seafood, dairy_eggs, fruit, vegetable, grain, snack, " +
  "beverage, dessert, meal, other) — an ingredient is usually a single-category thing (a specific meat, " +
  "vegetable, etc.), not 'meal'; reserve 'meal' for an ingredient that's itself a composite pre-made dish.";

export async function estimateRecipe(description: string): Promise<RecipeEstimate> {
  return withGeminiRetry(async () => {
    const response = await getGeminiClient().models.generateContent({
      model: "gemini-3.6-flash",
      contents: description,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RECIPE_ESTIMATE_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned no content for the recipe estimate.");
    }
    const parsed = JSON.parse(text) as RecipeEstimate;
    if (parsed.ingredients.length === 0) {
      throw new Error("Couldn't identify any ingredients from that description.");
    }
    return parsed;
  });
}
