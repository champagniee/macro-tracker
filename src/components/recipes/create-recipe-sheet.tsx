"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, Search, X, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NumericField } from "@/components/ui/numeric-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FoodSearchInput, type FoodSearchResult } from "@/components/food-search/food-search-input";
import { CategoryBadge } from "@/components/food-search/category-badge";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

const VISIBILITY_OPTIONS = ["Private", "Public"] as const;
// Slides in from the tapped tab's side and out toward the other, rather than
// a plain crossfade — direction comes in via Motion's `custom` prop.
const modeSlideVariants = {
  enter: (direction: number) => ({ opacity: 0, x: direction > 0 ? 16 : -16 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction > 0 ? -16 : 16 }),
};

interface DraftIngredient {
  food: FoodSearchResult;
  amount: string;
  amountLabel: string;
}

interface CreateRecipeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function computeTotals(ingredients: DraftIngredient[]) {
  return ingredients.reduce(
    (acc, ing) => {
      const factor = (Number(ing.amount) || 0) / 100;
      return {
        calories: acc.calories + ing.food.caloriesPer100 * factor,
        protein: acc.protein + ing.food.proteinPer100 * factor,
        carbs: acc.carbs + ing.food.carbsPer100 * factor,
        fat: acc.fat + ing.food.fatPer100 * factor,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function CreateRecipeSheet({ open, onOpenChange, onCreated }: CreateRecipeSheetProps) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [name, setName] = useState("");
  const [servings, setServings] = useState("1");
  const [visibility, setVisibility] = useState<(typeof VISIBILITY_OPTIONS)[number]>("Private");
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // "Describe it" mode — decomposes a whole-dish description into real
  // ingredients via Gemini, each saved as a custom food, then appended to the
  // ingredient list exactly as if picked one at a time from search. Separate
  // loading/error state from submitting since the two are independent steps.
  const [mode, setMode] = useState<"search" | "describe">("search");
  // +1/-1 — Search sits left of Describe it, so the content slides the same
  // direction as the tab that was tapped instead of just crossfading in place.
  const [modeDirection, setModeDirection] = useState(0);
  function changeMode(next: typeof mode) {
    setModeDirection(next === "describe" ? 1 : -1);
    setMode(next);
  }
  const [describeText, setDescribeText] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName("");
      setServings("1");
      setVisibility("Private");
      setIngredients([]);
      setMode("search");
      setDescribeText("");
      setEstimating(false);
      setEstimateError(null);
    }
  }

  async function handleEstimate() {
    if (describeText.trim().length < 2 || estimating) return;
    setEstimating(true);
    setEstimateError(null);
    try {
      const res = await fetch("/api/recipes/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: describeText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't get an estimate");

      setName(data.name);
      setServings(String(data.servings));
      setIngredients((prev) => [
        ...prev,
        ...data.ingredients.map((ing: { food: FoodSearchResult; amount: number; amountLabel: string }) => ({
          food: ing.food,
          amount: String(ing.amount),
          amountLabel: ing.amountLabel,
        })),
      ]);
      setDescribeText("");
    } catch (err) {
      setEstimateError(err instanceof Error ? err.message : "Couldn't get an estimate");
    } finally {
      setEstimating(false);
    }
  }

  function handleAddIngredient(food: FoodSearchResult) {
    setIngredients((prev) => [
      ...prev,
      {
        food,
        amount: food.servingSize ? String(food.servingSize) : "100",
        amountLabel: food.servingLabel ?? "",
      },
    ]);
  }

  function updateIngredient(index: number, patch: Partial<DraftIngredient>) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)));
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  const servingsNum = Number(servings) || 1;
  const totals = computeTotals(ingredients);
  const canSubmit =
    name.trim().length > 0 &&
    servingsNum > 0 &&
    ingredients.length > 0 &&
    ingredients.every((ing) => Number(ing.amount) > 0);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          servings: servingsNum,
          isPublic: visibility === "Public",
          ingredients: ingredients.map((ing) => ({
            foodId: ing.food.id,
            amount: Number(ing.amount),
            amountLabel: ing.amountLabel.trim() || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create recipe");
      toast.success(`Created ${data.recipe.name}`);
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const header = (
    <div className="flex items-center justify-between px-5 pb-3 pt-3.5 shrink-0">
      <h2 className="text-[17px] font-semibold">New Recipe</h2>
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
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-muted">Recipe name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Peanut Butter Sandwich"
            className="rounded-[12px] bg-ring-track px-3 py-2.5 text-[15px] font-medium outline-none placeholder:text-muted-2 placeholder:font-normal focus:ring-2 focus:ring-accent/50"
          />
        </label>

        <div className="flex items-end gap-3">
          <div className="w-32">
            <NumericField
              label="Servings"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              onStep={(delta) => setServings(String(Math.max(1, (Number(servings) || 1) + delta)))}
              min={1}
            />
          </div>
          <div className="flex-1">
            <span className="mb-1 block text-[12px] font-medium text-muted">Visibility</span>
            <SegmentedControl options={VISIBILITY_OPTIONS} value={visibility} onChange={setVisibility} />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-muted">Add ingredients</span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => changeMode("search")}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
                mode === "search" ? "border-accent bg-accent/10 text-accent" : "border-separator bg-surface text-muted",
              )}
            >
              <Search size={12} />
              Search
            </button>
            <button
              type="button"
              onClick={() => changeMode("describe")}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
                mode === "describe" ? "border-accent bg-accent/10 text-accent" : "border-separator bg-surface text-muted",
              )}
            >
              <Sparkles size={12} />
              Describe it
            </button>
          </div>
        </div>

        <motion.div layout transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}>
          <AnimatePresence mode="popLayout" initial={false} custom={modeDirection}>
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
                <FoodSearchInput
                  onSelect={handleAddIngredient}
                  placeholder="Search foods to add"
                  onAskAi={(query) => {
                    changeMode("describe");
                    setDescribeText(query);
                  }}
                />
              </motion.div>
            )}

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
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2 rounded-[12px] bg-ring-track px-3 py-2.5">
                    <Sparkles size={15} className="mt-0.5 text-muted-2 shrink-0" />
                    <textarea
                      value={describeText}
                      onChange={(e) => setDescribeText(e.target.value)}
                      placeholder="e.g. peanut butter sandwich with 2 slices of bread"
                      rows={4}
                      className="w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-muted-2"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    disabled={describeText.trim().length < 2 || estimating}
                    onClick={handleEstimate}
                  >
                    {estimating && <Loader2 size={14} className="animate-spin" />}
                    {estimating ? "Asking AI…" : "Ask AI"}
                  </Button>
                  {estimateError && (
                    <p className="px-1 text-[12px]" style={{ color: "var(--calories)" }}>
                      {estimateError}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {ingredients.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {ingredients.map((ing, index) => (
            <div key={`${ing.food.id}-${index}`} className="rounded-[12px] border border-separator bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <CategoryBadge category={ing.food.category} size={22} />
                  <p className="min-w-0 truncate text-[14px] font-medium">{ing.food.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeIngredient(index)}
                  aria-label={`Remove ${ing.food.name}`}
                  className="shrink-0 text-muted-2 transition-transform active:scale-90"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <NumericField
                  label={`Amount (${ing.food.baseUnit})`}
                  value={ing.amount}
                  onChange={(e) => updateIngredient(index, { amount: e.target.value })}
                  onStep={(delta) =>
                    updateIngredient(index, { amount: String(Math.max(0, (Number(ing.amount) || 0) + delta)) })
                  }
                />
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-2">Label (optional)</span>
                  <input
                    value={ing.amountLabel}
                    onChange={(e) => updateIngredient(index, { amountLabel: e.target.value })}
                    placeholder="e.g. 2 tbsp"
                    className="rounded-[10px] bg-ring-track px-2.5 py-2 text-[14px] outline-none placeholder:text-muted-2 focus:ring-2 focus:ring-accent/50"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {ingredients.length > 0 && (
        <div className="mt-4 rounded-[12px] bg-ring-track px-4 py-3">
          <p className="text-[12px] font-medium text-muted">Per serving ({servingsNum} total)</p>
          <p className="mt-1 text-[15px] font-semibold tabular-nums">
            {Math.round(totals.calories / servingsNum)} kcal
          </p>
          <p className="text-[12px] tabular-nums text-muted">
            P{Math.round(totals.protein / servingsNum)} · C{Math.round(totals.carbs / servingsNum)} · F
            {Math.round(totals.fat / servingsNum)}
          </p>
        </div>
      )}
    </div>
  );

  const footer = desktop ? (
    <div className="border-t border-separator px-5 pt-4 pb-5">
      <Button size="lg" className="w-full" disabled={!canSubmit || submitting} onClick={handleSubmit}>
        {submitting ? "Creating…" : "Create Recipe"}
      </Button>
    </div>
  ) : (
    <div className="absolute inset-x-0 bottom-0 border-t border-separator bg-surface-elevated px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <Button size="lg" className="w-full" disabled={!canSubmit || submitting} onClick={handleSubmit}>
        {submitting ? "Creating…" : "Create Recipe"}
      </Button>
    </div>
  );

  return (
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
                aria-label="New recipe"
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
              aria-label="New recipe"
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
  );
}
