import { createClient } from "@supabase/supabase-js";
import { fetchAllFeeds } from "./rss.ts";
import { extractDeal } from "./anthropic.ts";
import { toDealRow } from "./validate.ts";
import { findProcessed, markProcessed, resolveLayer2 } from "./dedup.ts";

// Supabase Edge Runtime global for keeping work alive after the response is sent.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

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
//
// Invocation modes (query string):
//   (none)        -> background: respond 202 immediately, run the pipeline via waitUntil.
//                    This is what the daily cron uses — its 5s HTTP timeout can't cover a
//                    ~60s run, so the function must return fast and finish on its own.
//   ?wait=1       -> run synchronously and return the full summary (manual real runs).
//   ?dry_run=1    -> run synchronously, no DB writes, log what would be written. Implies wait.
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const params = new URL(req.url).searchParams;

  // Auth: verify_jwt is off (the cron couldn't reliably send a valid JWT), so gate on a
  // shared secret in the query string instead. Enforced only when the secret is configured.
  const triggerSecret = Deno.env.get("PIPELINE_TRIGGER_SECRET");
  const providedKey = params.get("key") ?? req.headers.get("x-trigger-key");
  if (triggerSecret && providedKey !== triggerSecret) {
    return Promise.resolve(json(401, { ok: false, error: "invalid or missing key" }));
  }

  const dryRun = params.get("dry_run") === "1";
  const wait = dryRun || params.get("wait") === "1";

  if (wait) {
    return runPipeline(dryRun).then(
      (s) => json(200, { ok: true, ...s }),
      (err) => {
        console.error(`pipeline fatal: ${errMsg(err)}`);
        return json(500, { ok: false, error: errMsg(err) });
      },
    );
  }

  // Background mode: kick off and return right away.
  const task = runPipeline(false).catch((err) => console.error(`pipeline fatal: ${errMsg(err)}`));
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime) EdgeRuntime.waitUntil(task);
  return Promise.resolve(json(202, { ok: true, accepted: true, mode: "background" }));
});

async function runPipeline(dryRun: boolean) {
  const started = Date.now();
  const summary = {
    dry_run: dryRun,
    fetched: 0,
    new_articles: 0,
    extracted_deals: 0,
    inserted: 0,
    updated: 0,
    discarded: 0,
    invalid: 0,
    errors: 0,
    error_samples: [] as string[],
    ms: 0,
  };

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
        if (!dryRun) await markProcessed(supabase, article.url, false);
        continue;
      }
      summary.extracted_deals++;

      if (dryRun) {
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
      const msg = errMsg(err);
      console.error(`article failed: ${article.url} — ${msg}`);
      if (summary.error_samples.length < 5) summary.error_samples.push(msg.slice(0, 300));
    }
  }

  summary.ms = Date.now() - started;
  console.log(`pipeline done: ${JSON.stringify(summary)}`);
  return summary;
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
