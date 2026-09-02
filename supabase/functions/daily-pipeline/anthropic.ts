import type { Article, Extraction } from "./types.ts";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5"; // spec section 4: structured extraction, not open-ended reasoning

// Repeated verbatim on every call -> cache it for the ~90% repeated-input discount.
const SYSTEM_PROMPT =
  `You are extracting structured deal data from a single news article for Deal-Check, a VC/M&A/PE tracker.

Call the record_deal tool exactly once.

Set is_deal false (and null everything else) if the article is not reporting one specific, discrete
funding / M&A / PE event — e.g. a market roundup, trend piece, listicle, or opinion article.

Never guess a number: only fill amount_usd_millions if the article states a figure. Convert it to
millions of USD (a "$1.1B round" -> 1100). Leave it null for "undisclosed" or vague language.

Sector priority when a deal could fit more than one: quantum > ai > defi > deeptech > other.
Classify a company by what it physically makes or fundamentally is, not the industry it serves.
Test: if you removed the AI/ML component and a working core product remains, it is deeptech plus a
sub_sector_tag; if nothing remains, it is ai plus a tag.

announced_date is the date the deal was announced (yyyy-mm-dd), not the article's publish date,
unless they are the same.`;

const TOOL = {
  name: "record_deal",
  description: "Record the structured extraction for this one article.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "is_deal", "company", "description", "primary_sector", "sub_sector_tags",
      "deal_type", "stage", "amount_display", "amount_usd_millions", "investors",
      "region", "announced_date",
    ],
    properties: {
      is_deal: { type: "boolean" },
      company: { type: ["string", "null"], description: "The company raising / being acquired." },
      description: { type: ["string", "null"], description: "One sentence on what the company does." },
      primary_sector: { type: ["string", "null"], enum: ["quantum", "ai", "defi", "deeptech", "other", null] },
      sub_sector_tags: { type: "array", items: { type: "string" }, description: "e.g. Semiconductors, Robotics, Space, Biotech, AI Infrastructure, Payments/Stablecoins, Prediction Markets" },
      deal_type: { type: ["string", "null"], enum: ["VC", "MA", "PE", "SPAC", "Fund", null] },
      stage: { type: ["string", "null"], description: "e.g. Seed, Series B, Buyout" },
      amount_display: { type: ["string", "null"], description: 'Human-readable, e.g. "$1.1B"' },
      amount_usd_millions: { type: ["number", "null"], description: "Millions of USD, only if stated." },
      investors: { type: ["string", "null"] },
      region: { type: ["string", "null"] },
      announced_date: { type: ["string", "null"], description: "yyyy-mm-dd" },
    },
  },
} as const;

export async function extractDeal(article: Article, apiKey: string): Promise<Extraction> {
  const userText =
    `Source feed: ${article.feed}\n` +
    `Article published: ${article.published ?? "unknown"}\n` +
    `Headline: ${article.title}\n\n` +
    `Body:\n${article.content.slice(0, 12_000)}`;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [TOOL],
      tool_choice: { type: "tool", name: "record_deal" },
      messages: [{ role: "user", content: userText }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = await res.json();
  // deno-lint-ignore no-explicit-any
  const block = (data.content ?? []).find((b: any) => b.type === "tool_use");
  if (!block?.input) throw new Error("no tool_use block in Anthropic response");
  return normalize(block.input as Record<string, unknown>);
}

function normalize(raw: Record<string, unknown>): Extraction {
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: unknown): number | null =>
    typeof v === "number" && isFinite(v) && v >= 0 ? v : null;

  return {
    is_deal: raw.is_deal === true,
    company: str(raw.company),
    description: str(raw.description),
    primary_sector: (["quantum", "ai", "defi", "deeptech", "other"].includes(raw.primary_sector as string)
      ? raw.primary_sector
      : null) as Extraction["primary_sector"],
    sub_sector_tags: Array.isArray(raw.sub_sector_tags)
      ? raw.sub_sector_tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      : [],
    deal_type: (["VC", "MA", "PE", "SPAC", "Fund"].includes(raw.deal_type as string)
      ? raw.deal_type
      : null) as Extraction["deal_type"],
    stage: str(raw.stage),
    amount_display: str(raw.amount_display),
    amount_usd_millions: num(raw.amount_usd_millions),
    investors: str(raw.investors),
    region: str(raw.region),
    announced_date: str(raw.announced_date),
  };
}
