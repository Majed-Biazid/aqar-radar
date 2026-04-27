"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Saved-listings store.
 *
 * Persists in localStorage as `radar.saved.v1` = { [listingId]: savedAtMs }.
 * Entries auto-expire 7 days after they were saved — checked on every read,
 * so stale rows can't accumulate. Survives reloads, falls back to in-memory
 * when localStorage is unavailable (private mode, server-side render).
 */
const STORAGE_KEY = "radar.saved.v1";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type SavedMap = Record<string, number>;

function isBrowser() {
  return typeof window !== "undefined";
}

function readRaw(): SavedMap {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return parsed as SavedMap;
    return {};
  } catch {
    return {};
  }
}

function writeRaw(map: SavedMap) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota or disabled — silently ignore */
  }
}

function pruneExpired(map: SavedMap, now: number): SavedMap {
  const out: SavedMap = {};
  let changed = false;
  for (const [id, ts] of Object.entries(map)) {
    if (now - ts < TTL_MS) out[id] = ts;
    else changed = true;
  }
  return changed ? out : map;
}

// Stable empty reference — both the SSR fallback and the initial cache point
// here so successive `getSnapshot` calls return ===-equal until something
// actually changes. (React's useSyncExternalStore requires this contract.)
const EMPTY_SNAPSHOT: SavedMap = Object.freeze({}) as SavedMap;

// Subscriber list for cross-component updates without prop drilling.
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

// Storage events fire when *another tab* changes localStorage; we wire that up
// so saved state syncs across tabs of the same browser.
if (isBrowser()) {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) notify();
  });
}

// Cached snapshot — keyed by serialized state so successive calls return the
// same reference unless data actually changed.
let cachedSnapshot: SavedMap = EMPTY_SNAPSHOT;
let cachedSerialized = "";
function getSnapshot(): SavedMap {
  if (!isBrowser()) return EMPTY_SNAPSHOT;
  const raw = readRaw();
  const pruned = pruneExpired(raw, Date.now());
  if (pruned !== raw) writeRaw(pruned);
  const serialized = JSON.stringify(pruned);
  if (serialized === cachedSerialized) return cachedSnapshot;
  cachedSerialized = serialized;
  cachedSnapshot = pruned;
  return cachedSnapshot;
}

// Force the next getSnapshot to re-read from storage. Called by toggle/clear.
function invalidateSnapshot() {
  cachedSerialized = "";
}

function getServerSnapshot(): SavedMap {
  return EMPTY_SNAPSHOT;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSavedListings() {
  const map = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Periodic re-prune so the count badge ticks down as TTLs expire even if
  // nothing else changes.
  useEffect(() => {
    const i = setInterval(() => {
      invalidateSnapshot();
      notify();
    }, 60_000);
    return () => clearInterval(i);
  }, []);

  function toggle(id: string) {
    const cur = readRaw();
    if (cur[id]) delete cur[id];
    else cur[id] = Date.now();
    writeRaw(cur);
    invalidateSnapshot();
    notify();
  }

  function has(id: string) {
    return Boolean(map[id]);
  }

  function clear() {
    writeRaw({});
    invalidateSnapshot();
    notify();
  }

  const ids = Object.keys(map);
  return { ids, count: ids.length, has, toggle, clear };
}
