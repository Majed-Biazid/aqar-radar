"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DISTRICTS, CITIES, type City } from "@/lib/districts";
import type { Filters } from "@/lib/types";
import { t } from "@/lib/i18n";
import type { FilterMode } from "@/lib/prefs";

type Props = {
  filters: Filters;
  districtCounts: Record<string, number>;
  onChange: (next: Filters) => void;
  /** Display mode — "inline" pins the filter body to the page; "drawer" hides it behind a button. */
  mode?: FilterMode;
  /** User-clicked the small mode toggle in the bar. Lifts to prefs. */
  onModeChange?: (m: FilterMode) => void;
};

const PRICE_FLOOR = 0;
const PRICE_CEILING = 100_000;

const DEFAULTS: Omit<Filters, "districts"> = {
  priceMin: 28000,
  priceMax: 40000,
  ageMode: "any",
  includeGone: false,
  sort: "price-asc",
  query: "",
};

const SORT_OPTIONS: { value: Filters["sort"]; ar: string }[] = [
  { value: "price-asc",  ar: "السعر · تصاعدي" },
  { value: "price-desc", ar: "السعر · تنازلي" },
  { value: "new-first",  ar: "جديد أولاً" },
  { value: "newest",     ar: "الأحدث ظهوراً" },
  { value: "area-desc",  ar: "المساحة · تنازلي" },
];

const AGE_MODES: { value: Filters["ageMode"]; ar: string }[] = [
  { value: "any",      ar: "الكل" },
  { value: "le-2y",    ar: "≤ سنتين" },
  { value: "new-only", ar: "جديد فقط" },
];

/* ============================================================
   Top-level: <FilterPanel> renders the always-visible chip rail
   plus the slide-in drawer triggered by the "تصفية" button.
   ============================================================ */
export function FilterPanel({
  filters,
  districtCounts,
  onChange,
  mode = "drawer",
  onModeChange,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const allIds = useMemo(() => DISTRICTS.map((d) => d.id), []);
  const allOn = filters.districts.length === allIds.length;
  const totalCount = Object.values(districtCounts).reduce((a, b) => a + b, 0);
  const activeCount = activeFilterCount(filters, allOn);

  const reset = () => onChange({ ...DEFAULTS, districts: allIds });

  // In inline mode, the user can still collapse the body locally without
  // changing their persistent preference. This stays page-local.
  const [inlineCollapsed, setInlineCollapsed] = useState(false);

  return (
    <>
      <div
        className="surface-card"
        style={{ padding: "var(--s-3)", borderRadius: "var(--radius-lg)" }}
      >
        <div className="flex items-center gap-2 md:gap-3">
          <SearchBar
            value={filters.query}
            onChange={(v) => onChange({ ...filters, query: v })}
          />

          {/* mode toggle: pin in page ↔ drawer */}
          {onModeChange && (
            <button
              type="button"
              onClick={() => {
                if (mode === "inline") {
                  onModeChange("drawer");
                } else {
                  onModeChange("inline");
                  setInlineCollapsed(false);
                }
              }}
              aria-label={
                mode === "inline" ? "إخفاء في درج" : "تثبيت في الصفحة"
              }
              title={mode === "inline" ? "إخفاء في درج" : "تثبيت في الصفحة"}
              className="btn btn-ghost btn-icon shrink-0"
              style={{ color: mode === "inline" ? "var(--terracotta)" : "var(--fg-muted)" }}
            >
              {mode === "inline" ? <PinFilledGlyph /> : <PinGlyph />}
            </button>
          )}

          {/* mode-dependent CTA:
              inline → "إخفاء/إظهار" toggle (collapses the inline body)
              drawer → "تصفية" opens the drawer */}
          {mode === "inline" ? (
            <button
              type="button"
              onClick={() => setInlineCollapsed((c) => !c)}
              className="btn btn-ghost relative shrink-0"
              aria-label={inlineCollapsed ? "إظهار" : "إخفاء"}
              title={inlineCollapsed ? "إظهار" : "إخفاء"}
              style={{ paddingInline: 16 }}
            >
              <FilterGlyph />
              <span className="hidden sm:inline">
                {inlineCollapsed ? "إظهار" : "إخفاء"}
              </span>
              {activeCount > 0 && <ActiveBadge n={activeCount} />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="btn btn-ghost relative shrink-0"
              aria-label={t("filter.open")}
              title={t("filter.open")}
              style={{ paddingInline: 16 }}
            >
              <FilterGlyph />
              <span className="hidden sm:inline">{t("filter.open")}</span>
              {activeCount > 0 && <ActiveBadge n={activeCount} />}
            </button>
          )}
        </div>

        {/* — quick controls: sort + age toggle, always visible ————————— */}
        <QuickControls filters={filters} onChange={onChange} />

        {/* — active-filter chip rail ————————————————————— */}
        <ActiveChips
          filters={filters}
          allOn={allOn}
          totalCount={totalCount}
          onChange={onChange}
          onReset={reset}
        />

        {/* — inline filter body — connected to the bar via a single card ————— */}
        {mode === "inline" && !inlineCollapsed && (
          <div
            style={{
              marginTop: "var(--s-3)",
              paddingTop: "var(--s-4)",
              borderTop: "1px solid var(--hairline-soft)",
              animation: "fade-in var(--dur-base) var(--ease-soft)",
            }}
          >
            <InlineFilterBody
              filters={filters}
              districtCounts={districtCounts}
              onChange={onChange}
            />
          </div>
        )}
      </div>

      {/* drawer mode keeps the slide-in panel */}
      {mode === "drawer" && (
        <FilterDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          filters={filters}
          districtCounts={districtCounts}
          onChange={onChange}
          onReset={reset}
        />
      )}
    </>
  );
}

function ActiveBadge({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="tabular"
      style={{
        position: "absolute",
        top: -6,
        insetInlineEnd: -6,
        minWidth: 20,
        height: 20,
        padding: "0 6px",
        borderRadius: "var(--radius-pill)",
        background: "var(--terracotta)",
        color: "var(--parchment)",
        fontSize: 10,
        fontWeight: 600,
        fontFamily: "var(--font-mono)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 0 0 2px var(--bg-raised)",
      }}
    >
      {n}
    </span>
  );
}

function PinGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2 L10 12" />
      <path d="M6 6 L14 6 L13 12 L7 12 Z" />
      <path d="M10 12 L10 18" />
    </svg>
  );
}

function PinFilledGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
      <path d="M10 2 L10 4 L13 4 L14 6 L13 12 L7 12 L6 6 L7 4 L10 4 Z" />
      <path d="M9.6 12 L9.6 18 L10.4 18 L10.4 12 Z" />
    </svg>
  );
}

/* ============================================================
   InlineFilterBody — slim version for inline mode.
   Sort + age are intentionally OMITTED — they live in QuickControls
   above. Inline mode only adds cities, price, and gone toggle so the
   card stays compact.

   Mobile-first: single column stack so cities and price each get the
   full width. md+ splits into a 2-column layout.
   ============================================================ */
function InlineFilterBody({
  filters,
  districtCounts,
  onChange,
}: {
  filters: Filters;
  districtCounts: Record<string, number>;
  onChange: (f: Filters) => void;
}) {
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <div
      className="grid"
      style={{
        gap: isWide ? "var(--s-4)" : "var(--s-5)",
        gridTemplateColumns: isWide
          ? "minmax(0, 1.5fr) minmax(0, 1fr)"
          : "minmax(0, 1fr)",
      }}
    >
      <div className="flex flex-col" style={{ gap: "var(--s-3)" }}>
        <CompactSectionTitle>المدن والأحياء</CompactSectionTitle>
        <CityAccordions
          filters={filters}
          districtCounts={districtCounts}
          onChange={onChange}
        />
      </div>

      <div className="flex flex-col" style={{ gap: "var(--s-4)" }}>
        <div className="flex flex-col" style={{ gap: "var(--s-3)" }}>
          <CompactSectionTitle>{t("field.price")}</CompactSectionTitle>
          <PriceField
            min={filters.priceMin}
            max={filters.priceMax}
            onChange={(priceMin, priceMax) => onChange({ ...filters, priceMin, priceMax })}
          />
        </div>

        <div className="flex flex-col" style={{ gap: "var(--s-3)" }}>
          <CompactSectionTitle>{t("field.gone")}</CompactSectionTitle>
          <SwitchRow
            checked={filters.includeGone}
            onChange={(v) => onChange({ ...filters, includeGone: v })}
            label={
              filters.includeGone
                ? "تظهر العروض المنتهية"
                : "العروض المنتهية مخفية"
            }
          />
        </div>
      </div>
    </div>
  );
}

function CompactSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontFamily: "var(--font-display)",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--fg-muted)",
        letterSpacing: "var(--track-std)",
        textTransform: "uppercase",
      }}
    >
      {children}
    </h3>
  );
}

/* ============================================================
   FilterBody — the 5 sections (cities, price, age, sort, gone).
   Reused inside both the drawer and the inline card so mode
   never causes feature drift.
   ============================================================ */
function FilterBody({
  filters,
  districtCounts,
  onChange,
  layout = "drawer",
}: {
  filters: Filters;
  districtCounts: Record<string, number>;
  onChange: (f: Filters) => void;
  layout?: "drawer" | "inline";
}) {
  const isInline = layout === "inline";
  return (
    <div
      className={isInline ? "grid" : "flex flex-col"}
      style={
        isInline
          ? {
              gap: "var(--s-5)",
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
            }
          : { gap: "var(--s-6)" }
      }
    >
      {/* Left column on desktop inline, stacked otherwise */}
      <div className="flex flex-col" style={{ gap: "var(--s-5)" }}>
        <Section title="المدن والأحياء">
          <CityAccordions
            filters={filters}
            districtCounts={districtCounts}
            onChange={onChange}
          />
        </Section>
      </div>

      <div className="flex flex-col" style={{ gap: "var(--s-5)" }}>
        <Section title={t("field.price")}>
          <PriceField
            min={filters.priceMin}
            max={filters.priceMax}
            onChange={(priceMin, priceMax) => onChange({ ...filters, priceMin, priceMax })}
          />
        </Section>

        <Section title={t("field.age")}>
          <Segmented
            value={filters.ageMode}
            options={AGE_MODES}
            onChange={(v) => onChange({ ...filters, ageMode: v })}
          />
        </Section>

        <Section title={t("field.sort")}>
          <SortRadio
            value={filters.sort}
            options={SORT_OPTIONS}
            onChange={(v) => onChange({ ...filters, sort: v })}
          />
        </Section>

        <Section title={t("field.gone")}>
          <SwitchRow
            checked={filters.includeGone}
            onChange={(v) => onChange({ ...filters, includeGone: v })}
            label={
              filters.includeGone
                ? "تظهر العروض المنتهية ضمن النتائج"
                : "العروض المنتهية مخفية"
            }
          />
        </Section>
      </div>
    </div>
  );
}

/* ============================================================
   Search bar — soft, rounded, with leading glyph + clear button
   ============================================================ */
function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div
      className="flex items-center gap-2 flex-1 min-w-0"
      style={{
        background: "var(--surface-soft)",
        borderRadius: "var(--radius-pill)",
        padding: "0 14px",
        height: 44,
        border: "1px solid transparent",
        transition: "border-color var(--dur-fast) var(--ease-soft)",
      }}
      onFocusCapture={(e) => {
        e.currentTarget.style.borderColor = "var(--terracotta)";
      }}
      onBlurCapture={(e) => {
        e.currentTarget.style.borderColor = "transparent";
      }}
    >
      <SearchGlyph />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("search.placeholder")}
        className="flex-1 min-w-0 bg-transparent outline-none"
        style={{
          color: "var(--fg)",
          fontFamily: "var(--font-body)",
          fontSize: 14,
        }}
        dir="rtl"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("search.clear")}
          className="shrink-0 inline-flex items-center justify-center transition-colors"
          style={{
            width: 24,
            height: 24,
            borderRadius: "var(--radius-pill)",
            background: "var(--hairline)",
            color: "var(--fg)",
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* ============================================================
   QuickControls — always-visible sort + age toggles
   The user shouldn't need to open the drawer to change these.
   ============================================================ */
function QuickControls({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const currentSort = SORT_OPTIONS.find((o) => o.value === filters.sort) ?? SORT_OPTIONS[0];

  useEffect(() => {
    if (!sortOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!sortRef.current) return;
      if (!sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSortOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [sortOpen]);

  const setAge = (next: Filters["ageMode"]) =>
    onChange({ ...filters, ageMode: filters.ageMode === next ? "any" : next });

  return (
    <div
      className="flex items-center flex-wrap mt-2"
      style={{ gap: 8 }}
    >
      {/* Sort — chip with dropdown */}
      <div ref={sortRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setSortOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={sortOpen}
          className="inline-flex items-center transition-all"
          style={{
            gap: 8,
            paddingInlineStart: 14,
            paddingInlineEnd: 12,
            height: 36,
            borderRadius: "var(--radius-pill)",
            background: sortOpen ? "var(--bg-raised)" : "var(--surface-soft)",
            border: `1px solid ${sortOpen ? "var(--terracotta)" : "transparent"}`,
            color: "var(--fg)",
            fontFamily: "var(--font-display)",
            fontSize: 13,
          }}
        >
          <SortGlyph />
          <span style={{ fontWeight: 500 }}>{currentSort.ar}</span>
          <span
            aria-hidden
            style={{
              fontSize: 10,
              color: "var(--fg-muted)",
              transform: sortOpen ? "rotate(180deg)" : "none",
              transition: "transform var(--dur-fast) var(--ease-soft)",
            }}
          >
            ▾
          </span>
        </button>

        {sortOpen && (
          <div
            role="listbox"
            className="absolute top-full mt-1 z-30 overflow-hidden"
            style={{
              insetInlineStart: 0,
              minWidth: 200,
              background: "var(--bg-floating)",
              border: "1px solid var(--hairline)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-floating)",
              padding: 4,
              animation: "scale-in 160ms var(--ease-out)",
              transformOrigin: "top",
            }}
          >
            {SORT_OPTIONS.map((opt) => {
              const active = opt.value === filters.sort;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange({ ...filters, sort: opt.value });
                    setSortOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 transition-colors text-start"
                  style={{
                    paddingInline: 12,
                    paddingBlock: 10,
                    borderRadius: "var(--radius-sm)",
                    background: active
                      ? "color-mix(in srgb, var(--terracotta) 10%, transparent)"
                      : "transparent",
                    color: "var(--fg)",
                    fontFamily: "var(--font-display)",
                    fontSize: 13,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "var(--surface-soft)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: active ? "var(--terracotta)" : "transparent",
                      boxShadow: active ? "none" : "inset 0 0 0 1px var(--hairline)",
                    }}
                  />
                  <span style={{ fontWeight: active ? 600 : 400 }}>{opt.ar}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Age toggles — quick access for the most common case */}
      <QuickToggle
        active={filters.ageMode === "new-only"}
        onClick={() => setAge("new-only")}
        label="جديد فقط"
        glyph="✦"
      />
      <QuickToggle
        active={filters.ageMode === "le-2y"}
        onClick={() => setAge("le-2y")}
        label="≤ سنتين"
      />
    </div>
  );
}

function QuickToggle({
  active,
  onClick,
  label,
  glyph,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  glyph?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="switch"
      aria-checked={active}
      className="inline-flex items-center transition-all shrink-0"
      style={{
        gap: 6,
        paddingInline: 14,
        height: 36,
        borderRadius: "var(--radius-pill)",
        background: active ? "var(--terracotta)" : "var(--surface-soft)",
        color: active ? "var(--parchment)" : "var(--fg)",
        border: `1px solid ${active ? "var(--terracotta)" : "transparent"}`,
        fontFamily: "var(--font-display)",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        boxShadow: active ? "0 1px 3px rgba(200,85,61,0.28)" : "none",
      }}
    >
      {glyph && <span style={{ fontSize: 11 }}>{glyph}</span>}
      <span>{label}</span>
    </button>
  );
}

function SortGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <path d="M4 3 L4 13" />
      <path d="M4 13 L1.5 10.5" />
      <path d="M4 13 L6.5 10.5" />
      <path d="M12 3 L12 13" />
      <path d="M12 3 L9.5 5.5" />
      <path d="M12 3 L14.5 5.5" />
    </svg>
  );
}

/* ============================================================
   Active filter chips — dismissable summary that lives below the bar
   ============================================================ */
function ActiveChips({
  filters,
  allOn,
  totalCount,
  onChange,
  onReset,
}: {
  filters: Filters;
  allOn: boolean;
  totalCount: number;
  onChange: (f: Filters) => void;
  onReset: () => void;
}) {
  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  // Districts — show one chip per district when partially selected, or single
  // "كل الأحياء" when all on.
  if (allOn) {
    chips.push({
      key: "all-districts",
      label: t("filter.allDistricts"),
      onRemove: () => onChange({ ...filters, districts: [] }),
    });
  } else if (filters.districts.length === 0) {
    // unusual edge — surface a hint chip
    chips.push({
      key: "no-districts",
      label: "لا أحياء محددة",
      onRemove: () =>
        onChange({ ...filters, districts: DISTRICTS.map((d) => d.id) }),
    });
  } else {
    // group by city — collapse "all of city X" into one chip per city
    for (const city of CITIES) {
      const cityIds = DISTRICTS.filter((d) => d.city === city).map((d) => d.id);
      const selectedInCity = filters.districts.filter((id) => cityIds.includes(id));
      if (selectedInCity.length === 0) continue;
      if (selectedInCity.length === cityIds.length) {
        chips.push({
          key: `city:${city}`,
          label: `${t("filter.cityAll")} ${city}`,
          onRemove: () =>
            onChange({
              ...filters,
              districts: filters.districts.filter((id) => !cityIds.includes(id)),
            }),
        });
      } else {
        for (const id of selectedInCity) {
          const d = DISTRICTS.find((x) => x.id === id)!;
          chips.push({
            key: `d:${id}`,
            label: d.label.replace("حي ", ""),
            onRemove: () =>
              onChange({
                ...filters,
                districts: filters.districts.filter((x) => x !== id),
              }),
          });
        }
      }
    }
  }

  // Price (always shown — represents a constraint)
  if (filters.priceMin !== DEFAULTS.priceMin || filters.priceMax !== DEFAULTS.priceMax) {
    chips.push({
      key: "price",
      label: `${(filters.priceMin / 1000).toFixed(0)}–${(filters.priceMax / 1000).toFixed(0)}k ر.س`,
      onRemove: () =>
        onChange({ ...filters, priceMin: DEFAULTS.priceMin, priceMax: DEFAULTS.priceMax }),
    });
  }

  // Note: age + sort are now in the always-visible QuickControls above —
  // no need to duplicate as removable chips.

  if (filters.includeGone) {
    chips.push({
      key: "gone",
      label: "+ منتهية",
      onRemove: () => onChange({ ...filters, includeGone: false }),
    });
  }

  const hasNonDefault =
    !allOn ||
    filters.priceMin !== DEFAULTS.priceMin ||
    filters.priceMax !== DEFAULTS.priceMax ||
    filters.ageMode !== "any" ||
    filters.includeGone ||
    filters.sort !== "price-asc" ||
    filters.query !== "";

  return (
    <div
      className="flex items-center flex-wrap gap-1.5 mt-2"
      style={{ minHeight: 30 }}
    >
      {/* Result count — always anchors the leading edge */}
      <span
        className="tabular inline-flex items-baseline gap-1.5 px-2.5"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 12,
          color: "var(--fg-muted)",
          height: 26,
          alignItems: "center",
          display: "inline-flex",
        }}
      >
        <span
          className="font-semibold"
          style={{
            color: totalCount > 0 ? "var(--terracotta)" : "var(--fg-muted)",
            fontFamily: "var(--font-serif)",
            fontSize: 14,
          }}
        >
          {totalCount}
        </span>
        <span>{t("filter.results")}</span>
      </span>

      {chips.length > 0 && (
        <span
          aria-hidden
          style={{
            height: 14,
            width: 1,
            background: "var(--hairline)",
            display: "inline-block",
            margin: "0 4px",
          }}
        />
      )}

      {chips.map((c) => (
        <Chip key={c.key} label={c.label} onRemove={c.onRemove} />
      ))}

      {hasNonDefault && (
        <button
          type="button"
          onClick={onReset}
          className="ms-auto inline-flex items-center gap-1 transition-colors"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 12,
            color: "var(--fg-muted)",
            padding: "0 8px",
            height: 26,
          }}
        >
          <span>{t("filter.clearAll")}</span>
          <span style={{ color: "var(--terracotta)" }}>✕</span>
        </button>
      )}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        background: "var(--surface-soft)",
        borderRadius: "var(--radius-pill)",
        padding: "4px 4px 4px 10px",
        height: 26,
        fontSize: 12,
        fontFamily: "var(--font-display)",
        color: "var(--fg)",
      }}
    >
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`إزالة ${label}`}
        className="inline-flex items-center justify-center transition-colors"
        style={{
          width: 18,
          height: 18,
          borderRadius: "var(--radius-pill)",
          background: "var(--hairline)",
          color: "var(--fg)",
          fontSize: 10,
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </span>
  );
}

/* ============================================================
   Drawer — slide-in panel with full controls
   ============================================================ */
function FilterDrawer({
  open,
  onClose,
  filters,
  districtCounts,
  onChange,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  districtCounts: Record<string, number>;
  onChange: (f: Filters) => void;
  onReset: () => void;
}) {
  const [isMobile, setIsMobile] = useState(false);
  // Mounted state runs the exit animation before fully unmounting.
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const dur = 360; // matches --dur-slow
      const t = window.setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, dur);
      return () => window.clearTimeout(t);
    }
  }, [open, mounted]);

  // Lock body scroll while open or animating out
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  // ESC to close (kicks off exit animation)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  // RTL: drawer pins to the right edge (insetInlineStart:0).
  // Enter slides from off-right (translateX 100%) to in-place; exit reverses.
  const drawerStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 60,
        animation: closing
          ? "sheet-down var(--dur-slow) var(--ease-soft) forwards"
          : "sheet-up var(--dur-slow) var(--ease-out)",
      }
    : {
        // App is always dir="rtl"; pin drawer to the right edge using a
        // physical property (right) so the slide direction is unambiguous
        // regardless of CSS logical-property quirks.
        position: "fixed",
        top: 0,
        bottom: 0,
        right: 0,
        width: 460,
        zIndex: 60,
        animation: closing
          ? "drawer-out-end var(--dur-slow) var(--ease-soft) forwards"
          : "drawer-in-end var(--dur-slow) var(--ease-out)",
      };

  return (
    <>
      {/* scrim */}
      <button
        type="button"
        onClick={onClose}
        aria-label={t("filter.close")}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 55,
          background: "rgba(20, 15, 10, 0.45)",
          backdropFilter: "blur(2px)",
          animation: closing
            ? "fade-out var(--dur-slow) var(--ease-soft) forwards"
            : "fade-in var(--dur-base) var(--ease-soft)",
          cursor: "default",
        }}
      />

      {/* panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("filter.title")}
        className="flex flex-col"
        style={{
          ...drawerStyle,
          background: "var(--bg-raised)",
          boxShadow: "var(--shadow-drawer)",
          // RTL desktop: drawer flush with right edge → sharp corners on the
          // right (TR/BR), rounded on the left (TL/BL) where it meets content.
          // Mobile: full-width sheet → rounded top corners only.
          borderTopRightRadius: isMobile ? "var(--radius-xl)" : 0,
          borderBottomRightRadius: isMobile ? 0 : 0,
          borderTopLeftRadius: isMobile ? "var(--radius-xl)" : "var(--radius-xl)",
          borderBottomLeftRadius: isMobile ? 0 : "var(--radius-xl)",
          paddingTop: "max(env(safe-area-inset-top), 0px)",
          paddingBottom: "max(env(safe-area-inset-bottom), 0px)",
        }}
      >
        {/* header */}
        <header
          className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0"
          style={{ borderBottom: "1px solid var(--hairline-soft)" }}
        >
          <div className="flex flex-col">
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                fontWeight: 600,
                color: "var(--fg)",
                lineHeight: 1.1,
              }}
            >
              {t("filter.title")}
            </h2>
            <span
              className="italic"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 13,
                color: "var(--fg-muted)",
                marginTop: 2,
              }}
            >
              {t("filter.subtitle")}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t("filter.close")}
            className="inline-flex items-center justify-center transition-colors"
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-pill)",
              background: "var(--surface-soft)",
              color: "var(--fg)",
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </header>

        {/* scrollable body */}
        <div
          className="flex-1 overflow-y-auto px-5 py-5"
          style={{ scrollbarGutter: "stable" }}
        >
          <div className="flex flex-col" style={{ gap: "var(--s-6)" }}>
            <Section title="المدن والأحياء">
              <CityAccordions
                filters={filters}
                districtCounts={districtCounts}
                onChange={onChange}
              />
            </Section>

            <Section title={t("field.price")}>
              <PriceField
                min={filters.priceMin}
                max={filters.priceMax}
                onChange={(priceMin, priceMax) => onChange({ ...filters, priceMin, priceMax })}
              />
            </Section>

            <Section title={t("field.age")}>
              <Segmented
                value={filters.ageMode}
                options={AGE_MODES}
                onChange={(v) => onChange({ ...filters, ageMode: v })}
              />
            </Section>

            <Section title={t("field.sort")}>
              <SortRadio
                value={filters.sort}
                options={SORT_OPTIONS}
                onChange={(v) => onChange({ ...filters, sort: v })}
              />
            </Section>

            <Section title={t("field.gone")}>
              <SwitchRow
                checked={filters.includeGone}
                onChange={(v) => onChange({ ...filters, includeGone: v })}
                label={
                  filters.includeGone
                    ? "تظهر العروض المنتهية ضمن النتائج"
                    : "العروض المنتهية مخفية"
                }
              />
            </Section>
          </div>
        </div>

        {/* footer */}
        <footer
          className="flex items-center justify-between gap-3 px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--hairline-soft)" }}
        >
          <button type="button" onClick={onReset} className="btn btn-ghost">
            {t("filter.reset")}
          </button>
          <button type="button" onClick={onClose} className="btn btn-primary flex-1">
            {t("filter.apply")}
          </button>
        </footer>
      </aside>
    </>
  );
}

/* ============================================================
   Drawer building blocks
   ============================================================ */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col" style={{ gap: "var(--s-3)" }}>
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--fg)",
          letterSpacing: "-0.005em",
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function CityAccordions({
  filters,
  districtCounts,
  onChange,
}: {
  filters: Filters;
  districtCounts: Record<string, number>;
  onChange: (f: Filters) => void;
}) {
  // Auto-open the city the user already has selections in
  const [openCity, setOpenCity] = useState<City | null>(() => {
    for (const city of CITIES) {
      const ids = DISTRICTS.filter((d) => d.city === city).map((d) => d.id);
      if (ids.some((id) => filters.districts.includes(id))) return city;
    }
    return CITIES[0];
  });

  return (
    <div className="flex flex-col" style={{ gap: "var(--s-2)" }}>
      {CITIES.map((city, idx) => {
        const ids = DISTRICTS.filter((d) => d.city === city).map((d) => d.id);
        const selectedInCity = filters.districts.filter((id) => ids.includes(id));
        const selectedCount = selectedInCity.length;
        const allOn = selectedCount === ids.length;
        const cityTotal = ids.reduce((sum, id) => sum + (districtCounts[id] ?? 0), 0);
        const accent = idx % 2 === 0 ? "var(--terracotta)" : "var(--indigo)";
        const expanded = openCity === city;

        return (
          <div
            key={city}
            style={{
              background: "var(--surface-soft)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              transition: "background var(--dur-fast) var(--ease-soft)",
            }}
          >
            <div className="flex items-center" style={{ minHeight: 56 }}>
              <button
                type="button"
                onClick={() => setOpenCity(expanded ? null : city)}
                className="flex-1 flex items-center justify-between text-start gap-3 px-4"
                style={{ minHeight: 56 }}
                aria-expanded={expanded}
              >
                <div className="flex items-baseline gap-2.5 min-w-0">
                  <span
                    aria-hidden
                    className="inline-block"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background:
                        selectedCount === 0
                          ? "transparent"
                          : allOn
                            ? accent
                            : "var(--amber)",
                      boxShadow:
                        selectedCount === 0
                          ? `inset 0 0 0 1.5px var(--hairline)`
                          : `0 0 0 4px color-mix(in srgb, ${
                              allOn ? accent : "var(--amber)"
                            } 18%, transparent)`,
                      transition: "all var(--dur-fast) var(--ease-soft)",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 17,
                      fontWeight: 600,
                      color: "var(--fg)",
                    }}
                  >
                    {city}
                  </span>
                  <span
                    className="tabular"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--fg-muted)",
                    }}
                  >
                    {selectedCount}/{ids.length}
                    {cityTotal > 0 && (
                      <>
                        <span aria-hidden style={{ margin: "0 6px", opacity: 0.5 }}>·</span>
                        <span style={{ color: accent, fontWeight: 600 }}>{cityTotal}</span>
                      </>
                    )}
                  </span>
                </div>
                <span
                  aria-hidden
                  style={{
                    color: "var(--fg-muted)",
                    transform: expanded ? "rotate(180deg)" : "none",
                    transition: "transform var(--dur-fast) var(--ease-soft)",
                    fontSize: 12,
                  }}
                >
                  ▾
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    districts: allOn
                      ? filters.districts.filter((id) => !ids.includes(id))
                      : Array.from(new Set([...filters.districts, ...ids])),
                  })
                }
                className="shrink-0 transition-colors"
                style={{
                  paddingInline: 14,
                  height: 56,
                  fontFamily: "var(--font-display)",
                  fontSize: 12,
                  color: allOn ? "var(--fg-muted)" : accent,
                  borderInlineStart: "1px solid var(--hairline-soft)",
                }}
              >
                {allOn ? "إلغاء" : "الكل"}
              </button>
            </div>

            {expanded && (
              <div
                className="flex flex-wrap gap-1.5 px-4 pb-4 pt-1"
                style={{ animation: "fade-in 200ms var(--ease-soft)" }}
              >
                {DISTRICTS.filter((d) => d.city === city).map((d) => {
                  const checked = filters.districts.includes(d.id);
                  const count = districtCounts[d.id] ?? 0;
                  return (
                    <DistrictChip
                      key={d.id}
                      label={d.label.replace("حي ", "")}
                      count={count}
                      checked={checked}
                      accent={accent}
                      onClick={() =>
                        onChange({
                          ...filters,
                          districts: checked
                            ? filters.districts.filter((x) => x !== d.id)
                            : [...filters.districts, d.id],
                        })
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DistrictChip({
  label,
  count,
  checked,
  accent,
  onClick,
}: {
  label: string;
  count: number;
  checked: boolean;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className="inline-flex items-center gap-2 transition-all"
      style={{
        height: 34,
        paddingInline: 12,
        background: checked
          ? `color-mix(in srgb, ${accent} 14%, var(--bg-raised))`
          : "var(--bg-raised)",
        border: `1px solid ${checked ? accent : "var(--hairline-soft)"}`,
        borderRadius: "var(--radius-pill)",
        color: "var(--fg)",
        fontFamily: "var(--font-display)",
        fontSize: 13,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: checked ? accent : "var(--hairline)",
        }}
      />
      <span>{label}</span>
      <span
        className="tabular"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: checked ? accent : "var(--fg-muted)",
          opacity: count === 0 ? 0.4 : 1,
        }}
      >
        {count}
      </span>
    </button>
  );
}

/* ============================================================
   Price field — number inputs + visual track
   ============================================================ */
function PriceField({
  min,
  max,
  onChange,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  const fillStart = ((min - PRICE_FLOOR) / (PRICE_CEILING - PRICE_FLOOR)) * 100;
  const fillEnd = ((max - PRICE_FLOOR) / (PRICE_CEILING - PRICE_FLOOR)) * 100;
  const monthlyMin = Math.round(min / 12);
  const monthlyMax = Math.round(max / 12);

  return (
    <div className="flex flex-col" style={{ gap: "var(--s-3)" }}>
      <div className="flex items-end gap-3">
        <PriceCell
          label="من"
          value={min}
          onChange={(v) => onChange(Math.min(v, max), max)}
          min={PRICE_FLOOR}
          max={max}
        />
        <PriceCell
          label="إلى"
          value={max}
          onChange={(v) => onChange(min, Math.max(v, min))}
          min={min}
          max={PRICE_CEILING}
        />
      </div>

      {/* visual track */}
      <div
        className="relative h-2 rounded-full overflow-hidden"
        style={{ background: "var(--surface)" }}
      >
        <span
          className="absolute top-0 h-full transition-all"
          style={{
            insetInlineStart: `${fillStart}%`,
            width: `${Math.max(0, fillEnd - fillStart)}%`,
            background: "var(--terracotta)",
            borderRadius: 999,
          }}
        />
      </div>

      <div
        className="tabular"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--fg-muted)",
        }}
      >
        ≈ {monthlyMin.toLocaleString()}–{monthlyMax.toLocaleString()} ريال / شهر
      </div>
    </div>
  );
}

function PriceCell({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="flex flex-col flex-1" style={{ gap: 4 }}>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 11,
          color: "var(--fg-muted)",
        }}
      >
        {label}
      </span>
      <div
        className="relative flex items-center"
        style={{
          background: "var(--surface-soft)",
          borderRadius: "var(--radius-md)",
          height: 44,
          paddingInline: 14,
          border: "1px solid transparent",
        }}
      >
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={500}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v)) onChange(v);
          }}
          className="flex-1 bg-transparent outline-none tabular"
          style={{
            color: "var(--fg)",
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            width: "100%",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 11,
            color: "var(--fg-muted)",
            marginInlineStart: 6,
          }}
        >
          ر.س
        </span>
      </div>
    </label>
  );
}

/* ============================================================
   Segmented control — for ageMode
   ============================================================ */
function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; ar: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="inline-flex p-1 self-start"
      style={{
        background: "var(--surface-soft)",
        borderRadius: "var(--radius-pill)",
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="inline-flex items-center justify-center transition-all"
            style={{
              minWidth: 80,
              height: 36,
              paddingInline: 16,
              background: active ? "var(--bg-raised)" : "transparent",
              color: active ? "var(--fg)" : "var(--fg-muted)",
              borderRadius: "var(--radius-pill)",
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              boxShadow: active ? "var(--shadow-card)" : "none",
            }}
          >
            {opt.ar}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   Sort — radio list (clearer than dropdown in a drawer)
   ============================================================ */
function SortRadio({
  value,
  options,
  onChange,
}: {
  value: Filters["sort"];
  options: { value: Filters["sort"]; ar: string }[];
  onChange: (v: Filters["sort"]) => void;
}) {
  return (
    <div className="flex flex-col" style={{ gap: 4 }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            role="radio"
            aria-checked={active}
            className="flex items-center gap-3 transition-colors"
            style={{
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              background: active ? "color-mix(in srgb, var(--terracotta) 8%, transparent)" : "transparent",
              border: `1px solid ${active ? "var(--terracotta)" : "transparent"}`,
              color: active ? "var(--fg)" : "var(--fg-muted)",
            }}
          >
            <span
              aria-hidden
              className="inline-flex items-center justify-center"
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                border: `1.5px solid ${active ? "var(--terracotta)" : "var(--hairline)"}`,
              }}
            >
              {active && (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: "var(--terracotta)",
                  }}
                />
              )}
            </span>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 14,
                fontWeight: active ? 600 : 400,
              }}
            >
              {opt.ar}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   Switch row — for includeGone
   ============================================================ */
function SwitchRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between transition-colors w-full"
      style={{
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        background: "var(--surface-soft)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 13,
          color: "var(--fg)",
        }}
      >
        {label}
      </span>
      <span
        className="relative inline-block transition-colors"
        style={{
          width: 42,
          height: 24,
          borderRadius: 999,
          background: checked ? "var(--terracotta)" : "var(--hairline)",
        }}
      >
        <span
          className="absolute top-[2px] transition-all"
          style={{
            width: 20,
            height: 20,
            borderRadius: 999,
            background: "var(--bg-raised)",
            insetInlineStart: checked ? 20 : 2,
            boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
          }}
        />
      </span>
    </button>
  );
}

/* ============================================================
   Helpers
   ============================================================ */
function activeFilterCount(filters: Filters, allDistrictsOn: boolean): number {
  let n = 0;
  if (!allDistrictsOn) n++;
  if (filters.priceMin !== DEFAULTS.priceMin || filters.priceMax !== DEFAULTS.priceMax) n++;
  if (filters.ageMode !== "any") n++;
  if (filters.includeGone) n++;
  if (filters.sort !== "price-asc") n++;
  return n;
}

/* ============================================================
   Glyphs — minimal stroke icons, no library dep
   ============================================================ */
function SearchGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      style={{ color: "var(--fg-muted)", flexShrink: 0 }}
    >
      <circle cx="9" cy="9" r="6" />
      <line x1="13.4" y1="13.4" x2="17" y2="17" />
    </svg>
  );
}

function FilterGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <line x1="3" y1="6" x2="17" y2="6" />
      <line x1="6" y1="10" x2="14" y2="10" />
      <line x1="8" y1="14" x2="12" y2="14" />
    </svg>
  );
}
