-- TAXONOMY.md v2, step 2 of 2 (lock). Run only after every row has been reclassified to
-- the new keys (the one-time pass over stored company + description, 2026-09-17).
-- Applied to the live project via the Supabase MCP; kept for the record.

alter table public.deals add constraint deals_primary_sector_check
  check (primary_sector in (
    'payments_banking','lending_credit','insurance','wealth_capital_markets','web3_digital_assets',
    'ai_ml','enterprise_saas','dev_data_infra','cybersecurity',
    'consumer_brands_d2c','ecommerce_retail','media_gaming','edtech',
    'healthcare_services','biotech_pharma','medtech_diagnostics',
    'semiconductors','robotics_automation','advanced_manufacturing','space_defence','quantum',
    'energy_climate','ev_mobility','logistics_supply_chain','agritech_food','real_estate_construction',
    'other'
  ));

-- Fixed vocabulary from TAXONOMY.md §4, enforced at the database as well as in validate.ts.
alter table public.deals add constraint deals_tech_tags_check
  check (tech_tags <@ array[
    'ai_ml','quantum','blockchain','robotics','semiconductors','biotech',
    'space','iot_wearables','cybersecurity','climate','ar_vr'
  ]::text[]);

comment on column public.deals.primary_sector is
  'Exactly one market-axis sector key from TAXONOMY.md §2. Drives stats and the sector filter.';

-- Free-form tags are superseded by tech_tags.
alter table public.deals drop column if exists sub_sector_tags;
