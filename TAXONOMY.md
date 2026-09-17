# Deal-Check Taxonomy — v2

**Status:** approved 2026-09-17. Supersedes §1 (Sector taxonomy) of `../deal-check-context1.md`.
**Scope:** all startup sectors, India and global. The extraction prompt in
`supabase/functions/daily-pipeline/anthropic.ts` and the `deals` table constraints must
mirror this file exactly — change it here first.

Decisions this file encodes: market-axis primary sector · fixed technology tags as a
second axis · 26 fine-grained sectors + `other` · 6 UI-only groups · 9 deal types ·
recency = pipeline `created_at` window, ordered by `announced_date`.

---

## 1. Principles

1. **Market-first.** Classify by *who pays and for what outcome*, never by the technology
   inside. "AI-powered lending" is Lending & Credit, tagged `ai_ml`.
2. **The technology exception.** `ai_ml`, `quantum`, `robotics_automation`,
   `semiconductors` and `web3_digital_assets` are sectors **only when the technology itself
   is the product being sold.** Test: remove the technology — if a business remains, it
   belongs to that business's market sector instead.
3. **Vertical software follows its vertical.** Software sold into one industry takes that
   industry's sector (admissions software → `edtech`; hospital software →
   `healthcare_services`). `enterprise_saas` is reserved for **horizontal** tools.
4. **Revenue decides ties.** When a company straddles two sectors, pick the one the
   majority of revenue comes from; if unknown, the one the article leads with.
5. **Funds take their mandate's sector**, or `other` if generalist. `deal_type = Fund`
   already distinguishes them from operating companies.
6. **`other` is a signal, not a bucket.** It should stay under 5%. A recurring kind of
   deal landing in `other` means a sector is missing from this file.

---

## 2. Primary sectors

Exactly one per deal. Stored in `deals.primary_sector` (CHECK constraint on the keys).
Drives stats and the sector filter.

### Financial Services

| Key | Label | Definition · includes · *not this* |
|---|---|---|
| `payments_banking` | Payments & Banking | Moving money and holding accounts. Payment gateways/rails, POS, UPI apps, neobanks, banking-as-a-service, remittances, cards, payroll payments. *Not:* lending → `lending_credit`; investing → `wealth_capital_markets`; crypto → `web3_digital_assets`. |
| `lending_credit` | Lending & Credit | Extending credit or enabling it. Consumer / SME / MSME lending, BNPL, credit scoring & bureaus, collections, supply-chain finance, debt marketplaces. *Not:* payment processing → `payments_banking`. |
| `insurance` | Insurance | Risk-transfer products and their infrastructure. Distribution & aggregators, digital insurers, underwriting, claims tech, embedded insurance. *Not:* care delivery → `healthcare_services`. |
| `wealth_capital_markets` | Wealth & Capital Markets | Investing and market infrastructure. Brokerages, robo-advisors, mutual-fund platforms, wealth management, trading infra, private-market & secondary marketplaces, alternative assets. *Not:* crypto exchanges → `web3_digital_assets`. |
| `web3_digital_assets` | Web3 & Digital Assets | Blockchain-native products and crypto-asset businesses. L1/L2 chains, exchanges, wallets, stablecoins, DeFi protocols, tokenisation. *Not:* a fintech that merely settles on-chain → its fintech sector + `blockchain` tag. |

### Software & Security

| Key | Label | Definition · includes · *not this* |
|---|---|---|
| `ai_ml` | AI & Machine Learning | **The model is the product.** Foundation-model labs, AI infrastructure (training / inference / serving), MLOps, general-purpose agents and copilots, AI research companies. *Not:* AI applied to one vertical → that vertical + `ai_ml` tag. |
| `enterprise_saas` | Enterprise SaaS | **Horizontal** business software sold across industries. CRM, HR tech, finance & accounting ops, productivity, collaboration, sales & marketing tech, legal tech, customer support. *Not:* single-vertical software → that vertical (Principle 3); devtools → `dev_data_infra`; security → `cybersecurity`. |
| `dev_data_infra` | Developer & Data Infrastructure | What other software is built and run on. Devtools, CI/CD, databases, data platforms & warehouses, cloud & hosting, data centres, observability, API platforms, low-code. *Not:* AI-specific infra → `ai_ml`; security tooling → `cybersecurity`. |
| `cybersecurity` | Cybersecurity | Protecting systems, data and identities. Security software, identity & access, fraud detection & KYC, privacy and compliance tooling, threat intelligence. *Not:* general compliance ops → `enterprise_saas`. |

### Consumer & Media

| Key | Label | Definition · includes · *not this* |
|---|---|---|
| `consumer_brands_d2c` | Consumer Brands & D2C | Makes or owns branded products sold to consumers. Beauty & personal care, fashion & apparel, packaged food & beverage brands, home goods, wellness & lifestyle products, non-clinical fitness trackers. *Not:* marketplaces selling others' brands → `ecommerce_retail`; clinical-grade health devices → `medtech_diagnostics`. |
| `ecommerce_retail` | E-commerce & Retail Tech | Selling or enabling the sale of goods online / omnichannel. Horizontal & vertical marketplaces, quick commerce, grocery and restaurant delivery, rental & resale platforms, seller and retail enablement software, social commerce. *Not:* own-brand D2C → `consumer_brands_d2c`; the delivery network itself → `logistics_supply_chain`. |
| `media_gaming` | Media, Gaming & Entertainment | Content, play and live experiences. Streaming & OTT, gaming (incl. real-money gaming and fantasy sports), esports, creator-economy tools, publishing, events & ticketing, social and community apps. *Not:* adtech sold to businesses → `enterprise_saas`. |
| `edtech` | Edtech | Learning, and software for those who deliver it. K-12 / higher-ed / test-prep platforms, upskilling & professional training, coaching, campus and admissions software (Principle 3). *Not:* horizontal corporate-learning tools → `enterprise_saas`. |

### Health

| Key | Label | Definition · includes · *not this* |
|---|---|---|
| `healthcare_services` | Healthcare Services & Digital Health | Delivering or coordinating care. Hospital and clinic chains, telemedicine, mental-health platforms, pharmacy delivery, emergency services, care navigation, hospital software (Principle 3). *Not:* drugs → `biotech_pharma`; devices → `medtech_diagnostics`; underwriting → `insurance`. |
| `biotech_pharma` | Biotech & Pharma | Discovering, developing and manufacturing therapeutics. Drug discovery (incl. AI-driven — tag `ai_ml`), therapeutics, vaccines, CROs / CDMOs, bio-manufacturing, synthetic biology for health. *Not:* agricultural biotech → `agritech_food`; devices → `medtech_diagnostics`. |
| `medtech_diagnostics` | Medical Devices & Diagnostics | Physical products and tests that measure or treat the body. Medical devices, imaging, surgical robotics, lab and at-home diagnostics, clinical-grade wearables and monitoring. *Not:* lifestyle trackers with no health claims → `consumer_brands_d2c`. |

### Industrial & Frontier

| Key | Label | Definition · includes · *not this* |
|---|---|---|
| `semiconductors` | Semiconductors & Electronics | Chips and electronic hardware. Chip design, fabrication, packaging, EDA, photonics, electronic components & manufacturing, consumer-electronics hardware. *Not:* an AI lab that also makes chips → `ai_ml` (Principle 4); quantum hardware → `quantum`. |
| `robotics_automation` | Robotics & Automation | Builds and sells robots or automation systems as the product. Industrial, warehouse and service robots, drone hardware, humanoids, automation equipment. *Not:* an operator that uses robots → its sector + `robotics` tag; surgical robots → `medtech_diagnostics`. |
| `advanced_manufacturing` | Advanced Materials & Manufacturing | New materials and industrial production technology. Advanced materials, 3D printing / additive, industrial equipment and process tech, precision manufacturing, specialty chemicals, industrial IoT. *Not:* chips → `semiconductors`; robots → `robotics_automation`; batteries → `energy_climate`. |
| `space_defence` | Space & Defence | Beyond-Earth and national-security systems. Launch, satellites and constellations, earth observation, in-space services, defence systems, dual-use tech, military drones. *Not:* satellite-data analytics sold as SaaS to one vertical → that vertical + `space` tag. |
| `quantum` | Quantum | Quantum technologies. Quantum computing hardware and software, quantum sensing, quantum communications and cryptography. |

### Energy, Mobility & Real Assets

| Key | Label | Definition · includes · *not this* |
|---|---|---|
| `energy_climate` | Energy & Climate Tech | Producing, storing and distributing clean energy; reducing emissions. Solar / wind / hydrogen, batteries and storage, grid tech, energy trading, carbon capture and credits, sustainability software, water tech. *Not:* vehicles and charging → `ev_mobility`. |
| `ev_mobility` | EV & Mobility | Moving people, and the vehicles that do it. EV OEMs (2W / 3W / 4W), charging and battery-swap networks, ride-hailing, shared micro-mobility, auto-tech, eVTOL and aviation. *Not:* goods movement → `logistics_supply_chain`; cell manufacturing → `energy_climate`. |
| `logistics_supply_chain` | Logistics & Supply Chain | Moving goods and managing supply chains. Freight and trucking, warehousing and fulfilment, last-mile delivery networks, supply-chain SaaS, cross-border trade platforms, B2B commerce for SMEs. *Not:* consumer marketplaces → `ecommerce_retail`; passenger transport → `ev_mobility`. |
| `agritech_food` | Agritech & Food Systems | Growing, processing and distributing food at the production end. Farm inputs and advisory, precision agriculture, agri marketplaces and supply chain, alternative proteins, food-processing tech, aquaculture. *Not:* consumer food brands → `consumer_brands_d2c`; restaurants and food delivery → `ecommerce_retail`. |
| `real_estate_construction` | Real Estate & Construction | Property, and building it. Property marketplaces and brokerage tech, rental and co-living, construction tech and materials, facilities management, smart buildings, hospitality tech. *Not:* furniture rental → `ecommerce_retail`. |

### Fallback

| Key | Label | Definition |
|---|---|---|
| `other` | Other | Genuinely fits none of the above. Rare by design — see Principle 6. |

---

## 3. Sector groups (UI only)

Not stored. A static map in the frontend; regrouping is a one-line edit there.

| Group | Sectors |
|---|---|
| Financial Services | `payments_banking`, `lending_credit`, `insurance`, `wealth_capital_markets`, `web3_digital_assets` |
| Software & Security | `ai_ml`, `enterprise_saas`, `dev_data_infra`, `cybersecurity` |
| Consumer & Media | `consumer_brands_d2c`, `ecommerce_retail`, `media_gaming`, `edtech` |
| Health | `healthcare_services`, `biotech_pharma`, `medtech_diagnostics` |
| Industrial & Frontier | `semiconductors`, `robotics_automation`, `advanced_manufacturing`, `space_defence`, `quantum` |
| Energy, Mobility & Real Assets | `energy_climate`, `ev_mobility`, `logistics_supply_chain`, `agritech_food`, `real_estate_construction` |
| — | `other` (ungrouped) |

---

## 4. Technology tags

Zero or more per deal, from this **fixed** list only. Stored in `deals.tech_tags text[]`,
validated on insert; anything off-list is dropped. Replaces the retired free-form
`sub_sector_tags`.

A tag means the technology is **material to the product**, not incidental. A pure-play
sector deal carries its matching tag too (sector `ai_ml` → tag `ai_ml`), so a tag filter
returns *every* deal where that technology matters, pure-play or applied.

| Key | Label | Apply when |
|---|---|---|
| `ai_ml` | AI / ML | Machine learning is material to the product |
| `quantum` | Quantum | Uses quantum hardware or algorithms |
| `blockchain` | Blockchain | Distributed ledger or on-chain settlement is material |
| `robotics` | Robotics | Physical robots or autonomy are material |
| `semiconductors` | Semiconductors | Custom silicon is material |
| `biotech` | Biotech | Engineered biology is material |
| `space` | Space | Space-derived data or space assets are material |
| `iot_wearables` | IoT & Wearables | Connected hardware or sensors are material |
| `cybersecurity` | Cybersecurity | Security is a core capability, not a feature |
| `climate` | Climate | Emissions reduction or sustainability is a core outcome |
| `ar_vr` | AR / VR | Spatial computing is material |

---

## 5. Deal types

Exactly one per deal. Stored in `deals.deal_type` (CHECK constraint; nullable when the
article doesn't say).

| Value | Meaning |
|---|---|
| `VC` | Equity round from venture / angel investors (seed through late growth) |
| `PE` | Growth or buyout investment by private equity |
| `MA` | Acquisition or merger |
| `SPAC` | SPAC merger / de-SPAC listing |
| `IPO` | Public listing, including India SME-board IPOs |
| `Debt` | Venture debt, debt financing, credit lines — non-equity |
| `Grant` | Non-dilutive grant or government funding |
| `Secondary` | Secondary share sale, ESOP buyback, tender offer — no new capital to the company |
| `Fund` | A fund raising its own capital (LP close), not an operating company |

---

## 6. Tie-break procedure

Apply in order; stop at the first that resolves it.

1. **Is the technology itself the product?** → the technology sector (Principle 2).
2. **Which market does revenue come from?** → that sector (Principle 1).
3. **Is it software for one vertical?** → that vertical (Principle 3).
4. **Still two candidates?** → the majority-revenue one; if unknown, the one the article
   leads with (Principle 4).
5. **Truly none?** → `other`, and note it (Principle 6).

---

## 7. Worked examples (from the live table, 2026-09-17)

| Company | What it does | Old sector | New sector | Tags |
|---|---|---|---|---|
| Business Nextgen Finance | SME lender | `deeptech` ❌ | `lending_credit` | — |
| Medulance | Ambulance & emergency services | `deeptech` ❌ | `healthcare_services` | — |
| ESDS Software Solution | Data centres & cloud hosting | `ai` ❌ | `dev_data_infra` | — |
| GC AI | AI assistant for in-house legal | `ai` | `enterprise_saas` | `ai_ml` |
| NoPaperForms | Admissions & enrolment software | `ai` ❌ | `edtech` | — |
| Ultrahuman | Health-monitoring smart ring | `ai` **and** `deeptech` ❌ | `medtech_diagnostics` | `iot_wearables`, `ai_ml` |
| SUGAR Cosmetics | Beauty brand | `other` | `consumer_brands_d2c` | — |
| Purple Style Labs | Fashion brand house | `other` | `consumer_brands_d2c` | — |
| RentoMojo | Furniture & appliance rental | `other` | `ecommerce_retail` | — |
| EquityZen | Private-market secondaries marketplace | `other` | `wealth_capital_markets` | — |
| Niyo | Neobank | `other` | `payments_banking` | — |
| InsuranceDekho | Insurance aggregator | `other` | `insurance` | — |
| BookMyShow | Ticketing & live events | `other` | `media_gaming` | — |
| upGrad / Unacademy | Online education | `other` | `edtech` | — |
| Socure | Identity verification & fraud | `ai` | `cybersecurity` | `ai_ml` |
| Kepler Aerospace | Launch / space systems | `deeptech` | `space_defence` | `space` |
| Yuma Energy, Leanwatts | Clean energy | `deeptech` | `energy_climate` | `climate` |
| Minimac Systems | Industrial lubrication systems | `deeptech` | `advanced_manufacturing` | — |
| Diffraqtion | Quantum | `quantum` | `quantum` | `quantum` |
| NIIF | Government infrastructure fund | `other` | `other` (Fund, generalist) | — |

---

## 8. Data-model changes required

| Change | Detail |
|---|---|
| `deals.primary_sector` | Replace CHECK constraint with the 27 keys in §2 |
| `deals.tech_tags` | New `text[]`, default `'{}'`, validated against the 11 keys in §4 |
| `deals.sub_sector_tags` | Retire (drop after the reclassification pass) |
| `deals.deal_type` | Replace CHECK constraint with the 9 values in §5 |
| Existing rows (~85 at cut-over) | One-time reclassification pass over stored `company` + `description`, writes new `primary_sector` + `tech_tags`. No article re-fetch. |
| Extraction prompt & tool schema | Rewrite `anthropic.ts` to emit these keys; the enum lists in the tool schema are the enforcement point |
| Frontend | Sector-group map (§3), tag filter, recency filter (§9) |

---

## 9. Recency and date semantics

Two dates, two jobs:

- **`created_at`** — when Deal-Check found the deal. Drives the **recency window** on the
  main page: what's new since you last looked. Never empty on a day the cron ran.
- **`announced_date`** — when the deal actually happened per the article. Drives **sort
  order and date-group headers** inside the window. May be months before `created_at`
  (a March deal reported in September) and is occasionally null.

Main page = deals where `created_at ≥ now() − window`, ordered `announced_date desc nulls
last`. Window options: **Today · Last 3 days · Last week · Last month · Last 3 months · All
time**. Default: Today, falling back to Last 3 days if Today is empty.

---

## 10. Out of scope for this file (follow-ups)

- **RSS sources.** The current six feeds skew frontier-tech + India. All-sector global
  coverage needs additions (e.g. Axios Pro Rata, Fierce Biotech, Entrackr, EU-Startups,
  e27 for SEA). Tracked separately.
- **Dedup.** Layer-2 identity matching for M&A naming variance — separate change.
