"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Trash2, Flame, Beef, Wheat, Droplet } from "lucide-react";
import { MacroBar } from "@/components/rings/macro-bar";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import type { FoodEntry } from "@/lib/types";

interface FoodEntryDetailSheetProps {
  entry: FoodEntry | null;
  onOpenChange: (open: boolean) => void;
  // Omit for a view-only sheet (History's day-detail view, where past
  // entries aren't editable) — same optionality pattern MealSection/FoodRow
  // already use for their own onDelete.
  onDelete?: (id: string) => void;
}

// No fetch needed here unlike RecipeDetailSheet — the entry is already fully
// in memory (it's what's rendered in the meal list), so this is just a
// bigger view of data the caller already has, not a new data load.
export function FoodEntryDetailSheet({ entry, onOpenChange, onDelete }: FoodEntryDetailSheetProps) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const open = entry !== null;

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

  // Same reasoning as the recipe sheet: no daily goal applies to a single
  // logged item, so the bars show each macro's own share of this entry's
  // calories (4 kcal/g protein/carbs, 9 kcal/g fat) rather than progress
  // toward anything.
  const macroCalorieShare = (() => {
    if (!entry) return { protein: 0, carbs: 0, fat: 0 };
    const proteinKcal = entry.protein * 4;
    const carbsKcal = entry.carbs * 4;
    const fatKcal = entry.fat * 9;
    const total = proteinKcal + carbsKcal + fatKcal;
    if (total <= 0) return { protein: 0, carbs: 0, fat: 0 };
    return { protein: proteinKcal / total, carbs: carbsKcal / total, fat: fatKcal / total };
  })();

  const header = (
    <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-3.5 shrink-0">
      <h2 className="min-w-0 truncate text-[17px] font-semibold">{entry?.name ?? ""}</h2>
      <div className="flex shrink-0 items-center gap-2">
        {entry && onDelete && (
          <button
            onClick={() => {
              onDelete(entry.id);
              onOpenChange(false);
            }}
            aria-label={`Remove ${entry.name}`}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-ring-track text-muted transition-transform active:scale-90"
          >
            <Trash2 size={14} />
          </button>
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
      {entry && (
        <div className="flex flex-col gap-3">
          <p className="-mt-1 text-[13px] text-muted">
            {entry.meal} · {entry.serving}
          </p>

          <div className="grid grid-cols-2 gap-0.5">
            <MacroBar label="Calories" value={entry.calories} progress={1} unit="kcal" color="var(--calories)" icon={Flame} />
            <MacroBar
              label="Protein"
              value={entry.protein}
              progress={macroCalorieShare.protein}
              color="var(--protein)"
              icon={Beef}
            />
            <MacroBar
              label="Carbs"
              value={entry.carbs}
              progress={macroCalorieShare.carbs}
              color="var(--carbs)"
              icon={Wheat}
            />
            <MacroBar label="Fat" value={entry.fat} progress={macroCalorieShare.fat} color="var(--fat)" icon={Droplet} />
          </div>
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
                aria-label={entry?.name ?? "Food entry"}
                className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-[24px] bg-surface-elevated shadow-[var(--shadow-sheet)]"
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
              aria-label={entry?.name ?? "Food entry"}
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
