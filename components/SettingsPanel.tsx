"use client";

import { useEffect, useState } from "react";
import { usePrefs, type FilterMode } from "@/lib/prefs";
import type { Filters } from "@/lib/types";

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

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="الإعدادات"
        title="الإعدادات"
        className="btn btn-ghost btn-icon"
        style={{ color: "var(--fg-muted)" }}
      >
        <GearGlyph />
      </button>
      {open && <SettingsModal onClose={() => setOpen(false)} />}
    </>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const { prefs, setPrefs, reset } = usePrefs();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <>
      {/* scrim */}
      <button
        type="button"
        onClick={onClose}
        aria-label="إغلاق"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 70,
          background: "rgba(20, 15, 10, 0.50)",
          backdropFilter: "blur(2px)",
          animation: "fade-in var(--dur-base) var(--ease-soft)",
          cursor: "default",
        }}
      />

      {/* modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="الإعدادات"
        className="flex flex-col"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(520px, calc(100vw - 32px))",
          maxHeight: "calc(100vh - 64px)",
          background: "var(--bg-raised)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-drawer)",
          zIndex: 71,
          animation: "scale-in var(--dur-slow) var(--ease-out)",
          overflow: "hidden",
        }}
      >
        {/* header */}
        <header
          className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0"
          style={{ borderBottom: "1px solid var(--hairline-soft)" }}
        >
          <div className="flex flex-col">
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                fontWeight: 700,
                color: "var(--fg)",
                lineHeight: 1.1,
              }}
            >
              الإعدادات
            </h2>
            <span
              className="italic"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 13,
                color: "var(--fg-muted)",
                marginTop: 4,
              }}
            >
              تخصيصات تُحفظ في جهازك
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
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

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col" style={{ gap: "var(--s-6)" }}>
            <Section
              title="عرض الفلاتر"
              hint="اختر كيف تظهر فلاتر التصفية في الصفحة"
            >
              <SegmentedTwo<FilterMode>
                value={prefs.filterMode}
                options={[
                  { value: "inline", ar: "في الصفحة", hint: "مثبّتة دائماً" },
                  { value: "drawer", ar: "في درج", hint: "تُفتح بزر" },
                ]}
                onChange={(v) => setPrefs({ filterMode: v })}
              />
            </Section>

            <Section title="ترتيب افتراضي">
              <RadioList
                value={prefs.defaultSort}
                options={SORT_OPTIONS}
                onChange={(v) => setPrefs({ defaultSort: v })}
              />
            </Section>

            <Section title="عمر العقار افتراضي">
              <SegmentedTwo
                value={prefs.defaultAge}
                options={AGE_MODES.map((a) => ({ value: a.value, ar: a.ar }))}
                onChange={(v) => setPrefs({ defaultAge: v as Filters["ageMode"] })}
              />
            </Section>

            <Section title="نطاق السعر الافتراضي (ريال / سنة)">
              <div className="flex items-end gap-3">
                <NumberCell
                  label="من"
                  value={prefs.defaultPriceMin}
                  onChange={(v) =>
                    setPrefs({
                      defaultPriceMin: Math.min(v, prefs.defaultPriceMax),
                    })
                  }
                />
                <NumberCell
                  label="إلى"
                  value={prefs.defaultPriceMax}
                  onChange={(v) =>
                    setPrefs({
                      defaultPriceMax: Math.max(v, prefs.defaultPriceMin),
                    })
                  }
                />
              </div>
            </Section>

            <Section title="إظهار العروض المنتهية">
              <SwitchRow
                checked={prefs.defaultIncludeGone}
                onChange={(v) => setPrefs({ defaultIncludeGone: v })}
                label={
                  prefs.defaultIncludeGone
                    ? "تظهر افتراضياً ضمن النتائج"
                    : "مخفية افتراضياً"
                }
              />
            </Section>
          </div>
        </div>

        {/* footer */}
        <footer
          className="flex items-center justify-between gap-3 px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--hairline-soft)" }}
        >
          <button
            type="button"
            onClick={() => {
              if (confirm("استعادة الإعدادات الافتراضية؟")) reset();
            }}
            className="btn btn-ghost"
          >
            استعادة الافتراضي
          </button>
          <button type="button" onClick={onClose} className="btn btn-primary flex-1">
            تم
          </button>
        </footer>
      </div>
    </>
  );
}

/* — primitives ——————————————————————————— */

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col" style={{ gap: 8 }}>
      <div className="flex flex-col" style={{ gap: 2 }}>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--fg)",
          }}
        >
          {title}
        </h3>
        {hint && (
          <span
            style={{
              fontSize: 11,
              color: "var(--fg-muted)",
              fontFamily: "var(--font-display)",
            }}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function SegmentedTwo<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; ar: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="grid p-1"
      style={{
        background: "var(--surface-soft)",
        borderRadius: "var(--radius-md)",
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="flex flex-col items-center justify-center transition-all"
            style={{
              minHeight: 48,
              paddingInline: 12,
              paddingBlock: 8,
              background: active ? "var(--bg-raised)" : "transparent",
              borderRadius: "var(--radius-sm)",
              boxShadow: active ? "var(--shadow-card)" : "none",
              gap: 2,
              cursor: "pointer",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: active ? "var(--fg)" : "var(--fg-muted)",
              }}
            >
              {opt.ar}
            </span>
            {opt.hint && (
              <span
                style={{
                  fontSize: 10,
                  color: active ? "var(--terracotta)" : "var(--fg-muted)",
                  fontFamily: "var(--font-display)",
                }}
              >
                {opt.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function RadioList<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; ar: string }[];
  onChange: (v: T) => void;
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
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background: active
                ? "color-mix(in srgb, var(--terracotta) 8%, transparent)"
                : "transparent",
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

function NumberCell({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
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
        style={{
          background: "var(--surface-soft)",
          borderRadius: "var(--radius-md)",
          height: 44,
          paddingInline: 14,
          display: "flex",
          alignItems: "center",
        }}
      >
        <input
          type="number"
          value={value}
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

function GearGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2.5 L10 4.5 M10 15.5 L10 17.5 M2.5 10 L4.5 10 M15.5 10 L17.5 10 M4.7 4.7 L6.1 6.1 M13.9 13.9 L15.3 15.3 M4.7 15.3 L6.1 13.9 M13.9 6.1 L15.3 4.7" />
    </svg>
  );
}
