"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Saved-listings store.
 *
 * Two-layer persistence:
 *  - localStorage (fast, synchronous; survives reloads, works offline)
 *  - Supabase via /api/saved (durable, cross-device once auth is added)
 *
 * The local cache is the source of truth for synchronous UI reads (e.g.,
 * `has(id)` called on every card render). On hook mount, we pull the
 * server's set and merge — server overrides local so the user's
 * cross-device state wins. Toggles write locally first (optimistic),
 * then fire-and-forget to the API.
 */
const STORAGE_KEY = "radar.saved.v1";

type SavedMap = Record<string, number>; // id → savedAtMs

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

const EMPTY_SNAPSHOT: SavedMap = Object.freeze({}) as SavedMap;

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

if (isBrowser()) {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      invalidateSnapshot();
      notify();
    }
  });
}

let cachedSnapshot: SavedMap = EMPTY_SNAPSHOT;
let cachedSerialized = "";
function getSnapshot(): SavedMap {
  if (!isBrowser()) return EMPTY_SNAPSHOT;
  const raw = readRaw();
  const serialized = JSON.stringify(raw);
  if (serialized === cachedSerialized) return cachedSnapshot;
  cachedSerialized = serialized;
  cachedSnapshot = raw;
  return cachedSnapshot;
}

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

// — server sync ——————————————————————————————————————————————

let didInitialSync = false;
async function syncFromServer(): Promise<void> {
  if (!isBrowser() || didInitialSync) return;
  didInitialSync = true;
  try {
    const r = await fetch("/api/saved", { cache: "no-store" });
    if (!r.ok) return;
    const { ids } = (await r.json()) as { ids: string[] };
    const local = readRaw();
    const merged: SavedMap = {};
    const now = Date.now();
    // Server wins for membership: only ids returned by the server are kept.
    // For ids the server has, preserve the local timestamp if known.
    for (const id of ids) merged[id] = local[id] ?? now;
    // Push any local-only ids back up to the server (one-time reconciliation).
    const localOnly = Object.keys(local).filter((id) => !(id in merged));
    for (const id of localOnly) {
      merged[id] = local[id]; // keep them locally too
      void fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    }
    writeRaw(merged);
    invalidateSnapshot();
    notify();
  } catch {
    // network down — local state continues to work
  }
}

async function pushAdd(id: string): Promise<void> {
  try {
    await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  } catch {
    /* offline — will re-sync on next mount */
  }
}

async function pushRemove(id: string): Promise<void> {
  try {
    await fetch(`/api/saved?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    /* offline — will re-sync on next mount */
  }
}

// — public hook ——————————————————————————————————————————————

export function useSavedListings() {
  const map = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    void syncFromServer();
  }, []);

  function toggle(id: string) {
    const cur = readRaw();
    if (cur[id]) {
      delete cur[id];
      writeRaw(cur);
      invalidateSnapshot();
      notify();
      void pushRemove(id);
    } else {
      cur[id] = Date.now();
      writeRaw(cur);
      invalidateSnapshot();
      notify();
      void pushAdd(id);
    }
  }

  function has(id: string) {
    return Boolean(map[id]);
  }

  function clear() {
    const ids = Object.keys(readRaw());
    writeRaw({});
    invalidateSnapshot();
    notify();
    for (const id of ids) void pushRemove(id);
  }

  const ids = Object.keys(map);
  return { ids, count: ids.length, has, toggle, clear };
}
