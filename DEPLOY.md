# Deploy checklist — from repo to live app

Ordered. Each stage ends with a checkpoint you can verify.

## Inputs you need first

- **Anthropic API key** with billing on — https://console.anthropic.com/settings/keys
- **Supabase database password** — Dashboard → Project Settings → Database
- **Supabase service_role key** and **anon key** — Dashboard → Project Settings → API
- Supabase CLI: `npm i -g supabase` (Node is available on this machine), or `npx supabase ...`

---

## Stage 1 — Pipeline live

```bash
cd deal-check
supabase login
supabase link --project-ref nggfbjwpdggrezhtasys      # prompts for DB password
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...      # you run this — it is a secret
supabase functions deploy daily-pipeline
```

Dry run (no writes), watching logs in another terminal (`supabase functions logs daily-pipeline`):

```bash
$env:SUPABASE_SERVICE_ROLE_KEY = "..."
pwsh ./scripts/dry-run.ps1
```

Real run:

```bash
pwsh ./scripts/run.ps1
```

**✅ Checkpoint:** Dashboard → Table Editor → `deals` has rows. `run.ps1` returned
`"ok": true` with non-zero `inserted`.

---

## Stage 2 — Daily schedule

Dashboard → Edge Functions → `daily-pipeline` → Schedules → Add → `15 6 * * *` (06:15 UTC).

_Or_ SQL-managed: in the SQL editor run
`select vault.create_secret('<SERVICE_ROLE_KEY>', 'daily_pipeline_token');`
then `supabase db push` to apply `migrations/20260831000002_schedule_daily_pipeline.sql`.

**✅ Checkpoint:** Schedules tab lists the job; Invocations count increases the next day.

---

## Stage 3 — Frontend on Supabase Storage

1. Copy `deal-check.html` into `frontend/` (download it from the claude.ai Phase 1 chat).
2. Paste the **anon** key into `frontend/supabase-data.js` (`REPLACE_WITH_ANON_KEY`).
3. Wire `deal-check.html` to `loadDeals()` — see `frontend/README.md`. Keep it single-file
   by inlining the `supabase-data.js` body; remove any `window.storage` writes.
4. One-time: Dashboard → Storage → New bucket → name **`site`**, **Public** enabled.
5. Upload:

   ```bash
   $env:SUPABASE_SERVICE_ROLE_KEY = "..."
   pwsh ./scripts/deploy-frontend.ps1
   ```

**Live URL:**
`https://nggfbjwpdggrezhtasys.supabase.co/storage/v1/object/public/site/deal-check.html`

**✅ Checkpoint:** that URL loads the ledger, populated from Supabase, filters/sort/date
groups working. Re-run `deploy-frontend.ps1` any time you change the HTML (`x-upsert`).

---

## Stage 4 — GitHub

No `gh` CLI on this machine. Create an **empty** repo at https://github.com/new
(no README/licence/.gitignore), then:

```bash
cd deal-check
git branch -M main
git remote add origin https://github.com/<you>/deal-check.git
git push -u origin main
```

`.gitignore` already excludes `.env` and CLI state. Nothing secret is committed — keys
live in Supabase secrets and your local shell env only.
