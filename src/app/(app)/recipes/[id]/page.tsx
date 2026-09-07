"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ThemeToggle } from "@/components/theme-toggle";
import { MEAL_ORDER } from "@/lib/mock-data";
import { formatNumber } from "@/lib/utils";
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

export default function RecipeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [meal, setMeal] = useState<MealType>("Breakfast");
  const [logging, setLogging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/recipes/${params.id}`, { cache: "no-store" })
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
  }, [params.id]);

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
      router.push("/recipes");
    } catch {
      toast.error("Couldn't delete this recipe. Please try again.");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+16px)] lg:px-0 lg:pt-0">
        <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)]" />
      </div>
    );
  }

  if (notFound || !recipe) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 pt-[calc(env(safe-area-inset-top)+16px)] text-center lg:px-0 lg:pt-0">
        <p className="text-[15px] font-medium">Recipe not found</p>
        <Link href="/recipes" className="text-[13px] font-medium text-accent">
          Back to Recipes
        </Link>
      </div>
    );
  }

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-2 lg:px-0 lg:pt-0 lg:pb-6">
        <div className="min-w-0">
          <Link href="/recipes" className="text-[13px] font-medium text-muted">
            ← Recipes
          </Link>
          <h1 className="truncate text-[22px] font-semibold tracking-tight lg:text-[28px]">{recipe.name}</h1>
          {!recipe.isOwner && <p className="text-[12px] text-muted">by {recipe.ownerName}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle className="h-9 w-9 lg:hidden" />
          {recipe.isOwner && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Delete recipe"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-ring-track text-muted transition-transform active:scale-90 disabled:opacity-40"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-5 px-5 pb-28 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-6 lg:px-0 lg:pb-8">
        <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] lg:p-6">
          <h2 className="text-[15px] font-semibold">Ingredients</h2>
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

        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] lg:p-6">
            <h2 className="text-[15px] font-semibold">Per serving</h2>
            <p className="text-[20px] font-semibold tabular-nums">
              {formatNumber(recipe.macros.perServingCalories)} kcal
            </p>
            <p className="text-[13px] tabular-nums text-muted">
              P{formatNumber(recipe.macros.perServingProtein)} · C{formatNumber(recipe.macros.perServingCarbs)} · F
              {formatNumber(recipe.macros.perServingFat)}
            </p>
            <p className="text-[12px] text-muted-2">
              {recipe.servings} serving{recipe.servings === 1 ? "" : "s"} total
            </p>
          </section>

          {recipe.isOwner && (
            <section className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] lg:p-6">
              <h2 className="text-[15px] font-semibold">Visibility</h2>
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

          <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] lg:p-6">
            <h2 className="text-[15px] font-semibold">Log a serving</h2>
            <SegmentedControl options={MEAL_ORDER} value={meal} onChange={setMeal} />
            <Button size="lg" className="w-full" disabled={logging} onClick={handleLog}>
              {logging ? "Logging…" : `Log to ${meal}`}
            </Button>
          </section>
        </div>
      </div>
    </>
  );
}
