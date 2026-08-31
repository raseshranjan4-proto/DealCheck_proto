import { parseFeed } from "rss";
import type { Article } from "./types.ts";
import { FEEDS } from "./sources.ts";

const UA = "Deal-Check/1.0 (daily deal aggregator)";
const FETCH_TIMEOUT_MS = 20_000;

/** Fetch every configured feed, tolerate individual failures, de-dupe by URL within the batch. */
export async function fetchAllFeeds(perFeedLimit = 25): Promise<Article[]> {
  const settled = await Promise.allSettled(
    FEEDS.map((f) => fetchFeed(f.name, f.url, perFeedLimit)),
  );

  const out: Article[] = [];
  const seen = new Set<string>();
  settled.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`feed failed: ${FEEDS[i].name}: ${r.reason instanceof Error ? r.reason.message : r.reason}`);
      return;
    }
    for (const a of r.value) {
      if (!a.url || seen.has(a.url)) continue;
      seen.add(a.url);
      out.push(a);
    }
  });
  return out;
}

async function fetchFeed(name: string, url: string, limit: number): Promise<Article[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let xml: string;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } finally {
    clearTimeout(t);
  }

  const feed = await parseFeed(xml);
  const entries = feed.entries ?? [];
  return entries.slice(0, limit).map((e) => entryToArticle(e, name)).filter((a): a is Article => a !== null);
}

// deno-lint-ignore no-explicit-any
function entryToArticle(e: any, feedName: string): Article | null {
  const href: string =
    e?.links?.find((l: any) => l?.href)?.href ??
    e?.links?.[0]?.href ??
    (typeof e?.id === "string" && /^https?:/i.test(e.id) ? e.id : "");
  const url = normalizeUrl(href);
  if (!url) return null;

  const rawBody =
    e?.["content:encoded"]?.value ??
    e?.content?.value ??
    e?.description?.value ??
    e?.summary?.value ??
    "";

  const publishedDate: Date | undefined = e?.published ?? e?.updated;

  return {
    url,
    title: stripHtml(e?.title?.value ?? "").slice(0, 400),
    content: stripHtml(rawBody).slice(0, 20_000),
    published: publishedDate instanceof Date && !isNaN(publishedDate.getTime())
      ? publishedDate.toISOString()
      : null,
    feed: feedName,
  };
}

/** Strip tracking params / fragments / trailing slash so syndicated reposts collapse. */
export function normalizeUrl(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|mc_|pk_)/i.test(k) || /^(ref|source|fbclid|gclid|igshid|cmpid)$/i.test(k)) {
        u.searchParams.delete(k);
      }
    }
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    u.hostname = u.hostname.replace(/^www\./i, "");
    return u.toString();
  } catch {
    return s;
  }
}

function stripHtml(s: string): string {
  return String(s)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#\d+;|&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
