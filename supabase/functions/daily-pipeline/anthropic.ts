import type { Article, DealType, Extraction, PrimarySector, TechTag } from "./types.ts";
import {
  DEAL_TYPES, DEAL_TYPE_SET, IMPLIED_TAG,
  SECTOR_DEFINITIONS, SECTOR_KEYS, SECTOR_SET,
  TAG_DEFINITIONS, TAG_KEYS, TAG_SET,
} from "./taxonomy.ts";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5"; // structured extraction, not open-ended reasoning

const sectorLines = SECTOR_KEYS.map((k) => `- ${k}: ${SECTOR_DEFINITIONS[k]}`).join("\n");
const tagLines = TAG_KEYS.map((k) => `- ${k}: ${TAG_DEFINITIONS[k]}`).join("\n");

// Mirrors TAXONOMY.md §1 (principles), §2 (sectors), §4 (tags), §5 (deal types), §6 (ties).
const SYSTEM_PROMPT =
  `You are extracting structured deal data from a single news article for Deal-Check, a startup deal tracker covering every sector, India and global. Call the record_deal tool exactly once.

IS IT A DEAL
is_deal is true only if the article reports one specific, discrete transaction: a funding round, acquisition or merger, PE investment, IPO or listing, debt raise, grant, secondary sale, or fund close. Market roundups, trend pieces, listicles and opinion → is_deal false and every other field null or empty.

PRIMARY SECTOR — exactly one key from the list below.
Rule 1, market-first: classify by WHO PAYS and FOR WHAT OUTCOME, never by the technology inside. AI-powered lending is lending_credit, tagged ai_ml.
Rule 2, the technology exception: ai_ml, quantum, robotics_automation, semiconductors and web3_digital_assets are sectors ONLY when the technology itself is the product being sold. Test: remove the technology — if a business remains, use that business's market sector and add the tag instead.
Rule 3, vertical software: software sold into a single industry takes that industry's sector (admissions software → edtech; hospital software → healthcare_services). enterprise_saas is only for horizontal tools used across industries.
Rule 4, ties: the sector most revenue comes from; if unknown, the one the article leads with.
Rule 5: a fund takes its mandate's sector, or other if generalist. Use other only when nothing fits.

${sectorLines}

TECH TAGS — zero or more keys, only from this list, only where the technology is MATERIAL to the product, not incidental. A pure-play sector deal carries its matching tag too (sector ai_ml → tag ai_ml).
${tagLines}

DEAL TYPE — one of: VC (equity round from venture or angel investors, seed to late growth) · PE (growth or buyout by private equity) · MA (acquisition or merger) · SPAC (SPAC merger / de-SPAC listing) · IPO (public listing, incl. SME boards) · Debt (venture debt or credit lines — non-equity) · Grant (non-dilutive or government funding) · Secondary (share sale, ESOP buyback, tender offer — no new capital to the company) · Fund (a fund raising its own capital). Null if the article does not say.

AMOUNTS — never guess a number.
amount_usd_millions: the money that changed hands (raised or paid), in millions of USD, only if the article states a figure. "$1.1B" → 1100. If the article gives a USD equivalent for a non-USD figure, use that. Otherwise convert: ₹1 crore = ₹10 million ≈ US$0.12 million, so "₹100 Cr" → 12 and "₹1,000 Cr" → 120. Null for "undisclosed" or vague language.
valuation_usd_millions: the company's valuation, only if the article states one explicitly ("raised $50M at a $500M valuation" → amount 50, valuation 500). Never derive it from the amount or an assumed multiple; null if not stated.
amount_display and valuation_display: the figure as written in the article, e.g. "$1.1B", "₹100 Cr".

description: one sentence on what the company does — say who it sells to, since that decides the sector.
announced_date: the date the deal happened (yyyy-mm-dd), not the article's publish date unless they are the same.`;

const TOOL = {
  name: "record_deal",
  description: "Record the structured extraction for this one article.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "is_deal", "company", "description", "primary_sector", "tech_tags", "deal_type",
      "stage", "amount_display", "amount_usd_millions", "valuation_display",
      "valuation_usd_millions", "investors", "region", "announced_date",
    ],
    properties: {
      is_deal: { type: "boolean" },
      company: { type: ["string", "null"], description: "The company raising, being acquired, or listing." },
      description: { type: ["string", "null"], description: "One sentence on what the company does and who it sells to." },
      primary_sector: { type: ["string", "null"], enum: [...SECTOR_KEYS, null] },
      tech_tags: { type: "array", items: { type: "string", enum: [...TAG_KEYS] } },
      deal_type: { type: ["string", "null"], enum: [...DEAL_TYPES, null] },
      stage: { type: ["string", "null"], description: "e.g. Seed, Series B, Buyout" },
      amount_display: { type: ["string", "null"], description: 'Amount raised/paid as written, e.g. "$1.1B", "₹100 Cr".' },
      amount_usd_millions: { type: ["number", "null"], description: "Amount raised/paid in millions of USD, only if stated." },
      valuation_display: { type: ["string", "null"], description: "Valuation as written — distinct from the amount raised/paid." },
      valuation_usd_millions: { type: ["number", "null"], description: "Valuation in millions of USD, only if explicitly stated. Never derived." },
      investors: { type: ["string", "null"] },
      region: { type: ["string", "null"] },
      announced_date: { type: ["string", "null"], description: "yyyy-mm-dd" },
    },
  },
};

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

  const sector = SECTOR_SET.has(String(raw.primary_sector)) ? (raw.primary_sector as PrimarySector) : null;

  const tags = new Set<TechTag>(
    Array.isArray(raw.tech_tags)
      ? raw.tech_tags.filter((t): t is TechTag => typeof t === "string" && TAG_SET.has(t))
      : [],
  );
  const implied = sector ? IMPLIED_TAG[sector] : undefined;
  if (implied) tags.add(implied);

  return {
    is_deal: raw.is_deal === true,
    company: str(raw.company),
    description: str(raw.description),
    primary_sector: sector,
    tech_tags: [...tags],
    deal_type: DEAL_TYPE_SET.has(String(raw.deal_type)) ? (raw.deal_type as DealType) : null,
    stage: str(raw.stage),
    amount_display: str(raw.amount_display),
    amount_usd_millions: num(raw.amount_usd_millions),
    valuation_display: str(raw.valuation_display),
    valuation_usd_millions: num(raw.valuation_usd_millions),
    investors: str(raw.investors),
    region: str(raw.region),
    announced_date: str(raw.announced_date),
  };
}
