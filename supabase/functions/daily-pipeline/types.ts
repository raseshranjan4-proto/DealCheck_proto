export type PrimarySector = "quantum" | "ai" | "defi" | "deeptech" | "other";
export type DealType = "VC" | "MA" | "PE" | "SPAC" | "Fund";

/** One RSS item, normalised across feeds. */
export interface Article {
  url: string;
  title: string;
  content: string;
  published: string | null; // ISO 8601, or null if the feed omitted it
  feed: string;
}

/** Raw shape returned by the extraction LLM (after light normalisation). */
export interface Extraction {
  is_deal: boolean;
  company: string | null;
  description: string | null;
  primary_sector: PrimarySector | null;
  sub_sector_tags: string[];
  deal_type: DealType | null;
  stage: string | null;
  amount_display: string | null;
  amount_usd_millions: number | null;
  valuation_display: string | null;
  valuation_usd_millions: number | null;
  investors: string | null;
  region: string | null;
  announced_date: string | null; // yyyy-mm-dd
}

/** A validated row ready to insert/update in public.deals. */
export interface DealRow {
  company: string;
  description: string | null;
  primary_sector: PrimarySector;
  sub_sector_tags: string[];
  deal_type: DealType | null;
  stage: string | null;
  amount_display: string | null;
  amount_usd_millions: number | null;
  valuation_display: string | null;
  valuation_usd_millions: number | null;
  investors: string | null;
  region: string | null;
  announced_date: string | null;
  source_url: string;
}
