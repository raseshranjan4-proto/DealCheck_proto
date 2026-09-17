-- TAXONOMY.md v2, step 1 of 2 (prep). Opens the table for reclassification.
-- Applied to the live project via the Supabase MCP on 2026-09-17; kept for the record.
--
-- primary_sector's new CHECK is applied in step 2 (20260917000006), after existing rows
-- are reclassified, because three current keys (ai, defi, deeptech) don't survive.

alter table public.deals drop constraint if exists deals_primary_sector_check;

-- deal_type can be tightened now: every existing value is already in the new set.
alter table public.deals drop constraint if exists deals_deal_type_check;
alter table public.deals add constraint deals_deal_type_check
  check (deal_type in ('VC','PE','MA','SPAC','IPO','Debt','Grant','Secondary','Fund'));

-- Fixed-vocabulary technology tags (TAXONOMY.md §4). Replaces free-form sub_sector_tags,
-- which is dropped in step 2.
alter table public.deals add column if not exists tech_tags text[] not null default '{}';
comment on column public.deals.tech_tags is
  'Technology tags from the fixed list in TAXONOMY.md §4. Zero or more; a pure-play sector deal also carries its matching tag.';
