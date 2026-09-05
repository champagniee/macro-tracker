"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_GOALS } from "@/lib/mock-data";
import type { MacroGoals } from "@/lib/types";

interface GoalsContextValue {
  goals: MacroGoals;
  loading: boolean;
  setGoals: (goals: MacroGoals) => Promise<void>;
}

const GoalsContext = createContext<GoalsContextValue | null>(null);

export function GoalsProvider({ children }: { children: ReactNode }) {
  const [goals, setGoalsState] = useState<MacroGoals>(DEFAULT_GOALS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/goals", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.goals) setGoalsState(data.goals);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setGoals = useCallback(async (next: MacroGoals) => {
    const res = await fetch("/api/goals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to update goals");
    setGoalsState(data.goals);
  }, []);

  return (
    <GoalsContext.Provider value={{ goals, loading, setGoals }}>{children}</GoalsContext.Provider>
  );
}

export function useGoals() {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error("useGoals must be used within GoalsProvider");
  return ctx;
}
