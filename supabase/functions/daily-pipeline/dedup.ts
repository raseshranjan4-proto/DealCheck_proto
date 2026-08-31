import type { SupabaseClient } from "@supabase/supabase-js";
import type { DealRow } from "./types.ts";

const DAY_MS = 86_400_000;
const PROXIMITY_DAYS = 7;

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

/**
 * Layer 2 — identity dedup. Match = same company (case-insensitive) + same primary_sector
 * + announced_date within PROXIMITY_DAYS. On a match, update in place only if the new
 * article carries a more specific amount; otherwise discard.
 */
export async function resolveLayer2(supabase: SupabaseClient, row: DealRow): Promise<Layer2Outcome> {
  const { data, error } = await supabase
    .from("deals")
    .select("id, announced_date, amount_usd_millions, amount_display")
    .ilike("company", escapeIlike(row.company))
    .eq("primary_sector", row.primary_sector);
  if (error) throw new Error(`layer-2 dedup query: ${error.message}`);
  if (!data || data.length === 0) return { action: "insert" };

  const newT = row.announced_date ? Date.parse(row.announced_date) : null;

  const match = data.find((d) => {
    // If either side is missing a date, company + sector is enough to call it the same deal.
    if (newT === null || !d.announced_date) return true;
    return Math.abs(Date.parse(d.announced_date as string) - newT) <= PROXIMITY_DAYS * DAY_MS;
  });
  if (!match) return { action: "insert" };

  const hadAmount = match.amount_usd_millions !== null && match.amount_usd_millions !== undefined;
  const hasNewAmount = row.amount_usd_millions !== null;
  const amountChanged = hasNewAmount && Number(row.amount_usd_millions) !== Number(match.amount_usd_millions);
  const gainedDisplay = !match.amount_display && !!row.amount_display;

  if ((hasNewAmount && !hadAmount) || amountChanged || gainedDisplay) {
    return { action: "update", id: match.id as string };
  }
  return { action: "discard", id: match.id as string };
}

// PostgREST ilike treats % and _ as wildcards; escape them so a literal company name matches.
function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
