import type { DealRow, Extraction } from "./types.ts";

const SECTORS = new Set(["quantum", "ai", "defi", "deeptech", "other"]);
const DEAL_TYPES = new Set(["VC", "MA", "PE", "SPAC", "Fund"]);

export type ValidationResult =
  | { ok: true; row: DealRow }
  | { ok: false; reason: string };

/**
 * Turn a raw extraction into a DealRow, or reject it with a reason.
 * Rules (spec section 4): required fields present, enums in range, and
 * amount_usd_millions is a real number or null — never inferred from vague language.
 */
export function toDealRow(x: Extraction, sourceUrl: string): ValidationResult {
  if (!x.is_deal) return { ok: false, reason: "not a discrete deal" };
  if (!x.company) return { ok: false, reason: "missing company" };
  if (!x.primary_sector || !SECTORS.has(x.primary_sector)) {
    return { ok: false, reason: `bad primary_sector: ${x.primary_sector}` };
  }
  if (x.deal_type !== null && !DEAL_TYPES.has(x.deal_type)) {
    return { ok: false, reason: `bad deal_type: ${x.deal_type}` };
  }
  if (!isSaneAmount(x.amount_usd_millions)) return { ok: false, reason: "bad amount_usd_millions" };
  if (!isSaneAmount(x.valuation_usd_millions)) return { ok: false, reason: "bad valuation_usd_millions" };

  return {
    ok: true,
    row: {
      company: x.company.trim(),
      description: x.description,
      primary_sector: x.primary_sector,
      sub_sector_tags: Array.isArray(x.sub_sector_tags) ? x.sub_sector_tags : [],
      deal_type: x.deal_type,
      stage: x.stage,
      amount_display: x.amount_display,
      amount_usd_millions: x.amount_usd_millions,
      valuation_display: x.valuation_display,
      valuation_usd_millions: x.valuation_usd_millions,
      investors: x.investors,
      region: x.region,
      announced_date: normalizeDate(x.announced_date),
      source_url: sourceUrl,
    },
  };
}

/** null is fine (not stated); otherwise must be a real, non-negative number. */
function isSaneAmount(n: number | null): boolean {
  return n === null || (typeof n === "number" && isFinite(n) && n >= 0);
}

/** Accept only a sane yyyy-mm-dd; drop anything malformed or wildly out of range. */
function normalizeDate(s: string | null): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (isNaN(t)) return null;
  if (t > Date.now() + 3 * 86_400_000) return null;   // not more than ~3 days in the future
  if (t < Date.parse("2015-01-01T00:00:00Z")) return null;
  return iso;
}
