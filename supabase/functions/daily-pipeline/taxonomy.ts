// Single source of truth *in code* for TAXONOMY.md (repo root). Change that file first,
// then mirror it here. The extraction tool schema, validation, and the database CHECK
// constraints are all derived from these lists.

/** Primary sectors — exactly one per deal. Key → definition used in the extraction prompt. */
export const SECTOR_DEFINITIONS = {
  // Financial Services
  payments_banking: "Moving money and holding accounts: payment rails, POS, UPI apps, neobanks, banking-as-a-service, remittances, cards.",
  lending_credit: "Extending or enabling credit: consumer/SME lending, BNPL, credit scoring, collections, supply-chain finance.",
  insurance: "Risk transfer: distribution and aggregators, digital insurers, underwriting, claims tech, embedded insurance.",
  wealth_capital_markets: "Investing and market infrastructure: brokerages, robo-advisors, mutual-fund platforms, wealth management, trading infra, private-market and secondary marketplaces.",
  web3_digital_assets: "Blockchain-native businesses: chains, crypto exchanges, wallets, stablecoins, DeFi, tokenisation.",
  // Software & Security
  ai_ml: "The model IS the product: foundation-model labs, AI infrastructure (training/inference), MLOps, general-purpose agents and copilots, AI research companies.",
  enterprise_saas: "HORIZONTAL business software used across industries: CRM, HR tech, finance ops, productivity, collaboration, sales and marketing tech, legal tech, customer support.",
  dev_data_infra: "What software is built and run on: devtools, CI/CD, databases, data platforms, cloud and hosting, data centres, observability, APIs, low-code.",
  cybersecurity: "Protecting systems, data and identities: security software, identity and access, fraud detection and KYC, privacy and compliance tooling.",
  // Consumer & Media
  consumer_brands_d2c: "Makes or owns branded consumer products: beauty, personal care, fashion, packaged food and beverage brands, home goods, wellness and lifestyle products, non-clinical fitness trackers.",
  ecommerce_retail: "Selling or enabling the sale of goods: marketplaces, quick commerce, grocery and restaurant delivery, rental and resale platforms, seller enablement, social commerce.",
  media_gaming: "Content, play and live experiences: streaming/OTT, gaming incl. real-money gaming and fantasy sports, esports, creator economy, publishing, events and ticketing, social apps.",
  edtech: "Learning, and software for those who deliver it: K-12/higher-ed/test-prep, upskilling and professional training, coaching, campus and admissions software.",
  // Health
  healthcare_services: "Delivering or coordinating care: hospital and clinic chains, telemedicine, mental health, pharmacy delivery, emergency services, hospital software.",
  biotech_pharma: "Therapeutics: drug discovery, therapeutics, vaccines, CROs/CDMOs, bio-manufacturing, synthetic biology for health.",
  medtech_diagnostics: "Physical products and tests that measure or treat the body: medical devices, imaging, surgical robotics, lab and at-home diagnostics, clinical-grade wearables.",
  // Industrial & Frontier
  semiconductors: "Chips and electronic hardware: chip design, fabrication, packaging, EDA, photonics, electronic components, consumer-electronics hardware.",
  robotics_automation: "Builds and sells robots or automation systems as the product: industrial, warehouse and service robots, drone hardware, humanoids, automation equipment.",
  advanced_manufacturing: "New materials and industrial production tech: advanced materials, 3D printing, industrial equipment and process tech, precision manufacturing, specialty chemicals, industrial IoT.",
  space_defence: "Beyond-Earth and national security: launch, satellites, earth observation, in-space services, defence systems, dual-use tech, military drones.",
  quantum: "Quantum computing hardware and software, quantum sensing, quantum communications.",
  // Energy, Mobility & Real Assets
  energy_climate: "Clean energy and emissions reduction: solar/wind/hydrogen, batteries and storage, grid tech, energy trading, carbon capture and credits, sustainability software, water tech.",
  ev_mobility: "Moving people and the vehicles that do it: EV OEMs, charging and battery-swap networks, ride-hailing, micro-mobility, auto-tech, eVTOL.",
  logistics_supply_chain: "Moving goods: freight and trucking, warehousing and fulfilment, last-mile delivery networks, supply-chain SaaS, cross-border trade, B2B commerce for SMEs.",
  agritech_food: "Food at the production end: farm inputs and advisory, precision agriculture, agri marketplaces and supply chain, alternative proteins, food-processing tech, aquaculture.",
  real_estate_construction: "Property, and building it: property marketplaces and brokerage tech, rental and co-living, construction tech and materials, facilities management, hospitality tech.",
  // Fallback
  other: "Fits none of the above. Use rarely.",
} as const;

export type PrimarySector = keyof typeof SECTOR_DEFINITIONS;
export const SECTOR_KEYS = Object.keys(SECTOR_DEFINITIONS) as PrimarySector[];
export const SECTOR_SET: ReadonlySet<string> = new Set(SECTOR_KEYS);

/** Technology tags — zero or more per deal, fixed list. Key → "apply when" used in the prompt. */
export const TAG_DEFINITIONS = {
  ai_ml: "machine learning is material to the product",
  quantum: "uses quantum hardware or algorithms",
  blockchain: "distributed ledger or on-chain settlement is material",
  robotics: "physical robots or autonomy are material",
  semiconductors: "custom silicon is material",
  biotech: "engineered biology is material",
  space: "space-derived data or space assets are material",
  iot_wearables: "connected hardware or sensors are material",
  cybersecurity: "security is a core capability, not a feature",
  climate: "emissions reduction or sustainability is a core outcome",
  ar_vr: "spatial computing is material",
} as const;

export type TechTag = keyof typeof TAG_DEFINITIONS;
export const TAG_KEYS = Object.keys(TAG_DEFINITIONS) as TechTag[];
export const TAG_SET: ReadonlySet<string> = new Set(TAG_KEYS);

/**
 * A pure-play sector deal always carries its matching tag, so a tag filter returns every
 * deal where that technology matters — pure-play or applied. Enforced in code, not left
 * to the model.
 *
 * Only sectors whose name *is* the technology. Deliberately not biotech_pharma → biotech
 * (a pharma-compliance SaaS isn't engineered biology) or space_defence → space (a defence
 * drone maker has no space assets) — the model decides those case by case.
 */
export const IMPLIED_TAG: Partial<Record<PrimarySector, TechTag>> = {
  ai_ml: "ai_ml",
  quantum: "quantum",
  robotics_automation: "robotics",
  semiconductors: "semiconductors",
  web3_digital_assets: "blockchain",
  energy_climate: "climate",
  cybersecurity: "cybersecurity",
};

/** Deal types — exactly one per deal, or null when the article doesn't say. */
export const DEAL_TYPES = ["VC", "PE", "MA", "SPAC", "IPO", "Debt", "Grant", "Secondary", "Fund"] as const;
export type DealType = (typeof DEAL_TYPES)[number];
export const DEAL_TYPE_SET: ReadonlySet<string> = new Set(DEAL_TYPES);
