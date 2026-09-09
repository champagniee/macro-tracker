"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe2, Plus, Beef, Wheat, Droplet } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { CreateRecipeSheet } from "@/components/recipes/create-recipe-sheet";
import { RecipeDetailSheet } from "@/components/recipes/recipe-detail-sheet";
import { MacroLetterBadge } from "@/components/rings/macro-letter-badge";
import { formatNumber } from "@/lib/utils";

interface RecipeSummary {
  id: string;
  name: string;
  servings: number;
  isPublic: boolean;
  isOwner: boolean;
  ownerName: string;
  ingredientCount: number;
  macros: {
    perServingCalories: number;
    perServingProtein: number;
    perServingCarbs: number;
    perServingFat: number;
  };
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editRecipeId, setEditRecipeId] = useState<string | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  const loadRecipes = useCallback(async () => {
    const res = await fetch("/api/recipes", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setRecipes(data.recipes ?? []);
  }, []);

  useEffect(() => {
    loadRecipes().finally(() => setLoading(false));
  }, [loadRecipes]);

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-2 lg:px-0 lg:pt-0 lg:pb-6">
        <div>
          <p className="text-[13px] font-medium text-muted">Your dishes</p>
          <h1 className="text-[22px] font-semibold tracking-tight lg:text-[28px]">Recipes</h1>
        </div>
        <ThemeToggle className="h-9 w-9 lg:hidden" />
      </header>

      <div className="grid grid-cols-1 gap-3 px-5 pb-28 sm:grid-cols-2 lg:grid-cols-3 lg:px-0 lg:pb-8 lg:gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)]"
            />
          ))
        ) : recipes.length > 0 ? (
          recipes.map((recipe) => (
            <button
              key={recipe.id}
              type="button"
              onClick={() => setSelectedRecipeId(recipe.id)}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] bg-surface p-4 text-left shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="min-w-0 truncate text-[15px] font-medium">{recipe.name}</p>
                  {recipe.isPublic && (
                    <Globe2 size={12} className="shrink-0 text-muted-2" aria-label="Public recipe" />
                  )}
                </div>
                <p className="truncate text-[12px] text-muted">
                  {recipe.ingredientCount} ingredient{recipe.ingredientCount === 1 ? "" : "s"} ·{" "}
                  {recipe.servings} serving{recipe.servings === 1 ? "" : "s"}
                  {!recipe.isOwner && ` · by ${recipe.ownerName}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[13px] font-semibold tabular-nums">
                  {formatNumber(recipe.macros.perServingCalories)} kcal
                </span>
                <div className="flex items-center gap-1.5">
                  <MacroLetterBadge letter="P" value={recipe.macros.perServingProtein} color="var(--protein)" icon={Beef} />
                  <MacroLetterBadge letter="C" value={recipe.macros.perServingCarbs} color="var(--carbs)" icon={Wheat} />
                  <MacroLetterBadge letter="F" value={recipe.macros.perServingFat} color="var(--fat)" icon={Droplet} />
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="col-span-full mx-0 flex flex-col items-center gap-1 rounded-[var(--radius-card)] bg-surface px-5 py-10 text-center shadow-[var(--shadow-card)]">
            <p className="text-[15px] font-medium">No recipes yet</p>
            <p className="text-[13px] text-muted">Tap + to build one from foods you've already added.</p>
          </div>
        )}
      </div>

      <button
        onClick={() => {
          setEditRecipeId(null);
          setSheetOpen(true);
        }}
        aria-label="New recipe"
        className="fixed bottom-[calc(64px+env(safe-area-inset-bottom)+16px)] right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_24px_-6px_rgba(0,122,255,0.5)] transition-transform active:scale-90 lg:bottom-8 lg:right-8"
      >
        <Plus size={26} strokeWidth={2.3} />
      </button>

      <CreateRecipeSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={loadRecipes}
        editRecipeId={editRecipeId}
      />

      <RecipeDetailSheet
        recipeId={selectedRecipeId}
        onOpenChange={(open) => !open && setSelectedRecipeId(null)}
        onChanged={loadRecipes}
        onEdit={(id) => {
          setSelectedRecipeId(null);
          setEditRecipeId(id);
          setSheetOpen(true);
        }}
      />
    </>
  );
}
