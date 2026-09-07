// Standalone MCP server exposing Macro Tracker to any MCP-compatible AI
// client (Claude Desktop, Claude Code, etc.) — lets you say "log 2 eggs for
// breakfast" instead of opening the Add Food sheet.
//
// This is a personal, single-user app, so it deliberately skips building a
// real auth/token system just to let a local process call its own database —
// it runs as its own local process (spawned by the MCP client over stdio),
// imports the app's DB and search logic directly (no HTTP round-trip through
// the Next.js server), and acts as a single fixed user resolved once at
// startup via MCP_USER_EMAIL. Reuses the exact same search behavior as
// /api/foods/search (src/lib/food-sources/search-foods.ts) rather than
// reimplementing it, so results here always match what you'd see in the app.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, foodEntries } from "@/db/schema";
import { searchFoods } from "@/lib/food-sources/search-foods";
import { createEntrySchema, mealSchema } from "@/lib/entries/validation";
import { estimateMacros } from "@/lib/llm/estimate-macros";
import { customFoodSchema } from "@/lib/food-sources/validation";
import { createCustomFood } from "@/lib/food-sources/create-custom-food";
import { createRecipeSchema } from "@/lib/recipes/validation";
import { createRecipe, RecipeIngredientNotFoundError } from "@/lib/recipes/create-recipe";
import { macroGoals } from "@/db/schema";
import { calculateGoals, ACTIVITY_LEVEL_LABELS } from "@/lib/goals/calculate-goals";

async function resolveUserId(): Promise<string> {
  const email = process.env.MCP_USER_EMAIL?.trim();
  if (!email) {
    throw new Error("MCP_USER_EMAIL is not set — add it to .env.local (the account this server acts as).");
  }
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!user) {
    throw new Error(`No user found for MCP_USER_EMAIL="${email}".`);
  }
  return user.id;
}

async function main() {
  const userId = await resolveUserId();

  const server = new McpServer({ name: "macro-tracker", version: "0.1.0" });

  server.registerTool(
    "search_food",
    {
      description:
        "Search for a food across USDA FoodData Central, Open Food Facts, and custom foods (shared across " +
        "all users, not just your own). Returns per-100g/ml (or per-piece, for 'pcs' foods) macros, plus " +
        "each result's own natural serving size when known — scale caloriesPer100 etc. by (servingSize/100) " +
        "to get that serving's macros.",
      inputSchema: {
        query: z.string().min(2).describe("Food name to search for, e.g. 'chicken breast' or 'banana'"),
      },
    },
    async ({ query }) => {
      const { results, warnings } = await searchFoods(query);
      const trimmed = results.map((food) => ({
        id: food.id,
        name: food.name,
        brand: food.brand,
        category: food.category,
        source: food.source,
        baseUnit: food.baseUnit,
        caloriesPer100: food.caloriesPer100,
        proteinPer100: food.proteinPer100,
        carbsPer100: food.carbsPer100,
        fatPer100: food.fatPer100,
        servingSize: food.servingSize,
        servingUnit: food.servingUnit,
        servingLabel: food.servingLabel,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ results: trimmed, warnings }, null, 2) }],
      };
    },
  );

  server.registerTool(
    "log_entry",
    {
      description:
        "Log a food entry to today's diary for a given meal. Pass the already-resolved macros for the " +
        "amount actually eaten (e.g. after scaling a search_food result) — this does not do any unit " +
        "conversion itself. Pass foodId when the entry came from a search_food result, so it stays linked " +
        "to the catalog entry.",
      inputSchema: {
        name: z.string().min(1).describe("Food name, e.g. 'Chicken Breast'"),
        serving: z.string().min(1).describe("Human-readable serving description, e.g. '150g' or '1 large egg'"),
        meal: mealSchema,
        calories: z.number().min(0),
        protein: z.number().min(0),
        carbs: z.number().min(0),
        fat: z.number().min(0),
        foodId: z.string().uuid().optional().describe("The id of a search_food result, if this came from one"),
      },
    },
    async (input) => {
      const parsed = createEntrySchema.safeParse(input);
      if (!parsed.success) {
        return {
          content: [{ type: "text", text: `Invalid input: ${parsed.error.issues[0]?.message ?? "unknown error"}` }],
          isError: true,
        };
      }

      const [entry] = await db
        .insert(foodEntries)
        .values({ ...parsed.data, userId })
        .returning();

      return {
        content: [
          {
            type: "text",
            text: `Logged "${entry.name}" (${entry.calories} kcal) to ${entry.meal}.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "estimate_macros",
    {
      description:
        "Estimate macros for a food using an LLM, for foods USDA/Open Food Facts genuinely don't have " +
        "(home-cooked dishes, vague descriptions, or an unfamiliar branded product). This is a fallback, " +
        "not a replacement for search_food — always try search_food first, since a real measured value is " +
        "more trustworthy than an estimate. Provide a text description, an image, or both — an image (a " +
        "photo of a nutrition facts label or product packaging) is read for its actual printed values " +
        "instead of guessed from category knowledge, and is meaningfully more accurate for a specific " +
        "branded product than text alone (verified live: text-only guessed a generic product for an " +
        "unfamiliar brand; a label photo read the real numbers). Returns a hydrated name + macros ready to " +
        "pass to log_entry. The result is not cached anywhere; log it yourself via log_entry if you want to keep it.",
      inputSchema: {
        description: z
          .string()
          .optional()
          .describe("What was eaten, in natural language, e.g. '1 cup of sinigang na baboy' or '2 fried eggs with rice'"),
        imageBase64: z
          .string()
          .optional()
          .describe("Base64-encoded photo of a nutrition facts label or product packaging, no data: URI prefix"),
        imageMimeType: z
          .string()
          .optional()
          .describe("MIME type of imageBase64, e.g. 'image/jpeg' — required if imageBase64 is provided"),
      },
    },
    async ({ description, imageBase64, imageMimeType }) => {
      if (!description?.trim() && !imageBase64) {
        return { content: [{ type: "text", text: "Provide a description, an image, or both." }], isError: true };
      }
      if (imageBase64 && !imageMimeType) {
        return { content: [{ type: "text", text: "imageMimeType is required when imageBase64 is provided." }], isError: true };
      }

      const estimate = await estimateMacros(
        description,
        imageBase64 && imageMimeType ? { data: imageBase64, mimeType: imageMimeType } : undefined,
      );
      return { content: [{ type: "text", text: JSON.stringify(estimate, null, 2) }] };
    },
  );

  server.registerTool(
    "create_recipe",
    {
      description:
        "Create a reusable recipe from ingredients found via search_food. Macros are computed on read " +
        "from the ingredients' current data, not stored, so they can't go stale. Use this for dishes " +
        "logged repeatedly (e.g. a home-cooked meal made from a few tracked ingredients). This only " +
        "creates the recipe — log a serving separately via log_entry using the returned per-serving macros. " +
        "Private by default; pass isPublic: true to let other users view and quick-log it too (they still " +
        "can't edit or delete it).",
      inputSchema: {
        name: z.string().min(1).describe("Recipe name, e.g. 'Peanut Butter Sandwich'"),
        servings: z.number().positive().describe("How many servings this recipe makes"),
        ingredients: z
          .array(
            z.object({
              foodId: z.string().uuid().describe("The id of a search_food result"),
              amount: z.number().positive().describe("Amount in that food's own base unit (g/ml/pcs)"),
              amountLabel: z.string().optional().describe("Optional display label, e.g. '2 tbsp'"),
            }),
          )
          .min(1)
          .describe("At least one ingredient, each referencing a real food id returned by search_food"),
        isPublic: z.boolean().optional().describe("Visible to other users when true. Defaults to false (private)."),
      },
    },
    async (input) => {
      const parsed = createRecipeSchema.safeParse(input);
      if (!parsed.success) {
        return {
          content: [{ type: "text", text: `Invalid input: ${parsed.error.issues[0]?.message ?? "unknown error"}` }],
          isError: true,
        };
      }

      try {
        const recipe = await createRecipe(userId, parsed.data);
        return { content: [{ type: "text", text: JSON.stringify(recipe, null, 2) }] };
      } catch (err) {
        if (err instanceof RecipeIngredientNotFoundError) {
          return { content: [{ type: "text", text: err.message }], isError: true };
        }
        throw err;
      }
    },
  );

  server.registerTool(
    "create_custom_food",
    {
      description:
        "Create a reusable, searchable food in the shared catalog from a description and/or a photo of the " +
        "product's packaging/nutrition label — this is NOT a diary log entry (use log_entry for that, " +
        "optionally passing this tool's returned foodId). Once created, it shows up in search_food results " +
        "for every user (not just you) and can be logged normally from then on. Always try search_food " +
        "first for common items USDA/OFF likely already has — use this for a specific branded product or " +
        "home-cooked dish search doesn't find. A photo of the actual label is far more accurate for a " +
        "specific branded product than a text description alone (verified live: text-only guessed a " +
        "generic product for an unfamiliar brand; a label photo read the real printed numbers).",
      inputSchema: {
        description: z.string().optional().describe("What the product/food is, in natural language"),
        imageBase64: z
          .string()
          .optional()
          .describe("Base64-encoded photo of packaging/nutrition label, no data: URI prefix"),
        imageMimeType: z
          .string()
          .optional()
          .describe("MIME type of imageBase64, e.g. 'image/jpeg' — required if imageBase64 is provided"),
      },
    },
    async ({ description, imageBase64, imageMimeType }) => {
      if (!description?.trim() && !imageBase64) {
        return { content: [{ type: "text", text: "Provide a description, an image, or both." }], isError: true };
      }
      if (imageBase64 && !imageMimeType) {
        return { content: [{ type: "text", text: "imageMimeType is required when imageBase64 is provided." }], isError: true };
      }

      const estimate = await estimateMacros(
        description,
        imageBase64 && imageMimeType ? { data: imageBase64, mimeType: imageMimeType } : undefined,
      );

      const parsed = customFoodSchema.safeParse({
        name: estimate.name,
        brand: estimate.brand ?? undefined,
        servingSize: estimate.servingSize,
        servingUnit: estimate.servingUnit,
        servingLabel: estimate.servingDescription,
        category: estimate.category,
        calories: estimate.calories,
        protein: estimate.protein,
        carbs: estimate.carbs,
        fat: estimate.fat,
      });
      if (!parsed.success) {
        return {
          content: [
            { type: "text", text: `Estimate produced invalid data: ${parsed.error.issues[0]?.message ?? "unknown error"}` },
          ],
          isError: true,
        };
      }

      const food = await createCustomFood(userId, parsed.data);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                food: {
                  id: food.id,
                  name: food.name,
                  brand: food.brand,
                  category: food.category,
                  baseUnit: food.baseUnit,
                  caloriesPer100: food.caloriesPer100,
                  proteinPer100: food.proteinPer100,
                  carbsPer100: food.carbsPer100,
                  fatPer100: food.fatPer100,
                  servingSize: food.servingSize,
                  servingUnit: food.servingUnit,
                  servingLabel: food.servingLabel,
                },
                confidence: estimate.confidence,
                notes: estimate.notes,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "calculate_goals",
    {
      description:
        "Calculate suggested daily macro goals (calories/protein/carbs/fat) from biometric inputs " +
        "(sex, age, weight, height, activity level, and goal direction) using the Mifflin-St Jeor BMR " +
        "formula — pure arithmetic, not an LLM estimate, so it's exact and instant. By default this also " +
        "sets it as the user's active goal (same effect as saving goals in Settings); pass save=false to " +
        "only preview the numbers without changing anything.",
      inputSchema: {
        sex: z.enum(["male", "female"]),
        age: z.number().int().positive().describe("Age in years"),
        weightKg: z.number().positive().describe("Bodyweight in kilograms — convert if given in lb (1 lb = 0.453592 kg)"),
        heightCm: z.number().positive().describe("Height in centimeters — convert if given in ft/in (1 in = 2.54 cm)"),
        activityLevel: z
          .enum(["sedentary", "light", "moderate", "active", "very_active"])
          .describe(
            Object.entries(ACTIVITY_LEVEL_LABELS)
              .map(([key, label]) => `${key}: ${label}`)
              .join("; "),
          ),
        goalDirection: z.enum(["lose", "maintain", "gain"]).describe("Whether the goal is to lose, maintain, or gain weight"),
        save: z.boolean().optional().describe("Set as the active goal (default true). Pass false to only preview."),
      },
    },
    async ({ sex, age, weightKg, heightCm, activityLevel, goalDirection, save }) => {
      const goals = calculateGoals({ sex, age, weightKg, heightCm, activityLevel, goalDirection });

      if (save ?? true) {
        await db
          .insert(macroGoals)
          .values({ ...goals, userId })
          .onConflictDoUpdate({ target: macroGoals.userId, set: { ...goals, updatedAt: new Date() } });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ goals, saved: save ?? true }, null, 2),
          },
        ],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
