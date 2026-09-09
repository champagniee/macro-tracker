import type { LucideIcon } from "lucide-react";

interface MacroLetterBadgeProps {
  letter: "P" | "C" | "F";
  value: number;
  color: string;
  // Optional — swaps the leading "P"/"C"/"F" letter for a small colored icon
  // (Beef/Wheat/Droplet, matching MacroBar's icon choices) instead. Add Food's
  // staged-food row deliberately keeps the plain-letter default — user
  // feedback there was that the actual numbers read faster than a ring/icon
  // shape — so this only opts in where a caller passes it explicitly.
  icon?: LucideIcon;
}

// Color-coded "P32"/"C45"/"F12" style label for a food's macros — used as a
// trio in the Add Food sheet's staged-food cards, and (with `icon`) the
// recipe list/per-serving cards.
export function MacroLetterBadge({ letter, value, color, icon: Icon }: MacroLetterBadgeProps) {
  return (
    <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold tabular-nums" style={{ color }}>
      {Icon ? <Icon size={11} strokeWidth={2.5} /> : letter}
      {Math.round(value)}
    </span>
  );
}
