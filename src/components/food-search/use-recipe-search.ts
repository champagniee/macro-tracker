"use client";

import { useEffect, useState } from "react";
import type { RecipeMacros } from "@/lib/recipes/macros";

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

export interface RecipeSearchResult {
  id: string;
  name: string;
  servings: number;
  isPublic: boolean;
  isOwner: boolean;
  ownerName: string;
  ingredientCount: number;
  macros: RecipeMacros;
}

// Debounced GET /api/recipes?q= — same shape/behavior as useFoodSearch, for
// the Add Food sheet's "Recipes" mode. Own recipes plus everyone else's
// public ones, exactly what the list endpoint already returns.
export function useRecipeSearch(query: string) {
  const [results, setResults] = useState<RecipeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/recipes?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (!cancelled) setResults(data.recipes ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  return { results, loading };
}
