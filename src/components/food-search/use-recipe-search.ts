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
//
// `active` is the Add Food sheet's own open state, not "Recipes tab is the
// one showing" — deliberately so the list is fetched the moment the sheet
// opens rather than only once the user taps over to Recipes. Two reasons:
// 1. An empty query doesn't change across a mode switch or a sheet
//    close/reopen, so without *something* in the deps beyond `query`, the
//    very first fetch's result would stick around stale forever (e.g. a
//    recipe created after that never appears without typing a search to
//    force a new request).
// 2. Gating on the tab itself still refetches correctly, but the fetch then
//    only starts once you switch to Recipes — the tab-slide animation
//    finishes at the empty/loading state's height, and the list pops in
//    a few hundred ms later once the request resolves, an out-of-sync jump
//    that reads as a glitch. Keying off the sheet opening instead starts
//    the request while the user's still on the default Search tab, so by
//    the time they actually switch over the list has usually already
//    arrived.
export function useRecipeSearch(query: string, active: boolean) {
  const [results, setResults] = useState<RecipeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
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
  }, [query, active]);

  return { results, loading };
}
