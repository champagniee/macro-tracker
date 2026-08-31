"use client";

import { motion, useReducedMotion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

interface MacroBarProps {
  label: string;
  value: number;
  goal: number;
  unit?: string;
  color: string;
  icon: LucideIcon;
}

export function MacroBar({ label, value, goal, unit = "g", color, icon: Icon }: MacroBarProps) {
  const reduceMotion = useReducedMotion();
  const progress = Math.min(value / goal, 1);

  return (
    <div className="flex flex-1 flex-col gap-2 rounded-[16px] bg-surface p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-1.5">
        <Icon size={14} style={{ color }} strokeWidth={2.5} />
        <span className="text-[12px] font-medium text-muted">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[17px] font-semibold tabular-nums">{formatNumber(value)}</span>
        <span className="text-[12px] text-muted-2">/ {formatNumber(goal)}{unit}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ring-track">
        <motion.div
          className={cn("h-full rounded-full")}
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={
            reduceMotion
              ? { duration: 0.2 }
              : { type: "spring", duration: 0.9, bounce: 0.1, delay: 0.1 }
          }
        />
      </div>
    </div>
  );
}
