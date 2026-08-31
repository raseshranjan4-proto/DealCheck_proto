import { createClient } from "@supabase/supabase-js";
import { fetchAllFeeds } from "./rss.ts";
import { extractDeal } from "./anthropic.ts";
import { toDealRow } from "./validate.ts";
import { findProcessed, markProcessed, resolveLayer2 } from "./dedup.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Pipeline stations (spec section 6):
//   1. cron trigger (external)      5. validation
//   2. fetch feeds                  6. layer-2 dedup -> insert / update / discard
//   3. layer-1 dedup               7. always mark the article processed
//   4. extraction (Claude)         8. frontend reads deals via REST (separate concern)
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const started = Date.now();
  const summary = {
    fetched: 0,
    new_articles: 0,
    extracted_deals: 0,
    inserted: 0,
    updated: 0,
    discarded: 0,
    invalid: 0,
    errors: 0,
    dry_run: false,
  };

  try {
    summary.dry_run = new URL(req.url).searchParams.get("dry_run") === "1";

    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const ANTHROPIC_KEY = requireEnv("ANTHROPIC_API_KEY");
    const maxArticles = Number(Deno.env.get("PIPELINE_MAX_ARTICLES_PER_RUN") ?? "60") || 60;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // 2. fetch
    const articles = await fetchAllFeeds();
    summary.fetched = articles.length;

    // 3. layer-1 dedup — drop anything we've already looked at
    const processed = await findProcessed(supabase, articles.map((a) => a.url));
    const fresh = articles
      .filter((a) => !processed.has(a.url))
      .sort((a, b) => (Date.parse(b.published ?? "") || 0) - (Date.parse(a.published ?? "") || 0))
      .slice(0, maxArticles);
    summary.new_articles = fresh.length;

    for (const article of fresh) {
      try {
        // 4. extraction
        const extraction = await extractDeal(article, ANTHROPIC_KEY);

        // 5. validation
        const v = toDealRow(extraction, article.url);
        if (!v.ok) {
          if (extraction.is_deal) {
            summary.invalid++;
            console.warn(`invalid extraction: ${article.url} — ${v.reason}`);
          }
          if (!summary.dry_run) await markProcessed(supabase, article.url, false);
          continue;
        }
        summary.extracted_deals++;

        if (summary.dry_run) {
          console.log(`DRY RUN — would upsert: ${JSON.stringify(v.row)}`);
          continue; // no DB writes, and leave the article unmarked so the run is repeatable
        }

        // 6. layer-2 dedup
        const outcome = await resolveLayer2(supabase, v.row);
        if (outcome.action === "insert") {
          const { error } = await supabase.from("deals").insert(v.row);
          if (error && error.code !== "23505") throw new Error(`insert: ${error.message}`);
          if (!error) summary.inserted++;
        } else if (outcome.action === "update") {
          const { error } = await supabase
            .from("deals")
            .update({
              amount_display: v.row.amount_display,
              amount_usd_millions: v.row.amount_usd_millions,
              source_url: v.row.source_url,
            })
            .eq("id", outcome.id);
          if (error) throw new Error(`update: ${error.message}`);
          summary.updated++;
        } else {
          summary.discarded++;
        }

        // 7. always record the article
        await markProcessed(supabase, article.url, true);
      } catch (err) {
        summary.errors++;
        console.error(`article failed: ${article.url} — ${err instanceof Error ? err.message : err}`);
      }
    }

    return json(200, { ok: true, ms: Date.now() - started, ...summary });
  } catch (err) {
    console.error(`pipeline fatal: ${err instanceof Error ? err.message : err}`);
    return json(500, { ok: false, ms: Date.now() - started, error: err instanceof Error ? err.message : String(err), ...summary });
  }
});

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
