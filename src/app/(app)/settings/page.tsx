"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Flame, Beef, Wheat, Droplet } from "lucide-react";
import { toast } from "sonner";
import { NumericField } from "@/components/ui/numeric-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useGoals } from "@/components/goals-provider";
import { useAuth } from "@/components/auth-provider";
import { useIsClient } from "@/lib/use-is-client";
import { DEFAULT_GOALS } from "@/lib/mock-data";
import type { MacroGoals } from "@/lib/types";

const THEME_OPTIONS = ["Light", "Dark", "System"] as const;
type ThemeOption = (typeof THEME_OPTIONS)[number];

function toFormState(goals: MacroGoals) {
  return {
    calories: String(goals.calories),
    protein: String(goals.protein),
    carbs: String(goals.carbs),
    fat: String(goals.fat),
  };
}

export default function SettingsPage() {
  const { goals, setGoals } = useGoals();
  const { theme, setTheme } = useTheme();
  const { user, loading: authLoading, logout } = useAuth();
  const mounted = useIsClient();
  const [form, setForm] = useState(() => toFormState(goals));

  // Sync form fields whenever the goals object itself changes (e.g. Reset,
  // or hydration from localStorage) without clobbering in-progress typing.
  const [prevGoals, setPrevGoals] = useState(goals);
  if (goals !== prevGoals) {
    setPrevGoals(goals);
    setForm(toFormState(goals));
  }

  const themeValue: ThemeOption =
    theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";

  function handleThemeChange(value: ThemeOption) {
    setTheme(value.toLowerCase());
  }

  async function handleSave() {
    try {
      await setGoals({
        calories: Number(form.calories) || DEFAULT_GOALS.calories,
        protein: Number(form.protein) || DEFAULT_GOALS.protein,
        carbs: Number(form.carbs) || DEFAULT_GOALS.carbs,
        fat: Number(form.fat) || DEFAULT_GOALS.fat,
      });
      toast.success("Goals updated");
    } catch {
      toast.error("Couldn't save goals. Please try again.");
    }
  }

  async function handleReset() {
    try {
      await setGoals(DEFAULT_GOALS);
      toast("Goals reset to default");
    } catch {
      toast.error("Couldn't reset goals. Please try again.");
    }
  }

  async function handleLogout() {
    await logout();
    toast("Logged out");
  }

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-2 lg:px-0 lg:pt-0 lg:pb-6">
        <div>
          <p className="text-[13px] font-medium text-muted">Preferences</p>
          <h1 className="text-[22px] font-semibold tracking-tight lg:text-[28px]">Settings</h1>
        </div>
        <ThemeToggle className="h-9 w-9 lg:hidden" />
      </header>

      <div className="flex flex-col gap-5 px-5 pb-28 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-6 lg:px-0 lg:pb-8">
        <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] lg:p-6">
          <div className="flex items-center gap-1.5">
            <Flame size={14} style={{ color: "var(--calories)" }} strokeWidth={2.5} />
            <h2 className="text-[15px] font-semibold">Daily Goals</h2>
          </div>

          <NumericField
            label="Calories"
            unit="kcal"
            value={form.calories}
            onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value }))}
          />
          <div className="grid grid-cols-3 gap-3">
            <NumericField
              label="Protein"
              unit="g"
              color="var(--protein)"
              value={form.protein}
              onChange={(e) => setForm((f) => ({ ...f, protein: e.target.value }))}
            />
            <NumericField
              label="Carbs"
              unit="g"
              color="var(--carbs)"
              value={form.carbs}
              onChange={(e) => setForm((f) => ({ ...f, carbs: e.target.value }))}
            />
            <NumericField
              label="Fat"
              unit="g"
              color="var(--fat)"
              value={form.fat}
              onChange={(e) => setForm((f) => ({ ...f, fat: e.target.value }))}
            />
          </div>

          <div className="mt-1 flex gap-2">
            <Button className="flex-1 lg:flex-none lg:px-8" onClick={handleSave}>
              Save Goals
            </Button>
            <Button variant="secondary" onClick={handleReset}>
              Reset
            </Button>
          </div>
        </section>

        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] lg:p-6">
            <h2 className="text-[15px] font-semibold">Account</h2>
            {authLoading ? (
              <div className="h-9 rounded-[12px] bg-ring-track" />
            ) : user ? (
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-[13px] text-muted">{user.email}</p>
                <Button variant="secondary" size="sm" onClick={handleLogout}>
                  Log out
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] text-muted">You&apos;re not logged in.</p>
                <Link href="/login">
                  <Button size="sm">Log in</Button>
                </Link>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] lg:p-6">
            <h2 className="text-[15px] font-semibold">Appearance</h2>
            {mounted ? (
              <SegmentedControl options={THEME_OPTIONS} value={themeValue} onChange={handleThemeChange} />
            ) : (
              <div className="h-9 rounded-[12px] bg-ring-track" />
            )}
          </section>

          <section className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] lg:p-6">
            <h2 className="text-[15px] font-semibold">About</h2>
            <p className="text-[13px] leading-5 text-muted">
              Your food log and goals sync to your account. Auto-import from recipes and
              photos, plus synced macro lookups, are coming via a connected service.
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-4 text-[12px] text-muted-2">
              <span className="flex items-center gap-1">
                <Beef size={12} style={{ color: "var(--protein)" }} /> Protein
              </span>
              <span className="flex items-center gap-1">
                <Wheat size={12} style={{ color: "var(--carbs)" }} /> Carbs
              </span>
              <span className="flex items-center gap-1">
                <Droplet size={12} style={{ color: "var(--fat)" }} /> Fat
              </span>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
