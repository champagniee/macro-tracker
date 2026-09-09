"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, ChefHat, Globe2, Loader2, ScanBarcode, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { NumericField } from "@/components/ui/numeric-field";
import { useFoodSearch } from "@/components/food-search/use-food-search";
import { useRecipeSearch, type RecipeSearchResult } from "@/components/food-search/use-recipe-search";
import { FOOD_SOURCE_LABEL, formatFoodStat, type FoodSearchResult } from "@/components/food-search/types";
import { CategoryBadge } from "@/components/food-search/category-badge";
import { MacroLetterBadge } from "@/components/rings/macro-letter-badge";
import { BarcodeScanner } from "@/components/add-food/barcode-scanner";
import type { FoodCategory } from "@/lib/food-sources/categories";
import type { NormalizedFood } from "@/lib/food-sources/types";
import type { MacroEstimate } from "@/lib/llm/estimate-macros";
import { MEAL_ORDER } from "@/lib/mock-data";
import { useMediaQuery } from "@/lib/use-media-query";
import type { FoodEntry, MealType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AddFoodSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMeal: MealType;
  entries: FoodEntry[];
  onSubmit: (entry: Omit<FoodEntry, "id">) => void;
}

const emptyForm = {
  name: "",
  amount: "",
  unit: "g" as "g" | "ml" | "pcs",
  servingLabel: "",
  category: null as FoodCategory | null,
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
};
const UNIT_OPTIONS = ["g", "ml", "pcs"] as const;
const RECENT_FOODS_LIMIT = 6;
// Left-to-right, matching the mode tabs' actual on-screen order — the index
// difference between old and new mode is what tells the content which way
// to slide.
const MODE_ORDER = ["search", "describe", "recipe"] as const;
// Slides in from the tapped tab's side and out toward the other, rather than
// a plain crossfade — direction comes in via Motion's `custom` prop.
const modeSlideVariants = {
  enter: (direction: number) => ({ opacity: 0, x: direction > 0 ? 16 : -16 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction > 0 ? -16 : 16 }),
};

// One resolved food waiting to be logged — built up in the sheet before the
// final submit, so multiple foods can be added in one visit instead of one
// sheet-open per food. meal isn't part of this: all staged items share the
// sheet's single meal selection, applied at final submit time.
interface StagedFood {
  name: string;
  serving: string;
  category: FoodCategory | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  foodId?: string;
}

// Most-recently-logged foods, deduped by name (case-insensitive), newest first.
// Entries are always appended, so walking backwards is walking newest-to-oldest.
function getRecentFoods(entries: FoodEntry[], limit: number): FoodEntry[] {
  const seen = new Set<string>();
  const recent: FoodEntry[] = [];
  for (let i = entries.length - 1; i >= 0 && recent.length < limit; i--) {
    const key = entries[i].name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recent.push(entries[i]);
  }
  return recent;
}

export function AddFoodSheet({ open, onOpenChange, defaultMeal, entries, onSubmit }: AddFoodSheetProps) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [query, setQuery] = useState("");
  // Barcode scan: camera overlay open state, plus a brief loading window
  // between a code being detected and the Open Food Facts lookup resolving.
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [form, setForm] = useState(emptyForm);
  // The catalog food (if any) currently backing the form, so it can be passed
  // through as food_id on submit. Cleared whenever the name is hand-edited,
  // since at that point the form no longer represents that catalog entry.
  const [selectedFoodId, setSelectedFoodId] = useState<string | null>(null);
  // Per-100-base-unit macros for the selected catalog result, kept around so
  // editing Amount can rescale live instead of only computing once at pick
  // time. Only ever set from a real search result (recent-foods chips only
  // carry the already-resolved macros for their original amount, not a per-100
  // baseline to rescale from) — null means Amount edits just set the raw value.
  const [baseline, setBaseline] = useState<{
    caloriesPer100: number;
    proteinPer100: number;
    carbsPer100: number;
    fatPer100: number;
  } | null>(null);
  // Whether the user has hand-typed an Amount since the last programmatic set
  // (a search pick, or a Unit switch snapping in a default) — guards the
  // Unit-switch default snap from clobbering a value they actually typed.
  const [amountTouched, setAmountTouched] = useState(false);
  // Set when the form is currently backed by a picked recipe (1 serving's
  // macros) rather than a catalog food — gates two things: resolveCurrentForm
  // must NOT save it as a new custom food (a recipe log isn't a catalog
  // entry), and the Unit field stays locked the same way a catalog baseline
  // locks it, since "g of 1 recipe serving" doesn't mean anything.
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  // "Describe it" mode (estimate_macros/Gemini) — an alternative to catalog
  // search for foods USDA/OFF won't have (home-cooked dishes, vague
  // descriptions). "Recipe" mode logs 1 serving of one of your own or a
  // public recipe, reusing the same resolved-macros form the other two modes
  // populate. Mutually exclusive, not layered.
  const [mode, setMode] = useState<"search" | "describe" | "recipe">("search");
  // +1/-1, set right before mode changes — tells the mode content which way
  // to slide (matches the left-to-right order the mode tabs are laid out in,
  // so the content visibly moves the same direction as the tab you tapped).
  const [modeDirection, setModeDirection] = useState(0);
  function changeMode(next: typeof mode) {
    setModeDirection(MODE_ORDER.indexOf(next) > MODE_ORDER.indexOf(mode) ? 1 : -1);
    setMode(next);
  }
  const [describeText, setDescribeText] = useState("");
  // A photo of a nutrition label/packaging — verified live this gets real
  // printed values read directly instead of a category guess, meaningfully
  // more reliable than text alone for an unfamiliar branded product.
  const [image, setImage] = useState<{ data: string; mimeType: string; previewUrl: string } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  // The estimate currently backing the form, kept only to show its
  // confidence/notes caveats — cleared the moment the form no longer
  // represents it (name hand-edited, or a different source applied).
  const [lastEstimate, setLastEstimate] = useState<MacroEstimate | null>(null);
  // Foods already resolved and waiting to be logged together — lets one sheet
  // visit add several foods instead of one sheet-open per food.
  const [stagedFoods, setStagedFoods] = useState<StagedFood[]>([]);

  // Clears everything about the food currently being entered — used both when
  // the sheet opens and after "Add another" stages the current food, so the
  // form is ready for the next one. Deliberately doesn't touch meal or
  // stagedFoods; the caller resets those separately when it wants to.
  function resetFormFields() {
    setForm(emptyForm);
    setQuery("");
    setSelectedFoodId(null);
    setBaseline(null);
    setSelectedRecipeId(null);
    setAmountTouched(false);
    setMode("search");
    setDescribeText("");
    setImage(null);
    setEstimating(false);
    setEstimateError(null);
    setLastEstimate(null);
    setScannerOpen(false);
    setScanning(false);
  }

  // Reset the form whenever the sheet transitions to open, without doing it
  // in an effect (avoids an extra render pass just to clear stale fields).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setMeal(defaultMeal);
      setStagedFoods([]);
      resetFormFields();
    }
  }

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const recentFoods = useMemo(() => getRecentFoods(entries, RECENT_FOODS_LIMIT), [entries]);

  // Once the user actually starts typing, real catalog search (USDA/Open Food
  // Facts/custom foods) replaces the recent-foods chips — recent chips are the
  // zero-effort "log what I always eat" path, search is for finding anything else.
  const { results: searchResults, warnings: searchWarnings, loading: searching } = useFoodSearch(query);
  const { results: recipeResults, loading: searchingRecipes } = useRecipeSearch(query);
  const isSearching = query.trim().length >= 2;

  const canSubmit = form.name.trim().length > 0 && Number(form.calories) > 0;

  // True only for a "Describe it" estimate of a whole dish (not a single
  // ingredient) — see applyEstimate. Drives both the Amount/Unit display
  // (treated like a recipe pick: "1 serving", locked) and, in
  // resolveCurrentForm, which numbers get saved as the food's own catalog
  // serving size.
  const isMealEstimate = lastEstimate !== null && lastEstimate.category === "meal";

  // Recently-logged entries only ever stored a freeform "serving" display
  // string ("150g", "1 slice", ...), not a structured amount+unit — so there's
  // never a real number to show in Amount from the entry alone. Two cases:
  //
  // - Already linked to a real catalog food (entry.foodId set): fetch that
  //   food's own servingSize/baseUnit purely so Amount/Unit show something
  //   real instead of blank (previously left blank, which looked like a "0"
  //   bug — it wasn't wrong, just cosmetically broken). Deliberately does NOT
  //   touch calories/protein/carbs/fat/servingLabel — those stay exactly as
  //   actually logged, since a recent chip is "repeat what I ate," not
  //   "re-derive from the catalog's current numbers." No baseline is set
  //   either, so editing Amount afterward won't silently rescale away from
  //   the preserved recorded macros.
  // - Not linked: no food to look up, so default to "1 pcs" — enough to pass
  //   the hasAmount gate in handleSubmit so it can finally get saved as a
  //   custom food on re-log, same reasoning as before this comment existed.
  async function applySuggestion(entry: FoodEntry) {
    const base = {
      name: entry.name,
      servingLabel: entry.serving,
      // FoodEntry doesn't carry a category (entries only snapshot macros, not
      // catalog metadata) — the food lookup below fills this in when linked.
      category: null as FoodCategory | null,
      calories: String(entry.calories),
      protein: String(entry.protein),
      carbs: String(entry.carbs),
      fat: String(entry.fat),
    };

    if (entry.foodId) {
      try {
        const res = await fetch(`/api/foods/${entry.foodId}`);
        if (res.ok) {
          const { food } = (await res.json()) as { food: FoodSearchResult };
          // Same "1 serving" display as applyFoodResult for a meal — baseline
          // is already null on this path regardless, so this only changes what
          // Amount/Unit show, not how a later edit rescales entry.calories etc.
          setForm({
            ...base,
            amount: food.category === "meal" ? "1" : String(food.servingSize ?? 100),
            unit: food.baseUnit,
            category: food.category,
          });
          setSelectedFoodId(entry.foodId);
          setBaseline(null);
          setSelectedRecipeId(null);
          setAmountTouched(false);
          setLastEstimate(null);
          return;
        }
      } catch {
        // Fall through to the unlinked default below.
      }
    }

    setForm({ ...base, amount: "1", unit: "pcs" });
    setSelectedFoodId(entry.foodId ?? null);
    setBaseline(null);
    setSelectedRecipeId(null);
    setAmountTouched(false);
    setLastEstimate(null);
  }

  // Catalog results are stored per-100 base units — scale to the food's own
  // serving size (falling back to 100, i.e. "per 100g/ml") for the logged
  // amount, and keep the per-100 baseline around so editing Amount afterward
  // can rescale live instead of only computing once here.
  //
  // A "meal" (a previously AI-estimated or hand-saved whole dish, re-found via
  // search) gets the same "1 serving" treatment as a fresh estimate or a
  // recipe pick — see applyEstimate — rather than showing its raw stored
  // servingSize/baseUnit (e.g. "258g"), which is meaningless to re-log by.
  // No per-100 baseline is kept for a meal: `factor` still converts its
  // stored per-100 rate into real "1 serving" macros once, up front, and
  // handleAmountChange's baseline-less proportional-scaling branch (already
  // used by recipes) takes over correctly from there if Amount is edited.
  function applyFoodResult(food: FoodSearchResult) {
    const isMeal = food.category === "meal";
    const amount = food.servingSize ?? 100;
    const factor = amount / 100;
    setForm({
      name: food.name,
      amount: isMeal ? "1" : String(amount),
      unit: food.baseUnit,
      servingLabel: food.servingLabel ?? "",
      category: food.category,
      calories: String(Math.round(food.caloriesPer100 * factor)),
      protein: String(Math.round(food.proteinPer100 * factor)),
      carbs: String(Math.round(food.carbsPer100 * factor)),
      fat: String(Math.round(food.fatPer100 * factor)),
    });
    setSelectedFoodId(food.id);
    setBaseline(
      isMeal
        ? null
        : {
            caloriesPer100: food.caloriesPer100,
            proteinPer100: food.proteinPer100,
            carbsPer100: food.carbsPer100,
            fatPer100: food.fatPer100,
          },
    );
    setSelectedRecipeId(null);
    setAmountTouched(false);
    setLastEstimate(null);
    setQuery("");
  }

  // A scanned barcode has a real per-100 rate (like applyFoodResult), just no
  // existing catalog id — Open Food Facts is looked up live, not cached into
  // `foods` yet (deliberately deferred). Leaving selectedFoodId null means
  // resolveCurrentForm's existing "no foodId + a real amount → save as a new
  // custom food" gate fires on submit exactly like a hand-typed food, giving
  // it a real id the first time it's actually logged rather than the moment
  // it's scanned. OFF never classifies into this app's own category enum, so
  // category stays null (same "Other" fallback any uncategorized food gets).
  function applyBarcodeResult(food: NormalizedFood) {
    const amount = food.servingSize ?? 100;
    const factor = amount / 100;
    setForm({
      name: food.name,
      amount: String(amount),
      unit: food.baseUnit,
      servingLabel: food.servingLabel ?? "",
      category: null,
      calories: String(Math.round(food.caloriesPer100 * factor)),
      protein: String(Math.round(food.proteinPer100 * factor)),
      carbs: String(Math.round(food.carbsPer100 * factor)),
      fat: String(Math.round(food.fatPer100 * factor)),
    });
    setSelectedFoodId(null);
    setBaseline({
      caloriesPer100: food.caloriesPer100,
      proteinPer100: food.proteinPer100,
      carbsPer100: food.carbsPer100,
      fatPer100: food.fatPer100,
    });
    setSelectedRecipeId(null);
    setAmountTouched(false);
    setLastEstimate(null);
    setQuery("");
  }

  async function handleBarcodeDetected(code: string) {
    setScannerOpen(false);
    setScanning(true);
    try {
      const res = await fetch(`/api/foods/barcode/${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't find that product");
      applyBarcodeResult(data.food as NormalizedFood);
      toast.success(`Found "${data.food.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't look up that barcode");
    } finally {
      setScanning(false);
    }
  }

  // A recipe's per-serving macros become the form's numbers for "1" serving,
  // same shape as a resolved food — but with no per-100 baseline (there isn't
  // one), Amount edits fall through to the proportional-scaling path in
  // handleAmountChange, which correctly means "N servings" for any N typed.
  // selectedRecipeId is what stops resolveCurrentForm from saving this as a
  // brand-new custom food on submit.
  function applyRecipeResult(recipe: RecipeSearchResult) {
    setForm({
      name: recipe.name,
      amount: "1",
      unit: "pcs",
      // Left blank deliberately — resolveCurrentForm derives "N servings"
      // from the current Amount at resolve time instead, so it can't go
      // stale if Amount changes after picking.
      servingLabel: "",
      category: "meal",
      calories: String(Math.round(recipe.macros.perServingCalories)),
      protein: String(Math.round(recipe.macros.perServingProtein)),
      carbs: String(Math.round(recipe.macros.perServingCarbs)),
      fat: String(Math.round(recipe.macros.perServingFat)),
    });
    setSelectedFoodId(null);
    setBaseline(null);
    setSelectedRecipeId(recipe.id);
    setAmountTouched(false);
    setLastEstimate(null);
    setQuery("");
  }

  // Gemini's estimate is already for a specific described amount (not a
  // per-100 rate to scale from), so unlike applyFoodResult there's no
  // baseline to keep — Amount edits afterward behave like a hand-typed food.
  //
  // A "meal" (a whole composite dish, per estimate-macros.ts's own category
  // guidance) gets Amount/Unit treated like a recipe pick instead of a raw
  // ingredient: Amount starts at "1" and Unit displays "serving" (locked),
  // since Gemini can and does pick "g"/"ml" for a whole plate — real grams
  // are meaningful for a single ingredient, not for "how many platefuls am I
  // logging." The real servingSize/servingUnit Gemini estimated stays on
  // `lastEstimate` for the catalog-food save in resolveCurrentForm, which
  // needs the food's own actual per-serving size, not "how many of it".
  function applyEstimate(estimate: MacroEstimate) {
    const isMeal = estimate.category === "meal";
    setForm({
      name: estimate.name,
      // A real amount+unit (not just a display string) is what lets submit
      // save this as a reusable custom food — previously left blank here,
      // which silently skipped that save (the gate in handleSubmit requires
      // a valid amount), unlike recipe ingredients from the same estimate flow.
      amount: isMeal ? "1" : String(estimate.servingSize),
      unit: estimate.servingUnit,
      servingLabel: estimate.servingDescription,
      category: estimate.category,
      calories: String(Math.round(estimate.calories)),
      protein: String(Math.round(estimate.protein)),
      carbs: String(Math.round(estimate.carbs)),
      fat: String(Math.round(estimate.fat)),
    });
    setSelectedFoodId(null);
    setBaseline(null);
    setSelectedRecipeId(null);
    setAmountTouched(false);
    setLastEstimate(estimate);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string; // "data:image/jpeg;base64,...."
      const base64 = result.split(",")[1];
      if (base64) setImage({ data: base64, mimeType: file.type, previewUrl: result });
    };
    reader.readAsDataURL(file);
  }

  const canEstimate = describeText.trim().length >= 2 || image !== null;

  async function handleEstimate() {
    if (!canEstimate || estimating) return;
    setEstimating(true);
    setEstimateError(null);
    try {
      const res = await fetch("/api/foods/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: describeText.trim() || undefined,
          image: image ? { data: image.data, mimeType: image.mimeType } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't get an estimate");
      applyEstimate(data.estimate);
      setImage(null);
    } catch (err) {
      setEstimateError(err instanceof Error ? err.message : "Couldn't get an estimate");
    } finally {
      setEstimating(false);
    }
  }

  function handleNameChange(value: string) {
    setForm((f) => ({ ...f, name: value }));
    setSelectedFoodId(null);
    setBaseline(null);
    setSelectedRecipeId(null);
    setLastEstimate(null);
  }

  // Rescales the macro fields whenever Amount changes — from the precise
  // catalog per-100 rate when one's known (a search pick), or otherwise
  // proportionally from whatever's currently in the macro fields. That
  // fallback matters: a hand-typed or "Describe it"-estimated food has no
  // per-100 rate at all, but increasing Amount should still scale its macros
  // — previously it silently didn't, leaving old macros next to a new amount.
  function handleAmountChange(value: string) {
    setAmountTouched(true);
    setForm((f) => {
      const newAmountNum = Number(value);
      if (!(newAmountNum > 0)) return { ...f, amount: value };

      if (baseline) {
        const factor = newAmountNum / 100;
        return {
          ...f,
          amount: value,
          calories: String(Math.round(baseline.caloriesPer100 * factor)),
          protein: String(Math.round(baseline.proteinPer100 * factor)),
          carbs: String(Math.round(baseline.carbsPer100 * factor)),
          fat: String(Math.round(baseline.fatPer100 * factor)),
        };
      }

      // No known per-100 rate — scale proportionally from the old amount
      // instead, so a hand-typed/estimated food's macros still track Amount.
      const oldAmountNum = Number(f.amount);
      if (!(oldAmountNum > 0)) return { ...f, amount: value };
      const factor = newAmountNum / oldAmountNum;
      return {
        ...f,
        amount: value,
        calories: String(Math.round((Number(f.calories) || 0) * factor)),
        protein: String(Math.round((Number(f.protein) || 0) * factor)),
        carbs: String(Math.round((Number(f.carbs) || 0) * factor)),
        fat: String(Math.round((Number(f.fat) || 0) * factor)),
      };
    });
  }

  // Unit only free-switches for a hand-typed food (a catalog pick's baseUnit
  // is intrinsic to its stored per-100 data, not something to reinterpret).
  // Snaps Amount to a sensible default for the new unit unless the user has
  // already typed one, so switching to "pcs" doesn't leave a stale "100" sitting
  // there implying 100 pieces.
  function handleUnitChange(unit: "g" | "ml" | "pcs") {
    setForm((f) => ({
      ...f,
      unit,
      amount: amountTouched ? f.amount : unit === "pcs" ? "1" : "100",
    }));
  }

  // Resolves the food currently being entered into a StagedFood — the shared
  // step behind both "Add another" and the final submit (which also resolves
  // whatever's left in the form, so you don't have to hit "Add another" for
  // the very last item). Returns null if the form isn't valid to submit.
  async function resolveCurrentForm(): Promise<StagedFood | null> {
    if (!canSubmit) return null;

    const amountNum = Number(form.amount);
    const hasAmount = amountNum > 0;
    // Computed fresh here (not prefilled once at pick time) so it stays
    // correct if Amount changes afterward — "2 servings" instead of a stale
    // "1 serving" left over from when the recipe was first picked.
    const label =
      form.servingLabel.trim() ||
      (selectedRecipeId
        ? `${amountNum} serving${amountNum === 1 ? "" : "s"}`
        : hasAmount
          ? `${amountNum} ${form.unit}`
          : "1 serving");
    const macros = {
      calories: Number(form.calories) || 0,
      protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0,
      fat: Number(form.fat) || 0,
    };

    let foodId = selectedFoodId ?? undefined;

    // A hand-entered food (not picked verbatim from search — selectedFoodId is
    // cleared the moment the name is edited) gets saved as a reusable custom
    // food too, so it's searchable and reusable next time instead of a one-off
    // log entry — same "custom content is first-class" reasoning as the rest
    // of the catalog. Needs a real amount+unit to convert to per-100 storage;
    // silently skipped (falls back to a plain log entry) if that's missing,
    // e.g. reapplying an older recent-foods chip with no structured serving.
    // Skipped entirely for a recipe pick — logging "1 serving of a recipe"
    // isn't a new catalog food, it's just an entry snapshotting that recipe's
    // per-serving macros.
    if (!foodId && hasAmount && !selectedRecipeId) {
      // A meal estimate's Amount now means "how many servings to log" (see
      // applyEstimate), not the food's own serving size — save the catalog
      // food using Gemini's actual per-serving numbers instead of the
      // possibly-scaled form values, so logging "2 servings" doesn't get
      // saved back into the catalog as if one serving were twice the size.
      const mealEstimate = isMealEstimate ? lastEstimate : null;
      try {
        const res = await fetch("/api/foods/custom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            servingSize: mealEstimate ? mealEstimate.servingSize : amountNum,
            servingUnit: mealEstimate ? mealEstimate.servingUnit : form.unit,
            servingLabel: (mealEstimate ? mealEstimate.servingDescription : form.servingLabel.trim()) || undefined,
            category: form.category ?? undefined,
            ...(mealEstimate
              ? {
                  calories: Math.round(mealEstimate.calories),
                  protein: Math.round(mealEstimate.protein),
                  carbs: Math.round(mealEstimate.carbs),
                  fat: Math.round(mealEstimate.fat),
                }
              : macros),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          foodId = data.food.id;
        }
      } catch {
        // Non-fatal — this food still gets staged/logged even if the catalog save failed.
      }
    }

    return {
      name: form.name.trim(),
      serving: label,
      category: form.category,
      foodId,
      ...macros,
    };
  }

  async function handleAddAnother() {
    const staged = await resolveCurrentForm();
    if (!staged) return;
    setStagedFoods((prev) => [...prev, staged]);
    resetFormFields();
  }

  function removeStagedFood(index: number) {
    setStagedFoods((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleFinalSubmit() {
    const current = await resolveCurrentForm();
    const allItems = current ? [...stagedFoods, current] : stagedFoods;
    if (allItems.length === 0) return;

    for (const item of allItems) {
      onSubmit({
        name: item.name,
        serving: item.serving,
        meal,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        foodId: item.foodId,
      });
    }
    onOpenChange(false);
  }

  const header = (
    <div className="flex items-center justify-between px-5 pb-3 pt-3.5 shrink-0">
      <h2 className="text-[17px] font-semibold">Add Food</h2>
      <button
        onClick={() => onOpenChange(false)}
        aria-label="Close"
        className="flex h-7 w-7 items-center justify-center rounded-full bg-ring-track text-muted transition-transform active:scale-90"
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  );

  const body = (
    <div
      className={cn(
        "flex-1 overflow-y-auto no-scrollbar px-5",
        desktop ? "pb-6" : "pb-[calc(env(safe-area-inset-bottom)+96px)]",
      )}
    >
      <SegmentedControl options={MEAL_ORDER} value={meal} onChange={setMeal} className="mb-4" />

      {stagedFoods.length > 0 && (
        <div className="mb-4 flex flex-col gap-1.5">
          {stagedFoods.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded-[12px] border border-separator bg-surface px-3 py-2"
            >
              <CategoryBadge category={item.category} size={22} />
              <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.name}</p>
              <div className="flex shrink-0 items-center gap-1.5">
                <MacroLetterBadge letter="P" value={item.protein} color="var(--protein)" />
                <MacroLetterBadge letter="C" value={item.carbs} color="var(--carbs)" />
                <MacroLetterBadge letter="F" value={item.fat} color="var(--fat)" />
              </div>
              <span className="w-14 shrink-0 text-right text-[12px] tabular-nums text-muted">
                {Math.round(item.calories)} kcal
              </span>
              <button
                type="button"
                onClick={() => removeStagedFood(index)}
                aria-label={`Remove ${item.name}`}
                className="shrink-0 text-muted-2 transition-transform active:scale-90"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mb-3 flex gap-1.5">
        <button
          type="button"
          onClick={() => changeMode("search")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
            mode === "search" ? "border-accent bg-accent/10 text-accent" : "border-separator bg-surface text-muted",
          )}
        >
          <Search size={13} />
          Search
        </button>
        <button
          type="button"
          onClick={() => changeMode("describe")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
            mode === "describe" ? "border-accent bg-accent/10 text-accent" : "border-separator bg-surface text-muted",
          )}
        >
          <Sparkles size={13} />
          Describe it
        </button>
        <button
          type="button"
          onClick={() => changeMode("recipe")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
            mode === "recipe" ? "border-accent bg-accent/10 text-accent" : "border-separator bg-surface text-muted",
          )}
        >
          <ChefHat size={13} />
          Recipes
        </button>
      </div>

      {/* `layout` lets this box smoothly resize as the mode switches between
          very differently-sized content (a textarea vs. a results list)
          instead of snapping straight to the new height. `popLayout` takes
          the exiting mode out of flow immediately so the incoming one's
          layout animation isn't blocked waiting for it to finish fading. */}
      <motion.div layout transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}>
        <AnimatePresence mode="popLayout" initial={false} custom={modeDirection}>
          {mode === "describe" && (
            <motion.div
              key="describe"
              layout
              custom={modeDirection}
              variants={modeSlideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="mb-5 flex flex-col gap-2">
                <div className="flex items-start gap-2 rounded-[12px] bg-ring-track px-3 py-2.5">
                  <Sparkles size={15} className="mt-0.5 text-muted-2 shrink-0" />
                  <textarea
                    value={describeText}
                    onChange={(e) => setDescribeText(e.target.value)}
                    placeholder="e.g. 1 cup of sinigang na baboy"
                    rows={4}
                    className="w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-muted-2"
                  />
                  <label className="mt-0.5 shrink-0 text-muted-2 transition-transform active:scale-90">
                    <Camera size={17} />
                    <input type="file" accept="image/*" capture="environment" onChange={handleImageSelect} className="hidden" />
                  </label>
                </div>

                {image && (
                  <div className="flex items-center gap-2 rounded-[12px] border border-separator bg-surface px-3 py-2">
                    <img src={image.previewUrl} alt="Attached photo" className="h-10 w-10 shrink-0 rounded-[8px] object-cover" />
                    <p className="min-w-0 flex-1 truncate text-[12px] text-muted">Photo attached</p>
                    <button
                      type="button"
                      onClick={() => setImage(null)}
                      aria-label="Remove photo"
                      className="shrink-0 text-muted-2 transition-transform active:scale-90"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}

                <Button variant="secondary" className="w-full" disabled={!canEstimate || estimating} onClick={handleEstimate}>
                  {estimating && <Loader2 size={14} className="animate-spin" />}
                  {estimating ? "Asking AI…" : "Ask AI"}
                </Button>

                {estimateError && (
                  <p className="px-1 text-[12px]" style={{ color: "var(--calories)" }}>
                    {estimateError}
                  </p>
                )}

                {lastEstimate && !estimateError && (
                  <div className="rounded-[12px] border border-separator bg-surface px-3 py-2.5">
                    <p className="text-[12px] font-medium capitalize">
                      {lastEstimate.confidence} confidence · {lastEstimate.servingDescription}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted">{lastEstimate.notes}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {mode === "search" && (
            <motion.div
              key="search"
              layout
              custom={modeDirection}
              variants={modeSlideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="mb-4 flex items-center gap-2 rounded-[12px] bg-ring-track px-3 py-2.5">
                <Search size={15} className="text-muted-2 shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search or enter food name"
                  className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-2"
                />
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  disabled={scanning}
                  aria-label="Scan a barcode"
                  className="shrink-0 text-muted-2 transition-transform active:scale-90 disabled:opacity-50"
                >
                  {scanning ? <Loader2 size={17} className="animate-spin" /> : <ScanBarcode size={17} />}
                </button>
              </div>

              {!isSearching && recentFoods.length > 0 && (
                <div className="mb-5 -mx-5 overflow-x-auto no-scrollbar">
                  <p className="mb-2 px-5 text-[12px] font-medium text-muted">Recently logged</p>
                  <div className="flex gap-2 px-5">
                    {recentFoods.map((entry) => (
                      <button
                        key={entry.name}
                        onClick={() => applySuggestion(entry)}
                        className={cn(
                          "max-w-40 shrink-0 truncate rounded-full border py-1.5 pl-3 pr-4 text-[13px] font-medium transition-transform active:scale-95",
                          form.name === entry.name
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-separator bg-surface text-foreground",
                        )}
                      >
                        {entry.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isSearching && (
                <div className="mb-5 flex flex-col gap-2">
                  {searching && <p className="px-1 text-[12px] text-muted-2">Searching…</p>}

                  {!searching && searchWarnings.length > 0 && (
                    <p className="px-1 text-[12px]" style={{ color: "var(--calories)" }}>
                      {searchWarnings.join(" · ")}
                      {searchResults.length > 0 ? " — results may be incomplete." : " Try again in a moment."}
                    </p>
                  )}

                  {!searching && searchResults.length > 0 && (
                    <div className="no-scrollbar flex max-h-56 flex-col gap-1.5 overflow-y-auto">
                      {searchResults.map((food) => (
                        <button
                          key={food.id}
                          type="button"
                          onClick={() => applyFoodResult(food)}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2.5 text-left transition-transform active:scale-[0.98]",
                            selectedFoodId === food.id
                              ? "border-accent bg-accent/10"
                              : "border-separator bg-surface",
                          )}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <CategoryBadge category={food.category} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[14px] font-medium">{food.name}</p>
                              <p className="truncate text-[12px] text-muted">
                                {food.brand ? `${food.brand} · ` : ""}
                                {FOOD_SOURCE_LABEL[food.source]}
                              </p>
                            </div>
                          </div>
                          <p className="max-w-[35%] shrink-0 truncate text-right text-[12px] tabular-nums text-muted">
                            {formatFoodStat(food)}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {!searching && searchWarnings.length === 0 && searchResults.length === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setDescribeText(query);
                        changeMode("describe");
                      }}
                      className="px-1 text-left text-[12px] font-medium text-accent"
                    >
                      Can&apos;t find it, try asking AI
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {mode === "recipe" && (
            <motion.div
              key="recipe"
              layout
              custom={modeDirection}
              variants={modeSlideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="mb-4 flex items-center gap-2 rounded-[12px] bg-ring-track px-3 py-2.5">
                <ChefHat size={15} className="text-muted-2 shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your recipes"
                  className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-2"
                />
              </div>

              {isSearching && (
                <div className="mb-5 flex flex-col gap-2">
                  {searchingRecipes && <p className="px-1 text-[12px] text-muted-2">Searching…</p>}

                  {!searchingRecipes && recipeResults.length > 0 && (
                    <div className="no-scrollbar flex max-h-56 flex-col gap-1.5 overflow-y-auto">
                      {recipeResults.map((recipe) => (
                        <button
                          key={recipe.id}
                          type="button"
                          onClick={() => applyRecipeResult(recipe)}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2.5 text-left transition-transform active:scale-[0.98]",
                            selectedRecipeId === recipe.id
                              ? "border-accent bg-accent/10"
                              : "border-separator bg-surface",
                          )}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ring-track text-muted">
                              <ChefHat size={14} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="min-w-0 flex-1 truncate text-[14px] font-medium">{recipe.name}</p>
                                {recipe.isPublic && (
                                  <Globe2 size={11} className="shrink-0 text-muted-2" aria-label="Public recipe" />
                                )}
                              </div>
                              <p className="truncate text-[12px] text-muted">
                                {recipe.isOwner ? `${recipe.servings} servings` : `by ${recipe.ownerName}`}
                              </p>
                            </div>
                          </div>
                          <p className="shrink-0 text-[12px] tabular-nums text-muted">
                            {Math.round(recipe.macros.perServingCalories)} kcal/serving
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {!searchingRecipes && recipeResults.length === 0 && (
                    <p className="px-1 text-[12px] text-muted-2">
                      No recipes found — create one from the Recipes tab.
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className={cn("flex flex-col gap-3", desktop && "lg:grid lg:grid-cols-2 lg:gap-x-4")}>
        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className="text-[12px] font-medium text-muted">Food name</span>
          <input
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Chicken Caesar Salad"
            className="rounded-[12px] bg-ring-track px-3 py-2.5 text-[15px] font-medium outline-none placeholder:text-muted-2 placeholder:font-normal focus:ring-2 focus:ring-accent/50"
          />
        </label>

        <div className="grid grid-cols-[1fr_auto] gap-3 lg:col-span-2">
          <NumericField
            label="Amount"
            value={form.amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            onStep={(delta) => handleAmountChange(String(Math.max(0, (Number(form.amount) || 0) + delta)))}
            placeholder="0"
          />
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-muted">Unit</span>
            {baseline || selectedRecipeId || form.category === "meal" ? (
              // A catalog pick's unit is intrinsic to its stored per-100 data —
              // shown, not editable, so it can't be reinterpreted (e.g. "100g" of
              // chicken relabeled as "100 pcs"). Same reasoning for a recipe pick
              // or any whole-dish pick (a fresh AI estimate, a previously-saved
              // meal found via search, or re-applied from a "Recently logged"
              // chip): "servings" isn't one of g/ml/pcs, so the field is locked
              // rather than letting it be switched to something that implies it
              // can. `form.category === "meal"` alone covers all of those, since
              // every pick path that represents a whole dish sets it.
              <div className="flex h-full items-center rounded-[12px] bg-ring-track px-3 py-1.5 text-[13px] font-medium text-muted">
                {selectedRecipeId || form.category === "meal" ? "serving" : form.unit}
              </div>
            ) : (
              <SegmentedControl options={UNIT_OPTIONS} value={form.unit} onChange={handleUnitChange} />
            )}
          </label>
        </div>

        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className="text-[12px] font-medium text-muted">Serving label (optional)</span>
          <input
            value={form.servingLabel}
            onChange={(e) => setForm((f) => ({ ...f, servingLabel: e.target.value }))}
            placeholder="e.g. 1 large egg"
            className="rounded-[12px] bg-ring-track px-3 py-2.5 text-[15px] outline-none placeholder:text-muted-2 focus:ring-2 focus:ring-accent/50"
          />
        </label>

        <div className="lg:col-span-2">
          <NumericField
            label="Calories"
            unit="kcal"
            color="var(--calories)"
            value={form.calories}
            onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value }))}
            placeholder="0"
          />
        </div>

        <div className="grid grid-cols-3 gap-3 lg:col-span-2">
          <NumericField
            label="Protein"
            unit="g"
            color="var(--protein)"
            value={form.protein}
            onChange={(e) => setForm((f) => ({ ...f, protein: e.target.value }))}
            placeholder="0"
          />
          <NumericField
            label="Carbs"
            unit="g"
            color="var(--carbs)"
            value={form.carbs}
            onChange={(e) => setForm((f) => ({ ...f, carbs: e.target.value }))}
            placeholder="0"
          />
          <NumericField
            label="Fat"
            unit="g"
            color="var(--fat)"
            value={form.fat}
            onChange={(e) => setForm((f) => ({ ...f, fat: e.target.value }))}
            placeholder="0"
          />
        </div>
      </div>
    </div>
  );

  const totalToLog = stagedFoods.length + (canSubmit ? 1 : 0);
  const footerButtons = (
    <div className="flex gap-2">
      {canSubmit && (
        <Button variant="secondary" size="lg" className="flex-1" onClick={handleAddAnother}>
          Add another
        </Button>
      )}
      <Button
        size="lg"
        className={canSubmit ? "flex-1" : "w-full"}
        disabled={totalToLog === 0}
        onClick={handleFinalSubmit}
      >
        {totalToLog > 1 ? `Log ${totalToLog} to ${meal}` : `Add to ${meal}`}
      </Button>
    </div>
  );

  const footer = desktop ? (
    <div className="border-t border-separator px-5 pt-4 pb-5">{footerButtons}</div>
  ) : (
    <div className="absolute inset-x-0 bottom-0 border-t border-separator bg-surface-elevated px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      {footerButtons}
    </div>
  );

  return (
    <>
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => onOpenChange(false)}
          />

          {desktop ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Add food"
                className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-[24px] bg-surface-elevated shadow-[var(--shadow-sheet)]"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 4 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              >
                {header}
                {body}
                {footer}
              </motion.div>
            </div>
          ) : (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Add food"
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-[24px] bg-surface-elevated shadow-[var(--shadow-sheet)]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", duration: 0.45, bounce: 0.05 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.55 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 600) {
                  onOpenChange(false);
                }
              }}
            >
              <div className="flex justify-center pt-2.5 pb-1 shrink-0">
                <div className="h-1.5 w-9 rounded-full bg-separator-opaque" />
              </div>
              {header}
              {body}
              {footer}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>

    <BarcodeScanner
      open={scannerOpen}
      onClose={() => setScannerOpen(false)}
      onDetected={handleBarcodeDetected}
    />
    </>
  );
}

