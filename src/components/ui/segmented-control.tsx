"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface SegmentedControlProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const pillId = useId();
  return (
    <div
      className={cn(
        "relative flex items-center gap-0.5 rounded-[12px] bg-ring-track p-1",
        className,
      )}
      role="tablist"
    >
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option)}
            className={cn(
              "relative z-10 flex-1 whitespace-nowrap rounded-[9px] px-3 py-1.5 text-[13px] font-medium transition-colors",
              active ? "text-foreground" : "text-muted",
            )}
          >
            {active && (
              <motion.span
                layoutId={`segmented-control-pill-${pillId}`}
                className="absolute inset-0 -z-10 rounded-[9px] bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
              />
            )}
            {option}
          </button>
        );
      })}
    </div>
  );
}
