"use client";

import type { InputHTMLAttributes } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface NumericFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  unit?: string;
  color?: string;
  // Opt-in +/- stepper, flanking the input — only Amount uses this today, so
  // it's a prop rather than always-on, leaving Calories/Protein/Carbs/Fat
  // (which don't want a stepper) rendering exactly as before.
  onStep?: (delta: number) => void;
  step?: number;
}

export function NumericField({ label, unit, color, className, onStep, step = 1, ...props }: NumericFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-medium text-muted" style={color ? { color } : undefined}>
        {label}
      </span>
      <div className="flex items-center gap-1 rounded-[12px] bg-ring-track px-2 py-1.5 focus-within:ring-2 focus-within:ring-accent/50">
        {onStep && (
          <button
            type="button"
            onClick={() => onStep(-step)}
            aria-label={`Decrease ${label}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-transform active:scale-90"
          >
            <Minus size={14} />
          </button>
        )}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          className={cn(
            "w-full bg-transparent text-[15px] font-medium tabular-nums outline-none placeholder:text-muted-2",
            onStep && "text-center",
            className,
          )}
          {...props}
        />
        {onStep && (
          <button
            type="button"
            onClick={() => onStep(step)}
            aria-label={`Increase ${label}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-transform active:scale-90"
          >
            <Plus size={14} />
          </button>
        )}
        {unit && <span className="shrink-0 pr-1 text-[12px] text-muted-2">{unit}</span>}
      </div>
    </label>
  );
}
