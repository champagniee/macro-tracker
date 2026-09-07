"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

// A small centered confirm prompt — deliberately not another bottom sheet
// like AddFoodSheet/EditGoalsSheet, since those are for multi-field forms;
// a yes/no confirmation reads fine centered on both mobile and desktop.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCancel}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-label={title}
              className="w-full max-w-xs rounded-[20px] bg-surface-elevated p-5 shadow-[var(--shadow-sheet)]"
              initial={{ opacity: 0, scale: 0.95, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            >
              <h2 className="text-[16px] font-semibold">{title}</h2>
              {description && <p className="mt-1.5 text-[13px] leading-5 text-muted">{description}</p>}
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={onCancel}>
                  {cancelLabel}
                </Button>
                <Button variant={variant === "danger" ? "danger" : "primary"} className="flex-1" onClick={onConfirm}>
                  {confirmLabel}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
