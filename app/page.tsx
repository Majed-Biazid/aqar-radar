"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { FilterPanel } from "@/components/FilterPanel";
import { ListingCard } from "@/components/ListingCard";
import { RefreshButton } from "@/components/RefreshButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DetailDrawer } from "@/components/DetailDrawer";
import { DISTRICTS } from "@/lib/districts";
import type { Filters, Listing, RefreshRun } from "@/lib/types";
import { t } from "@/lib/i18n";
import { useSavedListings } from "@/lib/saved";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center h-full min-h-[500px] rounded-[4px] border font-mono text-[11px]"
      style={{ borderColor: "var(--hairline)", color: "var(--fg-muted)" }}
    >
      map loading…
    </div>
  ),
});

type ApiResponse = {
  listings: Listing[];
  summary: { total: number; active: number; new_labeled: number; price_dropped: number; gone: number };
  latestRun: RefreshRun | null;
};

const DEFAULT_FILTERS: Filters = {
  districts: DISTRICTS.map((d) => d.id),
  priceMin: 28000,
  priceMax: 40000,
  ageMode: "any",
  includeGone: false,
  sort: "price-asc",
  query: "",
};

export default function Home() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [openListing, setOpenListing] = useState<Listing | null>(null);
  // On mobile, default to "list" — the side-by-side split is desktop-first.
  // The view switcher in the header lets you flip to map at any time.
  const [view, setView] = useState<"split" | "list" | "map">("list");
  const [isMobile, setIsMobile] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const saved = useSavedListings();

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const onChange = () => {
      setIsMobile(!mq.matches);
      // First desktop visit: upgrade list → split for the richer view.
      if (mq.matches) setView((v) => (v === "list" ? "split" : v));
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  async function load(f: Filters) {
    setLoading(true);
    const qs = new URLSearchParams({
      districts: f.districts.join(","),
      priceMin: String(f.priceMin),
      priceMax: String(f.priceMax),
      ageMode: f.ageMode,
      includeGone: String(f.includeGone),
    });
    const r = await fetch(`/api/listings?${qs.toString()}`);
    const j: ApiResponse = await r.json();
    setData(j);
    setLoading(false);
  }

  // Only refetch when server-side filters change. `query` and `sort` are
  // applied client-side, so changing them must NOT trigger a network roundtrip.
  useEffect(() => {
    load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.districts.join(","),
    filters.priceMin,
    filters.priceMax,
    filters.ageMode,
    filters.includeGone,
  ]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenListing(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const districtCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of DISTRICTS) counts[d.id] = 0;
    if (!data) return counts;
    for (const l of data.listings) {
      // Count under the logical (possibly text-overridden) district. Match by
      // city-scoped URL pattern so e.g. Dammam:هجر and Dhahran:هجر are kept
      // separate, then fall back to label match for text-overridden listings.
      const byLabel = DISTRICTS.find((d) => d.label === l.district && l.city === d.city);
      const byUrl = DISTRICTS.find(
        (d) => l.url.includes(`/${d.city}/حي-${d.slug}/`)
      );
      const chosen = byLabel ?? byUrl;
      if (chosen) counts[chosen.id]++;
    }
    return counts;
  }, [data]);

  // Apply sort + search client-side (data is small — no need to round-trip)
  const visibleListings = useMemo(() => {
    if (!data) return [];
    const q = filters.query.trim().toLowerCase();
    let rows = data.listings;
    if (savedOnly) {
      const set = new Set(saved.ids);
      rows = rows.filter((l) => set.has(l.id));
    }
    if (q) {
      rows = rows.filter((l) => {
        const hay = [
          l.title,
          l.description,
          l.district,
          l.city,
          String(l.price_annual_sar ?? ""),
          l.price_annual_sar ? String(Math.round(l.price_annual_sar / 12)) : "",
          String(l.area_sqm ?? ""),
          String(l.bedrooms ?? ""),
          l.id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    const sorted = [...rows];
    switch (filters.sort) {
      case "price-asc":
        sorted.sort((a, b) => (a.price_annual_sar ?? Infinity) - (b.price_annual_sar ?? Infinity));
        break;
      case "price-desc":
        sorted.sort((a, b) => (b.price_annual_sar ?? 0) - (a.price_annual_sar ?? 0));
        break;
      case "new-first":
        // Seller-labeled "جديد" rises, then by price ascending within each group
        sorted.sort((a, b) => {
          const aNew = a.is_new === 1 ? 0 : 1;
          const bNew = b.is_new === 1 ? 0 : 1;
          if (aNew !== bNew) return aNew - bNew;
          return (a.price_annual_sar ?? Infinity) - (b.price_annual_sar ?? Infinity);
        });
        break;
      case "newest":
        sorted.sort((a, b) => new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime());
        break;
      case "area-desc":
        sorted.sort((a, b) => (b.area_sqm ?? 0) - (a.area_sqm ?? 0));
        break;
    }
    // Always keep "gone" items last regardless of sort
    sorted.sort((a, b) => (a.status === "gone" ? 1 : 0) - (b.status === "gone" ? 1 : 0));
    return sorted;
  }, [data, filters.sort, filters.query, savedOnly, saved.ids]);

  const lastRefreshed = data?.latestRun?.finished_at || data?.latestRun?.started_at;
  const lastRefreshedHuman = lastRefreshed ? timeAgo(lastRefreshed) : "never";

  return (
    <main
      className="min-h-screen flex flex-col max-w-[1700px] mx-auto px-3 sm:px-5 md:px-8 py-3 md:py-6"
      style={{
        // Safe-area floors — keep notch/home-bar visible.
        paddingInlineStart: "max(env(safe-area-inset-left), 12px)",
        paddingInlineEnd: "max(env(safe-area-inset-right), 12px)",
        paddingBottom: "max(env(safe-area-inset-bottom), var(--s-5))",
        gap: "var(--s-3)",
      }}
    >
      {/* Header — masthead */}
      <header
        className="flex flex-wrap items-end justify-between gap-3 border-b pb-2 md:pb-4"
        style={{ borderColor: "var(--hairline)" }}
      >
        <div className="flex flex-col min-w-0 flex-1" style={{ gap: "var(--s-1)" }}>
          {/* Eyebrow — register identifier (desktop only; redundant with wordmark on mobile) */}
          <div
            className="label-mast hidden md:inline-flex items-center"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 11,
              color: "var(--stone)",
              letterSpacing: "var(--track-wide)",
              textTransform: "none",
            }}
          >
            {t("brand.tag")}
            <span aria-hidden className="ledger-rule" />
            الدمام
            <span aria-hidden className="ledger-rule" />
            الخبر
          </div>

          {/* Wordmark — italic serif "Radar" + Arabic transliteration accent */}
          <h1
            className="leading-none flex items-baseline flex-wrap"
            style={{ gap: "var(--s-2)" }}
          >
            <span
              className="italic"
              style={{
                fontFamily: "var(--font-serif)",
                fontWeight: 600,
                color: "var(--fg)",
                fontSize: "clamp(28px, 6.5vw, 60px)",
                letterSpacing: "-0.02em",
              }}
            >
              Radar
            </span>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 500,
                color: "var(--terracotta)",
                fontSize: "clamp(16px, 2.4vw, 28px)",
                letterSpacing: "-0.01em",
              }}
            >
              رادار
            </span>
            <span
              className="hidden md:inline-flex font-normal"
              style={{
                color: "var(--fg-muted)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "var(--track-std)",
                textTransform: "uppercase",
                marginTop: "var(--s-1)",
              }}
            >
              / Eastern Province Rental Tracker
            </span>
          </h1>

          {/* Stats strip */}
          <div
            className="tabular flex items-center flex-wrap"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--fg-muted)",
              gap: "var(--s-1)",
            }}
          >
            {data ? (
              <>
                <Stat n={data.summary.active} label={t("stats.active")} />
                <span aria-hidden className="ledger-rule" />
                <button
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      ageMode: f.ageMode === "new-only" ? "any" : "new-only",
                    }))
                  }
                  title={
                    filters.ageMode === "new-only"
                      ? "showing only seller-tagged جديد — click to clear"
                      : "show only listings the seller tagged جديد"
                  }
                  className="inline-flex items-baseline gap-1.5 transition-colors hover:underline underline-offset-4"
                  style={{
                    color:
                      filters.ageMode === "new-only" ? "var(--terracotta)" : "inherit",
                  }}
                >
                  <Strong color="var(--terracotta)">{data.summary.new_labeled}</Strong>
                  <span style={{ fontFamily: "var(--font-display)" }}>
                    جديد{filters.ageMode === "new-only" ? " ✓" : ""}
                  </span>
                </button>
                {saved.count > 0 && (
                  <>
                    <span aria-hidden className="ledger-rule" />
                    <button
                      onClick={() => setSavedOnly((v) => !v)}
                      title={savedOnly ? "عرض كل العروض" : "عرض المحفوظات فقط"}
                      className="inline-flex items-baseline gap-1.5 transition-colors hover:underline underline-offset-4"
                      style={{
                        color: savedOnly ? "var(--terracotta)" : "inherit",
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{savedOnly ? "★" : "☆"}</span>
                      <Strong color="var(--terracotta)">{saved.count}</Strong>
                      <span style={{ fontFamily: "var(--font-display)" }}>
                        {t("stats.saved")}{savedOnly ? " ✓" : ""}
                      </span>
                    </button>
                  </>
                )}
                <span aria-hidden className="ledger-rule hidden sm:inline-flex" />
                <span className="hidden sm:inline-flex items-baseline gap-1.5">
                  <Strong color="var(--sage)">{data.summary.price_dropped}</Strong>
                  <span>{t("stats.dropped")}</span>
                </span>
                <span aria-hidden className="ledger-rule hidden md:inline-flex" />
                <span className="hidden md:inline-flex items-baseline gap-1.5">
                  <span>{t("stats.lastScrape")}</span>
                  <Strong>{lastRefreshedHuman}</Strong>
                </span>
              </>
            ) : (
              <span>{t("stats.loading")}</span>
            )}
          </div>
        </div>

        {/* Actions cluster */}
        <div className="flex items-center shrink-0" style={{ gap: "var(--s-2)" }}>
          <ViewSwitcher value={view} onChange={setView} compact={isMobile} />
          <ThemeToggle />
          <RefreshButton onDone={() => load(filters)} />
        </div>
      </header>

      {/* Horizontal filter bar — across the top */}
      <FilterPanel filters={filters} districtCounts={districtCounts} onChange={setFilters} />

      {/* listings | map — single column on mobile, split on desktop */}
      <div
        className="grid gap-4 md:gap-6"
        style={{ gridTemplateColumns: isMobile ? "1fr" : gridFor(view) }}
      >
        {(view === "split" || view === "list" || isMobile) && view !== "map" && (
          <section className="flex flex-col gap-3 min-w-0">
            <div className="flex items-baseline justify-between" style={{ gap: "var(--s-3)" }}>
              <h2
                className="inline-flex items-baseline"
                style={{
                  gap: "var(--s-2)",
                  fontFamily: "var(--font-display)",
                  fontSize: 13,
                  color: "var(--stone)",
                  fontWeight: 500,
                }}
              >
                <span>{t("listings.heading")}</span>
                <span
                  className="tabular"
                  style={{
                    color: "var(--terracotta)",
                    fontFamily: "var(--font-serif)",
                    fontWeight: 600,
                    fontSize: 16,
                  }}
                >
                  {visibleListings.length}
                </span>
                {filters.query && data && (
                  <span
                    className="label label-xs"
                    style={{ color: "var(--fg-muted)", textTransform: "none", letterSpacing: 0 }}
                  >
                    {t("listings.of")} {data.listings.length}
                  </span>
                )}
              </h2>
              {loading && (
                <span
                  className="inline-flex items-center"
                  style={{
                    color: "var(--fg-muted)",
                    gap: 6,
                    fontFamily: "var(--font-display)",
                    fontSize: 11,
                  }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--terracotta)", animation: "pulse 1.4s ease-in-out infinite" }}
                  />
                  {t("stats.loading")}
                </span>
              )}
            </div>
            {data && visibleListings.length === 0 && <EmptyState />}
            <div
              className={
                // split view (with map) → up to 3 cols
                // list view (no map)    → up to 6 cols on wide screens
                view === "split"
                  ? "grid gap-2.5 md:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  : "grid gap-2.5 md:gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
              }
            >
              {visibleListings.map((l, i) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  index={i}
                  onOpen={setOpenListing}
                  onHover={setHoveredId}
                  hovered={hoveredId === l.id}
                />
              ))}
            </div>
          </section>
        )}

        {(view === "map" || (view === "split" && !isMobile)) && (
          <section
            key={view}
            className="md:sticky md:top-4 md:self-start"
            style={{
              height: isMobile ? "calc(100vh - 220px)" : "calc(100vh - 160px)",
              minHeight: isMobile ? 360 : undefined,
            }}
          >
            <MapView
              key={view}
              listings={visibleListings}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              onOpen={setOpenListing}
              selectedDistrictIds={filters.districts}
            />
          </section>
        )}
      </div>

      <DetailDrawer listing={openListing} onClose={() => setOpenListing(null)} />
    </main>
  );
}

function gridFor(view: "split" | "list" | "map"): string {
  if (view === "split") return "minmax(0, 1.15fr) minmax(440px, 1fr)";
  if (view === "list") return "1fr";
  return "1fr";
}

function Strong({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="tabular font-semibold"
      style={{ color: color ?? "var(--fg)", fontFamily: "var(--font-serif)" }}
    >
      {children}
    </span>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <span className="inline-flex items-baseline" style={{ gap: "var(--s-2)" }}>
      <Strong>{n}</Strong>
      <span>{label}</span>
    </span>
  );
}

function ViewSwitcher({
  value,
  onChange,
  compact,
}: {
  value: "split" | "list" | "map";
  onChange: (v: "split" | "list" | "map") => void;
  compact?: boolean;
}) {
  const opts = compact
    ? ([
        { k: "list", label: t("view.list"), glyph: "≡" },
        { k: "map",  label: t("view.map"),  glyph: "◎" },
      ] as const)
    : ([
        { k: "split", label: t("view.split"), glyph: "▦" },
        { k: "list",  label: t("view.list"),  glyph: "≡" },
        { k: "map",   label: t("view.map"),   glyph: "◎" },
      ] as const);
  return (
    <div
      role="tablist"
      className="inline-flex items-center overflow-hidden"
      style={{
        height: 36,
        border: "1px solid var(--hairline)",
        borderRadius: "var(--radius-chip)",
      }}
    >
      {opts.map((o, i) => {
        const active = value === o.k;
        return (
          <button
            key={o.k}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.k)}
            title={o.label}
            className="inline-flex items-center justify-center transition-colors h-full"
            style={{
              padding: "0 12px",
              minWidth: 40,
              background: active ? "var(--surface)" : "transparent",
              color: active ? "var(--fg)" : "var(--fg-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "var(--track-std)",
              borderInlineStart: i === 0 ? "none" : "1px solid var(--hairline)",
            }}
          >
            <span className="hidden md:inline">{o.label}</span>
            <span className="md:hidden" style={{ fontSize: 14, lineHeight: 1 }}>
              {o.glyph}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="text-center flex flex-col items-center"
      style={{
        padding: "var(--s-12) var(--s-6)",
        border: "1px dashed var(--hairline)",
        borderRadius: "var(--radius-tile)",
        gap: "var(--s-3)",
      }}
    >
      <span
        aria-hidden
        style={{
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: 32,
          color: "var(--terracotta)",
          opacity: 0.6,
          lineHeight: 1,
        }}
      >
        ※
      </span>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 18,
          color: "var(--fg)",
          fontWeight: 500,
        }}
      >
        {t("empty.title")}
      </div>
      <div
        className="max-w-[420px]"
        style={{
          color: "var(--fg-muted)",
          fontSize: 12,
          fontFamily: "var(--font-body)",
          lineHeight: 1.6,
        }}
      >
        {t("empty.body")}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}
