-- Aqar Radar — Supabase schema
-- Run this once in: Supabase Dashboard → SQL Editor → New Query → Paste → Run.
-- Idempotent: safe to re-run.

create table if not exists public.listings (
  id               text primary key,
  url              text not null,
  city             text,
  district         text not null,
  title            text,
  price_annual_sar bigint,
  price_raw        bigint,
  price_period     text,
  area_sqm         bigint,
  bedrooms         integer,
  bathrooms        integer,
  living_rooms     integer,
  age_label        text,
  is_new           integer default 0,
  is_new_reason    text,            -- which regex pattern matched (audit/debug); null = not new

  description      text,
  image_url        text,
  photos           jsonb   default '[]'::jsonb,
  first_seen_at    timestamptz not null,
  last_seen_at     timestamptz not null,
  status           text not null default 'active'
);

create index if not exists idx_listings_city     on public.listings(city);
create index if not exists idx_listings_district on public.listings(district);
create index if not exists idx_listings_status   on public.listings(status);
create index if not exists idx_listings_is_new   on public.listings(is_new);
create index if not exists idx_listings_price    on public.listings(price_annual_sar);

create table if not exists public.price_history (
  listing_id       text not null references public.listings(id) on delete cascade,
  seen_at          timestamptz not null,
  price_annual_sar bigint not null,
  primary key (listing_id, seen_at)
);

create index if not exists idx_price_history_listing on public.price_history(listing_id);

create table if not exists public.refresh_runs (
  id                  bigint generated always as identity primary key,
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  listings_scraped    integer default 0,
  new_count           integer default 0,
  gone_count          integer default 0,
  price_change_count  integer default 0
);

-- ============================================================
-- saved_listings — user favorites. Single-user app for now, so no user_id;
-- if multi-user support is added later, add a user_id column + composite PK.
-- ============================================================
create table if not exists public.saved_listings (
  listing_id  text primary key references public.listings(id) on delete cascade,
  saved_at    timestamptz not null default now(),
  note        text
);

create index if not exists idx_saved_listings_at on public.saved_listings(saved_at desc);

alter table public.saved_listings enable row level security;

-- ============================================================
-- RLS: enable on all four tables. No policies = anon/authenticated get nothing.
-- Server-side (Next.js API + Python scraper) connects as service_role / postgres
-- and bypasses RLS. The browser never talks to Supabase directly — it goes
-- through Next.js API routes only.
-- ============================================================
alter table public.listings      enable row level security;
alter table public.price_history enable row level security;
alter table public.refresh_runs  enable row level security;
