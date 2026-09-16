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

// GET /api/recipes?q= — same shape/behavior as useFoodSearch, for the Add
// Food sheet's "Recipes" mode. Own recipes plus everyone else's public ones,
// exactly what the list endpoint already returns.
//
// Unlike useFoodSearch, an empty query is a valid request here rather than a
// no-op: it fetches the full list (own + public), so Recipes mode reads as a
// browsable dropdown of your recipes that also happens to support search,
// rather than a search box that only shows anything once you type. Fetched
// immediately on empty/mount for a snappy initial list; debounced once
// there's a query, same as before.
export function useRecipeSearch(query: string) {
  const [results, setResults] = useState<RecipeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timeout = setTimeout(
      async () => {
        try {
          const url = trimmed ? `/api/recipes?q=${encodeURIComponent(trimmed)}` : "/api/recipes";
          const res = await fetch(url);
          const data = await res.json();
          if (!cancelled) setResults(data.recipes ?? []);
        } catch {
          if (!cancelled) setResults([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      },
      trimmed ? DEBOUNCE_MS : 0,
    );

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  return { results, loading };
}
