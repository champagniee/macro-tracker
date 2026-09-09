"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { X, Trash2, Pencil, Globe2, Flame, Beef, Wheat, Droplet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { MacroBar } from "@/components/rings/macro-bar";
import { useMediaQuery } from "@/lib/use-media-query";
import { MEAL_ORDER } from "@/lib/mock-data";
import { formatNumber, cn } from "@/lib/utils";
import type { MealType } from "@/lib/types";

interface RecipeIngredient {
  id: string;
  foodName: string;
  foodBrand: string | null;
  amount: number;
  amountLabel: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface RecipeDetail {
  id: string;
  name: string;
  servings: number;
  isPublic: boolean;
  isOwner: boolean;
  ownerName: string;
  ingredients: RecipeIngredient[];
  macros: {
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    perServingCalories: number;
    perServingProtein: number;
    perServingCarbs: number;
    perServingFat: number;
  };
}

interface RecipeDetailSheetProps {
  recipeId: string | null;
  onOpenChange: (open: boolean) => void;
  // Called after a change that the list page needs to reflect (delete, or a
  // visibility flip changing the globe badge/owner line) — same "just
  // re-fetch the list" approach CreateRecipeSheet's onSaved already uses.
  onChanged: () => void;
  // Owner-only — closes this sheet and hands the recipe id back to the list
  // page, which opens CreateRecipeSheet in edit mode for it.
  onEdit: (recipeId: string) => void;
}

// Same bottom-sheet/desktop-dialog shell as DayDetailSheet — recipes no
// longer get their own /recipes/[id] page, viewing one is a modal over the
// list now, consistent with how History views a day.
export function RecipeDetailSheet({ recipeId, onOpenChange, onChanged, onEdit }: RecipeDetailSheetProps) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const router = useRouter();
  const open = recipeId !== null;
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [meal, setMeal] = useState<MealType>("Breakfast");
  const [logging, setLogging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  useEffect(() => {
    if (!recipeId) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setRecipe(null);
    fetch(`/api/recipes/${recipeId}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        setRecipe(data.recipe);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

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

  async function handleLog() {
    if (!recipe) return;
    setLogging(true);
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: recipe.name,
          serving: "1 serving",
          meal,
          calories: Math.round(recipe.macros.perServingCalories),
          protein: Math.round(recipe.macros.perServingProtein),
          carbs: Math.round(recipe.macros.perServingCarbs),
          fat: Math.round(recipe.macros.perServingFat),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to log");
      toast.success(`Logged ${recipe.name} to ${meal}`);
      onOpenChange(false);
      router.push("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLogging(false);
    }
  }

  async function handleVisibilityChange(value: "Private" | "Public") {
    if (!recipe) return;
    const isPublic = value === "Public";
    const previous = recipe.isPublic;
    setRecipe({ ...recipe, isPublic });
    setTogglingVisibility(true);
    try {
      const res = await fetch(`/api/recipes/${recipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success(isPublic ? "Recipe is now public" : "Recipe is now private");
      onChanged();
    } catch {
      setRecipe((r) => (r ? { ...r, isPublic: previous } : r));
      toast.error("Couldn't update visibility. Please try again.");
    } finally {
      setTogglingVisibility(false);
    }
  }

  async function handleDelete() {
    if (!recipe) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/recipes/${recipe.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Recipe deleted");
      onOpenChange(false);
      onChanged();
    } catch {
      toast.error("Couldn't delete this recipe. Please try again.");
      setDeleting(false);
    }
  }

  // A recipe has no daily goal to show progress toward, so the per-serving
  // ring/bars use each macro's own share of that serving's calories instead
  // (4 kcal/g for protein/carbs, 9 kcal/g for fat) — shows the composition
  // of the dish rather than progress toward anything.
  const macroCalorieShare = (() => {
    if (!recipe) return { protein: 0, carbs: 0, fat: 0 };
    const proteinKcal = recipe.macros.perServingProtein * 4;
    const carbsKcal = recipe.macros.perServingCarbs * 4;
    const fatKcal = recipe.macros.perServingFat * 9;
    const total = proteinKcal + carbsKcal + fatKcal;
    if (total <= 0) return { protein: 0, carbs: 0, fat: 0 };
    return { protein: proteinKcal / total, carbs: carbsKcal / total, fat: fatKcal / total };
  })();

  const heading = recipe?.name ?? "";

  const header = (
    <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-3.5 shrink-0">
      <h2 className="min-w-0 truncate text-[17px] font-semibold">{heading}</h2>
      <div className="flex shrink-0 items-center gap-2">
        {recipe?.isOwner && (
          <>
            <button
              onClick={() => onEdit(recipe.id)}
              aria-label="Edit recipe"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-ring-track text-muted transition-transform active:scale-90"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Delete recipe"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-ring-track text-muted transition-transform active:scale-90 disabled:opacity-40"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
        <button
          onClick={() => onOpenChange(false)}
          aria-label="Close"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-ring-track text-muted transition-transform active:scale-90"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );

  const body = (
    <div
      className={cn(
        "flex-1 overflow-y-auto no-scrollbar px-5",
        desktop ? "pb-6" : "pb-[calc(env(safe-area-inset-bottom)+24px)]",
      )}
    >
      {loading ? (
        <div className="flex flex-col gap-3">
          <div className="h-32 animate-pulse rounded-[var(--radius-card)] bg-ring-track" />
          <div className="h-24 animate-pulse rounded-[var(--radius-card)] bg-ring-track" />
        </div>
      ) : notFound || !recipe ? (
        <p className="py-8 text-center text-[14px] text-muted-2">Recipe not found</p>
      ) : (
        <div className="flex flex-col gap-5">
          {!recipe.isOwner && <p className="-mt-1 text-[12px] text-muted">by {recipe.ownerName}</p>}

          <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)]">
            <h3 className="text-[13px] font-semibold text-muted">Ingredients</h3>
            <div className="flex flex-col divide-y divide-separator">
              {recipe.ingredients.map((ing) => (
                <div key={ing.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">{ing.foodName}</p>
                    <p className="text-[12px] text-muted">{ing.amountLabel || `${formatNumber(ing.amount)}g`}</p>
                  </div>
                  <p className="shrink-0 text-[13px] tabular-nums text-muted">{formatNumber(ing.calories)} kcal</p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)]">
            <p className="self-start text-[13px] font-semibold text-muted">Per serving</p>
            <div className="grid w-full grid-cols-2 gap-0.5">
              <MacroBar
                label="Calories"
                value={recipe.macros.perServingCalories}
                progress={1}
                unit="kcal"
                color="var(--calories)"
                icon={Flame}
              />
              <MacroBar
                label="Protein"
                value={recipe.macros.perServingProtein}
                progress={macroCalorieShare.protein}
                color="var(--protein)"
                icon={Beef}
              />
              <MacroBar
                label="Carbs"
                value={recipe.macros.perServingCarbs}
                progress={macroCalorieShare.carbs}
                color="var(--carbs)"
                icon={Wheat}
              />
              <MacroBar
                label="Fat"
                value={recipe.macros.perServingFat}
                progress={macroCalorieShare.fat}
                color="var(--fat)"
                icon={Droplet}
              />
            </div>
            <p className="text-[12px] text-muted-2">
              {recipe.servings} serving{recipe.servings === 1 ? "" : "s"} total
            </p>
          </section>

          {recipe.isOwner && (
            <section className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)]">
              <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
                <Globe2 size={13} />
                Visibility
              </h3>
              <SegmentedControl
                options={["Private", "Public"] as const}
                value={recipe.isPublic ? "Public" : "Private"}
                onChange={handleVisibilityChange}
              />
              <p className="text-[12px] text-muted-2">
                {togglingVisibility
                  ? "Updating…"
                  : recipe.isPublic
                    ? "Anyone can view this recipe and log a serving."
                    : "Only you can see this recipe."}
              </p>
            </section>
          )}

          <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)]">
            <h3 className="text-[13px] font-semibold text-muted">Log a serving</h3>
            <SegmentedControl options={MEAL_ORDER} value={meal} onChange={setMeal} />
            <Button size="lg" className="w-full" disabled={logging} onClick={handleLog}>
              {logging ? "Logging…" : `Log to ${meal}`}
            </Button>
          </section>
        </div>
      )}
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
                aria-label={heading || "Recipe"}
                className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-[24px] bg-surface-elevated shadow-[var(--shadow-sheet)]"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 4 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              >
                {header}
                {body}
              </motion.div>
            </div>
          ) : (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={heading || "Recipe"}
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
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
