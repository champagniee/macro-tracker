"use client";

import { useState } from "react";
import { toast } from "sonner";
import { NumericField } from "@/components/ui/numeric-field";
import { Button } from "@/components/ui/button";
import { useGoals } from "@/components/goals-provider";
import { DEFAULT_GOALS } from "@/lib/mock-data";
import { GoalCalculator } from "./goal-calculator";
import type { MacroGoals } from "@/lib/types";

function toFormState(goals: MacroGoals) {
  return {
    calories: String(goals.calories),
    protein: String(goals.protein),
    carbs: String(goals.carbs),
    fat: String(goals.fat),
  };
}

interface GoalEditorProps {
  // Called after a successful Save — lets a modal wrapper (Today's Edit
  // Goals sheet) close itself, while Settings (no wrapper) just omits it.
  onSaved?: () => void;
}

// The goal-editing fields + AI calculator, extracted so both the Settings
// page and Today's Edit Goals sheet render identically instead of
// maintaining two copies of the same form/save logic.
export function GoalEditor({ onSaved }: GoalEditorProps) {
  const { goals, setGoals } = useGoals();
  const [form, setForm] = useState(() => toFormState(goals));

  // Sync form fields whenever the goals object itself changes (e.g. a save
  // completing, or hydration from localStorage) without clobbering
  // in-progress typing.
  const [prevGoals, setPrevGoals] = useState(goals);
  if (goals !== prevGoals) {
    setPrevGoals(goals);
    setForm(toFormState(goals));
  }

  // Save only makes sense once the form actually diverges from what's
  // currently stored — there's nothing to persist otherwise, and a save
  // button that's always there invites saving a no-op.
  const savedForm = toFormState(goals);
  const isDirty =
    form.calories !== savedForm.calories ||
    form.protein !== savedForm.protein ||
    form.carbs !== savedForm.carbs ||
    form.fat !== savedForm.fat;

  async function handleSave() {
    try {
      await setGoals({
        calories: Number(form.calories) || DEFAULT_GOALS.calories,
        protein: Number(form.protein) || DEFAULT_GOALS.protein,
        carbs: Number(form.carbs) || DEFAULT_GOALS.carbs,
        fat: Number(form.fat) || DEFAULT_GOALS.fat,
      });
      toast.success("Goals updated");
      onSaved?.();
    } catch {
      toast.error("Couldn't save goals. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
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

      <GoalCalculator
        onCalculate={(calculated) => {
          setForm(toFormState(calculated));
          toast("Goals calculated — review and Save");
        }}
      />

      {isDirty && (
        <Button className="mt-1 w-full" onClick={handleSave}>
          Save Goals
        </Button>
      )}
    </div>
  );
}
