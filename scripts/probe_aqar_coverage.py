"""Probe aqar.fm for Eastern Province cities + their district slugs.

Output: a markdown report with city status + per-city district list with counts.
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

CITIES = [
    "الدمام", "الخبر", "الظهران", "القطيف", "سيهات", "الجبيل",
    "الأحساء", "الهفوف", "رأس-تنورة", "بقيق", "عنك", "تاروت",
    "النعيرية", "حفر-الباطن", "صفوى", "الجش", "أم-الساهك",
]

LISTING_RE = re.compile(r"-(\d{6,})$")
DIST_RE = re.compile(r"/حي-([^/?#]+)")


def fetch(url: str) -> tuple[int, str]:
    try:
        r = requests.get(url, headers={"User-Agent": UA, "Accept-Language": "ar,en"}, timeout=20)
        return r.status_code, r.text if r.status_code == 200 else ""
    except Exception as e:
        return 0, f"<error: {e}>"


def probe_city(city: str) -> dict:
    url = f"{BASE}/{urllib.parse.quote(CATEGORY)}/{urllib.parse.quote(city)}"
    status, html = fetch(url)
    if status != 200:
        return {"city": city, "status": status, "listings": 0, "districts": {}}
    soup = BeautifulSoup(html, "html.parser")
    anchors = soup.find_all("a", href=True)
    listings = 0
    district_counts: Counter[str] = Counter()
    for a in anchors:
        href = urllib.parse.unquote(a["href"])
        if not LISTING_RE.search(href):
            continue
        listings += 1
        m = DIST_RE.search(href)
        if m:
            district_counts[m.group(1)] += 1
    return {
        "city": city,
        "status": status,
        "listings": listings,
        "districts": dict(district_counts.most_common()),
    }


def main() -> None:
    print("# aqar.fm Eastern Province coverage probe\n")
    print("| city | http | listings (page 1) | distinct slugs |")
    print("|------|------|-------------------|----------------|")
    results: list[dict] = []
    for c in CITIES:
        r = probe_city(c)
        results.append(r)
        print(f"| {c} | {r['status']} | {r['listings']} | {len(r['districts'])} |")
        sys.stdout.flush()
        time.sleep(1.2)

    print("\n## Per-city districts (slug → page-1 count)\n")
    for r in results:
        if r["listings"] == 0 or not r["districts"]:
            continue
        print(f"### {r['city']} — {r['listings']} listings, {len(r['districts'])} slugs")
        for slug, n in r["districts"].items():
            print(f"- `{slug}` → {n}")
        print()


if __name__ == "__main__":
    main()
