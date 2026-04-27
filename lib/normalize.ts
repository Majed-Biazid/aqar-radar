import type { PricePeriod } from "./types";

export function annualize(raw: number | null, period: PricePeriod): number | null {
  if (raw == null) return null;
  return period === "monthly" ? raw * 12 : raw;
}

export function monthlyEq(annual: number | null): number | null {
  if (annual == null) return null;
  return Math.round(annual / 12);
}

/**
 * Deterministic jitter seeded from the listing ID, in degrees.
 * Keeps each listing in roughly the same spot across refreshes (no jumping pins),
 * while spreading pins within a district to avoid overlap.
 * ±300m ≈ ±0.0027° lat, ±0.003° lng at Dammam's latitude.
 */
export function jitter(id: string): [number, number] {
  let h1 = 2166136261 >>> 0;
  let h2 = 3141592653 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h1 = ((h1 ^ id.charCodeAt(i)) * 16777619) >>> 0;
    h2 = ((h2 ^ id.charCodeAt(i)) * 2654435761) >>> 0;
  }
  const dLat = ((h1 % 10000) / 10000 - 0.5) * 0.0054;  // ±~300m
  const dLng = ((h2 % 10000) / 10000 - 0.5) * 0.006;
  return [dLat, dLng];
}

export function formatSAR(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

export function formatDateArabic(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ar-SA", { day: "numeric", month: "short", year: "numeric" });
}
