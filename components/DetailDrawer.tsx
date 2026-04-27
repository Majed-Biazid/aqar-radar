"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { PriceHistorySparkline } from "./PriceHistorySparkline";
import { formatSAR, monthlyEq, formatDateArabic } from "@/lib/normalize";
import type { Listing } from "@/lib/types";

type Props = {
  listing: Listing | null;
  onClose: () => void;
};

export function DetailDrawer({ listing, onClose }: Props) {
  return (
    <AnimatePresence>
      {listing && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(20, 15, 10, 0.45)", backdropFilter: "blur(4px)" }}
            onClick={onClose}
          />
          <motion.aside
            key="drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 30 }}
            className="fixed top-0 start-0 bottom-0 z-50 w-full max-w-[640px] overflow-y-auto"
            style={{
              background: "var(--bg-raised)",
              borderInlineEnd: "1px solid var(--hairline)",
              boxShadow: "var(--shadow-drawer)",
            }}
          >
            <DetailBody listing={listing} onClose={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function DetailBody({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const photos = listing.photos && listing.photos.length > 0
    ? listing.photos
    : (listing.image_url ? [listing.image_url] : []);

  return (
    <div className="flex flex-col">
      {/* Photo gallery — sticky hero */}
      <PhotoGallery photos={photos} title={listing.title ?? listing.district} />

      <div
        className="flex flex-col"
        style={{ padding: "var(--s-6) var(--s-6) var(--s-8)", gap: "var(--s-6)" }}
      >
        {/* Header — register identifier + close */}
        <header className="flex items-start justify-between" style={{ gap: "var(--s-4)" }}>
          <div className="flex-1 min-w-0">
            <div className="label label-sm">
              سجل · listing #{listing.id} · {listing.city ?? "—"}
            </div>
            <h2
              className="leading-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--fg)",
                fontSize: 22,
                fontWeight: 500,
                marginTop: "var(--s-2)",
              }}
            >
              {listing.title ?? listing.district}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="close (esc)"
            className="inline-flex items-center justify-center transition-colors hover:opacity-80"
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius-chip)",
              border: "1px solid var(--hairline)",
              color: "var(--fg-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            ✕
          </button>
        </header>

        {/* Price block — annual + monthly equivalent */}
        <section
          className="grid grid-cols-2"
          style={{
            gap: "var(--s-4)",
            paddingTop: "var(--s-4)",
            paddingBottom: "var(--s-4)",
            borderTop: "1px solid var(--hairline)",
            borderBottom: "1px solid var(--hairline)",
          }}
        >
          <div>
            <div className="label label-sm">annual · سنوي</div>
            <div
              className="tabular leading-none"
              style={{
                fontFamily: "var(--font-serif)",
                fontWeight: 600,
                fontSize: 32,
                color: "var(--fg)",
                marginTop: "var(--s-2)",
              }}
            >
              {formatSAR(listing.price_annual_sar)}
            </div>
            <div className="label label-xs" style={{ marginTop: "var(--s-1)", color: "var(--fg-muted)" }}>
              SAR /سنة
            </div>
          </div>
          <div>
            <div className="label label-sm">monthly · شهري</div>
            <div
              className="tabular leading-none"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 22,
                color: "var(--indigo)",
                marginTop: "var(--s-2)",
              }}
            >
              {formatSAR(monthlyEq(listing.price_annual_sar))}
            </div>
            <div
              className="label label-xs"
              style={{ marginTop: "var(--s-1)", color: "var(--fg-muted)" }}
            >
              SAR /شهر
              {listing.price_period === "monthly" && (
                <span style={{ marginInlineStart: 8, color: "var(--amber)", textTransform: "none" }}>
                  · raw price labeled monthly
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Specs — quad of stats */}
        <section className="grid grid-cols-4" style={{ gap: "var(--s-2)" }}>
          <Stat label="حي" value={listing.district.replace("حي ", "")} />
          <Stat label="م²" value={listing.area_sqm ? String(listing.area_sqm) : "—"} />
          <Stat label="🛏" value={listing.bedrooms != null ? String(listing.bedrooms) : "—"} />
          <Stat label="🚿" value={listing.bathrooms != null ? String(listing.bathrooms) : "—"} />
        </section>

        {/* Price history */}
        <section>
          <SectionLabel>price history · سجل السعر</SectionLabel>
          <PriceHistorySparkline history={listing.price_history ?? []} />
        </section>

        {/* Description */}
        {listing.description && (
          <section>
            <SectionLabel>وصف المعلن · raw description</SectionLabel>
            <p
              className="whitespace-pre-wrap leading-relaxed"
              style={{
                fontSize: 13,
                color: "var(--fg)",
                fontFamily: "var(--font-body)",
                marginTop: "var(--s-2)",
              }}
            >
              {listing.description}
            </p>
          </section>
        )}

        {/* Provenance row */}
        <section
          className="grid grid-cols-2"
          style={{
            gap: "var(--s-4)",
            paddingTop: "var(--s-4)",
            borderTop: "1px solid var(--hairline)",
          }}
        >
          <div>
            <div className="label label-xs">first seen</div>
            <div
              className="tabular"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--fg-muted)",
                marginTop: 4,
              }}
            >
              {formatDateArabic(listing.first_seen_at)}
            </div>
          </div>
          <div>
            <div className="label label-xs">last seen</div>
            <div
              className="tabular"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--fg-muted)",
                marginTop: 4,
              }}
            >
              {formatDateArabic(listing.last_seen_at)}
            </div>
          </div>
        </section>

        {/* CTA */}
        <a
          href={listing.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center transition-opacity hover:opacity-90"
          style={{
            height: 44,
            borderRadius: "var(--radius-chip)",
            background: "var(--terracotta)",
            color: "var(--parchment)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "var(--track-std)",
            textTransform: "uppercase",
          }}
        >
          open on aqar.fm <span aria-hidden style={{ marginInlineStart: 8 }}>↗</span>
        </a>
      </div>
    </div>
  );
}

function PhotoGallery({ photos, title }: { photos: string[]; title: string }) {
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [photos.length > 0 ? photos[0] : ""]);

  if (photos.length === 0) {
    return (
      <div
        className="h-48 flex items-center justify-center font-mono text-[11px]"
        style={{ background: "var(--surface)", color: "var(--fg-muted)" }}
      >
        no photos
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" style={{ background: "var(--ink)" }}>
      <div className="relative w-full" style={{ aspectRatio: "3/2" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[active]}
          alt={`${title} — photo ${active + 1}`}
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
        />
        {photos.length > 1 && (
          <>
            <button
              onClick={() => setActive((i) => (i - 1 + photos.length) % photos.length)}
              className="absolute top-1/2 start-2 -translate-y-1/2 w-9 h-9 rounded-full grid place-items-center"
              style={{ background: "rgba(15,12,8,0.55)", color: "var(--parchment)" }}
              aria-label="previous"
            >
              ‹
            </button>
            <button
              onClick={() => setActive((i) => (i + 1) % photos.length)}
              className="absolute top-1/2 end-2 -translate-y-1/2 w-9 h-9 rounded-full grid place-items-center"
              style={{ background: "rgba(15,12,8,0.55)", color: "var(--parchment)" }}
              aria-label="next"
            >
              ›
            </button>
            <div
              className="absolute bottom-2 end-2 rounded font-mono text-[10px] px-2 py-1"
              style={{ background: "rgba(15,12,8,0.55)", color: "var(--parchment)" }}
            >
              {active + 1} / {photos.length}
            </div>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-1 overflow-x-auto px-2 pb-2 scrollbar-none">
          {photos.map((p, i) => (
            <button
              key={p}
              onClick={() => setActive(i)}
              className="flex-none h-14 w-20 overflow-hidden border-2 rounded-[2px]"
              style={{ borderColor: i === active ? "var(--terracotta)" : "transparent" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col items-center text-center"
      style={{
        padding: "10px 8px",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--radius-chip)",
      }}
    >
      <span style={{ fontSize: 14, color: "var(--stone)", lineHeight: 1 }}>{label}</span>
      <span
        className="tabular truncate w-full"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--fg)",
          marginTop: 4,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="label label-sm flex items-center"
      style={{ gap: 8, marginBottom: "var(--s-2)" }}
    >
      <span>{children}</span>
      <span
        aria-hidden
        className="flex-1 h-px"
        style={{ background: "var(--hairline)" }}
      />
    </div>
  );
}
