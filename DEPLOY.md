# Deploy checklist — from repo to live app

This machine has **Windows PowerShell 5.1** (`powershell`, not `pwsh`) and the
**Supabase CLI 2.x** installed.

## Status

| Stage | State |
|---|---|
| 1 — Pipeline deployed + verified (dry run + real run, rows in `deals`) | ✅ done |
| 4 — GitHub repo (`raseshranjan4-proto/DealCheck_proto`) | ✅ done (a few commits to push) |
| 2 — Daily cron | ⬜ pending |
| 3 — Frontend on **GitHub Pages** | ⬜ pending (Supabase Storage rejected — see below) |

---

## Stage 1 — Pipeline live ✅

- [x] `supabase login` / `supabase link --project-ref nggfbjwpdggrezhtasys`
- [x] `supabase functions deploy daily-pipeline` — `verify_jwt` on; unauth call → 401
- [x] `supabase secrets set ANTHROPIC_API_KEY=...` (needs Anthropic billing/credits)
- [x] `supabase secrets set PIPELINE_MAX_ARTICLES_PER_RUN=25`
- [x] dry run → `errors: 0`; real run → rows in `public.deals`

Re-run any time (service_role secret from Dashboard → Settings → API Keys → legacy):

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJ...service_role..."
powershell -ExecutionPolicy Bypass -File .\scripts\dry-run.ps1   # no writes
powershell -ExecutionPolicy Bypass -File .\scripts\run.ps1       # writes
```

Logs: Dashboard → Edge Functions → `daily-pipeline` → Logs (the CLI has no `functions logs`).

---

## Stage 2 — Daily cron ⬜

**Auth model:** `verify_jwt = false` on the function (the cron UI / `net.http_post` could
not reliably send a valid project JWT). Instead the function requires a shared secret —
`?key=<PIPELINE_TRIGGER_SECRET>` in the query string, or an `x-trigger-key` header.

Prereqs: `pg_cron` + `pg_net` extensions enabled (Database → Extensions), and the secret set:
```powershell
supabase secrets set PIPELINE_TRIGGER_SECRET=<a long random string>
```

Schedule via **SQL Editor** (the cron UI's "Edge Function" type is fine too, but SQL is
what actually worked here — paste the same secret):

```sql
select cron.unschedule('deal-check-daily');  -- ignore error if it doesn't exist yet

select cron.schedule(
  'deal-check-daily',
  '15 6 * * *',
  $$
  select net.http_post(
    url     := 'https://nggfbjwpdggrezhtasys.supabase.co/functions/v1/daily-pipeline?key=<PIPELINE_TRIGGER_SECRET>',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);
```

Background mode: the bare call (no `wait`/`dry_run`) returns `202` in <1s and finishes the
~60s pipeline via `EdgeRuntime.waitUntil`, so the 5s cron timeout is irrelevant.

Test immediately — run the inner `net.http_post(... ?key=<secret> ...)` on its own, wait
~90s, then:
```sql
select id, status_code, left(content::text,150) content, created
from net._http_response order by created desc limit 3;   -- want status_code 202
select count(*) from public.deals;                        -- want it to grow
```
Real health = Edge Functions → `daily-pipeline` → **Logs** (`pipeline done: {...}`), not the
cron run-status line.

**✅ Checkpoint:** `net._http_response` shows `202`; `deals` grows after the test / next day.

---

## Stage 3 — Frontend on GitHub Pages ⬜

> **Why not Supabase Storage:** every public Storage object is served with
> `Content-Security-Policy: default-src 'none'; sandbox` and `Content-Type: text/plain`.
> That disables all JavaScript, styles, fonts, and `fetch` — a single-file web app
> cannot run there, and the header is not configurable. GitHub Pages serves plain HTML
> correctly.

The published file is **`docs/index.html`** (a copy of the wired page; keep it in sync if
you edit the source).

1. Push the repo (Stage 4).
2. GitHub → repo **Settings → Pages** → Source: **Deploy from a branch** →
   Branch `main`, folder **`/docs`** → Save.
3. Wait ~1 min for the first build.

**Live URL:** `https://raseshranjan4-proto.github.io/DealCheck_proto/`

**✅ Checkpoint:** that URL renders the ledger; the deals from Stage 1 appear; filters,
sort, date-groups, and the ticker work.

Update later: edit `docs/index.html` (and `frontend`-side source if you keep one),
commit, push — Pages rebuilds automatically.

---

## Stage 4 — GitHub ✅

Repo: `https://github.com/raseshranjan4-proto/DealCheck_proto` (`main`).

```powershell
git push
```

`.gitignore` excludes `.env` and CLI state. No secrets are committed — the Anthropic key
and service-role key live only in Supabase secrets and your shell.

**Rotate after go-live:** both the Anthropic key and the `service_role` JWT were pasted in
plaintext during setup. Anthropic Console → roll the key; Supabase → Settings → API Keys →
roll the JWT secret (the function's injected copy updates automatically).
