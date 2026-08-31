// Deal-Check — live data source.
// Drop-in replacement for the `window.storage` seed reads in deal-check.html.
//
// The page is READ-ONLY (spec section 7): public RLS on `deals` is select-only, so there
// is no write path here by design. Do not add one without revisiting that access decision.

const SUPABASE_URL = "https://nggfbjwpdggrezhtasys.supabase.co";

// Public anon key — safe to ship in the page. RLS restricts it to SELECT on `deals`.
// Dashboard > Project Settings > API > Project API keys > anon / public
const SUPABASE_ANON_KEY = "REPLACE_WITH_ANON_KEY";

/**
 * Fetch every deal, newest first. Column names already match the fields the UI renders
 * (company, description, primary_sector, sub_sector_tags, deal_type, stage,
 *  amount_display, amount_usd_millions, investors, region, announced_date, source_url).
 *
 * Deals persist indefinitely; the daily pipeline only ever adds/updates rows, so this is
 * a plain full-table read and the UI does its own date-grouping/filtering client-side.
 *
 * @returns {Promise<Array<object>>}
 */
export async function loadDeals() {
  const url =
    `${SUPABASE_URL}/rest/v1/deals` +
    `?select=*` +
    `&order=announced_date.desc.nullslast,created_at.desc`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
