"use client";

import { motion } from "motion/react";
import type { FoodEntry } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface FoodRowProps {
  entry: FoodEntry;
  onDelete: (id: string) => void;
}

export function FoodRow({ entry, onDelete }: FoodRowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className="group flex items-center justify-between gap-3 px-4 py-3 active:bg-black/[0.02] dark:active:bg-white/[0.04]"
    >
      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium">{entry.name}</p>
        <p className="truncate text-[12px] text-muted">
          {entry.serving} · P{formatNumber(entry.protein)} C{formatNumber(entry.carbs)} F
          {formatNumber(entry.fat)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[15px] font-semibold tabular-nums">
          {formatNumber(entry.calories)}
        </span>
        <button
          onClick={() => onDelete(entry.id)}
          aria-label={`Remove ${entry.name}`}
          className="h-6 w-6 shrink-0 rounded-full text-[13px] text-muted-2 opacity-50 transition-opacity duration-150 group-hover:opacity-100 active:scale-90"
        >
          ✕
        </button>
      </div>
    </motion.div>
  );
}
