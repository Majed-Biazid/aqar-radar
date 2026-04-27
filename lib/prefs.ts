"use client";

/**
 * User preferences — persisted to localStorage, read on first paint so the
 * app honors them without a flash of defaults. Single source of truth for
 * "what should X default to / display as" across the app.
 */

import { useEffect, useState } from "react";
import type { Filters } from "./types";

const STORAGE_KEY = "radar.prefs.v1";

export type FilterMode = "inline" | "drawer";
export type ViewMode = "split" | "list" | "map";

export type Prefs = {
  filterMode: FilterMode;
  /** Last-used split/list/map view — restored on reload. */
  view: ViewMode;
  /** Whether the saved-only toggle is active. */
  savedOnly: boolean;
  defaultSort: Filters["sort"];
  defaultAge: Filters["ageMode"];
  defaultPriceMin: number;
  defaultPriceMax: number;
  defaultIncludeGone: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  filterMode: "inline",
  view: "split",
  savedOnly: false,
  defaultSort: "price-asc",
  defaultAge: "any",
  defaultPriceMin: 28000,
  defaultPriceMax: 40000,
  defaultIncludeGone: false,
};

function readPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(p: Prefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // private browsing / quota — silently ignore
  }
}

/**
 * usePrefs — reactive accessor.
 * Reads synchronously on mount (so SSR HTML matches first client render),
 * persists on every change, and broadcasts updates to other tabs via
 * the storage event.
 */
export function usePrefs(): {
  prefs: Prefs;
  setPrefs: (next: Partial<Prefs>) => void;
  reset: () => void;
} {
  const [prefs, setLocal] = useState<Prefs>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLocal(readPrefs());
    setHydrated(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLocal(readPrefs());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPrefs = (patch: Partial<Prefs>) => {
    setLocal((curr) => {
      const next = { ...curr, ...patch };
      if (hydrated) writePrefs(next);
      return next;
    });
  };

  const reset = () => {
    setLocal(DEFAULT_PREFS);
    if (hydrated) writePrefs(DEFAULT_PREFS);
  };

  return { prefs, setPrefs, reset };
}

/** Build a Filters object from prefs (used as initial state on page load). */
export function filtersFromPrefs(prefs: Prefs, allDistrictIds: string[]): Filters {
  return {
    districts: allDistrictIds,
    priceMin: prefs.defaultPriceMin,
    priceMax: prefs.defaultPriceMax,
    ageMode: prefs.defaultAge,
    includeGone: prefs.defaultIncludeGone,
    sort: prefs.defaultSort,
    query: "",
  };
}
