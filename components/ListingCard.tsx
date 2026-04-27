"use client";

import Image from "next/image";
import Link from "next/link";
import { memo, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { formatSAR, monthlyEq } from "@/lib/normalize";
import { t } from "@/lib/i18n";
import { useSavedListings } from "@/lib/saved";
import type { Listing } from "@/lib/types";

type Props = {
  listing: Listing;
  index: number;
  onOpen: (l: Listing) => void;
  onHover: (id: string | null) => void;
  hovered: boolean;
};

function ListingCardImpl({ listing, index, onOpen, onHover, hovered }: Props) {
  const [imgOk, setImgOk] = useState(true);
  const saved = useSavedListings();
  const isSaved = saved.has(listing.id);
  const isGone = listing.status === "gone";
  const annual = listing.price_annual_sar;
  const monthly = monthlyEq(annual);
  const delay = Math.min(index * 24, 480);
  const bed = listing.bedrooms ?? "—";
  const bath = listing.bathrooms ?? "—";
  const area = listing.area_sqm ? `${listing.area_sqm}م²` : "—";
  const aboveFold = index < 8;

  return (
    <article
      className={`rise group relative flex flex-col overflow-hidden cursor-pointer transition-all duration-200 ${
        isGone ? "gone-pattern opacity-70" : ""
      }`}
      style={{
        animationDelay: `${delay}ms`,
        background: "var(--bg-raised)",
        border: "1px solid",
        borderColor: hovered ? "var(--terracotta)" : "var(--hairline)",
        borderRadius: "var(--radius-tile)",
        boxShadow: hovered ? "var(--shadow-lift)" : "none",
        transform: hovered ? "translateY(-2px)" : "none",
      }}
      onMouseEnter={() => onHover(listing.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onOpen(listing)}
    >
      {/* === Image — top of tile ============================================== */}
      <div
        className="relative bg-[var(--surface)] overflow-hidden"
        style={{ aspectRatio: "16 / 10" }}
      >
        {listing.image_url && imgOk ? (
          <Image
            src={listing.image_url}
            alt={listing.title ?? "apartment"}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
            className="object-cover"
            loading={aboveFold ? "eager" : "lazy"}
            onError={() => setImgOk(false)}
            unoptimized
          />
        ) : (
          <div
            className="flex items-center justify-center h-full"
            style={{
              color: "var(--fg-muted)",
              fontFamily: "var(--font-display)",
              fontSize: 11,
            }}
          >
            {t("card.noPhoto")}
          </div>
        )}

        {/* warm wash for legibility behind district pill */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
          style={{ background: "linear-gradient(0deg, rgba(20,15,10,0.42), transparent)" }}
        />

        {/* bookmark star — top-start (touchable) */}
        <button
          aria-label={isSaved ? t("card.unsave") : t("card.save")}
          aria-pressed={isSaved}
          onClick={(e) => {
            e.stopPropagation();
            saved.toggle(listing.id);
          }}
          className="absolute top-2 start-2 inline-flex items-center justify-center transition-all"
          style={{
            width: 28,
            height: 28,
            borderRadius: "var(--radius-pill)",
            background: isSaved
              ? "var(--terracotta)"
              : "color-mix(in srgb, var(--bg-raised) 70%, transparent)",
            color: isSaved ? "var(--parchment)" : "var(--fg)",
            border: `1px solid ${isSaved ? "var(--terracotta)" : "var(--hairline)"}`,
            backdropFilter: "blur(4px)",
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          {isSaved ? "★" : "☆"}
        </button>

        {/* badges — top-end */}
        <div className="absolute top-2 end-2 flex flex-col items-end gap-1 pointer-events-none">
          {listing.is_new === 1 && <StatusBadge kind="new" />}
          {listing.price_change && listing.price_change.to < listing.price_change.from && (
            <StatusBadge kind="price-drop" from={listing.price_change.from} to={listing.price_change.to} />
          )}
          {listing.price_change && listing.price_change.to > listing.price_change.from && (
            <StatusBadge kind="price-rise" from={listing.price_change.from} to={listing.price_change.to} />
          )}
          {isGone && <StatusBadge kind="gone" />}
        </div>

        {/* district label — bottom-start, sits on the wash */}
        <div
          className="absolute bottom-2 start-2 inline-flex items-center gap-1.5"
          style={{ color: "var(--parchment)" }}
        >
          <span
            aria-hidden
            className="inline-block w-1 h-1 rounded-full"
            style={{ background: "var(--terracotta)", boxShadow: "0 0 0 2px rgba(244,236,216,0.25)" }}
          />
          <span
            className="text-[12px] leading-none"
            style={{ fontFamily: "var(--font-display)", textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
          >
            {listing.district.replace("حي ", "")}
          </span>
        </div>
      </div>

      {/* === Body ============================================================ */}
      <div
        className="flex flex-col flex-1 min-w-0"
        style={{ padding: "10px 12px 8px" }}
      >
        {/* Price line — primary */}
        <div className="flex items-baseline justify-between gap-2 min-w-0">
          <span
            className="tabular leading-none"
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 600,
              fontSize: 20,
              color: "var(--fg)",
            }}
          >
            {formatSAR(annual)}
            <span
              className="ms-1"
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 400,
                fontSize: 10,
                color: "var(--fg-muted)",
              }}
            >
              /سنة
            </span>
          </span>
          <span
            className="tabular shrink-0"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--fg-muted)",
            }}
          >
            ≈ {formatSAR(monthly)}
          </span>
        </div>

        {/* Specs row — secondary */}
        <div
          className="tabular flex items-center mt-1.5"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--fg-muted)",
            gap: "var(--s-2)",
          }}
        >
          <span>{area}</span>
          <DotSep />
          <span>{bed}🛏</span>
          <DotSep />
          <span>{bath}🚿</span>
          {listing.price_period === "monthly" && (
            <span
              className="ms-auto"
              style={{
                color: "var(--amber)",
                fontFamily: "var(--font-display)",
                fontSize: 10,
              }}
            >
              {t("card.monthly")}
            </span>
          )}
        </div>

        {/* Title — tertiary, optional */}
        {listing.title && (
          <p
            className="mt-2 leading-snug line-clamp-2"
            style={{
              fontSize: 11,
              color: "var(--fg-muted)",
              fontFamily: "var(--font-body)",
            }}
          >
            {listing.title}
          </p>
        )}

        {/* Footer — flush bottom, hairline above */}
        <div
          className="mt-auto pt-2 flex items-center justify-between"
          style={{ borderTop: "1px solid var(--hairline)", marginTop: "var(--s-2)" }}
        >
          <Link
            href={listing.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="hover:opacity-80 transition-opacity"
            style={{
              color: "var(--indigo)",
              fontFamily: "var(--font-display)",
              fontSize: 10,
              fontWeight: 500,
            }}
          >
            {t("card.aqar")} ↗
          </Link>
          <span
            className="tabular"
            style={{
              color: "var(--fg-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
            }}
          >
            #{listing.id}
          </span>
        </div>
      </div>
    </article>
  );
}

function DotSep() {
  return (
    <span aria-hidden style={{ color: "var(--hairline)" }}>
      ·
    </span>
  );
}

export const ListingCard = memo(ListingCardImpl, (prev, next) => {
  return (
    prev.listing === next.listing &&
    prev.hovered === next.hovered &&
    prev.index === next.index
  );
});
