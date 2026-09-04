# Deal-Check — Phase 2 (automated daily pipeline)

Backend + published page for [Deal-Check](../deal-check-context1.md): a public tracker for
global M&A/VC/PE deals in deep tech, AI, quantum, and DeFi. Phase 1 (the UI) was finalised
in claude.ai. This project is Phase 2 — the deployed pipeline that fills the database every
day, plus the page that reads it.

**Spec of record:** [`../deal-check-context1.md`](../deal-check-context1.md) (supersedes
`../deal-check-context.md`). Read it before changing pipeline behaviour — the taxonomy,
dedup rules, extraction prompt, and RLS model are all locked there.

## What runs

```
cron (daily, 06:15 UTC)  ->  daily-pipeline Edge Function
                              1. fetch 6 RSS feeds
                              2. layer-1 dedup   (processed_articles.article_url)
                              3. extract         (Claude Haiku 4.5, tool-call schema)
                              4. validate        (required fields, enum checks, no inferred numbers)
                              5. layer-2 dedup   (company + primary_sector + announced_date within 7 days)
                              6. insert / update / discard into  public.deals
                              7. always record the article in  public.processed_articles
GitHub Pages  ->  docs/index.html reads public.deals via the Supabase REST API
                  (publishable key, RLS select-only)
```

## Layout

```
deal-check/
  supabase/
    config.toml                                    # project_id + verify_jwt for the function
    migrations/
      20260831000001_initial_schema.sql            # deals + processed_articles + RLS (mirrors live DB)
      20260831000002_schedule_daily_pipeline.sql   # pg_cron + pg_net daily trigger (opt-in)
    functions/daily-pipeline/
      index.ts        # orchestrator / HTTP handler; ?dry_run=1 skips writes
      sources.ts      # the 6 RSS feeds
      rss.ts          # fetch + parse + URL normalisation
      anthropic.ts    # extraction call (Haiku 4.5, tool-call structured output)
      validate.ts     # extraction -> DealRow, or reject with a reason
      dedup.ts        # layer 1 + layer 2
      types.ts / deno.json
  docs/
    index.html        # the published page (Phase 1 UI, wired to Supabase REST) — served by GitHub Pages
  scripts/
    dry-run.ps1 / .sh   # invoke the function with ?dry_run=1 (no DB writes)
    run.ps1 / .sh       # invoke it for real
  .env.example
  DEPLOY.md            # step-by-step deploy state + remaining steps
```

## Current state

| | |
|---|---|
| Edge Function deployed, `verify_jwt` on | ✅ |
| `ANTHROPIC_API_KEY` + `PIPELINE_MAX_ARTICLES_PER_RUN=25` secrets set | ✅ |
| Dry run clean, real run inserted rows into `deals` | ✅ |
| GitHub repo `raseshranjan4-proto/DealCheck_proto` | ✅ |
| Daily cron | ⬜ |
| GitHub Pages publish (`/docs`) | ⬜ |

See [`DEPLOY.md`](DEPLOY.md) for the exact remaining steps.

## Auth

`verify_jwt = false` on the function — the Supabase cron UI / `net.http_post` could not
reliably send a valid project JWT. The function instead requires the shared secret
**`PIPELINE_TRIGGER_SECRET`**, passed as `?key=<secret>` or an `x-trigger-key` header.
Set it once: `supabase secrets set PIPELINE_TRIGGER_SECRET=<random string>`.

## Re-running the pipeline

```powershell
$env:PIPELINE_TRIGGER_SECRET = "<same value as the Supabase secret>"
powershell -ExecutionPolicy Bypass -File .\scripts\dry-run.ps1   # no writes
powershell -ExecutionPolicy Bypass -File .\scripts\run.ps1       # writes
```

Invocation modes (query string on `…/functions/v1/daily-pipeline`, all need the key):

| Call | Behaviour |
|---|---|
| _(none)_ | background: returns `202` in <1s, runs via `EdgeRuntime.waitUntil` — **the cron uses this** |
| `?wait=1` | run synchronously, return the full summary (`scripts/run.ps1`) |
| `?dry_run=1` | synchronous, no DB writes, logs what it would write (implies `wait`) |

Successful response shape:

```json
{ "ok": true, "ms": 41230, "fetched": 118, "new_articles": 22,
  "extracted_deals": 5, "inserted": 4, "updated": 1, "discarded": 0,
  "invalid": 0, "errors": 0, "dry_run": false, "error_samples": [] }
```

Logs: Dashboard → Edge Functions → `daily-pipeline` → Logs (the CLI has no `functions logs`
subcommand in 2.x).

## Frontend notes

`docs/index.html` is the approved Phase 1 build (spec §7 — **locked styling, no write UI**),
changed only where it read data:

- `loadDeals()` does a `fetch` against `…/rest/v1/deals` instead of `window.storage`.
- `mapRow()` maps DB columns (`primary_sector`, `deal_type`, `amount_display`,
  `amount_usd_millions`, `announced_date`, `source_url`) to the flat field names the
  table/stats/ticker render against.
- `SEED_DEALS` and `saveDeals()` removed; fetch failure shows an error empty-state.
- `SUPABASE_ANON_KEY` holds the publishable key (`sb_publishable_…`), public by design.

**Not Supabase Storage:** public Storage objects are served with
`Content-Security-Policy: default-src 'none'; sandbox`, which disables all JS/CSS/fetch and
is not configurable. GitHub Pages serves the file correctly.

## Open decisions (spec §8)

- Custom domain for the Pages URL — optional.
- `verify_jwt` stays **on**; the cron sends the project anon key, which satisfies it.
