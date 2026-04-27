"""Deep probe: enumerate ALL districts on aqar for the 3 target cities.

Walks every page of each city's listing index (no price filter, then with the
user's 28k-40k price filter) and aggregates every distinct `حي-{slug}` we see.
"""
from __future__ import annotations
import re
import sys
import time
import urllib.parse
from collections import Counter

import requests
from bs4 import BeautifulSoup

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
BASE = "https://sa.aqar.fm"
CATEGORY = "شقق-للإيجار"

CITIES = ["الدمام", "الخبر", "الظهران"]
LISTING_RE = re.compile(r"-(\d{6,})$")
DIST_RE = re.compile(r"/حي-([^/?#]+)")


def fetch(url: str) -> tuple[int, str]:
    try:
        r = requests.get(url, headers={"User-Agent": UA, "Accept-Language": "ar,en"}, timeout=20)
        return r.status_code, r.text if r.status_code == 200 else ""
    except Exception as e:
        return 0, f"<error: {e}>"


def walk_city(city: str, price_min: int | None = None, price_max: int | None = None,
              max_pages: int = 80) -> tuple[int, Counter]:
    total = 0
    slugs: Counter[str] = Counter()
    seen_listing_ids: set[str] = set()
    for page in range(1, max_pages + 1):
        path = f"/{urllib.parse.quote(CATEGORY)}/{urllib.parse.quote(city)}"
        if page > 1:
            path += f"/{page}"
        qs = ""
        if price_min is not None:
            qs = f"?price_min={price_min}&price_max={price_max}"
        url = BASE + path + qs
        status, html = fetch(url)
        if status != 200:
            break
        soup = BeautifulSoup(html, "html.parser")
        anchors = soup.find_all("a", href=True)
        added = 0
        for a in anchors:
            href = urllib.parse.unquote(a["href"])
            m = LISTING_RE.search(href)
            if not m:
                continue
            lid = m.group(1)
            if lid in seen_listing_ids:
                continue
            seen_listing_ids.add(lid)
            total += 1
            added += 1
            sm = DIST_RE.search(href)
            if sm:
                slugs[sm.group(1)] += 1
        if added == 0:
            break
        time.sleep(1.0)
    return total, slugs


def main() -> None:
    for city in CITIES:
        print(f"\n=== {city} ===")
        total_unfiltered, slugs_unfiltered = walk_city(city)
        print(f"  unfiltered: {total_unfiltered} listings, {len(slugs_unfiltered)} slugs")
        for slug, n in slugs_unfiltered.most_common():
            print(f"    {slug:35s} {n}")

        total_filtered, slugs_filtered = walk_city(city, 28000, 40000)
        print(f"\n  filtered (28k-40k SAR): {total_filtered} listings, {len(slugs_filtered)} slugs")
        for slug, n in slugs_filtered.most_common():
            print(f"    {slug:35s} {n}")


if __name__ == "__main__":
    main()
