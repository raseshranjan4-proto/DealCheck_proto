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

Dashboard → **Integrations → Cron** (a.k.a. Database → Cron Jobs) → **Create job**:

| Field | Value |
|---|---|
| Name | `deal-check-daily` |
| Schedule | `15 6 * * *` (06:15 UTC) |
| Type | Supabase Edge Function → `daily-pipeline` |
| Method | POST |

The UI attaches the project anon key as `Authorization`, which satisfies `verify_jwt`.
Use **Run now** once and confirm `ok: true`.

_SQL alternative:_ `select vault.create_secret('<SERVICE_ROLE_KEY>', 'daily_pipeline_token');`
then `supabase db push` to apply `migrations/20260831000002_schedule_daily_pipeline.sql`.

**✅ Checkpoint:** job listed; Invocations count rises the next day.

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
