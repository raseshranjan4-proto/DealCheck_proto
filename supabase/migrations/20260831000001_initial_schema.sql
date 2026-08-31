-- Deal-Check core schema.
-- Mirrors what is already live in project nggfbjwpdggrezhtasys (tables exist, RLS on, 0 rows).
-- Written idempotently so it can also seed a fresh or local database without clobbering prod.
-- You do NOT need to run this against the existing linked project.

create extension if not exists "pgcrypto";

-- ── public.deals — the real data ───────────────────────────────────────────
create table if not exists public.deals (
  id                   uuid primary key default gen_random_uuid(),
  company              text not null,
  description          text,
  primary_sector       text not null
                         check (primary_sector in ('quantum', 'ai', 'defi', 'deeptech', 'other')),
  sub_sector_tags      text[] not null default '{}',
  deal_type            text
                         check (deal_type in ('VC', 'MA', 'PE', 'SPAC', 'Fund')),
  stage                text,
  amount_display       text,
  amount_usd_millions  numeric,          -- only when the article states a figure; never estimated. Stats sum this.
  investors            text,
  region               text,
  announced_date       date,
  source_url           text unique,      -- dedup key, layer 1 on the deals side
  created_at           timestamptz not null default now()
);

create index if not exists deals_primary_sector_idx on public.deals (primary_sector);
create index if not exists deals_announced_date_idx on public.deals (announced_date desc);
create index if not exists deals_company_lower_idx  on public.deals (lower(company));  -- layer-2 dedup lookups

-- ── public.processed_articles — dedup ledger ──────────────────────────────
create table if not exists public.processed_articles (
  id            uuid primary key default gen_random_uuid(),
  article_url   text unique not null,   -- every article ever looked at, deal or not
  was_a_deal    boolean not null default false,
  processed_at  timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────
alter table public.deals             enable row level security;
alter table public.processed_articles enable row level security;

-- deals: public read-only. No INSERT/UPDATE/DELETE policy exists, so only the
-- service-role key (which bypasses RLS) can write — i.e. the Edge Function.
drop policy if exists "deals public read" on public.deals;
create policy "deals public read"
  on public.deals
  for select
  to anon, authenticated
  using (true);

-- processed_articles: no policies at all => fully private (service-role only).
