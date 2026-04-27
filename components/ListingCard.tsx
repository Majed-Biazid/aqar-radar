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
      className={`rise group relative flex flex-col overflow-hidden cursor-pointer transition-all ${
        isGone ? "gone-pattern" : ""
      }`}
      style={{
        animationDelay: `${delay}ms`,
        background: "var(--bg-raised)",
        border: "1px solid",
        borderColor: hovered ? "var(--terracotta)" : "var(--hairline-soft)",
        borderRadius: "var(--radius-lg)",
        boxShadow: hovered ? "var(--shadow-lift)" : "var(--shadow-card)",
        transform: hovered ? "translateY(-3px)" : "none",
        opacity: isGone ? 0.7 : 1,
        transitionDuration: "var(--dur-base)",
        transitionTimingFunction: "var(--ease-soft)",
      }}
      onMouseEnter={() => onHover(listing.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onOpen(listing)}
    >
      {/* === Image — top, with inset rounding for the modern look ============ */}
      <div
        className="relative bg-[var(--surface)] overflow-hidden"
        style={{
          aspectRatio: "16 / 11",
          borderStartStartRadius: "var(--radius-md)",
          borderStartEndRadius: "var(--radius-md)",
          borderEndStartRadius: 0,
          borderEndEndRadius: 0,
          margin: 6,
          marginBottom: 0,
        }}
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
              fontSize: 12,
            }}
          >
            {t("card.noPhoto")}
          </div>
        )}

        {/* legibility wash for the district pill */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
          style={{ background: "linear-gradient(0deg, rgba(20,15,10,0.45), transparent)" }}
        />

        {/* save button — top-start */}
        <button
          aria-label={isSaved ? t("card.unsave") : t("card.save")}
          aria-pressed={isSaved}
          onClick={(e) => {
            e.stopPropagation();
            saved.toggle(listing.id);
          }}
          className="absolute top-2.5 start-2.5 inline-flex items-center justify-center transition-all"
          style={{
            width: 32,
            height: 32,
            borderRadius: "var(--radius-pill)",
            background: isSaved
              ? "var(--terracotta)"
              : "color-mix(in srgb, var(--bg-raised) 65%, transparent)",
            color: isSaved ? "var(--parchment)" : "var(--fg)",
            border: `1px solid ${isSaved ? "var(--terracotta)" : "rgba(244,236,216,0.45)"}`,
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          {isSaved ? "★" : "☆"}
        </button>

        {/* status badges — top-end */}
        <div className="absolute top-2.5 end-2.5 flex flex-col items-end gap-1 pointer-events-none">
          {listing.is_new === 1 && <StatusBadge kind="new" />}
          {listing.price_change && listing.price_change.to < listing.price_change.from && (
            <StatusBadge kind="price-drop" from={listing.price_change.from} to={listing.price_change.to} />
          )}
          {listing.price_change && listing.price_change.to > listing.price_change.from && (
            <StatusBadge kind="price-rise" from={listing.price_change.from} to={listing.price_change.to} />
          )}
          {isGone && <StatusBadge kind="gone" />}
        </div>

        {/* district pill — bottom-start, sits on the wash */}
        <div
          className="absolute bottom-2.5 start-2.5 inline-flex items-center gap-1.5"
          style={{
            color: "var(--parchment)",
            background: "rgba(20,15,10,0.42)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            paddingInline: 10,
            paddingBlock: 4,
            borderRadius: "var(--radius-pill)",
            fontFamily: "var(--font-display)",
            fontSize: 11.5,
          }}
        >
          <span
            aria-hidden
            className="inline-block"
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: "var(--terracotta-soft)",
            }}
          />
          <span style={{ lineHeight: 1 }}>
            {listing.district.replace("حي ", "")}
          </span>
        </div>
      </div>

      {/* === Body ============================================================ */}
      <div
        className="flex flex-col flex-1 min-w-0"
        style={{ padding: "14px 16px 12px" }}
      >
        {/* Price line — primary */}
        <div className="flex items-baseline justify-between gap-2 min-w-0">
          <span
            className="tabular leading-none"
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 600,
              fontSize: 22,
              color: "var(--fg)",
              letterSpacing: "-0.01em",
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
              fontSize: 11,
              color: "var(--fg-muted)",
            }}
          >
            ≈ {formatSAR(monthly)}
          </span>
        </div>

        {/* Specs row */}
        <div
          className="tabular flex items-center mt-2"
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

        {/* Title */}
        {listing.title && (
          <p
            className="mt-2.5 leading-snug line-clamp-2"
            style={{
              fontSize: 12,
              color: "var(--fg-muted)",
              fontFamily: "var(--font-body)",
            }}
          >
            {listing.title}
          </p>
        )}

        {/* Footer */}
        <div
          className="mt-auto pt-3 flex items-center justify-between"
          style={{
            borderTop: "1px solid var(--hairline-soft)",
            marginTop: "var(--s-3)",
          }}
        >
          <Link
            href={listing.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
            style={{
              color: "var(--indigo)",
              fontFamily: "var(--font-display)",
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            <span>{t("card.aqar")}</span>
            <span style={{ fontSize: 9 }}>↗</span>
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
