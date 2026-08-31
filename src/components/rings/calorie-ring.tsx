"use client";

import { motion, useReducedMotion } from "motion/react";
import { formatNumber } from "@/lib/utils";

interface CalorieRingProps {
  consumed: number;
  goal: number;
  size?: number;
  strokeWidth?: number;
}

export function CalorieRing({
  consumed,
  goal,
  size = 220,
  strokeWidth = 18,
}: CalorieRingProps) {
  const reduceMotion = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(consumed / goal, 1);
  const remaining = Math.max(goal - consumed, 0);
  const over = consumed > goal;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--ring-track)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={over ? "var(--calories)" : "var(--calories)"}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - progress) }}
          transition={
            reduceMotion
              ? { duration: 0.2 }
              : { type: "spring", duration: 1.1, bounce: 0.15 }
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[13px] font-medium text-muted">
          {over ? "Over" : "Remaining"}
        </span>
        <span className="text-[40px] font-semibold tracking-tight tabular-nums">
          {formatNumber(over ? consumed - goal : remaining)}
        </span>
        <span className="text-[13px] text-muted-2">
          of {formatNumber(goal)} kcal
        </span>
      </div>
    </div>
  );
}
