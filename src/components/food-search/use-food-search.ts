"use client";

import { useEffect, useState } from "react";
import type { FoodSearchResult } from "./types";

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

// Shared debounced /api/foods/search fetch — used by both the recipe ingredient
// picker and the Add Food sheet, so they always search exactly the same way.
export function useFoodSearch(query: string) {
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setWarnings([]);
      setLoading(false);
      return;
    }

    // A `cancelled` flag, not AbortController: actually aborting the in-flight
    // fetch produced its own unhandled-rejection race in practice, so a stale
    // request is just left to finish and its result ignored instead.
    let cancelled = false;
    setLoading(true);

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/foods/search?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (!cancelled) {
          setResults(data.results ?? []);
          setWarnings(data.warnings ?? []);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setWarnings([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  return { results, warnings, loading };
}
