"use client";

import { AnimatePresence } from "motion/react";
import { Plus } from "lucide-react";
import type { FoodEntry, MealType } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { FoodRow } from "./food-row";

interface MealSectionProps {
  meal: MealType;
  entries: FoodEntry[];
  // Omit both to render read-only (no add button, no delete buttons, plain
  // empty state) — used by History's day-detail view for past, uneditable days.
  onAdd?: (meal: MealType) => void;
  onDelete?: (id: string) => void;
}

export function MealSection({ meal, entries, onAdd, onDelete }: MealSectionProps) {
  const total = entries.reduce((sum, e) => sum + e.calories, 0);

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
        <h2 className="text-[15px] font-semibold">{meal}</h2>
        <div className="flex items-center gap-3">
          {entries.length > 0 && (
            <span className="text-[13px] tabular-nums text-muted">
              {formatNumber(total)} kcal
            </span>
          )}
          {onAdd && (
            <button
              onClick={() => onAdd(meal)}
              aria-label={`Add food to ${meal}`}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-accent transition-transform active:scale-90"
            >
              <Plus size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="divide-y divide-separator border-t border-separator">
          <AnimatePresence initial={false}>
            {entries.map((entry) => (
              <FoodRow key={entry.id} entry={entry} onDelete={onDelete} />
            ))}
          </AnimatePresence>
        </div>
      ) : onAdd ? (
        <button
          onClick={() => onAdd(meal)}
          className="w-full border-t border-separator px-4 py-3 text-left text-[13px] text-muted-2 transition-colors active:bg-black/[0.02] dark:active:bg-white/[0.04]"
        >
          No food logged yet — tap to add
        </button>
      ) : (
        <p className="w-full border-t border-separator px-4 py-3 text-[13px] text-muted-2">Nothing logged</p>
      )}
    </section>
  );
}
