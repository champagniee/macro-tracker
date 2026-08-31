"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<Variant, string> = {
  primary: "bg-accent text-white",
  secondary: "bg-surface-elevated text-foreground border border-separator",
  ghost: "bg-transparent text-accent",
  danger: "bg-calories text-white",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-[10px]",
  md: "h-11 px-4 text-[15px] rounded-[14px]",
  lg: "h-13 px-5 text-[17px] rounded-[16px]",
  icon: "h-10 w-10 rounded-full",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 font-medium select-none",
          "transition-transform duration-[120ms] ease-[var(--ease-out-strong)]",
          "active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
