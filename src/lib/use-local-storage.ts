"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

function dispatchChange(key: string) {
  window.dispatchEvent(new CustomEvent(`local-storage:${key}`));
}

function subscribe(key: string, callback: () => void) {
  window.addEventListener(`local-storage:${key}`, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(`local-storage:${key}`, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getServerSnapshot() {
  return null;
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const raw = useSyncExternalStore(
    useCallback((callback) => subscribe(key, callback), [key]),
    useCallback(() => getSnapshot(key), [key]),
    getServerSnapshot,
  );

  const value = useMemo(() => {
    if (raw === null) return initialValue;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initialValue;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  const setValue = useCallback(
    (updater: T | ((prev: T) => T)) => {
      try {
        const currentRaw = getSnapshot(key);
        const current = currentRaw !== null ? (JSON.parse(currentRaw) as T) : initialValue;
        const next = typeof updater === "function" ? (updater as (prev: T) => T)(current) : updater;
        window.localStorage.setItem(key, JSON.stringify(next));
        dispatchChange(key);
      } catch {
        // ignore write failures (private browsing, quota, etc.)
      }
    },
    [key, initialValue],
  );

  return [value, setValue] as const;
}
