"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useFoodSearch } from "./use-food-search";
import { FOOD_SOURCE_LABEL, type FoodSearchResult } from "./types";

export type { FoodSearchResult };

interface FoodSearchInputProps {
  onSelect: (food: FoodSearchResult) => void;
  placeholder?: string;
}

export function FoodSearchInput({ onSelect, placeholder = "Search foods" }: FoodSearchInputProps) {
  const [query, setQuery] = useState("");
  const { results, warnings, loading } = useFoodSearch(query);

  function handleSelect(food: FoodSearchResult) {
    onSelect(food);
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-[12px] bg-ring-track px-3 py-2.5">
        <Search size={15} className="text-muted-2 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-2"
        />
      </div>

      {loading && <p className="px-1 text-[12px] text-muted-2">Searching…</p>}

      {!loading && warnings.length > 0 && (
        <p className="px-1 text-[12px]" style={{ color: "var(--calories)" }}>
          {warnings.join(" · ")}
          {results.length > 0 ? " — results may be incomplete." : " Try again in a moment."}
        </p>
      )}

      {!loading && results.length > 0 && (
        <div className="no-scrollbar flex max-h-64 flex-col gap-1.5 overflow-y-auto">
          {results.map((food) => (
            <button
              key={food.id}
              type="button"
              onClick={() => handleSelect(food)}
              className="flex items-center justify-between gap-3 rounded-[12px] border border-separator bg-surface px-3 py-2.5 text-left transition-transform active:scale-[0.98]"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium">{food.name}</p>
                <p className="truncate text-[12px] text-muted">
                  {food.brand ? `${food.brand} · ` : ""}
                  {FOOD_SOURCE_LABEL[food.source]}
                </p>
              </div>
              <p className="shrink-0 text-[12px] tabular-nums text-muted">
                {Math.round(food.caloriesPer100)} kcal/100{food.baseUnit}
              </p>
            </button>
          ))}
        </div>
      )}

      {!loading && warnings.length === 0 && query.trim().length >= 2 && results.length === 0 && (
        <p className="px-1 text-[12px] text-muted-2">No matches found.</p>
      )}
    </div>
  );
}
