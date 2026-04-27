import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import type { Listing, RefreshRun } from "@/lib/types";
import { DISTRICTS } from "@/lib/districts";

export const dynamic = "force-dynamic";

const VALID_IDS = new Set(DISTRICTS.map((d) => d.id));
const ID_TO_DISTRICT = new Map(DISTRICTS.map((d) => [d.id, d]));

/**
 * Text-based district override. aqar's URL slug categorization is coarse — many
 * listings that physically sit in الراكة-الشمالية or هجر end up filed under a
 * neighboring slug (الراكة-الجنوبية, الفردوس, etc.) but the poster mentions
 * the real neighborhood in the description. We scan for those mentions and
 * reclassify.
 *
 * Each entry is keyed by composite district ID (`city:slug`) so overrides are
 * city-scoped — Dammam هجر and Dhahran هجر have separate entries.
 */
const TEXT_OVERRIDES: { id: string; patterns: RegExp[] }[] = [
  { id: "الخبر:الراكة-الشمالية",   patterns: [/الراك[هة]\s*الشمالي[هة]/] },
  { id: "الدمام:هجر", patterns: [
      /(?:حي|بحي|في)\s*هجر(?:\W|$)/,
      /\bهجر\s*[،,-]/,
      /\bهجر\s*الدمام/,
  ]},
  { id: "الدمام:القصور", patterns: [
      /(?:حي|بحي|في)\s*القصور/,
      /\bالقصور\s*[،,]/,
      /\bالقصور\s*[-–]\s*الدمام/,
  ]},
];

function overrideDistrict(raw: { url: string; description: string | null; title: string | null }): string | null {
  const hay = `${raw.title ?? ""}  ${raw.description ?? ""}`;
  for (const { id, patterns } of TEXT_OVERRIDES) {
    if (patterns.some((re) => re.test(hay))) return id;
  }
  return null;
}

// Build SQL LIKE clauses for one district id (city + slug). The URL match is
// city-scoped: `%/<city>/حي-<slug>/%`. Text override patterns add OR clauses
// against description/title for districts aqar doesn't expose as a URL slug
// but sellers mention in free text.
function districtClauses(id: string, paramOffset: number): { sql: string; params: string[] } {
  const dist = ID_TO_DISTRICT.get(id);
  if (!dist) return { sql: "false", params: [] };
  const { city, slug } = dist;
  const params: string[] = [`%/${city}/حي-${slug}/%`];
  const parts: string[] = [`url LIKE $${paramOffset + params.length}`];
  if (id === "الدمام:هجر") {
    for (const p of [`%حي هجر%`, `%في هجر%`, `%هجر،%`]) {
      params.push(p);
      parts.push(`description LIKE $${paramOffset + params.length}`);
    }
    params.push(`%هجر%`);
    parts.push(`title LIKE $${paramOffset + params.length}`);
  }
  if (id === "الخبر:الراكة-الشمالية") {
    for (const p of [`%الراكة الشمالية%`, `%الراكه الشمالية%`]) {
      params.push(p);
      parts.push(`description LIKE $${paramOffset + params.length}`);
    }
  }
  if (id === "الدمام:القصور") {
    for (const p of [`%حي القصور%`, `%بحي القصور%`, `%في القصور%`]) {
      params.push(p);
      parts.push(`description LIKE $${paramOffset + params.length}`);
    }
    params.push(`%القصور%`);
    parts.push(`title LIKE $${paramOffset + params.length}`);
  }
  return { sql: `(${parts.join(" OR ")})`, params };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const districtsParam = sp.get("districts");
  // Accept either composite ids (city:slug) or — for backwards-compat with
  // older clients — bare slugs that we expand to the first matching id.
  const ids = districtsParam
    ? districtsParam
        .split(",")
        .map((s) => (VALID_IDS.has(s) ? s : DISTRICTS.find((d) => d.slug === s)?.id))
        .filter((s): s is string => Boolean(s))
    : DISTRICTS.map((d) => d.id);
  const priceMin = Number(sp.get("priceMin") ?? 0);
  const priceMax = Number(sp.get("priceMax") ?? 1_000_000);
  const ageMode = (sp.get("ageMode") ?? "le-2y") as "new-only" | "le-2y" | "any";
  const includeGone = sp.get("includeGone") === "true";

  const pool = getPool();

  const params: unknown[] = [];
  const districtOrs: string[] = [];
  for (const id of ids) {
    const { sql, params: p } = districtClauses(id, params.length);
    if (sql !== "false") {
      districtOrs.push(sql);
      params.push(...p);
    }
  }

  const where: string[] = [];
  if (districtOrs.length === 0) {
    // No valid districts selected — return nothing.
    where.push("1=0");
  } else {
    where.push(`(${districtOrs.join(" OR ")})`);
  }
  params.push(priceMin); where.push(`price_annual_sar >= $${params.length}`);
  params.push(priceMax); where.push(`price_annual_sar <= $${params.length}`);

  if (!includeGone) where.push("status = 'active'");
  if (ageMode === "new-only") where.push("is_new = 1");
  if (ageMode === "le-2y") where.push("(is_new = 1 OR age_label IN ('new','<2y'))");

  const sql = `
    SELECT
      id, url, city, district, title,
      price_annual_sar, price_raw, price_period,
      area_sqm, bedrooms, bathrooms, living_rooms,
      age_label, is_new, description, image_url,
      photos,
      first_seen_at, last_seen_at, status
    FROM listings
    WHERE ${where.join(" AND ")}
    ORDER BY
      CASE WHEN status='gone' THEN 1 ELSE 0 END,
      is_new DESC,
      last_seen_at DESC,
      price_annual_sar ASC
  `;

  type Row = Omit<Listing, "photos" | "first_seen_at" | "last_seen_at"> & {
    photos: unknown;
    first_seen_at: Date;
    last_seen_at: Date;
  };

  const [{ rows }, latestQ, prevQ] = await Promise.all([
    pool.query<Row>(sql, params),
    pool.query<RefreshRun>("SELECT * FROM refresh_runs ORDER BY id DESC LIMIT 1"),
    pool.query<RefreshRun>("SELECT * FROM refresh_runs ORDER BY id DESC LIMIT 1 OFFSET 1"),
  ]);

  const latestRun = latestQ.rows[0] ?? null;
  const prevRun = prevQ.rows[0];

  const listingIds = rows.map((r) => r.id);
  const historyByListing = new Map<string, { seen_at: string; price_annual_sar: number }[]>();
  if (listingIds.length) {
    const { rows: hist } = await pool.query<{
      listing_id: string;
      seen_at: Date;
      price_annual_sar: number;
    }>(
      `SELECT listing_id, seen_at, price_annual_sar
         FROM price_history
        WHERE listing_id = ANY($1)
        ORDER BY listing_id, seen_at ASC`,
      [listingIds]
    );
    for (const h of hist) {
      const arr = historyByListing.get(h.listing_id) ?? [];
      arr.push({ seen_at: h.seen_at.toISOString(), price_annual_sar: h.price_annual_sar });
      historyByListing.set(h.listing_id, arr);
    }
  }

  const enriched: Listing[] = rows.map((r) => {
    const history = historyByListing.get(r.id) ?? [];
    let priceChange: { from: number; to: number } | null = null;
    if (history.length >= 2) {
      const last = history[history.length - 1].price_annual_sar;
      const prev = history[history.length - 2].price_annual_sar;
      if (last !== prev) priceChange = { from: prev, to: last };
    }
    const prevRunBoundary = prevRun?.finished_at ?? prevRun?.started_at;
    const isNewInLastRun = Boolean(
      prevRunBoundary && r.first_seen_at >= new Date(prevRunBoundary)
    );

    let photos: string[] = [];
    if (Array.isArray(r.photos)) photos = r.photos as string[];

    // If description text matches a district override, reclassify the label so
    // the UI + district-count reflect the real neighborhood.
    const overriddenId = overrideDistrict({
      url: r.url,
      description: r.description,
      title: r.title,
    });
    let districtLabel = r.district;
    if (overriddenId) {
      const d = ID_TO_DISTRICT.get(overriddenId);
      if (d) districtLabel = d.label;
    }

    return {
      ...r,
      district: districtLabel,
      photos,
      first_seen_at: r.first_seen_at.toISOString(),
      last_seen_at: r.last_seen_at.toISOString(),
      price_history: history,
      price_change: priceChange,
      is_new_in_last_run: isNewInLastRun,
    };
  });

  const summary = {
    total: enriched.length,
    active: enriched.filter((r) => r.status === "active").length,
    new_labeled: enriched.filter((r) => r.is_new === 1 && r.status === "active").length,
    price_dropped: enriched.filter((r) => r.price_change && r.price_change.to < r.price_change.from).length,
    gone: enriched.filter((r) => r.status === "gone").length,
  };

  const latestRunOut = latestRun
    ? {
        ...latestRun,
        started_at: (latestRun.started_at as unknown as Date).toISOString?.() ?? latestRun.started_at,
        finished_at: latestRun.finished_at
          ? (latestRun.finished_at as unknown as Date).toISOString?.() ?? latestRun.finished_at
          : null,
      }
    : null;

  return NextResponse.json({
    listings: enriched,
    summary,
    latestRun: latestRunOut,
    districts: DISTRICTS,
  });
}
