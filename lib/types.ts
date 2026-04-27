export type PricePeriod = "annual" | "monthly" | "unknown";
export type AgeLabel = "new" | "<2y" | "<5y" | "<10y" | "unknown";
export type ListingStatus = "active" | "gone";

export type Listing = {
  id: string;
  url: string;
  city: string | null;
  district: string;
  title: string | null;
  price_annual_sar: number | null;
  price_raw: number | null;
  price_period: PricePeriod;
  area_sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  living_rooms: number | null;
  age_label: AgeLabel;
  is_new: 0 | 1;
  description: string | null;
  image_url: string | null;
  photos: string[];
  first_seen_at: string;
  last_seen_at: string;
  status: ListingStatus;
  price_history?: { seen_at: string; price_annual_sar: number }[];
  price_change?: { from: number; to: number } | null;
  is_new_in_last_run?: boolean;
};

export type SortMode = "price-asc" | "price-desc" | "new-first" | "newest" | "area-desc";

export type Filters = {
  districts: string[];        // district slugs without 'حي-' prefix
  priceMin: number;
  priceMax: number;
  ageMode: "new-only" | "le-2y" | "any";
  includeGone: boolean;
  sort: SortMode;
  query: string;
};

export type RefreshRun = {
  id: number;
  started_at: string;
  finished_at: string | null;
  listings_scraped: number;
  new_count: number;
  gone_count: number;
  price_change_count: number;
};
