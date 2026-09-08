"use client";

import { motion, useReducedMotion } from "motion/react";
import { formatNumber } from "@/lib/utils";

interface CalorieRingProps {
  consumed: number;
  // Omit for a goal-less display (e.g. a recipe's per-serving total, which
  // has nothing to be "remaining" toward) — the ring renders full and the
  // center just shows the raw number instead of remaining/over.
  goal?: number;
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
  const hasGoal = goal !== undefined;
  const progress = hasGoal ? Math.min(consumed / goal, 1) : 1;
  const remaining = hasGoal ? Math.max(goal - consumed, 0) : 0;
  const over = hasGoal && consumed > goal;

  // Once over goal, the main ring reads as "full" (its 0-100% story is
  // done) and a smaller inset ring takes over, tracking the excess as its
  // own lap of the goal amount — so going 2x over goal shows a full inner
  // ring too, not an inner ring stuck at 100% forever.
  const excess = hasGoal ? Math.max(consumed - goal, 0) : 0;
  const overflowStrokeWidth = strokeWidth * 0.6;
  const overflowRadius = radius - strokeWidth / 2 - overflowStrokeWidth / 2 - 4;
  const overflowCircumference = 2 * Math.PI * overflowRadius;
  const overflowProgress = over && hasGoal && goal > 0 ? Math.min(excess / goal, 1) : 0;

  const transition = reduceMotion
    ? { duration: 0.2 }
    : { type: "spring" as const, duration: 1.1, bounce: 0.15 };

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
          stroke="var(--calories)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - progress) }}
          transition={transition}
        />

        {over && (
          <>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={overflowRadius}
              fill="none"
              stroke="var(--ring-track)"
              strokeWidth={overflowStrokeWidth}
            />
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={overflowRadius}
              fill="none"
              stroke="var(--calories-over)"
              strokeWidth={overflowStrokeWidth}
              strokeLinecap="round"
              strokeDasharray={overflowCircumference}
              initial={{ strokeDashoffset: overflowCircumference }}
              animate={{ strokeDashoffset: overflowCircumference * (1 - overflowProgress) }}
              transition={transition}
            />
          </>
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {hasGoal ? (
          <>
            <span
              className="text-[13px] font-medium text-muted"
              style={over ? { color: "var(--calories-over)" } : undefined}
            >
              {over ? "Over" : "Remaining"}
            </span>
            <span className="text-[40px] font-semibold tracking-tight tabular-nums">
              {formatNumber(over ? consumed - goal : remaining)}
            </span>
            <span className="text-[13px] text-muted-2">
              of {formatNumber(goal)} kcal
            </span>
          </>
        ) : (
          <>
            <span className="text-[40px] font-semibold tracking-tight tabular-nums">
              {formatNumber(consumed)}
            </span>
            <span className="text-[13px] text-muted-2">kcal</span>
          </>
        )}
      </div>
    </div>
  );
}
