"use client";

import { motion, useReducedMotion } from "motion/react";

interface MiniRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export function MiniRing({ progress, size = 44, strokeWidth = 5, color = "var(--calories)" }: MiniRingProps) {
  const reduceMotion = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(progress, 0), 1);

  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--ring-track)" strokeWidth={strokeWidth} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference * (1 - clamped) }}
        transition={reduceMotion ? { duration: 0.2 } : { type: "spring", duration: 0.9, bounce: 0.1 }}
      />
    </svg>
  );
}
