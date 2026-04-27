"use client";

import { useEffect, useRef, useState } from "react";
import { DISTRICTS, CITIES } from "@/lib/districts";
import type { Filters } from "@/lib/types";
import { t } from "@/lib/i18n";

type Props = {
  filters: Filters;
  districtCounts: Record<string, number>;
  onChange: (next: Filters) => void;
};

const SORT_OPTIONS: { value: Filters["sort"]; ar: string; sub?: string }[] = [
  { value: "price-asc",  ar: "السعر تصاعدي" },
  { value: "price-desc", ar: "السعر تنازلي" },
  { value: "new-first",  ar: "جديد أولاً" },
  { value: "newest",     ar: "الأحدث ظهوراً" },
  { value: "area-desc",  ar: "المساحة تنازلي" },
];

const AGE_MODES: { value: Filters["ageMode"]; ar: string; sub?: string }[] = [
  { value: "new-only", ar: "جديد" },
  { value: "le-2y",    ar: "≤ ٢ سنة" },
  { value: "any",      ar: "الكل" },
];

const PRICE_FLOOR = 0;
const PRICE_CEILING = 100_000;

export function FilterPanel({ filters, districtCounts, onChange }: Props) {
  const totalDistricts = DISTRICTS.length;
  const selectedDistricts = filters.districts.length;
  const totalCount = Object.values(districtCounts).reduce((a, b) => a + b, 0);

  // Mobile: collapse the body by default to save vertical space — most users
  // adjust filters once and then want maximum room for the listings.
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => {
      setIsMobile(mq.matches);
      if (mq.matches) setCollapsed(true);
      else setCollapsed(false);
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggleDistrict = (id: string) => {
    const has = filters.districts.includes(id);
    const next = has ? filters.districts.filter((s) => s !== id) : [...filters.districts, id];
    onChange({ ...filters, districts: next });
  };

  const toggleCity = (city: string) => {
    const cityIds = DISTRICTS.filter((d) => d.city === city).map((d) => d.id);
    const allOn = cityIds.every((s) => filters.districts.includes(s));
    const next = allOn
      ? filters.districts.filter((s) => !cityIds.includes(s))
      : Array.from(new Set([...filters.districts, ...cityIds]));
    onChange({ ...filters, districts: next });
  };

  const reset = () =>
    onChange({
      districts: DISTRICTS.map((d) => d.id),
      priceMin: 28000,
      priceMax: 40000,
      ageMode: "any",
      includeGone: false,
      sort: "price-asc",
      query: "",
    });

  return (
    <section
      aria-label="filter slip"
      className="relative parchment-grain"
      style={{
        background: "var(--bg-raised)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--radius-tile)",
      }}
    >
      {/* corner brackets — the editorial flourish */}
      <Bracket position="tl" />
      <Bracket position="tr" />
      <Bracket position="bl" />
      <Bracket position="br" />

      {/* — masthead row ———————————————————————————————————————— */}
      <header
        className="flex flex-wrap items-center justify-between gap-x-4 md:gap-x-6 gap-y-2 px-3.5 md:px-5 pt-3 md:pt-4 pb-2.5 md:pb-3 border-b"
        style={{ borderColor: "var(--hairline)" }}
      >
        <div className="flex items-baseline gap-2 md:gap-3">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--fg)",
            }}
          >
            {t("filter.title")}
          </span>
          <span className="rule hidden sm:inline-block" />
          <span
            className="italic text-[12px] md:text-[13px] hidden sm:inline"
            style={{ color: "var(--fg-muted)", fontFamily: "var(--font-serif)" }}
          >
            {t("filter.subtitle")}
          </span>
        </div>

        <div
          className="flex items-center gap-2 md:gap-3 tabular"
          style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "var(--fg-muted)" }}
        >
          <Stat label={t("filter.districts")} value={`${selectedDistricts}/${totalDistricts}`} accent={selectedDistricts < totalDistricts} />
          <span className="rule hidden md:inline-block" />
          <Stat label={t("filter.results")} value={String(totalCount)} accent={totalCount > 0} accentColor="var(--terracotta)" />
          <span className="rule hidden md:inline-block" />
          <button
            onClick={reset}
            className="transition-colors hover:underline underline-offset-4"
            style={{ color: "var(--fg-muted)", fontFamily: "var(--font-display)", fontSize: 12 }}
          >
            {t("filter.reset")}
          </button>
          {isMobile && (
            <button
              onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "expand filters" : "collapse filters"}
              className="ms-1 inline-flex items-center justify-center rounded-[3px] border min-w-[32px] min-h-[28px] transition-colors"
              style={{
                borderColor: "var(--hairline)",
                color: "var(--terracotta)",
                background: collapsed ? "transparent" : "var(--surface)",
              }}
            >
              <span style={{ transform: collapsed ? "none" : "rotate(180deg)", transition: "transform 200ms" }}>▾</span>
            </button>
          )}
        </div>
      </header>

      {collapsed ? (
        <div className="px-3.5 pb-3 pt-0">
          <ActiveFilterSummary filters={filters} />
        </div>
      ) : (
        <div className="contents">
          {/* search row + districts + controls — only rendered when expanded */}

      {/* — search row (top, prominent) ——————————————————————————— */}
      <div className="px-3.5 md:px-5 pt-3 md:pt-4 pb-2.5 md:pb-3 border-b" style={{ borderColor: "var(--hairline)" }}>
        <SearchSlip
          value={filters.query}
          onChange={(v) => onChange({ ...filters, query: v })}
        />
      </div>

      {/* — district matrix: one tile per Eastern-Province city ————————— */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x" style={{ borderColor: "var(--hairline)" }}>
        {CITIES.map((city, idx) => {
          const cityIds = DISTRICTS.filter((d) => d.city === city).map((d) => d.id);
          if (cityIds.length === 0) return null;
          const allOn = cityIds.every((s) => filters.districts.includes(s));
          const someOn = cityIds.some((s) => filters.districts.includes(s));
          const cityTotal = cityIds.reduce((sum, s) => sum + (districtCounts[s] ?? 0), 0);
          // Alternate accent colors for visual grouping across many cities.
          const accent = idx % 2 === 0 ? "var(--terracotta)" : "var(--indigo)";

          return (
            <div key={city} className="px-3.5 md:px-5 py-3 md:py-4 flex flex-col gap-2.5 md:gap-3" style={{ borderColor: "var(--hairline)" }}>
              <div className="flex items-baseline justify-between gap-3">
                <button
                  onClick={() => toggleCity(city)}
                  className="group inline-flex items-baseline gap-2 text-start"
                  title={allOn ? t("filter.deselectAll") : t("filter.selectAll")}
                >
                  <span
                    aria-hidden
                    className="inline-block w-1.5 h-1.5 rounded-full transition-colors"
                    style={{
                      background: allOn ? accent : someOn ? "var(--amber)" : "transparent",
                      boxShadow: allOn ? `0 0 0 3px ${withAlpha(accent, 0.15)}` : someOn ? "0 0 0 3px rgba(216,155,60,0.15)" : `inset 0 0 0 1px var(--hairline)`,
                    }}
                  />
                  <span
                    className="text-[18px] leading-none font-semibold"
                    style={{
                      fontFamily: "var(--font-display)",
                      color: someOn ? "var(--fg)" : "var(--fg-muted)",
                    }}
                  >
                    {city}
                  </span>
                  <span
                    className="transition-opacity opacity-60 group-hover:opacity-100"
                    style={{
                      color: accent,
                      fontFamily: "var(--font-display)",
                      fontSize: 11,
                    }}
                  >
                    {allOn ? t("filter.deselectAll") : t("filter.selectAll")}
                  </span>
                </button>

                <div
                  className="flex items-baseline gap-1.5 tabular"
                  style={{
                    color: "var(--fg-muted)",
                    fontFamily: "var(--font-display)",
                    fontSize: 11,
                  }}
                >
                  <span style={{ fontSize: 10 }}>{t("filter.tally")}</span>
                  <span style={{ color: cityTotal > 0 ? accent : "var(--fg-muted)", fontWeight: 600 }}>
                    {String(cityTotal).padStart(2, "0")}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {DISTRICTS.filter((d) => d.city === city).map((d) => {
                  const checked = filters.districts.includes(d.id);
                  const count = districtCounts[d.id] ?? 0;
                  const empty = count === 0;
                  return (
                    <DistrictChip
                      key={d.id}
                      label={d.label.replace("حي ", "")}
                      count={count}
                      checked={checked}
                      empty={empty}
                      accent={accent}
                      onClick={() => toggleDistrict(d.id)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* — controls row: price · age · sort · gone ——————————————— */}
      <div
        className="flex flex-wrap items-stretch gap-x-4 md:gap-x-6 gap-y-3 md:gap-y-4 px-3.5 md:px-5 py-3 md:py-4 border-t"
        style={{ borderColor: "var(--hairline)" }}
      >
        <Field label={t("field.price")} className="flex-1 min-w-[260px] md:min-w-[300px]">
          <PriceRange
            min={filters.priceMin}
            max={filters.priceMax}
            onChange={(priceMin, priceMax) => onChange({ ...filters, priceMin, priceMax })}
          />
        </Field>

        <Divider />

        <Field label={t("field.age")}>
          <Segmented
            value={filters.ageMode}
            options={AGE_MODES}
            onChange={(v) => onChange({ ...filters, ageMode: v })}
          />
        </Field>

        <Divider />

        <Field label={t("field.sort")}>
          <SortDropdown
            value={filters.sort}
            onChange={(v) => onChange({ ...filters, sort: v })}
          />
        </Field>

        <Divider />

        <Field label={t("field.gone")}>
          <Switch
            checked={filters.includeGone}
            onChange={(v) => onChange({ ...filters, includeGone: v })}
            onLabel={t("switch.show")}
            offLabel={t("switch.hide")}
          />
        </Field>
      </div>
        </div>
      )}
    </section>
  );
}

function ActiveFilterSummary({ filters }: { filters: Filters }) {
  const items: string[] = [];
  items.push(`${filters.districts.length} حي`);
  items.push(`${(filters.priceMin / 1000).toFixed(0)}–${(filters.priceMax / 1000).toFixed(0)}k ر.س`);
  if (filters.ageMode !== "any") {
    items.push(filters.ageMode === "new-only" ? "جديد فقط" : "≤ ٢ سنة");
  }
  if (filters.includeGone) items.push("+ منتهية");
  if (filters.query) items.push(`"${filters.query}"`);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((label, i) => (
        <span
          key={i}
          className="inline-flex items-baseline rounded-full"
          style={{
            border: "1px solid var(--hairline)",
            color: "var(--fg)",
            background: "var(--surface)",
            padding: "2px 10px",
            fontFamily: "var(--font-display)",
            fontSize: 11,
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/* ───────────────────────── primitives ───────────────────────── */

function Stat({
  label,
  value,
  accent,
  accentColor = "var(--sage)",
}: {
  label: string;
  value: string;
  accent?: boolean;
  accentColor?: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span style={{ fontFamily: "var(--font-display)", color: "var(--fg-muted)" }}>{label}</span>
      <span
        style={{
          color: accent ? accentColor : "var(--fg-muted)",
          fontFamily: "var(--font-serif)",
          fontWeight: 600,
        }}
      >
        {value}
      </span>
    </span>
  );
}

function Bracket({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const base = "absolute w-3 h-3 pointer-events-none";
  const pos = {
    tl: "top-1.5 start-1.5 border-t border-s",
    tr: "top-1.5 end-1.5 border-t border-e",
    bl: "bottom-1.5 start-1.5 border-b border-s",
    br: "bottom-1.5 end-1.5 border-b border-e",
  }[position];
  return <span aria-hidden className={`${base} ${pos}`} style={{ borderColor: "var(--terracotta)", opacity: 0.5 }} />;
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 11,
          fontWeight: 500,
          color: "var(--stone)",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      className="hidden md:block self-stretch w-px"
      style={{ background: "var(--hairline)" }}
    />
  );
}

function DistrictChip({
  label,
  count,
  checked,
  empty,
  accent,
  onClick,
}: {
  label: string;
  count: number;
  checked: boolean;
  empty: boolean;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className="group inline-flex items-center gap-1.5 rounded-full border ps-2 pe-1.5 py-1 text-[11px] transition-all"
      style={{
        borderColor: checked ? accent : "var(--hairline)",
        background: checked ? withAlpha(accent, 0.08) : "transparent",
        color: checked ? "var(--fg)" : empty ? "var(--fg-muted)" : "var(--fg)",
        opacity: empty && !checked ? 0.55 : 1,
      }}
    >
      <span
        aria-hidden
        className="inline-block w-1 h-1 rounded-full transition-colors"
        style={{
          background: checked ? accent : empty ? "transparent" : "var(--stone)",
          boxShadow: checked ? "none" : empty ? "inset 0 0 0 1px var(--hairline)" : "none",
        }}
      />
      <span style={{ fontFamily: "var(--font-display)" }}>{label}</span>
      <span
        className="font-mono tabular text-[9px] rounded-full px-1.5 py-px"
        style={{
          background: checked ? accent : "transparent",
          color: checked ? "var(--parchment)" : empty ? "var(--fg-muted)" : "var(--stone)",
          border: checked ? "none" : "1px solid var(--hairline)",
          minWidth: 18,
          textAlign: "center",
        }}
      >
        {count}
      </span>
    </button>
  );
}

function SearchSlip({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="shrink-0"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--fg)",
        }}
      >
        {t("search.find")}
      </span>
      <span aria-hidden className="self-stretch w-px" style={{ background: "var(--hairline)" }} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("search.placeholder")}
        className="flex-1 bg-transparent outline-none text-[13px]"
        style={{
          color: "var(--fg)",
          fontFamily: "var(--font-body)",
          borderBottom: "1px dotted var(--hairline)",
          paddingBottom: 4,
        }}
        dir="rtl"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label={t("search.clear")}
          className="hover:underline underline-offset-4"
          style={{
            color: "var(--terracotta)",
            fontFamily: "var(--font-display)",
            fontSize: 12,
          }}
        >
          {t("search.clear")} ✕
        </button>
      )}
    </div>
  );
}

function PriceRange({
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 font-mono text-[12px] tabular">
        <NumberCell
          value={min}
          onChange={(v) => onChange(Math.min(v, max), max)}
          min={PRICE_FLOOR}
          max={max}
        />
        <span style={{ color: "var(--stone)" }}>—</span>
        <NumberCell
          value={max}
          onChange={(v) => onChange(min, Math.max(v, min))}
          min={min}
          max={PRICE_CEILING}
        />
        <span
          style={{
            color: "var(--stone)",
            fontFamily: "var(--font-display)",
            fontSize: 11,
          }}
        >
          ريال / سنة
        </span>
      </div>

      {/* visual track */}
      <div
        className="relative h-[3px] rounded-full overflow-hidden"
        style={{ background: "var(--surface)" }}
      >
        <span
          className="absolute top-0 h-full"
          style={{
            insetInlineStart: `${fillStart}%`,
            width: `${Math.max(0, fillEnd - fillStart)}%`,
            background: "var(--terracotta)",
          }}
        />
      </div>

      <div
        className="font-mono text-[10px] tabular"
        style={{ color: "var(--fg-muted)" }}
      >
        ≈ {monthlyMin.toLocaleString()}–{monthlyMax.toLocaleString()} / شهر
      </div>
    </div>
  );
}

function NumberCell({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
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
      className="w-[88px] bg-transparent font-mono text-[13px] tabular outline-none transition-colors"
      style={{
        color: "var(--fg)",
        borderBottom: "1px solid var(--hairline)",
        paddingBottom: 2,
      }}
    />
  );
}

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
      className="inline-flex overflow-hidden self-start"
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: "var(--radius-chip)",
        height: 36,
      }}
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="inline-flex items-center justify-center transition-colors"
            style={{
              padding: "0 14px",
              background: active ? "var(--terracotta)" : "transparent",
              color: active ? "var(--parchment)" : "var(--fg-muted)",
              borderInlineStart: i === 0 ? "none" : "1px solid var(--hairline)",
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: active ? 500 : 400,
            }}
          >
            {opt.ar}
          </button>
        );
      })}
    </div>
  );
}

function SortDropdown({
  value,
  onChange,
}: {
  value: Filters["sort"];
  onChange: (v: Filters["sort"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center transition-colors"
        style={{
          height: 36,
          padding: "0 12px",
          gap: 8,
          border: "1px solid",
          borderColor: open ? "var(--terracotta)" : "var(--hairline)",
          borderRadius: "var(--radius-chip)",
          background: open ? "var(--surface)" : "transparent",
        }}
      >
        <span style={{ color: "var(--fg)", fontFamily: "var(--font-display)", fontSize: 13 }}>
          {current.ar}
        </span>
        <span
          aria-hidden
          style={{
            color: "var(--terracotta)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 160ms",
            fontSize: 11,
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-full mt-1 end-0 z-30 min-w-[180px] rounded-[3px] border overflow-hidden"
          style={{
            background: "var(--bg-raised)",
            borderColor: "var(--hairline)",
            boxShadow: "0 8px 24px -8px rgba(26,22,19,0.18)",
          }}
        >
          {SORT_OPTIONS.map((opt, i) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className="w-full flex items-baseline gap-3 text-start transition-colors hover:[background:var(--surface)]"
                style={{
                  padding: "10px 14px",
                  background: active ? "color-mix(in srgb, var(--terracotta) 8%, transparent)" : "transparent",
                  borderTop: i === 0 ? "none" : "1px dotted var(--hairline)",
                }}
              >
                <span
                  aria-hidden
                  className="inline-block w-1 h-1 rounded-full"
                  style={{ background: active ? "var(--terracotta)" : "transparent" }}
                />
                <span style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--fg)" }}>
                  {opt.ar}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  onLabel,
  offLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 self-start"
    >
      <span
        className="relative inline-block w-9 h-[18px] rounded-full transition-colors"
        style={{
          background: checked ? "var(--gunmetal)" : "var(--surface)",
          border: "1px solid var(--hairline)",
        }}
      >
        <span
          className="absolute top-[1px] w-[14px] h-[14px] rounded-full transition-all"
          style={{
            insetInlineStart: checked ? "calc(100% - 16px)" : "1px",
            background: checked ? "var(--parchment)" : "var(--stone)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
          }}
        />
      </span>
      <span
        style={{
          color: checked ? "var(--fg)" : "var(--fg-muted)",
          fontFamily: "var(--font-display)",
          fontSize: 12,
        }}
      >
        {checked ? onLabel : offLabel}
      </span>
    </button>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

function withAlpha(color: string, alpha: number): string {
  // For CSS var() colors, fall back to a known terracotta tint so transparency
  // still works in older browsers. For new browsers, color-mix() is exact.
  if (color.startsWith("var(")) {
    return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
  }
  return color;
}
