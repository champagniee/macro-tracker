// LLM-estimated macros for a food description, used as a fallback when
// USDA/Open Food Facts genuinely have nothing (see the conversation this was
// built from: the user isn't happy with USDA's product-heavy results for
// unfamiliar/home-cooked foods, but real lab-measured data is still preferred
// when it exists — this only supplements it, doesn't replace it).
//
// Shared between the MCP server's estimate_macros tool and the web app's
// POST /api/foods/estimate route, so both go through the exact same Gemini
// call instead of duplicating it.
//
// Uses Gemini rather than Claude — chosen deliberately for its free tier,
// since a single-user macro tracker's LLM usage here is too low-volume to
// justify paying per call. Verified against Google's own SDK README and REST
// API reference before writing this (not from training-data recall): package
// is @google/genai, the call is ai.models.generateContent({model, contents,
// config}), and JSON mode uses config.responseMimeType/responseSchema.
//
// Prototype scope: returns an estimate for the caller to log themselves.
// Doesn't cache into the `foods` table (unlike USDA/OFF) — an LLM guess isn't
// the kind of fact worth sharing across every future search the way real lab
// data is.
//
// Optionally takes a photo of a nutrition facts label/packaging — verified
// live this makes a real difference: text-only, "sugar free peanut butter
// from Mood Food" got a generic guess with the model's own notes admitting
// it didn't know that brand's real formulation; a label photo lets it read
// the actual printed numbers instead of guessing from category knowledge.
import { Type, type PartUnion } from "@google/genai";
import { getGeminiClient } from "./client";
import { withGeminiRetry } from "./retry";
import { FOOD_CATEGORIES, type FoodCategory } from "@/lib/food-sources/categories";

export interface MacroEstimateImage {
  data: string; // base64, no "data:image/..." prefix
  mimeType: string;
}

export interface MacroEstimate {
  name: string;
  brand: string | null;
  // Cosmetic-only classification (icon/color in the UI) — see categories.ts.
  category: FoodCategory;
  // Human-readable serving ("2/3 cup (55g)") plus the same amount as a real
  // number + unit — needed to actually save this as a custom food (which
  // takes a numeric servingSize/servingUnit, not a display string) rather
  // than only being usable as a one-off log entry.
  servingDescription: string;
  servingSize: number;
  servingUnit: "g" | "ml" | "pcs";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: "high" | "medium" | "low";
  notes: string;
}

// Gemini's responseSchema is a constrained subset of OpenAPI 3.0 schema, not
// full JSON Schema — no $ref, limited keyword support — so this is hand-written
// rather than derived from a zod schema the way the rest of this app's
// validation is (src/lib/food-sources/validation.ts, src/lib/entries/validation.ts).
const MACRO_ESTIMATE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Normalized food name" },
    brand: { type: Type.STRING, nullable: true, description: "Brand name if visible/known, else null — don't guess a brand" },
    category: {
      type: Type.STRING,
      enum: [...FOOD_CATEGORIES],
      description: "Best-fit category for this food",
    },
    servingDescription: {
      type: Type.STRING,
      description: "The serving this estimate is for, e.g. '1 cup (approx. 250g)' or '2/3 cup (55g)'",
    },
    servingSize: {
      type: Type.NUMBER,
      description: "The same serving as a plain number matching servingUnit, e.g. 250, or 2 for '2 pcs'",
    },
    servingUnit: {
      type: Type.STRING,
      enum: ["g", "ml", "pcs"],
      description: "Unit for servingSize — 'pcs' for discrete/countable items (eggs, slices), else g or ml",
    },
    calories: { type: Type.NUMBER },
    protein: { type: Type.NUMBER },
    carbs: { type: Type.NUMBER },
    fat: { type: Type.NUMBER },
    confidence: {
      type: Type.STRING,
      enum: ["high", "medium", "low"],
      description: "How confident this estimate is, given the description's specificity",
    },
    notes: {
      type: Type.STRING,
      description: "Assumptions made (portion size, preparation method, etc.) — be upfront about what was guessed",
    },
  },
  required: [
    "name",
    "brand",
    "category",
    "servingDescription",
    "servingSize",
    "servingUnit",
    "calories",
    "protein",
    "carbs",
    "fat",
    "confidence",
    "notes",
  ],
};

const SYSTEM_INSTRUCTION =
  "You estimate nutrition macros (calories, protein, carbs, fat in grams) for a food. Given only a text " +
  "description, give your best realistic estimate — this is a fallback for foods a nutrition database " +
  "wouldn't have. Be honest in `confidence` and `notes` about what you had to assume (portion size, " +
  "ingredients, preparation) rather than presenting a guess as certain.\n\n" +
  "If a photo of a nutrition facts label or product packaging is provided, read the actual printed " +
  "values directly instead of guessing from category knowledge — real label data, not an estimate. Use " +
  "any accompanying text to know the amount actually eaten and scale from the label's stated serving " +
  "size accordingly (e.g. the label is per 2 tbsp but the user only had 1 tbsp — divide by 2). If the " +
  "photo shows an unfamiliar brand, this is still more reliable than a text-only guess — say so in " +
  "`confidence`/`notes` only if the label itself is unclear or partially unreadable, not merely unfamiliar.\n\n" +
  "Always give servingSize as a plain number in servingUnit, matching servingDescription — e.g. " +
  "servingDescription '2/3 cup (55g)' -> servingSize 55, servingUnit 'g'; '2 fried eggs' -> servingSize 2, " +
  "servingUnit 'pcs'. Use 'pcs' for discrete/countable items (eggs, slices, pieces), 'g' or 'ml' otherwise. " +
  "Set brand only if the packaging shows one or the description names one — never invent a plausible-sounding " +
  "brand, leave it null instead.\n\n" +
  "Pick the single best-fit category. Use 'meal' for a composite dish with multiple components (a stew, a " +
  "sandwich, a plate of rice + viand) rather than trying to force it into one ingredient's category — use a " +
  "specific ingredient category (meat, seafood, dairy_eggs, fruit, vegetable, grain) only for something that " +
  "genuinely is just that one thing. 'snack' covers packaged snacks/crackers/chips, 'dessert' covers sweets " +
  "eaten as dessert specifically (cake, ice cream), 'beverage' covers drinks. 'other' only if truly nothing fits.";

export async function estimateMacros(description?: string, image?: MacroEstimateImage): Promise<MacroEstimate> {
  if (!description?.trim() && !image) {
    throw new Error("Provide a description, a photo, or both.");
  }

  const parts: PartUnion[] = [];
  if (description?.trim()) parts.push(description.trim());
  if (image) parts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });

  return withGeminiRetry(async () => {
    const response = await getGeminiClient().models.generateContent({
      model: "gemini-3.6-flash",
      contents: parts,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: MACRO_ESTIMATE_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned no content for the macro estimate.");
    }
    return JSON.parse(text) as MacroEstimate;
  });
}
