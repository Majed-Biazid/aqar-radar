"""
Apartment-rental scraper for aqar.fm — supports multiple cities.

Usage (Supabase):
  python3 scraper/scrape.py --db-url "postgresql://..." \
      --targets "الدمام:الشعلة,الدمام:المنتزه,الخبر:الحمرا" \
      --price-min 28000 --price-max 40000

Usage (legacy SQLite, for offline runs):
  python3 scraper/scrape.py --db-path data/listings.db --targets ...

Writes to Postgres (Supabase) or SQLite. History is preserved — listings are
upserted; listings no longer seen are marked status='gone' but never deleted.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sqlite3
import sys
import time
import urllib.parse
from pathlib import Path

import requests
from bs4 import BeautifulSoup

try:
    import psycopg2
    import psycopg2.extras
    HAS_PG = True
except ImportError:
    HAS_PG = False

BASE = "https://sa.aqar.fm"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
)
CATEGORY = "شقق-للإيجار"
POLITE_SLEEP = 1.2
DETAIL_POLITE_SLEEP = 0.9
DETAIL_PHOTO_RE = re.compile(r'https://images\.aqar\.fm/webp/[^"\'\s>]+/props/\d+_\d+\.jpe?g')

_AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")

_NEW_PATTERNS = [
    r"جديد(?:ة|ه|ا)?",
    r"عمر\s*العقار\s*[:\-]?\s*جديد",
    r"أقل\s*من\s*[12]\s*(?:سن|عام)",
    r"عمر\s*العقار\s*[:\-]?\s*(?:[٠-٩]|0|1|2)\s*(?:سن|عام)",
    r"\b(?:[٠-٩]|0|1|2)\s*(?:سنة|سنين|سنوات|عام)",
    r"تحت\s*الإنش?اء",
    r"بناء?\s*جديد(?:ة|ه)?",
    r"حديث\s*البناء",
]
_AGE_REGEX = re.compile("|".join(_NEW_PATTERNS), re.UNICODE)


# ----- Storage abstraction -----
# Two backends share a tiny interface so the scraper logic stays unchanged.
# Both use ? placeholders (sqlite); the pg backend rewrites to $N at execute time.

class Store:
    def migrate(self) -> None: ...
    def begin_run(self, started_at: str) -> int: ...
    def get_old_price(self, listing_id: str) -> int | None: ...
    def insert_listing(self, payload: dict) -> None: ...
    def update_listing(self, payload: dict) -> None: ...
    def insert_price(self, listing_id: str, seen_at: str, price: int) -> None: ...
    def mark_gone(self, run_start: str) -> int: ...
    def finish_run(self, run_id: int, finished_at: str, scraped: int, new_count: int, gone: int, price_changes: int) -> None: ...
    def close(self) -> None: ...


class SQLiteStore(Store):
    BASE_SCHEMA = """
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY, url TEXT NOT NULL, district TEXT NOT NULL, title TEXT,
      price_annual_sar INTEGER, price_raw INTEGER, price_period TEXT,
      area_sqm INTEGER, bedrooms INTEGER, bathrooms INTEGER, living_rooms INTEGER,
      age_label TEXT, is_new INTEGER, description TEXT, image_url TEXT,
      first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS price_history (
      listing_id TEXT NOT NULL, seen_at TEXT NOT NULL, price_annual_sar INTEGER NOT NULL,
      PRIMARY KEY (listing_id, seen_at)
    );
    CREATE TABLE IF NOT EXISTS refresh_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT NOT NULL, finished_at TEXT,
      listings_scraped INTEGER DEFAULT 0, new_count INTEGER DEFAULT 0,
      gone_count INTEGER DEFAULT 0, price_change_count INTEGER DEFAULT 0
    );
    """

    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path)

    def migrate(self) -> None:
        self.conn.executescript(self.BASE_SCHEMA)
        cols = {row[1] for row in self.conn.execute("PRAGMA table_info(listings)").fetchall()}
        if "city" not in cols:
            self.conn.execute("ALTER TABLE listings ADD COLUMN city TEXT")
        if "photos_json" not in cols:
            self.conn.execute("ALTER TABLE listings ADD COLUMN photos_json TEXT")
        for s in (
            "CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city)",
            "CREATE INDEX IF NOT EXISTS idx_listings_district ON listings(district)",
            "CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status)",
            "CREATE INDEX IF NOT EXISTS idx_listings_is_new ON listings(is_new)",
        ):
            self.conn.execute(s)
        self.conn.commit()

    def begin_run(self, started_at: str) -> int:
        cur = self.conn.cursor()
        cur.execute("INSERT INTO refresh_runs (started_at) VALUES (?)", (started_at,))
        self.conn.commit()
        return cur.lastrowid

    def get_old_price(self, listing_id: str) -> tuple[bool, int | None]:
        row = self.conn.execute(
            "SELECT price_annual_sar FROM listings WHERE id = ?", (listing_id,)
        ).fetchone()
        if row is None:
            return False, None
        return True, row[0]

    def insert_listing(self, p: dict) -> None:
        self.conn.execute(
            """INSERT INTO listings (id, url, city, district, title, price_annual_sar, price_raw,
               price_period, area_sqm, bedrooms, bathrooms, living_rooms, age_label, is_new,
               description, image_url, photos_json, first_seen_at, last_seen_at, status)
               VALUES (:id, :url, :city, :district, :title, :price_annual_sar, :price_raw,
               :price_period, :area_sqm, :bedrooms, :bathrooms, :living_rooms, :age_label, :is_new,
               :description, :image_url, :photos_json, :first_seen_at, :last_seen_at, 'active')""",
            p,
        )

    def update_listing(self, p: dict) -> None:
        self.conn.execute(
            """UPDATE listings SET url=:url, city=:city, district=:district, title=:title,
               price_annual_sar=:price_annual_sar, price_raw=:price_raw, price_period=:price_period,
               area_sqm=:area_sqm, bedrooms=:bedrooms, bathrooms=:bathrooms, living_rooms=:living_rooms,
               age_label=:age_label, is_new=:is_new, description=:description, image_url=:image_url,
               photos_json=:photos_json, last_seen_at=:last_seen_at, status='active'
               WHERE id=:id""",
            p,
        )

    def insert_price(self, listing_id: str, seen_at: str, price: int) -> None:
        self.conn.execute(
            "INSERT OR IGNORE INTO price_history (listing_id, seen_at, price_annual_sar) VALUES (?, ?, ?)",
            (listing_id, seen_at, price),
        )

    def mark_gone(self, run_start: str) -> int:
        cur = self.conn.execute(
            "UPDATE listings SET status='gone' WHERE last_seen_at < ? AND status != 'gone'",
            (run_start,),
        )
        self.conn.commit()
        return cur.rowcount

    def finish_run(self, run_id, finished_at, scraped, new_count, gone, price_changes):
        self.conn.execute(
            "UPDATE refresh_runs SET finished_at=?, listings_scraped=?, new_count=?, gone_count=?, price_change_count=? WHERE id=?",
            (finished_at, scraped, new_count, gone, price_changes, run_id),
        )
        self.conn.commit()

    def close(self):
        self.conn.commit()
        self.conn.close()


class PostgresStore(Store):
    """Postgres backend (Supabase). Uses jsonb for photos and timestamptz for times."""

    def __init__(self, dsn: str):
        if not HAS_PG:
            raise RuntimeError("psycopg2 not installed — run: pip install psycopg2-binary")
        self.conn = psycopg2.connect(dsn)
        self.conn.autocommit = False

    def migrate(self) -> None:
        # The schema is created once via scripts/supabase-schema.sql in the
        # Supabase SQL Editor. We don't try to ALTER it here — keep migrations
        # explicit and reviewable in SQL. Just verify the tables exist.
        with self.conn.cursor() as cur:
            cur.execute("SELECT to_regclass('public.listings'), to_regclass('public.refresh_runs')")
            l, r = cur.fetchone()
            if l is None or r is None:
                raise RuntimeError(
                    "Supabase tables missing — run scripts/supabase-schema.sql in the SQL Editor first."
                )
        self.conn.commit()

    def begin_run(self, started_at: str) -> int:
        with self.conn.cursor() as cur:
            cur.execute(
                "INSERT INTO refresh_runs (started_at) VALUES (%s) RETURNING id",
                (started_at,),
            )
            run_id = cur.fetchone()[0]
        self.conn.commit()
        return run_id

    def get_old_price(self, listing_id: str) -> tuple[bool, int | None]:
        with self.conn.cursor() as cur:
            cur.execute("SELECT price_annual_sar FROM listings WHERE id = %s", (listing_id,))
            row = cur.fetchone()
        if row is None:
            return False, None
        return True, row[0]  # price may legitimately be NULL — exists is what matters

    def insert_listing(self, p: dict) -> None:
        photos = json.loads(p["photos_json"]) if p.get("photos_json") else []
        with self.conn.cursor() as cur:
            cur.execute(
                """INSERT INTO listings (id, url, city, district, title, price_annual_sar, price_raw,
                   price_period, area_sqm, bedrooms, bathrooms, living_rooms, age_label, is_new,
                   description, image_url, photos, first_seen_at, last_seen_at, status)
                   VALUES (%(id)s, %(url)s, %(city)s, %(district)s, %(title)s, %(price_annual_sar)s,
                   %(price_raw)s, %(price_period)s, %(area_sqm)s, %(bedrooms)s, %(bathrooms)s,
                   %(living_rooms)s, %(age_label)s, %(is_new)s, %(description)s, %(image_url)s,
                   %(photos)s::jsonb, %(first_seen_at)s, %(last_seen_at)s, 'active')""",
                {**p, "photos": json.dumps(photos, ensure_ascii=False)},
            )

    def update_listing(self, p: dict) -> None:
        photos = json.loads(p["photos_json"]) if p.get("photos_json") else []
        with self.conn.cursor() as cur:
            cur.execute(
                """UPDATE listings SET url=%(url)s, city=%(city)s, district=%(district)s,
                   title=%(title)s, price_annual_sar=%(price_annual_sar)s,
                   price_raw=%(price_raw)s, price_period=%(price_period)s,
                   area_sqm=%(area_sqm)s, bedrooms=%(bedrooms)s, bathrooms=%(bathrooms)s,
                   living_rooms=%(living_rooms)s, age_label=%(age_label)s, is_new=%(is_new)s,
                   description=%(description)s, image_url=%(image_url)s,
                   photos=%(photos)s::jsonb, last_seen_at=%(last_seen_at)s, status='active'
                   WHERE id=%(id)s""",
                {**p, "photos": json.dumps(photos, ensure_ascii=False)},
            )

    def insert_price(self, listing_id: str, seen_at: str, price: int) -> None:
        with self.conn.cursor() as cur:
            cur.execute(
                "INSERT INTO price_history (listing_id, seen_at, price_annual_sar) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                (listing_id, seen_at, price),
            )

    def mark_gone(self, run_start: str) -> int:
        with self.conn.cursor() as cur:
            cur.execute(
                "UPDATE listings SET status='gone' WHERE last_seen_at < %s AND status != 'gone'",
                (run_start,),
            )
            n = cur.rowcount
        self.conn.commit()
        return n

    def finish_run(self, run_id, finished_at, scraped, new_count, gone, price_changes):
        with self.conn.cursor() as cur:
            cur.execute(
                "UPDATE refresh_runs SET finished_at=%s, listings_scraped=%s, new_count=%s, gone_count=%s, price_change_count=%s WHERE id=%s",
                (finished_at, scraped, new_count, gone, price_changes, run_id),
            )
        self.conn.commit()

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.commit()
        self.conn.close()


# ----- Parsing (unchanged from prior version) -----

def _num(s: str) -> int | None:
    s = s.translate(_AR_DIGITS).replace(",", "").replace("٬", "")
    m = re.search(r"\d+", s)
    return int(m.group()) if m else None


def _fetch(url: str, retries: int = 3) -> str:
    """GET with retries + backoff — aqar occasionally times out under load."""
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            r = requests.get(
                url,
                headers={"User-Agent": UA, "Accept-Language": "ar,en"},
                timeout=30,
            )
            r.raise_for_status()
            return r.text
        except (requests.Timeout, requests.ConnectionError) as e:
            last_err = e
            wait = 2 ** attempt  # 1s, 2s, 4s
            print(f"    ! transient error ({type(e).__name__}); retry in {wait}s", file=sys.stderr)
            time.sleep(wait)
        except requests.HTTPError:
            raise  # let HTTP errors bubble (e.g. 404 means stop paging)
    raise last_err if last_err else RuntimeError("fetch failed")


def _detect_period(parts: list[str], raw_price: int) -> str:
    joined = " ".join(parts)
    if "شهري" in joined or "/شهر" in joined:
        return "monthly"
    if "سنوي" in joined or "/سنة" in joined:
        return "annual"
    if raw_price and raw_price < 10_000:
        return "monthly"
    return "annual"


def _detect_age(text: str) -> tuple[str, bool]:
    if not text:
        return "unknown", False
    if _AGE_REGEX.search(text):
        return "new", True
    return "unknown", False


def parse_card(a) -> dict | None:
    href = a["href"]
    m = re.search(r"-(\d{6,})$", href)
    if not m:
        return None
    listing_id = m.group(1)
    url = BASE + href if href.startswith("/") else href

    parts = [t.strip() for t in a.stripped_strings if t.strip() and t.strip() != "§"]

    is_featured = parts and parts[0] == "مميز"
    if is_featured:
        parts = parts[1:]

    raw_price = None
    price_idx = None
    for i, p in enumerate(parts):
        clean = p.translate(_AR_DIGITS).replace(",", "")
        if clean.isdigit() and int(clean) >= 1000:
            raw_price = int(clean)
            price_idx = i
            break

    title = ""
    if is_featured and price_idx is not None and price_idx + 1 < len(parts):
        title = parts[price_idx + 1]
    elif not is_featured and parts:
        title = parts[0]

    period = _detect_period(parts, raw_price or 0)
    annual = raw_price * 12 if raw_price and period == "monthly" else raw_price

    area = None
    feature_nums: list[int] = []
    after_price = parts[(price_idx or -1) + 1:]
    for tok in after_price:
        if "م²" in tok or "م2" in tok or "متر" in tok:
            area = _num(tok)
            continue
        clean = tok.translate(_AR_DIGITS).replace(",", "")
        if clean.isdigit() and 1 <= int(clean) <= 20 and len(clean) <= 2:
            feature_nums.append(int(clean))

    beds = feature_nums[0] if len(feature_nums) >= 1 else None
    baths = feature_nums[1] if len(feature_nums) >= 2 else None
    living = feature_nums[2] if len(feature_nums) >= 3 else None

    long_parts = [p for p in parts if len(p) > 20]
    description = " ".join(long_parts) or " ".join(parts)
    full_text = " ".join(parts)
    age_label, is_new = _detect_age(full_text if _AGE_REGEX.search(full_text) else description)

    image_url = None
    for img in a.find_all("img"):
        src = img.get("src") or ""
        if "images.aqar.fm" in src:
            image_url = src
            break
    if image_url is None:
        for img in a.find_all("img"):
            src = img.get("src") or ""
            if src and "/icons/" not in src:
                image_url = src
                break

    district = ""
    for p in reversed(parts):
        if ("حي " in p) and ("," in p or "،" in p):
            bits = re.split(r"[،,]", p)
            if len(bits) >= 2:
                district = bits[0].strip()
                break
    if not district:
        segs = [urllib.parse.unquote(s) for s in href.split("/") if s]
        if len(segs) >= 3:
            district = segs[2].replace("حي-", "حي ")

    return {
        "id": listing_id,
        "url": url,
        "district": district,
        "title": title,
        "price_annual_sar": annual,
        "price_raw": raw_price,
        "price_period": period,
        "area_sqm": area,
        "bedrooms": beds,
        "bathrooms": baths,
        "living_rooms": living,
        "age_label": age_label,
        "is_new": 1 if is_new else 0,
        "description": description[:2000],
        "image_url": image_url,
    }


def scrape_photos(listing_url: str) -> list[str]:
    try:
        html = _fetch(listing_url)
    except Exception as e:
        print(f"    ! photo fetch failed for {listing_url[:60]}: {e}", file=sys.stderr)
        return []
    urls = DETAIL_PHOTO_RE.findall(html)
    seen = set()
    ordered = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            ordered.append(u)
    return ordered


CATCHALL = "_all"
MAX_PAGES_DISTRICT = 20
MAX_PAGES_CATCHALL = 60


def scrape_target(city: str, slug: str, price_min: int, price_max: int) -> list[dict]:
    results: list[dict] = []
    seen: set[str] = set()
    city_raw = f"/{city}/"
    city_enc = f"/{urllib.parse.quote(city)}/"
    is_catchall = slug == CATCHALL
    dist_raw = "" if is_catchall else f"/حي-{slug}/"
    dist_enc = "" if is_catchall else f"/{urllib.parse.quote('حي-' + slug)}/"
    max_pages = MAX_PAGES_CATCHALL if is_catchall else MAX_PAGES_DISTRICT

    for page in range(1, max_pages + 1):
        if is_catchall:
            path = f"/{urllib.parse.quote(CATEGORY)}/{urllib.parse.quote(city)}"
        else:
            path = f"/{urllib.parse.quote(CATEGORY)}/{urllib.parse.quote(city)}/{urllib.parse.quote('حي-' + slug)}"
        if page > 1:
            path += f"/{page}"
        qs = f"?price_min={price_min}&price_max={price_max}"
        url = BASE + path + qs
        try:
            html = _fetch(url)
        except requests.HTTPError as e:
            print(f"    ! page {page}: HTTP {e.response.status_code}", file=sys.stderr)
            break
        except Exception as e:
            # Network gave up after retries — skip this page, don't kill the
            # whole scrape. Other targets / pages may still succeed.
            print(f"    ! page {page}: {type(e).__name__} after retries — skipping", file=sys.stderr)
            break
        soup = BeautifulSoup(html, "html.parser")
        anchors = [a for a in soup.find_all("a", href=True) if re.search(r"-\d{6,}$", a["href"])]
        before = len(results)
        for a in anchors:
            href = a["href"]
            decoded = urllib.parse.unquote(href)
            in_city = city_raw in href or city_enc in href or city_raw in decoded
            in_dist = is_catchall or (dist_raw in href or dist_enc in href or dist_raw in decoded)
            if not (in_city and in_dist):
                continue
            card = parse_card(a)
            if card and card["id"] not in seen:
                seen.add(card["id"])
                card["city"] = city
                results.append(card)
        added = len(results) - before
        print(f"  page {page}: +{added} (total {len(results)})")
        if added == 0:
            break
        time.sleep(POLITE_SLEEP)
    return results


def upsert(store: Store, run_start: str, cards: list[dict]) -> tuple[int, int]:
    new_count = 0
    price_changes = 0
    for c in cards:
        exists, old_price = store.get_old_price(c["id"])
        payload = {**c, "photos_json": json.dumps(c.get("photos") or [], ensure_ascii=False)}
        if not exists:
            store.insert_listing({**payload, "first_seen_at": run_start, "last_seen_at": run_start})
            if c["price_annual_sar"]:
                store.insert_price(c["id"], run_start, c["price_annual_sar"])
            new_count += 1
        else:
            store.update_listing({**payload, "last_seen_at": run_start})
            if c["price_annual_sar"] and c["price_annual_sar"] != old_price:
                store.insert_price(c["id"], run_start, c["price_annual_sar"])
                price_changes += 1
    if isinstance(store, PostgresStore):
        store.commit()
    return new_count, price_changes


def main() -> None:
    ap = argparse.ArgumentParser()
    backend = ap.add_mutually_exclusive_group(required=False)
    backend.add_argument("--db-path", help="SQLite path (legacy/offline use)")
    backend.add_argument("--db-url",  help="Postgres connection string (Supabase)")
    ap.add_argument("--targets", required=True,
                    help="comma-separated CITY:SLUG pairs, e.g. 'الدمام:الشعلة,الخبر:الحمرا'")
    ap.add_argument("--price-min", type=int, default=28000)
    ap.add_argument("--price-max", type=int, default=40000)
    ap.add_argument("--with-photos", action="store_true", help="enable per-listing photo scraping (slower, often rate-limited by aqar)")
    args = ap.parse_args()

    # Default to env var if neither flag given.
    db_url = args.db_url or os.environ.get("SUPABASE_DB_URL")
    db_path = args.db_path

    targets: list[tuple[str, str]] = []
    for pair in args.targets.split(","):
        pair = pair.strip()
        if ":" not in pair:
            continue
        city, slug = pair.split(":", 1)
        targets.append((city.strip(), slug.strip()))

    if db_url:
        print(f"[storage] Postgres (Supabase)")
        store: Store = PostgresStore(db_url)
    elif db_path:
        print(f"[storage] SQLite at {db_path}")
        store = SQLiteStore(Path(db_path))
    else:
        ap.error("provide --db-url, --db-path, or set SUPABASE_DB_URL")
        return

    store.migrate()

    run_start = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    run_id = store.begin_run(run_start)

    all_cards: list[dict] = []
    seen_ids: set[str] = set()
    for city, slug in targets:
        label = "(city-wide)" if slug == CATCHALL else f"/ حي-{slug}"
        print(f"[target] {city} {label}")
        for c in scrape_target(city, slug, args.price_min, args.price_max):
            if c["id"] in seen_ids:
                continue
            seen_ids.add(c["id"])
            all_cards.append(c)

    if args.with_photos:
        print(f"\n[photos] fetching galleries for {len(all_cards)} listings…")
        consecutive_403s = 0
        for i, c in enumerate(all_cards, 1):
            try:
                photos = scrape_photos(c["url"])
                if photos:
                    consecutive_403s = 0
                c["photos"] = photos
            except Exception as e:
                c["photos"] = []
                if "403" in str(e):
                    consecutive_403s += 1
                    if consecutive_403s >= 5:
                        print(f"  ! {consecutive_403s} consecutive 403s — aqar is blocking detail pages; skipping rest")
                        break
            if i % 20 == 0 or i == len(all_cards):
                print(f"  [{i}/{len(all_cards)}]")
            time.sleep(DETAIL_POLITE_SLEEP)

    new_count, price_changes = upsert(store, run_start, all_cards)
    gone_count = store.mark_gone(run_start)
    finished_at = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    store.finish_run(run_id, finished_at, len(all_cards), new_count, gone_count, price_changes)

    summary = {
        "run_id": run_id,
        "started_at": run_start,
        "finished_at": finished_at,
        "scraped": len(all_cards),
        "new": new_count,
        "gone": gone_count,
        "price_changes": price_changes,
    }
    print("\n" + json.dumps(summary, indent=2))
    store.close()


if __name__ == "__main__":
    main()
