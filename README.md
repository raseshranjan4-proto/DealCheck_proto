# Deal-Check — Phase 2 (automated daily pipeline)

Backend for [Deal-Check](../deal-check-context1.md): a public tracker for global M&A/VC/PE
deals in deep tech, AI, quantum, and DeFi. Phase 1 (the UI) is finalised in claude.ai.
This project is Phase 2 — the deployed backend that fills the database every day.

**Spec of record:** [`../deal-check-context1.md`](../deal-check-context1.md) (supersedes
`../deal-check-context.md`). Read it before changing pipeline behaviour — the taxonomy,
dedup rules, extraction prompt, and RLS model are all locked there.

## What runs

```
cron (daily)  ->  daily-pipeline Edge Function
                    1. fetch 6 RSS feeds
                    2. layer-1 dedup   (processed_articles.article_url)
                    3. extract         (Claude Haiku 4.5, tool-call schema, cached system prompt)
                    4. validate        (required fields, enum checks, no inferred numbers)
                    5. layer-2 dedup   (company + primary_sector + announced_date within 7 days)
                    6. insert / update / discard into  public.deals
                    7. always record the article in  public.processed_articles
frontend  ->  reads public.deals via the Supabase REST API (anon key, RLS select-only)
```

## Layout

```
deal-check/
  supabase/
    config.toml
    migrations/
      20260831000001_initial_schema.sql          # deals + processed_articles + RLS (mirrors live DB)
      20260831000002_schedule_daily_pipeline.sql  # pg_cron + pg_net daily trigger (opt-in)
    functions/
      daily-pipeline/
        index.ts        # orchestrator / HTTP handler
        sources.ts      # the 6 RSS feeds
        rss.ts          # fetch + parse + URL normalisation
        anthropic.ts    # extraction call (tool-call structured output + prompt cache)
        validate.ts     # extraction -> DealRow, or reject with a reason
        dedup.ts        # layer 1 + layer 2
        types.ts
        deno.json
  frontend/
    deal-check.html     # approved Phase 1 build, wired to Supabase REST (single file)
    README.md
  scripts/
    dry-run.ps1 / .sh        # invoke the deployed function with ?dry_run=1 (no DB writes)
    run.ps1 / .sh            # invoke it for real
    deploy-frontend.ps1     # upload deal-check.html to Supabase Storage
  .env.example
  DEPLOY.md
```

## Prerequisites

- **Supabase CLI 2.x** — installed (`supabase --version`). Reinstall with `npm i -g supabase`.
- **Deno** — optional, only for `supabase functions serve` (fully local runs). The Supabase
  CLI bundles its own Deno for deploys, so you can skip this for deploy-only.
- **An Anthropic API key** with billing on — https://console.anthropic.com/settings/keys
- Access to Supabase project **`nggfbjwpdggrezhtasys`** (`raseshranjan4-proto's Project`,
  ap-southeast-2).

## Setup

Progress so far: `login` ✅ · `link` ✅ · `functions deploy` ✅ · secret + first run ⬜

```bash
# 1. from this folder
supabase login
supabase link --project-ref nggfbjwpdggrezhtasys

# 2. the schema is already live in the linked project (tables exist, RLS on, 0 rows).
#    Only run this against a fresh/local DB — the migration is idempotent but you do not
#    need it for the existing project:
# supabase db push

# 3. secrets for the Edge Function
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
#    SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected into the function
#    automatically by the platform — do not set them yourself.

# 4. deploy
supabase functions deploy daily-pipeline
```

```powershell
# 5. dry run (fetches + extracts, logs what it *would* write, no DB changes).
#    Needs the service-role key because the function keeps verify_jwt on.
#    This machine has Windows PowerShell 5.1 (powershell, not pwsh):
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJ...service_role..."
powershell -ExecutionPolicy Bypass -File .\scripts\dry-run.ps1
```

Watch logs while it runs: `supabase functions logs daily-pipeline`.

A successful run returns JSON like:

```json
{ "ok": true, "ms": 41230, "fetched": 118, "new_articles": 47,
  "extracted_deals": 9, "inserted": 7, "updated": 1, "discarded": 1,
  "invalid": 0, "errors": 0, "dry_run": false }
```

## Scheduling the daily run

Two options — pick one:

- **Dashboard:** Project → Edge Functions → `daily-pipeline` → Schedules → add
  `15 6 * * *` (06:15 UTC). Simplest.
- **Migration:** `20260831000002_schedule_daily_pipeline.sql` sets up the same thing via
  `pg_cron` + `pg_net`. It reads the function's bearer token from Supabase Vault, so first:
  `select vault.create_secret('<SERVICE_ROLE_KEY>', 'daily_pipeline_token');`
  then `supabase db push`. Edit the cron time in the file before pushing.

## Frontend

`frontend/deal-check.html` is already wired to the Supabase REST API (`loadDeals()` +
`mapRow()` replacing the old `window.storage` seed reads). Remaining before it goes live:
paste the **anon** key in place of `REPLACE_WITH_ANON_KEY`, then publish with
`scripts/deploy-frontend.ps1`. Details in [`frontend/README.md`](frontend/README.md) and
[`DEPLOY.md`](DEPLOY.md). **Do not restyle** (spec section 7 is locked) and **do not add
write UI** (RLS is select-only for the public).

## Notes / decisions still open (from spec section 8)

- Real hosting/domain for the public page — decide after a few clean manual runs.
- `verify_jwt` is left **on** for the function so it is not an open endpoint; cron and the
  dry-run scripts pass the service-role key. Flip it in `supabase/config.toml` only if you
  add a lighter-weight auth path.
