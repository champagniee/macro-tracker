interface MacroLetterBadgeProps {
  letter: "P" | "C" | "F";
  value: number;
  color: string;
}

// Color-coded "P32"/"C45"/"F12" style label for a food's macros — used as a
// trio in the Add Food sheet's staged-food cards. No ring/shape, just colored
// text, per feedback that the actual numbers read faster than a ring shape.
export function MacroLetterBadge({ letter, value, color }: MacroLetterBadgeProps) {
  return (
    <span className="shrink-0 text-[11px] font-semibold tabular-nums" style={{ color }}>
      {letter}
      {Math.round(value)}
    </span>
  );
}
