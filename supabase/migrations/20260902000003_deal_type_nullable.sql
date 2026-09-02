-- The live database (created manually before this project) had `deals.deal_type` as
-- NOT NULL. That is stricter than the spec: section 2 lists only a CHECK constraint, and
-- the extraction schema in section 4 returns `deal_type` as one of the enum values *or
-- null*. A genuine funding / M&A event can lack a clearly stated type in the source
-- article — those should still be recorded — so `deal_type` must allow null.
--
-- Applied directly via the SQL editor on 2026-09-02 after the first cron-cadence run hit
-- "null value in column deal_type violates not-null constraint". Kept here for the record;
-- migration 0001 already defines the column without NOT NULL for fresh databases.

alter table public.deals alter column deal_type drop not null;
