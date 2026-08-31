"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useLocalStorage } from "@/lib/use-local-storage";
import { DEFAULT_GOALS } from "@/lib/mock-data";
import type { MacroGoals } from "@/lib/types";

interface GoalsContextValue {
  goals: MacroGoals;
  setGoals: (goals: MacroGoals) => void;
}

const GoalsContext = createContext<GoalsContextValue | null>(null);

export function GoalsProvider({ children }: { children: ReactNode }) {
  const [goals, setGoals] = useLocalStorage<MacroGoals>("macro-tracker:goals", DEFAULT_GOALS);
  return <GoalsContext.Provider value={{ goals, setGoals }}>{children}</GoalsContext.Provider>;
}

export function useGoals() {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error("useGoals must be used within GoalsProvider");
  return ctx;
}
