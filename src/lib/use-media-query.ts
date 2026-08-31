"use client";

import { useCallback, useSyncExternalStore } from "react";

function subscribe(query: string, callback: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    useCallback((callback) => subscribe(query, callback), [query]),
    () => window.matchMedia(query).matches,
    () => false,
  );
}
