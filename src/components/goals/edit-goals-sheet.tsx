"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { GoalEditor } from "./goal-editor";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

interface EditGoalsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Same bottom-sheet/desktop-dialog shell as DayDetailSheet/AddFoodSheet,
// wrapping GoalEditor so goals can be edited from Today's macro card without
// navigating to Settings, while staying the exact same form/save logic.
export function EditGoalsSheet({ open, onOpenChange }: EditGoalsSheetProps) {
  const desktop = useMediaQuery("(min-width: 1024px)");

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

  const header = (
    <div className="flex items-center justify-between px-5 pb-3 pt-3.5 shrink-0">
      <h2 className="text-[17px] font-semibold">Edit Goals</h2>
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
      <GoalEditor onSaved={() => onOpenChange(false)} />
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
                aria-label="Edit Goals"
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
              aria-label="Edit Goals"
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
