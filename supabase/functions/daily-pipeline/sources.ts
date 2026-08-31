export interface Feed {
  name: string;
  url: string;
}

// Finalised in the Phase 1 design (spec section 5). Cadence is once daily.
// Note on DL News: their RSS terms specify personal/non-commercial use with attribution.
// Swap for The Block (https://www.theblock.co/rss.xml) if that becomes a concern at scale.
export const FEEDS: Feed[] = [
  { name: "TechCrunch — Fundings & Exits", url: "https://techcrunch.com/fundings-exits/feed/" },
  { name: "Crunchbase News", url: "https://news.crunchbase.com/feed/" },
  { name: "Quantum Computing Report", url: "https://quantumcomputingreport.com/feed/" },
  { name: "DL News", url: "https://www.dlnews.com/rss/" },
  { name: "Inc42", url: "https://inc42.com/feed" },
  { name: "YourStory", url: "https://yourstory.com/feed" },
];
