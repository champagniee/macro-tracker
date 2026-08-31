"use client";

import { MiniRing } from "@/components/rings/mini-ring";
import { HISTORY } from "@/lib/mock-data";
import { formatNumber } from "@/lib/utils";

export default function HistoryPage() {
  return (
    <>
      <header className="px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-2 lg:px-0 lg:pt-0 lg:pb-6">
        <p className="text-[13px] font-medium text-muted">Last 7 days</p>
        <h1 className="text-[22px] font-semibold tracking-tight lg:text-[28px]">History</h1>
      </header>

      <div className="grid grid-cols-1 gap-3 px-5 pb-28 sm:grid-cols-2 lg:grid-cols-3 lg:px-0 lg:pb-8 lg:gap-4">
        {HISTORY.map((day) => {
          const over = day.calories > day.goal;
          const diff = Math.abs(day.calories - day.goal);
          return (
            <div
              key={day.date}
              className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface px-4 py-3.5 shadow-[var(--shadow-card)]"
            >
              <MiniRing progress={day.calories / day.goal} color={over ? "var(--calories)" : "var(--success)"} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">{day.label}</p>
                <p className="text-[12px] text-muted">
                  P{formatNumber(day.protein)} · C{formatNumber(day.carbs)} · F{formatNumber(day.fat)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[15px] font-semibold tabular-nums">{formatNumber(day.calories)}</p>
                <p className="text-[12px] tabular-nums" style={{ color: over ? "var(--calories)" : "var(--success)" }}>
                  {over ? "+" : "-"}
                  {formatNumber(diff)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
