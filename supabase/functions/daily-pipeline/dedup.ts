import type { SupabaseClient } from "@supabase/supabase-js";
import type { DealRow } from "./types.ts";

const DAY_MS = 86_400_000;
// Widened from 7: a real case in this data was the same round confirmed by a follow-up
// article 13 days later with more investor names disclosed (spec's original DeepSeek
// example — figures firm up over time). Name matching got stricter in the same change
// (word-boundary, not raw substring), so the wider window doesn't add much false-merge risk.
const PROXIMITY_DAYS = 14;

/** Layer 1 — return the subset of `urls` already present in processed_articles. */
export async function findProcessed(supabase: SupabaseClient, urls: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  const CHUNK = 200;
  for (let i = 0; i < urls.length; i += CHUNK) {
    const chunk = urls.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("processed_articles")
      .select("article_url")
      .in("article_url", chunk);
    if (error) throw new Error(`layer-1 dedup query: ${error.message}`);
    for (const r of data ?? []) found.add(r.article_url as string);
  }
  return found;
}

/** Record that an article was looked at, regardless of outcome. Idempotent. */
export async function markProcessed(supabase: SupabaseClient, url: string, wasADeal: boolean): Promise<void> {
  const { error } = await supabase
    .from("processed_articles")
    .upsert({ article_url: url, was_a_deal: wasADeal }, { onConflict: "article_url" });
  if (error) console.error(`markProcessed failed for ${url}: ${error.message}`);
}

export type Layer2Outcome =
  | { action: "insert" }
  | { action: "update"; id: string }
  | { action: "discard"; id: string };

// Corporate suffixes stripped before comparison, so "RentoMojo" and "Rentomojo Ltd" match.
// Deliberately NOT stripping generic business words (Mobility, Group, Energy, ...) — those
// can be load-bearing (e.g. distinguishing two unrelated companies) and stripping them was
// how a previous naive-substring version produced a false match between two quantum
// companies (their concatenated names happened to share 4 consecutive letters).
const SUFFIX_RE = /\b(ltd|limited|inc|llc|pvt|private|solutions|technologies|technology|corp|corporation|holdings?)\b\.?/gi;

/** Lowercase, strip suffixes as whole words, collapse whitespace/punctuation to single spaces. */
function normalize(name: string): string {
  return name
    .replace(SUFFIX_RE, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** "Nykaa / Earth Rhythm" -> ["Nykaa", "Earth Rhythm"]. A combined-name row can match on either party. */
function nameParts(raw: string): string[] {
  return raw.split(/\s*[/+]\s*|\s+x\s+/i).map((p) => p.trim()).filter(Boolean);
}

/** Does `needle` appear in `haystack` bounded by word boundaries (not mid-word, e.g. "meta" in "metax")? */
function wordBoundaryContains(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(haystack);
}

/** True if any normalized part of A whole-word-contains, or is contained by, any part of B. */
function companiesMatch(companyA: string, companyB: string): boolean {
  const partsA = nameParts(companyA).map(normalize).filter((p) => p.length >= 3);
  const partsB = nameParts(companyB).map(normalize).filter((p) => p.length >= 3);
  for (const a of partsA) {
    for (const b of partsB) {
      if (a === b || wordBoundaryContains(a, b) || wordBoundaryContains(b, a)) return true;
    }
  }
  return false;
}

/**
 * Layer 2 — identity dedup. Match = same primary_sector + fuzzy company-name overlap
 * (word-boundary, suffix-stripped, multi-party aware) + announced_date within
 * PROXIMITY_DAYS. On a match, update in place only if the new article carries a more
 * specific amount and/or valuation; otherwise discard.
 */
export async function resolveLayer2(supabase: SupabaseClient, row: DealRow): Promise<Layer2Outcome> {
  const { data, error } = await supabase
    .from("deals")
    .select("id, company, announced_date, amount_usd_millions, amount_display, valuation_usd_millions, valuation_display")
    .eq("primary_sector", row.primary_sector);
  if (error) throw new Error(`layer-2 dedup query: ${error.message}`);
  if (!data || data.length === 0) return { action: "insert" };

  const newT = row.announced_date ? Date.parse(row.announced_date) : null;

  const match = data.find((d) => {
    if (!companiesMatch(row.company, d.company as string)) return false;
    // If either side is missing a date, name + sector overlap is enough to call it the same deal.
    if (newT === null || !d.announced_date) return true;
    return Math.abs(Date.parse(d.announced_date as string) - newT) <= PROXIMITY_DAYS * DAY_MS;
  });
  if (!match) return { action: "insert" };

  const gainedFigure = (newNum: number | null, oldNum: unknown, newDisplay: string | null, oldDisplay: unknown) => {
    const had = oldNum !== null && oldNum !== undefined;
    const has = newNum !== null;
    const changed = has && Number(newNum) !== Number(oldNum);
    const gainedDisplay = !oldDisplay && !!newDisplay;
    return (has && !had) || changed || gainedDisplay;
  };

  const shouldUpdate =
    gainedFigure(row.amount_usd_millions, match.amount_usd_millions, row.amount_display, match.amount_display) ||
    gainedFigure(row.valuation_usd_millions, match.valuation_usd_millions, row.valuation_display, match.valuation_display);

  if (shouldUpdate) return { action: "update", id: match.id as string };
  return { action: "discard", id: match.id as string };
}
