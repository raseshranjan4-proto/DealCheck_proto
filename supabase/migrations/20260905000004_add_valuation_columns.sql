-- Deal-Check: record the company/deal valuation separately from the amount raised or paid.
-- These are distinct figures (a raise amount is not the same as the resulting valuation)
-- and must never be conflated or derived from one another. Applied directly to the live
-- project via the Supabase MCP on 2026-09-05; kept here for the record / fresh databases.

alter table public.deals
  add column if not exists valuation_display text,
  add column if not exists valuation_usd_millions numeric;

comment on column public.deals.valuation_display is
  'Human-readable company/deal valuation, e.g. "$1.2B" — distinct from amount_display (money raised/paid). Null unless the source article states a valuation.';
comment on column public.deals.valuation_usd_millions is
  'Valuation in millions of USD, only if the article states one — never inferred or computed from amount_usd_millions.';
