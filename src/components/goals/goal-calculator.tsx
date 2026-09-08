"use client";

import { useState } from "react";
import { Calculator, ChevronDown } from "lucide-react";
import { NumericField } from "@/components/ui/numeric-field";
import { Button } from "@/components/ui/button";
import { Collapse } from "@/components/ui/collapse";
import {
  calculateGoals,
  lbToKg,
  inToCm,
  ACTIVITY_LEVEL_LABELS,
  type Sex,
  type ActivityLevel,
  type GoalDirection,
} from "@/lib/goals/calculate-goals";
import type { MacroGoals } from "@/lib/types";

const SEX_OPTIONS = ["Male", "Female"] as const;
const UNIT_OPTIONS = ["Metric", "Imperial"] as const;
const GOAL_OPTIONS = ["Lose", "Maintain", "Gain"] as const;

const ACTIVITY_LEVELS = Object.keys(ACTIVITY_LEVEL_LABELS) as ActivityLevel[];

interface GoalCalculatorProps {
  onCalculate: (goals: MacroGoals) => void;
}

interface DropdownProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly T[];
  labels?: Record<T, string>;
}

// Every field in this panel is a plain <select> — deliberately, not
// SegmentedControl toggles — for a more minimal footprint in the modal.
// `appearance-none` drops the browser's own chevron (which sits flush
// against the edge with no way to pad it) in favor of a real icon we can
// actually position.
function Dropdown<T extends string>({ label, value, onChange, options, labels }: DropdownProps<T>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-medium text-muted">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="w-full appearance-none rounded-[12px] bg-ring-track py-2.5 pl-3 pr-9 text-[13px] outline-none"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {labels ? labels[option] : option}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-2"
        />
      </div>
    </label>
  );
}

export function GoalCalculator({ onCalculate }: GoalCalculatorProps) {
  const [open, setOpen] = useState(false);
  const [sex, setSex] = useState<(typeof SEX_OPTIONS)[number]>("Male");
  const [goal, setGoal] = useState<(typeof GOAL_OPTIONS)[number]>("Maintain");
  const [units, setUnits] = useState<(typeof UNIT_OPTIONS)[number]>("Metric");
  const weightUnit = units === "Metric" ? "kg" : "lb";
  const heightUnit = units === "Metric" ? "cm" : "in";
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  const canCalculate = Number(age) > 0 && Number(weight) > 0 && Number(height) > 0;

  function handleCalculate() {
    if (!canCalculate) return;
    const weightKg = weightUnit === "lb" ? lbToKg(Number(weight)) : Number(weight);
    const heightCm = heightUnit === "in" ? inToCm(Number(height)) : Number(height);

    const goals = calculateGoals({
      sex: sex.toLowerCase() as Sex,
      age: Number(age),
      weightKg,
      heightCm,
      activityLevel,
      goalDirection: goal.toLowerCase() as GoalDirection,
    });
    onCalculate(goals);
    // Values are already copied up into the parent goal form — no reason to
    // keep this panel's own Calculate/Close buttons sitting directly above
    // the form's Save/Reset once there's nothing left to do here.
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {!open && (
        <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
          <Calculator size={16} />
          Calculate Target Macros
        </Button>
      )}

      <Collapse open={open}>
        <div className="flex flex-col gap-3 rounded-[12px] border border-separator bg-surface p-3">
          <p className="text-[11px] leading-4 text-muted-2">
            Uses the Mifflin-St Jeor formula on your stats, scaled by activity level — a fixed
            calculation, not a guess.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Dropdown label="Sex" value={sex} onChange={setSex} options={SEX_OPTIONS} />
            <Dropdown label="Units" value={units} onChange={setUnits} options={UNIT_OPTIONS} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <NumericField label="Age" unit="yrs" value={age} onChange={(e) => setAge(e.target.value)} />
            <NumericField
              label="Weight"
              unit={weightUnit}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
            <NumericField
              label="Height"
              unit={heightUnit}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>

          <Dropdown
            label="Activity level"
            value={activityLevel}
            onChange={setActivityLevel}
            options={ACTIVITY_LEVELS}
            labels={ACTIVITY_LEVEL_LABELS}
          />

          <Dropdown label="Goal" value={goal} onChange={setGoal} options={GOAL_OPTIONS} />

          <div className="mt-1 flex gap-2">
            <Button className="flex-1" onClick={handleCalculate} disabled={!canCalculate}>
              Calculate Goals
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Collapse>
    </div>
  );
}
