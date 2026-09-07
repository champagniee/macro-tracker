"use client";

import { useEffect, useState } from "react";
import { MiniRing } from "@/components/rings/mini-ring";
import { ThemeToggle } from "@/components/theme-toggle";
import { DayDetailSheet } from "@/components/history/day-detail-sheet";
import { formatNumber } from "@/lib/utils";

interface HistoryDay {
  date: string;
  label: string;
  calories: number;
  goal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<HistoryDay | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/entries/summary?days=7", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setHistory(data.history ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-2 lg:px-0 lg:pt-0 lg:pb-6">
        <div>
          <p className="text-[13px] font-medium text-muted">Last 7 days</p>
          <h1 className="text-[22px] font-semibold tracking-tight lg:text-[28px]">History</h1>
        </div>
        <ThemeToggle className="h-9 w-9 lg:hidden" />
      </header>

      <div className="grid grid-cols-1 gap-3 px-5 pb-28 sm:grid-cols-2 lg:grid-cols-3 lg:px-0 lg:pb-8 lg:gap-4">
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="h-[72px] animate-pulse rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)]"
              />
            ))
          : history.map((day) => {
              const over = day.calories > day.goal;
              const diff = Math.abs(day.calories - day.goal);
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className="flex w-full items-center gap-3 rounded-[var(--radius-card)] bg-surface px-4 py-3.5 text-left shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]"
                >
                  <MiniRing
                    progress={day.goal > 0 ? day.calories / day.goal : 0}
                    color={over ? "var(--calories)" : "var(--success)"}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium">{day.label}</p>
                    <p className="text-[12px] text-muted">
                      P{formatNumber(day.protein)} · C{formatNumber(day.carbs)} · F{formatNumber(day.fat)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[15px] font-semibold tabular-nums">{formatNumber(day.calories)}</p>
                    <p
                      className="text-[12px] tabular-nums"
                      style={{ color: over ? "var(--calories)" : "var(--success)" }}
                    >
                      {over ? "+" : "-"}
                      {formatNumber(diff)}
                    </p>
                  </div>
                </button>
              );
            })}
      </div>

      <DayDetailSheet
        date={selectedDay?.date ?? null}
        onOpenChange={(open) => !open && setSelectedDay(null)}
      />
    </>
  );
}
