"""
One-shot migration: copy data/listings.db → Supabase Postgres.

Usage:
  # Reads SUPABASE_DB_URL from .env.local
  python3 scripts/migrate_sqlite_to_supabase.py

  # Or pass it explicitly:
  python3 scripts/migrate_sqlite_to_supabase.py \
      --sqlite data/listings.db \
      --pg-url "postgresql://postgres.xxx:pwd@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"

Idempotent: uses ON CONFLICT DO UPDATE/NOTHING so re-running is safe.
The destination tables must exist (run scripts/supabase-schema.sql first).
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras


def load_env_local(env_path: Path) -> None:
    """Tiny .env.local loader so we don't pull in a dotenv dep."""
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def chunked(seq, n):
    buf = []
    for x in seq:
        buf.append(x)
        if len(buf) >= n:
            yield buf
            buf = []
    if buf:
        yield buf


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    load_env_local(repo_root / ".env.local")

    ap = argparse.ArgumentParser()
    ap.add_argument("--sqlite", default=str(repo_root / "data" / "listings.db"))
    ap.add_argument("--pg-url", default=os.environ.get("SUPABASE_DB_URL"))
    args = ap.parse_args()

    if not args.pg_url:
        print("error: SUPABASE_DB_URL not set and --pg-url not given", file=sys.stderr)
        sys.exit(1)

    sqlite_path = Path(args.sqlite)
    if not sqlite_path.exists():
        print(f"error: SQLite file not found: {sqlite_path}", file=sys.stderr)
        sys.exit(1)

    src = sqlite3.connect(sqlite_path)
    src.row_factory = sqlite3.Row
    dst = psycopg2.connect(args.pg_url)
    dst.autocommit = False

    # ---- listings ----
    src_rows = src.execute("SELECT * FROM listings").fetchall()
    print(f"[listings]   {len(src_rows)} rows")

    # Clamp obviously broken integers from the scraper. Realistic ranges:
    #   area_sqm:           < 100,000 m² (apartments top out far below this)
    #   price_annual_sar:   < 100,000,000 SAR (extreme upper bound for sanity)
    #   bedrooms/baths:     < 100
    INT4_MAX = 2_147_483_647
    def safe_int(v, ceiling=INT4_MAX):
        if v is None:
            return None
        try:
            n = int(v)
        except (TypeError, ValueError):
            return None
        return n if 0 <= n <= ceiling else None

    listing_payloads = []
    for r in src_rows:
        photos_json = r["photos_json"] if "photos_json" in r.keys() else None
        try:
            photos = json.loads(photos_json) if photos_json else []
        except Exception:
            photos = []
        listing_payloads.append((
            r["id"], r["url"], r["city"] if "city" in r.keys() else None, r["district"], r["title"],
            safe_int(r["price_annual_sar"], 100_000_000),
            safe_int(r["price_raw"], 100_000_000),
            r["price_period"],
            safe_int(r["area_sqm"], 100_000),
            safe_int(r["bedrooms"], 100),
            safe_int(r["bathrooms"], 100),
            safe_int(r["living_rooms"], 100),
            r["age_label"], r["is_new"], r["description"], r["image_url"],
            json.dumps(photos, ensure_ascii=False),
            r["first_seen_at"], r["last_seen_at"], r["status"],
        ))

    sql_listings = """
        INSERT INTO listings (
          id, url, city, district, title, price_annual_sar, price_raw, price_period,
          area_sqm, bedrooms, bathrooms, living_rooms, age_label, is_new, description,
          image_url, photos, first_seen_at, last_seen_at, status
        ) VALUES %s
        ON CONFLICT (id) DO UPDATE SET
          url=EXCLUDED.url, city=EXCLUDED.city, district=EXCLUDED.district, title=EXCLUDED.title,
          price_annual_sar=EXCLUDED.price_annual_sar, price_raw=EXCLUDED.price_raw,
          price_period=EXCLUDED.price_period, area_sqm=EXCLUDED.area_sqm,
          bedrooms=EXCLUDED.bedrooms, bathrooms=EXCLUDED.bathrooms,
          living_rooms=EXCLUDED.living_rooms, age_label=EXCLUDED.age_label,
          is_new=EXCLUDED.is_new, description=EXCLUDED.description, image_url=EXCLUDED.image_url,
          photos=EXCLUDED.photos, first_seen_at=EXCLUDED.first_seen_at,
          last_seen_at=EXCLUDED.last_seen_at, status=EXCLUDED.status
    """
    template = "(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s)"
    with dst.cursor() as cur:
        for batch in chunked(listing_payloads, 500):
            psycopg2.extras.execute_values(cur, sql_listings, batch, template=template)
    dst.commit()
    print(f"[listings]   ✓ inserted/updated")

    # ---- price_history ----
    ph_rows = src.execute("SELECT listing_id, seen_at, price_annual_sar FROM price_history").fetchall()
    print(f"[history]    {len(ph_rows)} rows")
    sql_ph = """
        INSERT INTO price_history (listing_id, seen_at, price_annual_sar)
        VALUES %s
        ON CONFLICT (listing_id, seen_at) DO NOTHING
    """
    with dst.cursor() as cur:
        for batch in chunked(((r["listing_id"], r["seen_at"], r["price_annual_sar"]) for r in ph_rows), 500):
            psycopg2.extras.execute_values(cur, sql_ph, batch)
    dst.commit()
    print(f"[history]    ✓ inserted")

    # ---- refresh_runs ----
    rr_rows = src.execute("SELECT * FROM refresh_runs ORDER BY id").fetchall()
    print(f"[runs]       {len(rr_rows)} rows")
    # The Postgres `id` column is auto-generated. We don't preserve old IDs;
    # we just append rows in chronological order so latest-run lookups still
    # show the most recent scrape correctly.
    sql_rr = """
        INSERT INTO refresh_runs
          (started_at, finished_at, listings_scraped, new_count, gone_count, price_change_count)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    with dst.cursor() as cur:
        # Skip if Postgres already has runs (avoid double-import on re-run).
        cur.execute("SELECT COUNT(*) FROM refresh_runs")
        existing = cur.fetchone()[0]
        if existing > 0:
            print(f"[runs]       ↳ {existing} runs already present in Postgres — skipping refresh_runs import")
        else:
            for r in rr_rows:
                cur.execute(sql_rr, (
                    r["started_at"], r["finished_at"], r["listings_scraped"],
                    r["new_count"], r["gone_count"], r["price_change_count"],
                ))
    dst.commit()
    print(f"[runs]       ✓ inserted")

    src.close()
    dst.close()
    print("\n✓ migration complete")


if __name__ == "__main__":
    main()
