# Frontend

`deal-check.html` is the approved Phase 1 build (spec section 7 — locked styling), already
wired to the live database. It stays a single self-contained file.

## What was changed from the claude.ai version

- `loadDeals()` now does a `fetch` against the Supabase REST API instead of reading
  `window.storage`.
- Added `mapRow()` — Supabase columns (`primary_sector`, `deal_type`, `amount_display`,
  `amount_usd_millions`, `announced_date`, `source_url`) are mapped to the flat field names
  the table/stats/ticker already render against (`sector`, `type`, `amount`, `amountNum`,
  `date`, `source`).
- Removed `SEED_DEALS` and `saveDeals()` — the page is read-only and owns no data.
- On a fetch failure the empty state shows a "couldn't load the registry" message instead
  of silently falling back to fake data.

## Key

`SUPABASE_ANON_KEY` near the top of the `<script>` holds the project's publishable key
(`sb_publishable_…`), sent via the `apikey` header. It is public by design; RLS restricts
it to `SELECT` on `deals`. Swap it only if the key is rotated.

## Publish

Supabase Storage — see [`../DEPLOY.md`](../DEPLOY.md) stage 3, or:

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = "..."
powershell -ExecutionPolicy Bypass -File ..\scripts\deploy-frontend.ps1
```

Live URL: `https://nggfbjwpdggrezhtasys.supabase.co/storage/v1/object/public/site/deal-check.html`

## Do not

- Restyle (spec section 7 is locked).
- Add manual add/edit/delete UI — public access is `SELECT` only.
