"use client";

import { useState } from "react";
import { Beef, Wheat, Droplet, Plus } from "lucide-react";
import { toast } from "sonner";
import { CalorieRing } from "@/components/rings/calorie-ring";
import { MacroBar } from "@/components/rings/macro-bar";
import { MealSection } from "@/components/meals/meal-section";
import { AddFoodSheet } from "@/components/add-food/add-food-sheet";
import { useGoals } from "@/components/goals-provider";
import { useLocalStorage } from "@/lib/use-local-storage";
import { INITIAL_ENTRIES, MEAL_ORDER } from "@/lib/mock-data";
import type { FoodEntry, MealType } from "@/lib/types";

const TODAY_LABEL = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(new Date());

export default function TodayPage() {
  const { goals } = useGoals();
  const [entries, setEntries] = useLocalStorage<FoodEntry[]>(
    "macro-tracker:entries",
    INITIAL_ENTRIES,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeMeal, setActiveMeal] = useState<MealType>("Breakfast");

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

  function handleAdd(entry: Omit<FoodEntry, "id">) {
    setEntries((prev) => [...prev, { ...entry, id: crypto.randomUUID() }]);
    toast.success(`Added ${entry.name} to ${entry.meal}`);
  }

  function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-2 lg:px-0 lg:pt-0 lg:pb-6">
        <div>
          <p className="text-[13px] font-medium text-muted">{TODAY_LABEL}</p>
          <h1 className="text-[22px] font-semibold tracking-tight lg:text-[28px]">Today</h1>
        </div>
      </header>

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
        onSubmit={handleAdd}
      />
    </>
  );
}
