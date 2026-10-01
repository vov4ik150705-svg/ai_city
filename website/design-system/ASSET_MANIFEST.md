# Corporator Website — Asset Manifest

All paths are relative to the repository root `C:\Users\sk640\ai_city`. Every file below was listed and measured from the repository (dimensions / pixel format via System.Drawing). Filenames are exact, including spaces, capitalization and documented typos. **Do not rename assets** (README: "Имена файлов с опечатками не переименовывать").

Legend — Status: **CANONICAL** (named by documentation) · **SUPPORTING** (in repo, not named, usable only with owner approval) · **DUPLICATE** (byte-identical copy of a canonical file at another path; use the canonical path) · **EXCLUDED** (documentation forbids) · **SUPERSEDED** (used by the obsolete prototype, replaced by documented paths) · **MISSING** (documented need, no file).

Alpha: `A` = 32bpp with alpha channel, `O` = opaque 24bpp.

---

## 1. Global / brand

| Canonical name | Path | Type | Size | α | Status | Usage | Notes |
|---|---|---|---|---|---|---|---|
| Corporator mark (small) | `website/industries-cut/mark.png` | PNG | 96×110 | A | SUPPORTING | header/footer logo mark candidate | only raster marks exist; no SVG (OQ-03) |
| Corporator mark (HUD) | `apps/client/assets/hud/brand/mark.png` | PNG | 128×128 | A | SUPPORTING | alt source for mark | HUD asset |
| Logo sheet with $CORP | `website/logo solo.png` | PNG | 1254×1254 | O | SUPPORTING | reference only (opaque off-white bg) | not for direct placement |
| Prototype favicon | `apps/www/public/favicon.svg` | SVG | 241 B | — | SUPERSEDED? | favicon | prototype-authored, not verified brand (OQ-03) |
| Wordmark "CORPORATOR" | — | — | — | — | MISSING | header, footer | typeset in TT Octosquares Condensed (OQ-01 resolved). Vector file still open (OQ-03) |
| Robinhood Chain wordmark, black | `website/brand/robinhood-chain/robinhood-chain-brand-assets-v1/Robinhood Chain Brand Assets - V1/Robinhood Chain Logo/Robinhood_Chain_Logo_Black.svg` | SVG | viewBox 1576×207 | A | CANONICAL | Hero on a light background | Official file from `robinhood-chain-brand-assets-v1.zip`. Do not redraw, recolor, distort, or crop. PNG sibling is 6567×863, transparent, black ink |
| Robinhood Chain wordmark, white | `website/brand/robinhood-chain/robinhood-chain-brand-assets-v1/Robinhood Chain Brand Assets - V1/Robinhood Chain Logo/Robinhood_Chain_Logo_White.svg` | SVG | viewBox 1576×207 | A | CANONICAL | dark backgrounds only | Same package. PNG sibling 6567×863, transparent, white ink |
| Robinhood feather avatar | `website/brand/robinhood-chain/robinhood-chain-brand-assets-v1/Robinhood Chain Brand Assets - V1/Robinhood Feather Symbol/Robinhood_Avatar.jpg` | JPEG | 1000×1000 | O | CANONICAL symbol, not the Hero logo | app icon / favicon only, per the brand guidelines | Neon field `#CCFF00` is part of the file. Do not substitute this for the wordmark |
| X logo | — | — | — | — | MISSING | footer "Follow on X", links | brand glyph needs approval (OQ-05) |

## 2. Fonts

| Family | Path | Weights | Status | Usage |
|---|---|---|---|---|
| TT Octosquares Condensed Black | `website/fonts/tt-octosquares/TT-Octosquares-Trial-Condensed-Black.ttf` | 900, width class condensed, CSS `font-stretch: normal` | CANONICAL display (OQ-01). Trial file supplied by the owner. Internal name `TT Octosquares Trl Cnd` / `Blc`. Not the retail webfont | major headlines and display roles. Do not substitute another family |
| Roboto Regular | `website/fonts/roboto/roboto-latin.woff2` | 400 only | CANONICAL body/UI (OQ-02). Name table `Roboto` / `Regular`, OS/2 weight 400, no `fvar` | body, navigation, labels, buttons, metadata, tables, supporting UI |
| Roboto Regular latin-ext | `website/fonts/roboto/roboto-latin-ext.woff2` | 400 only | CANONICAL web subset | load with latin |
| JetBrains Mono | `art/fonts/jetbrains_mono.woff2` | 400 | CANONICAL (repo) | addresses |
| IBM Plex Sans | `art/fonts/ibm_plex_sans.woff2` | 400 only | NOT for the website. HUD and current `apps/www` prototype only | do not use on the website |
| Anton | — | — | SUPERSEDED. Not the website display face | do not use |
| Inter | — | — | SUPERSEDED. Not the website body face | do not use |
| Barlow Condensed | — | — | FORBIDDEN for the website | do not use |
| Source Serif 4 | `art/fonts/source_serif_4.woff2` | — | not used | — |
| Press Start 2P | `art/fonts/press_start_2p.woff2`, `.ttf` | — | not used | — |

Licenses on disk: `website/fonts/roboto/LICENSE`, plus the HUD set `art/fonts/OFL-IBMPlexSans.txt`, `OFL-JetBrainsMono.txt`, `OFL-PressStart2P.txt`, `LICENSE-SourceSerif4.md`. HUD manifest: `art/fonts/manifest.json` (pixel/log only; website faces are not added there).

TT Octosquares Condensed Black is the display face. The file on disk is the owner-supplied trial `TT Octosquares Trial Condensed Black.ttf` (name table `TT Octosquares Trl Cnd` / `Blc`, OS/2 weight 900, width class 3). CSS assigns it to `"TT Octosquares Condensed"` at weight 900 and `font-stretch: normal`. It is not the retail webfont. No other family is used in its place. Roboto Regular woff2 is the file Google Fonts serves for Roboto v51 at weight 400 only (latin and latin-ext). `fontTools`: name Roboto, subfamily Regular, OS/2 weight 400, no `fvar`. `font-synthesis: none` stays. Do not add Roboto 500 or 600.

Robinhood Chain source: `https://cdn.robinhood.com/robinhood_chain/brand_assets/robinhood-chain-brand-assets-v1.zip`, linked from `https://docs.robinhood.com/chain/brand-guidelines/`. The zip is kept next to the extract. Files inside were not edited. The Hero uses the black wordmark. The feather avatar is not the Hero logo. Approved pairings on that page are black on white, white on black, and black on `#CCFF00`. The word mark in running text is "Robinhood Chain" in title case. See DC-59.

## 3. Hero

| Name | Path | Size | α | Status | Desktop | Mobile |
|---|---|---|---|---|---|---|
| Hero island + sky | `website/arts/hero.png` | 1671×941 | O | CANONICAL (README, copy §1) | full-bleed background; island right half | stacked layer below buttons, cover crop |

Art note: in `hero.png` the island center sits ≈60% from the left; in `hero-desktop.png` ≈70% (DC-46). Island includes waterfalls, floating islets, sun flare top-left.

## 4. Game (core loop)

| Step | Path | Size | α | Status |
|---|---|---|---|---|
| 01 Get Capital | `website/assets/logo_cloud_png.png` | 1555×1012 | A | CANONICAL |
| 02 Switch on and staff | `website/assets/workshop_cloud_png.png` | 1554×1012 | A | CANONICAL |
| 03 Supply the work | `website/assets/workshop_solo_cloud.png` | 1536×1024 | **O** | CANONICAL — opaque; background must match card surface or be verified visually (OQ-13 note) |
| 04 Get paid, then decide | `website/assets/bank_cloud_png.png` | 1254×1254 | A | CANONICAL |
| HUD panels Overview / Agents / Bank / Industries | — | — | — | MISSING → placeholders (documented) (OQ-08) |

Supporting, not to use in place of the above: `website/assets/logo_cloud.png` (O), `workshop_cloud.png` (O), `bank_cloud.png` (O) — opaque versions of the same art.

## 5. Industries

### 5.1 Sky and beacons (documented folder `website/design-refernces/industries/assets/`)

| Industry | Beacon building | Path | Size | α | Status |
|---|---|---|---|---|---|
| (shared) sky | — | `website/design-refernces/industries/assets/sky2.png` | 1585×992 | O | CANONICAL |
| Compute | AI Research Center | `website/design-refernces/industries/assets/AI-RESEARCH-CENTER.png` | 1024×1536 | A | CANONICAL |
| Energy | Energy Plant | `…/industries/assets/ENERGY-PLANT.png` | 1254×1254 | A | CANONICAL |
| Logistics | Logistics Hub | `…/industries/assets/LOGISTICS-HUB.png` | 1268×1241 | A | CANONICAL |
| Consumer | Flagship Store | `…/industries/assets/FLAGSHIP-STORE.png` | 1214×1295 | A | CANONICAL |
| Automation | Cloud Campus | `…/industries/assets/CLOUD-CAMPUS.png` | 1024×1536 | A | CANONICAL |
| Finance | Finance Tower | `…/industries/assets/FINANCE-TOWER.png` | 1024×1536 | A | CANONICAL |

Beacons verified against `content/params/districts.json` → `districts.*.beacon`: compute→ai_research_center, energy→energy_plant, logistics→logistics_hub, consumer→flagship_store, automation→cloud_campus, finance→finance_tower.

Beacon canvases differ in aspect ratio (2:3 portrait vs ~1:1). Render inside a fixed stage box with `object-fit: contain` and bottom anchoring so the island base sits at the same baseline for all six.

DUPLICATES (same byte size, use canonical path above): `website/arts/{AI-RESEARCH-CENTER,CLOUD-CAMPUS,ENERGY-PLANT,FINANCE-TOWER,FLAGSHIP-STORE,LOGISTICS-HUB}.png`, `website/assets/{same six}.png`, `website/arts/sky2.png`, `website/assets/sky2.png`.

### 5.2 Stock logos (`website/stock-logos/`)

| Industry | Path | Size | α | Notes |
|---|---|---|---|---|
| Compute | `website/stock-logos/nvidia_logo.png` | 800×800 | A | |
| Energy | `website/stock-logos/tesla_logo.jpg` | 735×767 | O (JPEG) | white bg in file |
| Logistics | `website/stock-logos/amazon_logo.jpg` | 480×480 | O | |
| Consumer | `website/stock-logos/apple_logo.jpg` | 728×542 | O | |
| Automation | `website/stock-logos/microsoft_logo.jpg` | 820×500 | O | |
| Finance | `website/stock-logos/coinbase_logo.jpg` | 554×554 | O | |

JPEG logos have opaque backgrounds; place them on white tiles/chips only (Industries tiles and chips are white; Leaderboard weights pills are white). Used by: Industries selector, Works with, synergy card pair rows, Leaderboard "Weights, not payouts" row. Never with a ticker in the same frame (Industries).

### 5.3 Synergy building avatars (from `website/buildings-avatars/`, documented)

| Synergy | Pair | Path |
|---|---|---|
| Robotics Lab | Compute + Energy | `website/buildings-avatars/Robotics Lab.png` |
| Drone Depot | Compute + Logistics | `website/buildings-avatars/Drone Depot.png` |
| Data Center | Compute + Automation | `website/buildings-avatars/Data Center.png` |
| Fleet Yard | Energy + Logistics | `website/buildings-avatars/Fleet Yard.png` |
| Retail Complex | Consumer + Logistics | `website/buildings-avatars/Retail Complex.png` |
| Clearing House | Automation + Finance | `website/buildings-avatars/clearing house.png` |

Pairs verified against `content/params/districts.json` → `synergies.*.requires`. All avatars are **opaque black background** (sampled `#000000`) — on the light synergy cards this is a black rectangle (DC-10, OQ-13).

## 6. Buildings (18) — previews and models

Preview folder `website/buildings-avatars/` (all O, black bg). Model folder `models/`. Mapping is the documented table (README); two names differ (Retail Complex model, Clearing House preview). Ids from `content/params/buildings.json`.

| # | Building (id) | Category | Preview | Preview size | Model | Model size |
|---|---|---|---|---|---|---|
| 1 | City Hall (`city_hall`) | Base | `City Hall.png` | 1254² | `City Hall.glb` | 0.84 MB |
| 2 | Workshop (`workshop`) | Base | `Workshop.png` | 1254² | `Workshop.glb` | 1.40 MB |
| 3 | Agent Hub (`agent_hub`) | Base | `Agent Hub.png` | 1254² | `Agent Hub.glb` | 1.33 MB |
| 4 | Power Node (`power_node`) | Base | `Power Node.png` | 1254² | `Power Node.glb` | 1.86 MB |
| 5 | Bank (`bank`) | Base | `Bank.png` | 1254² | `Bank.glb` | 1.79 MB |
| 6 | Exchange (`exchange`) | Base | `Exchange.png` | 1536×1024 | `Exchange.glb` | 1.38 MB |
| 7 | AI Research Center (`ai_research_center`) | Industry · Compute | `AI Research Center.png` | 1254² | `AI Research Center.glb` | 2.52 MB |
| 8 | Energy Plant (`energy_plant`) | Industry · Energy | `Energy Plant.png` | 1254² | `Energy Plant.glb` | 0.64 MB |
| 9 | Logistics Hub (`logistics_hub`) | Industry · Logistics | `Logistics Hub.png` | 1268×1241 | `Logistics Hub.glb` | 1.22 MB |
| 10 | Flagship Store (`flagship_store`) | Industry · Consumer | `Flagship Store.png` | 1536×1024 | `Flagship Store.glb` | 0.28 MB |
| 11 | Cloud Campus (`cloud_campus`) | Industry · Automation | `Cloud Campus.png` | 1254² | `Cloud Campus.glb` | 1.68 MB |
| 12 | Finance Tower (`finance_tower`) | Industry · Finance | `Finance Tower.png` | 1254² | `Finance Tower.glb` | 0.66 MB |
| 13 | Robotics Lab (`robotics_lab`) | Synergy · Compute+Energy | `Robotics Lab.png` | 1254² | `Robotics Lab.glb` | 0.15 MB |
| 14 | Drone Depot (`drone_depot`) | Synergy · Compute+Logistics | `Drone Depot.png` | 1254² | `Drone Depot.glb` | 1.41 MB |
| 15 | Data Center (`data_center`) | Synergy · Compute+Automation | `Data Center.png` | 1312×1199 | `Data Center.glb` | 1.14 MB |
| 16 | Fleet Yard (`fleet_yard`) | Synergy · Energy+Logistics | `Fleet Yard.png` | 1268×1241 | `Fleet Yard.glb` | 0.87 MB |
| 17 | Retail Complex (`retail_complex`) | Synergy · Consumer+Logistics | `Retail Complex.png` | 1269×1239 | **`Retail_complex.glb`** | 1.39 MB |
| 18 | Clearing House (`clearing_house`) | Synergy · Automation+Finance | **`clearing house.png`** | 1312×1199 | `Clearing House.glb` | 0.61 MB |

Preview paths are `website/buildings-avatars/<Preview>`; model paths `models/<Model>`. Category split (Base 6 / Industry 6 / Synergy 6) follows copy §4 headings.

Supporting alternatives (not documented, owner approval required, OQ-13):
- `website/agents-cut/buildings/*.png` — 16 transparent cut-outs 480 px (snake_case names; **missing `agent_hub` and `robotics_lab`**).
- `apps/client/assets/hud/buildings/*.png` — 19 HUD building PNGs incl. `neon_residence.png` (HUD art, not website).
- `website/buildings/*.png` — larger opaque renders (19 incl. `Neon Residence.png`) and two reference sheets.

## 7. Agents

| Role | Portrait (documented) | Size | α | Supporting cut-out |
|---|---|---|---|---|
| Engineer | `website/units/Engineer.png` | 1024×1536 | A | `website/agents-cut/units/engineer.png` (356×755 A) |
| Logistician | `website/units/Logistician.png` | 1024×1536 | A | `website/agents-cut/units/logistician.png` |
| Trader | `website/units/trader.png` | 1024×1024 | A | `website/agents-cut/units/trader.png` |
| Scientist | `website/units/scientist.png` | 1024×1536 | A | `website/agents-cut/units/scientist.png` |
| Manager | `website/units/manager.png` | 1408×1408 | A | `website/agents-cut/units/manager.png` |

Portraits are images, not 3D (documented). Canvas aspect ratios differ (2:3, 1:1): render in a fixed stage with `contain`, bottom-anchored so feet align. Selector thumbnails crop the same image (upper body); no separate thumbnail files are documented.

SUPERSEDED: `assets/website/units/*_anfas.png` (used by `apps/www/src/art.ts`). Undocumented: `website/arts/units*.png` (composite renders) — not to use.

## 8. Economy

### 8.1 Main art (`website/design-refernces/economy/art/`)

| File | Size | α | Role | Status |
|---|---|---|---|---|
| `economy-art.png` | 1670×941 | O | whole composition (sky + bank island + character + coin) | CANONICAL option A |
| `economy-sky-art.png` | 1671×941 | O | background for composite | CANONICAL option B (background) |
| `economy-art-png-2.png` | 1670×942 | A | island cut-out without floating islets | CANONICAL option B (cut) |
| `economy-art-2-png.png` | 1670×942 | A | island cut-out with floating islets | CANONICAL option B (cut) |

Choice A vs B is open (OQ-20). Undocumented look-alikes: `website/arts/economy-art-png.png` (A), `website/arts/economy-example-art.png` (O) — do not use.

### 8.2 Tab images (`website/design-refernces/economy/assets/`)

| Tab | Slot | File(s) | α |
|---|---|---|---|
| Enter | flow | `CORP.png` → `vault.png` → `capital.png` → `city_actions.png` | A, A, A, A |
| Enter | assets column | `CORP.png`, `capital.png`, `stock-tokens.png`, `payroll.png`, `INFLUENSE.png`, `fragments.png` | `stock-tokens.png` is **O** |
| Work | flow | `work.png` → `Payment-Request.png` → `payroll.png` → `capital.png` | A |
| Work | rules | `fund_14_per_day.png`, `24ticks.png`, `proportional_share.png`, `empty_fund.png` | A |
| Work | "40% burned" | — | no image exists (documented) |
| Exit | flow | `capital.png` → `bank.png` → `voucher_exit_flow.png` → `CORP.png` | A (bank/voucher 1536×1024) |
| Exit | rules | `base_markup.png`, `global_daily_limit.png`, `voucher_exit_rules.png` | A |
| Prizes | flow | `DEX.png` → `pools.png` → `cualify.png` → `claim.png` | A |
| Prizes | cards | `prizes_monthly.png`, `stock-tokens.png`, `farm.png` | `stock-tokens.png` O |
| Prizes | rules | `30_day_prize_period.png`, `7_day_farm.png`, `6_positive_days.png`, `live_stake.png`, `TOP10.png`, `claim_yourself.png` | `live_stake.png` is **O** |

Exact typos kept: `INFLUENSE.png`, `cualify.png`. `voucher_exit_flow.png` (voucher on pedestal) is only for the flow step; `voucher_exit_rules.png` (blank only) is only for the rules column (documented).

Exit mockup "Bank window" rule has no documented image (the README lists three rules images for four mockup rules) — use a Lucide clock icon or leave the slot iconless (OQ-19).

EXCLUDED: `city_actions_2.png` (documented "не использовать").

## 9. Rating / Leaderboard

| Need | File | Status |
|---|---|---|
| Island image per leaderboard row (replaces company logos) | **not named** | MISSING (OQ-24) |
| "Weights, not payouts" logos | the six `website/stock-logos/*` files | CANONICAL |
| Rating empty-state icon | Lucide `file-text` | icon |
| Factor / clock / rule icons | Lucide | icons |

## 10. Footer

| Name | Path | Size | α | Status |
|---|---|---|---|---|
| Footer art | `website/arts/futer.png` | 2170×725 | O | CANONICAL |

Supporting: `website/assets/industries_png.png` (2171×724 A) and `website/industries-cut/cloud.png` (1800×496 A) — not documented; do not use.

## 11. 3D resources

- Models: 18 files in `models/` (table §6). Loader: `three` `GLTFLoader` (three@0.185.1 present in the pnpm store as a dependency of `packages/render`; **not** resolvable from `apps/www` today — OQ-17).
- The live game renderer `packages/render/src/three.ts` is the game's renderer; do not import game render code into the website.
- Island GLBs are not website assets.

## 12. Exclusion list

| Asset / path | Reason | Source | Likely accidental use |
|---|---|---|---|
| `website/buildings-avatars/Neon Residence.png` | not among the 18 | README Buildings; copy §4 | building rail "all files in folder" loop |
| `website/buildings/Neon Residence.png` | same | same | same |
| `models/neon-residence.glb` | same | same | model glob |
| `apps/client/assets/hud/buildings/neon_residence.png` | same (HUD) | same | HUD asset reuse |
| `models/island1/`, `models/island 2/` … `models/island 6/` | "Папки island1, island 2–island 6 … не брать" | README Buildings | recursive model glob |
| `models/_experimental/` | same | README Buildings | recursive model glob |
| `website/design-refernces/economy/assets/city_actions_2.png` | "не использовать" | README Economy | alphabetical picker |
| Mockup PNGs (`website/reference/mockups/**`, `website/design-refernces/**/*-desktop.png`, `*-mobile.png`) | references, never shipped as UI | README; task rules | using a mockup crop as image |
| Company logos inside Leaderboard rows | replaced by island image | README Leaderboard | copying mockup |
| Flat mockup icons in Economy slots | replaced by generated images | README Economy | redrawing icons |
| Tickers next to logos in Industries | forbidden | README Industries | copying mockup labels |
| `website/buildings/Canonical_Building_Reference_11_19.png`, `Corporator_Building_Reference_01_10.png` | reference sheets | evidence: sheets, not placements | gallery reuse |

Not excluded, but undocumented (use only with owner approval): `website/arts/SKY.png`, `website/arts/Industries 1.png`, `Industries 2.png`, `units*.png`, `website/industries-cloud.png`, `website/industries-cut/*.png` (except as brand mark candidate), `website/agents-cut/**`, `website/*.html` prototypes, all of `assets/website/**` (SUPERSEDED prototype sources).

## 13. Asset delivery

- Originals are 0.7–2.5 MB PNGs. The implementation must produce resized derivatives (AVIF/WebP + PNG fallback for alpha) at build time without altering the originals or their names in the source folders. Derivative widths: 480 / 800 / 1200 / 1600 / 2200 as needed per slot.
- Filenames with spaces must be URL-encoded when referenced; importing via Vite `?url` from `../../../website/...` works with the existing `server.fs.allow: [repo]`.
