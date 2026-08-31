"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface NumericFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  unit?: string;
  color?: string;
}

export function NumericField({ label, unit, color, className, ...props }: NumericFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-medium text-muted" style={color ? { color } : undefined}>
        {label}
      </span>
      <div className="flex items-center gap-1 rounded-[12px] bg-ring-track px-3 py-2 focus-within:ring-2 focus-within:ring-accent/50">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          className={cn(
            "w-full bg-transparent text-[15px] font-medium tabular-nums outline-none placeholder:text-muted-2",
            className,
          )}
          {...props}
        />
        {unit && <span className="text-[12px] text-muted-2">{unit}</span>}
      </div>
    </label>
  );
}
