# Frontend wiring

The approved Phase 1 build — `deal-check.html`, a single self-contained file — lives in the
claude.ai project outputs, not in this repo. The only Phase 2 change to it is swapping the
data source from browser-local `window.storage` seed data to the live Supabase table.

## Steps

1. Copy `deal-check.html` into this folder (or edit it wherever it lives).
2. Get the **anon / public** key from the Supabase Dashboard
   (Project Settings → API → Project API keys → `anon`) and paste it into
   [`supabase-data.js`](supabase-data.js) in place of `REPLACE_WITH_ANON_KEY`.
3. In `deal-check.html`, find where it currently loads seed deals from `window.storage`
   (the internal key is `dealwire_deals`). Replace that read with:

   ```html
   <script type="module">
     import { loadDeals } from "./supabase-data.js";
     // or paste the body of supabase-data.js inline to keep the file single-file
     const deals = await loadDeals();
     // ...hand `deals` to the existing render function unchanged
   </script>
   ```

   To keep it a single file, inline the contents of `supabase-data.js` into the page's
   existing `<script>` instead of importing.
4. Remove any code path that *writes* to `window.storage` — the page no longer owns the
   data. Keep view-state (filters, sort, date range) in memory or `localStorage`; that is
   per-viewer UI state, not deal data.

## Do not

- Restyle. Section 7 of the spec is locked (Inter + IBM Plex Mono for numerics, flat
  ledger table, navy `#243B6B`, sector column blocks, ticker strip, mobile stacked cards).
- Re-add manual add/edit/delete UI. Public access is select-only.
