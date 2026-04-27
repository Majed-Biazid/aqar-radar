"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { FilterPanel } from "@/components/FilterPanel";
import { ListingCard } from "@/components/ListingCard";
import { RefreshButton } from "@/components/RefreshButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DetailDrawer } from "@/components/DetailDrawer";
import { BrandMark } from "@/components/BrandMark";
import { SettingsButton } from "@/components/SettingsPanel";
import { usePrefs, filtersFromPrefs } from "@/lib/prefs";
import { DISTRICTS } from "@/lib/districts";
import type { Filters, Listing, RefreshRun } from "@/lib/types";
import { t } from "@/lib/i18n";
import { useSavedListings } from "@/lib/saved";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center h-full min-h-[500px]"
      style={{
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--hairline-soft)",
        background: "var(--bg-raised)",
        color: "var(--fg-muted)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
      }}
    >
      جارٍ تحميل الخريطة…
    </div>
  ),
});

type ApiResponse = {
  listings: Listing[];
  summary: { total: number; active: number; new_labeled: number; price_dropped: number; gone: number };
  latestRun: RefreshRun | null;
};

const ALL_DISTRICT_IDS = DISTRICTS.map((d) => d.id);

export default function Home() {
  const { prefs, setPrefs } = usePrefs();
  const [filters, setFilters] = useState<Filters>(() => ({
    districts: ALL_DISTRICT_IDS,
    priceMin: 28000,
    priceMax: 40000,
    ageMode: "any",
    includeGone: false,
    sort: "price-asc",
    query: "",
  }));

  // Apply pref defaults to filters once prefs hydrate from localStorage —
  // but only if the user hasn't started editing (still on factory defaults).
  const [prefsApplied, setPrefsApplied] = useState(false);
  useEffect(() => {
    if (prefsApplied) return;
    setFilters((curr) => {
      const isFactory =
        curr.priceMin === 28000 &&
        curr.priceMax === 40000 &&
        curr.ageMode === "any" &&
        curr.sort === "price-asc" &&
        curr.includeGone === false &&
        curr.query === "";
      if (!isFactory) return curr;
      return filtersFromPrefs(prefs, ALL_DISTRICT_IDS);
    });
    setPrefsApplied(true);
  }, [prefs, prefsApplied]);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [openListing, setOpenListing] = useState<Listing | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const saved = useSavedListings();

  // view + savedOnly are mirrored from prefs so reloading restores the user's
  // last choice. Writing back through setPrefs persists every change.
  const view = prefs.view;
  const setView = (v: typeof prefs.view) => setPrefs({ view: v });
  const savedOnly = prefs.savedOnly;
  const setSavedOnly = (next: boolean | ((prev: boolean) => boolean)) =>
    setPrefs({
      savedOnly: typeof next === "function" ? next(prefs.savedOnly) : next,
    });

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const sync = () => setIsMobile(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
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

  // Only refetch when server-side filters change. `query` and `sort` apply
  // client-side, so they must NOT trigger a network roundtrip.
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
      const byLabel = DISTRICTS.find((d) => d.label === l.district && l.city === d.city);
      const byUrl = DISTRICTS.find(
        (d) => l.url.includes(`/${d.city}/حي-${d.slug}/`)
      );
      const chosen = byLabel ?? byUrl;
      if (chosen) counts[chosen.id]++;
    }
    return counts;
  }, [data]);

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
    sorted.sort((a, b) => (a.status === "gone" ? 1 : 0) - (b.status === "gone" ? 1 : 0));
    return sorted;
  }, [data, filters.sort, filters.query, savedOnly, saved.ids]);

  const lastRefreshed = data?.latestRun?.finished_at || data?.latestRun?.started_at;
  const lastRefreshedHuman = lastRefreshed ? timeAgo(lastRefreshed) : "—";

  return (
    <main
      className="min-h-screen flex flex-col mx-auto"
      style={{
        maxWidth: 1700,
        gap: "var(--s-4)",
        paddingInlineStart: "max(env(safe-area-inset-left), 16px)",
        paddingInlineEnd: "max(env(safe-area-inset-right), 16px)",
        paddingTop: "var(--s-4)",
        paddingBottom: "max(env(safe-area-inset-bottom), var(--s-6))",
      }}
    >
      {/* === Header — masthead ============================================== */}
      <header
        className="flex items-end justify-between gap-3 flex-wrap"
        style={{ paddingBlock: "var(--s-2)" }}
      >
        <div className="flex flex-col min-w-0 flex-1" style={{ gap: 2 }}>
          {/* eyebrow — only desktop */}
          <span
            className="hidden md:inline-flex items-center"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 11,
              fontWeight: 500,
              color: "var(--fg-muted)",
              letterSpacing: "var(--track-std)",
              textTransform: "uppercase",
            }}
          >
            <span style={{ color: "var(--terracotta)", letterSpacing: "var(--track-tight)" }}>
              ◉
            </span>
            <span style={{ marginInline: 8 }}>{t("brand.tag")}</span>
            <span aria-hidden style={{ width: 16, height: 1, background: "var(--hairline)" }} />
            <span style={{ marginInlineStart: 8 }}>{t("brand.cities")}</span>
          </span>

          {/* wordmark — icon + Arabic name only (no English) */}
          <h1
            className="leading-none flex items-center flex-wrap"
            style={{ gap: 14, marginTop: 4 }}
          >
            <BrandMark size={48} ariaLabel="رادار" />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                color: "var(--fg)",
                fontSize: "clamp(34px, 6.5vw, 60px)",
                letterSpacing: "-0.025em",
                lineHeight: 1,
              }}
            >
              رادار
            </span>
          </h1>

          {/* tagline + stats */}
          <div
            className="tabular flex items-center flex-wrap"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 13,
              color: "var(--fg-muted)",
              gap: 10,
              marginTop: 6,
            }}
          >
            {data ? (
              <>
                <Stat n={data.summary.active} label={t("stats.active")} accent="var(--fg)" />
                <Dot />
                <ChipStat
                  active={filters.ageMode === "new-only"}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      ageMode: f.ageMode === "new-only" ? "any" : "new-only",
                    }))
                  }
                  n={data.summary.new_labeled}
                  label={t("stats.new")}
                  color="var(--terracotta)"
                />
                {saved.count > 0 && (
                  <>
                    <Dot />
                    <ChipStat
                      active={savedOnly}
                      onClick={() => setSavedOnly((v) => !v)}
                      n={saved.count}
                      label={t("stats.saved")}
                      color="var(--terracotta)"
                      glyph={savedOnly ? "★" : "☆"}
                    />
                  </>
                )}
                <Dot className="hidden sm:inline-flex" />
                <span className="hidden sm:inline-flex items-baseline gap-1.5">
                  <Strong color="var(--sage)">{data.summary.price_dropped}</Strong>
                  <span>{t("stats.dropped")}</span>
                </span>
                <Dot className="hidden md:inline-flex" />
                <span className="hidden md:inline-flex items-baseline gap-1.5">
                  <span>{t("stats.lastScrape")}</span>
                  <Strong>{lastRefreshedHuman}</Strong>
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--terracotta)", animation: "pulse 1.4s ease-in-out infinite" }}
                />
                {t("stats.loading")}
              </span>
            )}
          </div>
        </div>

        {/* Actions cluster */}
        <div className="flex items-center shrink-0" style={{ gap: 8 }}>
          <ViewSwitcher value={view} onChange={setView} compact={isMobile} />
          <SettingsButton />
          <ThemeToggle />
          <RefreshButton onDone={() => load(filters)} />
        </div>
      </header>

      {/* === Filter rail + drawer ============================================ */}
      <FilterPanel
        filters={filters}
        districtCounts={districtCounts}
        onChange={setFilters}
        mode={prefs.filterMode}
        onModeChange={(m) => setPrefs({ filterMode: m })}
      />

      {/* === Listings + Map ================================================== */}
      <div
        className="grid"
        style={{
          gap: "var(--s-5)",
          gridTemplateColumns: isMobile ? "1fr" : gridFor(view),
        }}
      >
        {(view === "split" || view === "list" || isMobile) && view !== "map" && (
          <section className="flex flex-col min-w-0" style={{ gap: "var(--s-3)" }}>
            <div className="flex items-baseline justify-between" style={{ gap: 12 }}>
              <h2
                className="inline-flex items-baseline"
                style={{
                  gap: 8,
                  fontFamily: "var(--font-display)",
                  fontSize: 14,
                  color: "var(--fg-muted)",
                  fontWeight: 500,
                }}
              >
                <span>{t("listings.heading")}</span>
                <span
                  className="tabular"
                  style={{
                    color: "var(--fg)",
                    fontFamily: "var(--font-serif)",
                    fontWeight: 600,
                    fontSize: 18,
                  }}
                >
                  {visibleListings.length}
                </span>
                {filters.query && data && (
                  <span style={{ color: "var(--fg-muted)", fontSize: 12 }}>
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
                    fontSize: 12,
                  }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{
                      background: "var(--terracotta)",
                      animation: "pulse 1.4s ease-in-out infinite",
                    }}
                  />
                  {t("stats.loading")}
                </span>
              )}
            </div>
            {data && visibleListings.length === 0 && <EmptyState />}
            <div
              className={
                view === "split"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
              }
              style={{ gap: "var(--s-3)" }}
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
              height: isMobile ? "calc(100vh - 240px)" : "calc(100vh - 180px)",
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

function Stat({ n, label, accent }: { n: number; label: string; accent?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <Strong color={accent}>{n}</Strong>
      <span>{label}</span>
    </span>
  );
}

function Dot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block ${className ?? ""}`}
      style={{
        width: 3,
        height: 3,
        borderRadius: 999,
        background: "var(--hairline)",
        marginInline: 2,
      }}
    />
  );
}

function ChipStat({
  active,
  onClick,
  n,
  label,
  color,
  glyph,
}: {
  active: boolean;
  onClick: () => void;
  n: number;
  label: string;
  color: string;
  glyph?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-baseline transition-all"
      style={{
        gap: 6,
        paddingInline: 10,
        paddingBlock: 4,
        borderRadius: "var(--radius-pill)",
        background: active
          ? `color-mix(in srgb, ${color} 14%, transparent)`
          : "transparent",
        border: `1px solid ${active ? color : "transparent"}`,
        color: active ? "var(--fg)" : "var(--fg-muted)",
      }}
    >
      {glyph && <span style={{ fontSize: 12, color }}>{glyph}</span>}
      <Strong color={color}>{n}</Strong>
      <span style={{ fontSize: 12 }}>
        {label}
        {active && " ✓"}
      </span>
    </button>
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
      className="inline-flex p-1"
      style={{
        background: "var(--surface-soft)",
        borderRadius: "var(--radius-pill)",
      }}
    >
      {opts.map((o) => {
        const active = value === o.k;
        return (
          <button
            key={o.k}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.k)}
            title={o.label}
            className="inline-flex items-center justify-center transition-all"
            style={{
              minWidth: compact ? 40 : 64,
              height: 32,
              paddingInline: compact ? 8 : 14,
              borderRadius: "var(--radius-pill)",
              background: active ? "var(--bg-raised)" : "transparent",
              color: active ? "var(--fg)" : "var(--fg-muted)",
              fontFamily: "var(--font-display)",
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              boxShadow: active ? "var(--shadow-card)" : "none",
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
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-raised)",
        gap: "var(--s-3)",
      }}
    >
      <span
        aria-hidden
        style={{
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: 36,
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
          fontSize: 19,
          color: "var(--fg)",
          fontWeight: 600,
        }}
      >
        {t("empty.title")}
      </div>
      <div
        className="max-w-[420px]"
        style={{
          color: "var(--fg-muted)",
          fontSize: 13,
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
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}
