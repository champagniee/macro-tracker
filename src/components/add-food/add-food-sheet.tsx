"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { NumericField } from "@/components/ui/numeric-field";
import { QUICK_ADD_SUGGESTIONS, MEAL_ORDER } from "@/lib/mock-data";
import { useMediaQuery } from "@/lib/use-media-query";
import type { FoodEntry, MealType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AddFoodSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMeal: MealType;
  onSubmit: (entry: Omit<FoodEntry, "id">) => void;
}

const emptyForm = { name: "", serving: "", calories: "", protein: "", carbs: "", fat: "" };

export function AddFoodSheet({ open, onOpenChange, defaultMeal, onSubmit }: AddFoodSheetProps) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);

  // Reset the form whenever the sheet transitions to open, without doing it
  // in an effect (avoids an extra render pass just to clear stale fields).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setMeal(defaultMeal);
      setForm(emptyForm);
      setQuery("");
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

  const suggestions = useMemo(() => {
    if (!query.trim()) return QUICK_ADD_SUGGESTIONS;
    return QUICK_ADD_SUGGESTIONS.filter((s) =>
      s.name.toLowerCase().includes(query.trim().toLowerCase()),
    );
  }, [query]);

  const canSubmit = form.name.trim().length > 0 && Number(form.calories) > 0;

  function applySuggestion(s: (typeof QUICK_ADD_SUGGESTIONS)[number]) {
    setForm({
      name: s.name,
      serving: s.serving,
      calories: String(s.calories),
      protein: String(s.protein),
      carbs: String(s.carbs),
      fat: String(s.fat),
    });
  }

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      name: form.name.trim(),
      serving: form.serving.trim() || "1 serving",
      meal,
      calories: Number(form.calories) || 0,
      protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0,
      fat: Number(form.fat) || 0,
    });
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

      <div className="mb-4 flex items-center gap-2 rounded-[12px] bg-ring-track px-3 py-2.5">
        <Search size={15} className="text-muted-2 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search or enter food name"
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-2"
        />
      </div>

      {suggestions.length > 0 && (
        <div className="mb-5 -mx-5 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 px-5">
            {suggestions.map((s) => (
              <button
                key={s.name}
                onClick={() => applySuggestion(s)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-transform active:scale-95",
                  form.name === s.name
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-separator bg-surface text-foreground",
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={cn("flex flex-col gap-3", desktop && "lg:grid lg:grid-cols-2 lg:gap-x-4")}>
        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className="text-[12px] font-medium text-muted">Food name</span>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Chicken Caesar Salad"
            className="rounded-[12px] bg-ring-track px-3 py-2.5 text-[15px] font-medium outline-none placeholder:text-muted-2 placeholder:font-normal focus:ring-2 focus:ring-accent/50"
          />
        </label>

        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className="text-[12px] font-medium text-muted">Serving</span>
          <input
            value={form.serving}
            onChange={(e) => setForm((f) => ({ ...f, serving: e.target.value }))}
            placeholder="e.g. 1 cup"
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

  const footer = desktop ? (
    <div className="border-t border-separator px-5 pt-4 pb-5">
      <Button size="lg" className="w-full" disabled={!canSubmit} onClick={handleSubmit}>
        Add to {meal}
      </Button>
    </div>
  ) : (
    <div className="absolute inset-x-0 bottom-0 border-t border-separator bg-surface-elevated px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <Button size="lg" className="w-full" disabled={!canSubmit} onClick={handleSubmit}>
        Add to {meal}
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
  );
}

