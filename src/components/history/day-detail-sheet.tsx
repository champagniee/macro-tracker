"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Beef, Wheat, Droplet } from "lucide-react";
import { MealSection } from "@/components/meals/meal-section";
import { FoodEntryDetailSheet } from "@/components/meals/food-entry-detail-sheet";
import { CalorieRing } from "@/components/rings/calorie-ring";
import { MacroBar } from "@/components/rings/macro-bar";
import { useGoals } from "@/components/goals-provider";
import { useMediaQuery } from "@/lib/use-media-query";
import { MEAL_ORDER } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { FoodEntry } from "@/lib/types";

interface DayDetailSheetProps {
  // "YYYY-MM-DD", or null when closed — the full weekday + date heading is
  // derived from this alone, so the caller doesn't need to pass a separate label.
  date: string | null;
  onOpenChange: (open: boolean) => void;
}

// Parsed as UTC midnight rather than local time — entries are bucketed by UTC
// day server-side (see the documented "today" boundary simplification), so
// parsing this as local time could shift the displayed date by one for a user
// west of UTC.
function formatDayHeading(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Read-only day view for History — reuses MealSection/FoodRow exactly as the
// Today page does, just without onAdd/onDelete, since a past day's log isn't
// editable here (only viewable). Also mirrors Today's CalorieRing + MacroBar
// pair so "did I hit my goals that day" reads the same way it does live —
// goals come from the same GoalsProvider Today uses, not the summary
// endpoint's calorie-only figure, so protein/carbs/fat goals are available too.
export function DayDetailSheet({ date, onOpenChange }: DayDetailSheetProps) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const { goals } = useGoals();
  const open = date !== null;
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<FoodEntry | null>(null);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/entries?date=${date}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setEntries(data.entries ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

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

  // Derived from the same entries list being displayed below, rather than
  // trusting a separately-fetched summary total — one source of truth, can't drift.
  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const heading = date ? formatDayHeading(date) : "";

  const header = (
    <div className="flex items-center justify-between px-5 pb-3 pt-3.5 shrink-0">
      <h2 className="text-[17px] font-semibold">{heading}</h2>
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
        desktop ? "pb-6" : "pb-[calc(env(safe-area-inset-bottom)+24px)]",
      )}
    >
      {loading ? (
        <div className="flex flex-col gap-3">
          <div className="h-52 animate-pulse rounded-[var(--radius-card)] bg-ring-track" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-[var(--radius-card)] bg-ring-track" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] bg-surface py-5 shadow-[var(--shadow-card)]">
            <CalorieRing consumed={totals.calories} goal={goals.calories} size={160} strokeWidth={14} />
            <div className="grid w-full grid-cols-3 gap-2 px-4">
              <MacroBar label="Protein" value={totals.protein} goal={goals.protein} color="var(--protein)" icon={Beef} />
              <MacroBar label="Carbs" value={totals.carbs} goal={goals.carbs} color="var(--carbs)" icon={Wheat} />
              <MacroBar label="Fat" value={totals.fat} goal={goals.fat} color="var(--fat)" icon={Droplet} />
            </div>
          </div>

          {entries.length === 0 ? (
            <p className="py-4 text-center text-[14px] text-muted-2">No food logged this day</p>
          ) : (
            <div className="flex flex-col gap-3">
              {MEAL_ORDER.map((meal) => (
                <MealSection
                  key={meal}
                  meal={meal}
                  entries={entries.filter((e) => e.meal === meal)}
                  onSelect={setSelectedEntry}
                />
              ))}
            </div>
          )}
        </div>
      )}
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
                aria-label={heading}
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
              aria-label={heading}
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

    <FoodEntryDetailSheet
      entry={selectedEntry}
      onOpenChange={(entryOpen) => !entryOpen && setSelectedEntry(null)}
    />
    </>
  );
}
