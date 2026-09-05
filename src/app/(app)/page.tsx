"use client";

import { useCallback, useEffect, useState } from "react";
import { Beef, Wheat, Droplet, Plus } from "lucide-react";
import { toast } from "sonner";
import { CalorieRing } from "@/components/rings/calorie-ring";
import { MacroBar } from "@/components/rings/macro-bar";
import { MealSection } from "@/components/meals/meal-section";
import { AddFoodSheet } from "@/components/add-food/add-food-sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { useGoals } from "@/components/goals-provider";
import { MEAL_ORDER } from "@/lib/mock-data";
import type { FoodEntry, MealType } from "@/lib/types";

const TODAY_LABEL = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(new Date());

// Local calendar date, not UTC — matches what the user actually sees as "today".
function localDateString(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function TodayPage() {
  const { goals } = useGoals();
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeMeal, setActiveMeal] = useState<MealType>("Breakfast");

  const loadEntries = useCallback(async () => {
    const res = await fetch(`/api/entries?date=${localDateString(new Date())}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setEntries(data.entries ?? []);
  }, []);

  useEffect(() => {
    loadEntries().finally(() => setLoading(false));
  }, [loadEntries]);

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  function openSheet(meal: MealType) {
    setActiveMeal(meal);
    setSheetOpen(true);
  }

  async function handleAdd(entry: Omit<FoodEntry, "id">) {
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add entry");
      setEntries((prev) => [...prev, data.entry]);
      toast.success(`Added ${entry.name} to ${entry.meal}`);
    } catch {
      toast.error("Couldn't add that food. Please try again.");
    }
  }

  async function handleDelete(id: string) {
    const previous = entries;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setEntries(previous);
      toast.error("Couldn't delete that entry. Please try again.");
    }
  }

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-2 lg:px-0 lg:pt-0 lg:pb-6">
        <div>
          <p className="text-[13px] font-medium text-muted">{TODAY_LABEL}</p>
          <h1 className="text-[22px] font-semibold tracking-tight lg:text-[28px]">Today</h1>
        </div>
        <ThemeToggle className="h-9 w-9 lg:hidden" />
      </header>

      {loading ? (
        <div className="flex flex-col gap-5 px-5 pb-28 lg:grid lg:grid-cols-[360px_1fr] lg:items-start lg:gap-8 lg:px-0 lg:pb-8">
          <div className="h-[360px] animate-pulse rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)] lg:sticky lg:top-8" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:gap-4 xl:grid-cols-2">
            {MEAL_ORDER.map((meal) => (
              <div
                key={meal}
                className="h-24 animate-pulse rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)]"
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 px-5 pb-28 lg:grid lg:grid-cols-[360px_1fr] lg:items-start lg:gap-8 lg:px-0 lg:pb-8">
          <div className="flex flex-col items-center gap-5 rounded-[var(--radius-card)] bg-surface py-6 shadow-[var(--shadow-card)] lg:sticky lg:top-8">
            <CalorieRing consumed={totals.calories} goal={goals.calories} />
            <div className="grid w-full grid-cols-3 gap-2 px-4">
              <MacroBar label="Protein" value={totals.protein} goal={goals.protein} color="var(--protein)" icon={Beef} />
              <MacroBar label="Carbs" value={totals.carbs} goal={goals.carbs} color="var(--carbs)" icon={Wheat} />
              <MacroBar label="Fat" value={totals.fat} goal={goals.fat} color="var(--fat)" icon={Droplet} />
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:gap-4 xl:grid-cols-2">
            {MEAL_ORDER.map((meal) => (
              <MealSection
                key={meal}
                meal={meal}
                entries={entries.filter((e) => e.meal === meal)}
                onAdd={openSheet}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => openSheet("Breakfast")}
        aria-label="Add food"
        className="fixed bottom-[calc(64px+env(safe-area-inset-bottom)+16px)] right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_24px_-6px_rgba(0,122,255,0.5)] transition-transform active:scale-90 lg:bottom-8 lg:right-8"
      >
        <Plus size={26} strokeWidth={2.3} />
      </button>

      <AddFoodSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        defaultMeal={activeMeal}
        entries={entries}
        onSubmit={handleAdd}
      />
    </>
  );
}
