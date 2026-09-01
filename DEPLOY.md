# Deploy checklist — from repo to live app

Ordered. Each stage ends with a checkpoint you can verify.
This machine has **Windows PowerShell 5.1** (`powershell`, not `pwsh`) and the
**Supabase CLI 2.x** already installed.

## Inputs you need

- **Anthropic API key** with billing on — https://console.anthropic.com/settings/keys _(outstanding)_
- ~~Supabase database password~~ — used, project linked
- **service_role key** (legacy `eyJ...` JWT) — Dashboard → Settings → API Keys → "JWT-based keys (legacy)"

---

## Stage 1 — Pipeline live

- [x] `supabase login`
- [x] `supabase link --project-ref nggfbjwpdggrezhtasys`
- [x] `supabase functions deploy daily-pipeline` — deployed, `verify_jwt` on, unauthenticated call returns 401, authenticated call runs
- [ ] `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` — **blocked on the API key**
- [ ] dry run, then real run

Once the key is set, watch logs in another terminal
(`supabase functions logs daily-pipeline`) and run:

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJ...service_role..."

# dry run — fetch + extract, logs what it would write, no DB changes
powershell -ExecutionPolicy Bypass -File .\scripts\dry-run.ps1

# real run
powershell -ExecutionPolicy Bypass -File .\scripts\run.ps1
```

Or skip the scripts entirely — the raw call:

```powershell
curl.exe -sS -X POST "https://nggfbjwpdggrezhtasys.supabase.co/functions/v1/daily-pipeline?dry_run=1" -H "Authorization: Bearer $env:SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d "{}"
```
(drop `?dry_run=1` for the real run)

**✅ Checkpoint:** Dashboard → Table Editor → `deals` has rows; the response is
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

1. [x] `frontend/deal-check.html` wired to the Supabase REST API (`loadDeals()` +
   `mapRow()`; `window.storage` and `SEED_DEALS` removed).
2. [x] Publishable key (`sb_publishable_…`) set in `frontend/deal-check.html`; Data API
   enabled, `public` schema exposed, `GET /rest/v1/deals` returns `[]`.
3. [ ] One-time: Dashboard → Storage → New bucket → name **`site`**, **Public** enabled.
4. [ ] Upload:

   ```powershell
   $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ...service_role..."
   powershell -ExecutionPolicy Bypass -File .\scripts\deploy-frontend.ps1
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
