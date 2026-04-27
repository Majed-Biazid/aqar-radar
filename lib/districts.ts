// District registry — Dammam (الدمام), Khobar (الخبر), Dhahran (الظهران).
//
// Only the curated set the user actually shops in. The scraper still hits a
// city-wide _all catch-all per city so listings filed under slugs we don't
// enumerate (or districts aqar only labels in free text) still get pulled in
// via the API's text-override layer.
//
// `id` (composite city:slug) is the unique key. Slugs alone are NOT unique —
// e.g. "هجر" and "القصور" exist in both الدمام and الظهران. The composite ID
// lets the UI filter and the API URL-match scope to the right city.

export type DistrictGeo = {
  /** Composite unique identifier, format: `city:slug`. */
  id: string;
  /** aqar.fm URL slug (without 'حي-' prefix). NOT unique across cities. */
  slug: string;
  /** Display label (Arabic, with prefix). */
  label: string;
  city: City;
  /** [lat, lng] — used for the map view. */
  center: [number, number];
  polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
};

export type City = (typeof CITIES)[number];

export const CITIES = ["الدمام", "الخبر", "الظهران"] as const;

export const CITY_CENTERS: Record<City, [number, number]> = {
  "الدمام":  [26.4207, 50.0888],
  "الخبر":   [26.2172, 50.1971],
  "الظهران": [26.3082, 50.1450],
};

const C = CITY_CENTERS;

// Helper to keep the registry concise. Composite ID derived automatically.
function d(city: City, slug: string, label: string,
          center: [number, number] = C[city],
          polygon: DistrictGeo["polygon"] = null): DistrictGeo {
  return { id: `${city}:${slug}`, slug, label, city, center, polygon };
}

export const DISTRICTS: DistrictGeo[] = [
  // ===== الدمام (Dammam) — curated, user-shopped districts =====
  d("الدمام", "الشعلة", "حي الشعلة", [26.4345, 50.0425]),
  d("الدمام", "المنتزه", "حي المنتزه", [26.3787, 50.1318],
    {"type":"Polygon","coordinates":[[[50.121474,26.38293],[50.124339,26.373262],[50.127252,26.372786],[50.128358,26.372463],[50.129795,26.371822],[50.134079,26.369751],[50.13586,26.368869],[50.1400084,26.3761185],[50.1401183,26.377385],[50.1400191,26.3782495],[50.138853,26.3796096],[50.1332056,26.3862318],[50.130554,26.384572],[50.129145,26.384317],[50.121474,26.38293]]]}),
  d("الدمام", "الفردوس", "حي الفردوس", [26.3802, 50.1174],
    {"type":"Polygon","coordinates":[[[50.1106167,26.3753959],[50.112226,26.375254],[50.122894,26.37353],[50.124339,26.373262],[50.121474,26.38293],[50.119069,26.391108],[50.115991,26.386944],[50.114668,26.385005],[50.113397,26.383031],[50.1127545,26.3816107],[50.1115945,26.3786447],[50.1106167,26.3753959]]]}),
  d("الدمام", "الندى", "حي الندى", [26.4020, 50.0610]),
  d("الدمام", "القصور", "حي القصور", [26.3493, 50.1504],
    {"type":"Polygon","coordinates":[[[50.136664,26.353587],[50.1448949,26.3454571],[50.1496293,26.3407616],[50.1512149,26.3391059],[50.1520474,26.3380828],[50.152964,26.3367253],[50.1534436,26.3359053],[50.1630619,26.3428379],[50.1654785,26.3446212],[50.1637888,26.3460564],[50.152384,26.3561222],[50.14511,26.362263],[50.144947,26.362003],[50.143673,26.360241],[50.142265,26.358549],[50.141452,26.35766],[50.139072,26.355436],[50.136664,26.353587]]]}),
  d("الدمام", "هجر", "حي هجر", [26.3650, 50.0750]),

  // ===== الخبر (Khobar) =====
  d("الخبر", "الخبر-الشمالية",  "الخبر الشمالية"),
  d("الخبر", "الخبر-الجنوبية",  "الخبر الجنوبية"),
  d("الخبر", "الراكة-الجنوبية", "حي الراكة الجنوبية", [26.355411, 50.195772]),
  d("الخبر", "الراكة-الشمالية", "حي الراكة الشمالية", [26.359160, 50.182253]),

  // ===== الظهران (Dhahran) =====
  // Both القصور and هجر have a Dhahran variant; composite IDs distinguish
  // them from Dammam's القصور / هجر.
  d("الظهران", "القصور",          "حي القصور"),
  d("الظهران", "الجامعة",         "حي الجامعة"),
  d("الظهران", "هجر",             "حي هجر"),
  d("الظهران", "الدوحة-الجنوبية", "الدوحة الجنوبية"),
  d("الظهران", "الدانة-الشمالية", "الدانة الشمالية"),
  d("الظهران", "القشلة",          "حي القشلة"),
  d("الظهران", "تهامة",           "حي تهامة"),
  d("الظهران", "الدوحة-الشمالية", "الدوحة الشمالية"),
];

export const DAMMAM_CENTER: [number, number] = [26.3700, 50.1200];
