# Corporator Website — Architecture

Source of truth order: documentation (`CORPORATOR_WEBSITE_COPY_2.md`, `README.md`) → desktop mockups → mobile mockups → repository. See `DESIGN_CONFLICTS.md` for every place where they disagree.

---

## 1. Routes (documented, closed set)

| Route | Page | Meta title | Meta description | Breadcrumbs |
|---|---|---|---|---|
| `/` | Landing | **not documented** (OQ-32) | **not documented** (OQ-32) | none |
| `/rating` | Rating | `Rating \| Corporator` | `The public Corporator rating: every wallet city ordered by Influence, and how the daily score is counted.` | `Corporator / Rating` |
| `/leaderboard` | Leaderboard | `Leaderboard \| Corporator` | `How Corporator cities qualify for Stock Token prizes, how places are paid, and what resets each 30-day period.` | `Corporator / Leaderboard` |

Anchors:

- `/#game` — "Что это за игра" block. Header "Game" scrolls to it on `/`; on subpages navigates to `/#game`.
- Hero secondary CTA **How it works** — anchor to the core loop inside the Game block (same block; anchor id for the loop, e.g. `#how-it-works`, is an implementation detail, not a route).

No other routes. The current prototype routes `/game`, `/industries`, `/economy`, `/seasons` (`apps/www/src/App.tsx`) are obsolete (DC-50) and are removed when the site is implemented. The prototype's designed 404 view is repository behavior for unknown paths and may remain; it is not a new page.

Hosting: SPA with History API routing (existing `navigate()` in `App.tsx`). Production hosting must rewrite `/rating` and `/leaderboard` to `index.html` (existing `HANDOFF.md` note). Direct entry to `/rating` and `/leaderboard` must work — the documentation states people arrive there by direct link.

---

## 2. Shared layout

```
<SkipLink/>                       existing repository pattern
<Header/>                         shared, sticky, Hero mockup is the only reference
<main id="main">                  page content, focus target on route change (existing)
<Footer/>                         shared, identical on all three routes (futer.png art)
<MobilePlayBar/>                  mobile only, fixed bottom, Play Now (documented)
<PlayChooser/>                    modal/popover: Play demo · Play with wallet + hint
<Tooltip/> <Modal/>               portals
```

Header, Footer, MobilePlayBar and PlayChooser are rendered once by the app shell, never by a page or block.

---

## 3. Landing `/`

Order is fixed by documentation. No other sections; **no FAQ, no Rating teaser, no Leaderboard teaser, no section numbers**.

| # (TOC only) | Block | Theme | Id / anchor | Contract |
|---|---|---|---|---|
| 1 | Hero | light, full-viewport sky art | `hero` | `blocks/HERO_OVERVIEW.md` |
| 2 | Game ("Что это за игра") | light, flat `--site-bg-light` with sky top | `game` | `blocks/GAME_OVERVIEW.md` |
| 3 | Industries | light, sky art | `industries` | `blocks/INDUSTRIES_OVERVIEW.md` |
| 4 | Buildings | **dark** | `buildings` | `blocks/BUILDINGS_OVERVIEW.md` |
| 5 | Agents | **dark** | `agents` | `blocks/AGENTS_OVERVIEW.md` |
| 6 | Economy | light, sky art | `economy` | `blocks/ECONOMY_OVERVIEW.md` |
| 7 | Final CTA + Footer | light, `futer.png` art | — | `blocks/FOOTER_OVERVIEW.md` |

Ids exist for internal linking only. They are not navigation items (Industries/Buildings/Agents/Economy are explicitly not in the menu).

Theme transitions: Game (light) → Industries (light) → Buildings (dark) → Agents (dark) → Economy (light). Buildings and Agents form one contiguous dark band; the boundary between light and dark is a straight horizontal edge (no gradient is evidenced).

---

## 4. Rating `/rating`

Order from copy §"Страница A". Table first, directly under the introduction.

| Section | Content source | Notes |
|---|---|---|
| Page header | breadcrumbs + H1 (one variant, OQ-09) + introduction | eyebrow slot of mockup holds breadcrumbs (DC-34) |
| 1. The table | section text, columns `# · Wallet · Influence · Day GDP`, search "Find a wallet", "You" row, empty state "No wallet cities yet.", tooltips | API-backed; states in §7 |
| 2. How Influence is counted | text, example 9,025 × 30 = 270,750, four factor cards joined by ×, Zero test toggles | always visible, never blurred |
| 3. How to climb faster | four items | |
| 4. Where the period stands | `ThreeClocks` | shared component |
| 5. Next | two cards (Leaderboard / Play Now) + link "The full rules are in the Docs." | mockup omits cards (DC-30) |
| Footer | shared | |

---

## 5. Leaderboard `/leaderboard`

Order from copy §"Страница B". Single column.

| Section | Content source | Notes |
|---|---|---|
| Page header | breadcrumbs + H1 (OQ-09) + introduction | |
| Prize table | places 1–10, island image in each row (file unnamed, OQ-24), Weight, Share of a 10,000 pool | closed state: blurred + countdown overlay |
| "Weights, not payouts" panel | caption + six stock logos | **never blurred** |
| Weights chart + example table | bar chart of place weights + example table | no mockup (OQ-26) |
| 1. Who qualifies | text + optional "Your status" card | |
| 2. One slot per wallet | text | |
| 3. What is paid | text + weights table + example paragraph | |
| 4. Where the pool comes from | text; live pool amounts only when real | |
| 5. Claiming | text | |
| 6. What resets | text + two columns Resets / Stays | |
| 7. Where the period stands | `ThreeClocks` | |
| 8. Next | two cards (Rating / Play Now) + Docs link | |
| Footer | shared | mobile: fixed Play Now (documented) |

Mapping of the mockup's three summary cards ("Six positive days to qualify", "30-day prize period", "The top 10 places split each asset") onto sections 1, 6 and 3 is described in `blocks/LEADERBOARD_OVERVIEW.md`. The documented section order is authoritative; the mockup is a partial visual of it (DC-40).

Note on table semantics: the documentation's "table" on this page is the **weights-by-place table** (static documented numbers, 8,200 … 1,000). The open/closed states govern its visibility. Whether a live per-wallet places list also exists is not documented (OQ-25).

---

## 6. Block boundaries

- A block owns everything between its top and bottom edge, including its background art, heading, controls and state.
- A block never renders the Header, Footer, MobilePlayBar or a second copy of a global component.
- Cross-block links are plain anchors (`Hero → #how-it-works`, fact chip "Prizes are paid in Stock Tokens" → `/leaderboard`).
- `ThreeClocks` is global and is placed by the Rating and Leaderboard pages; it is not owned by either.

---

## 7. State architecture

All state is local UI state unless marked **remote**. No state persists across reloads unless stated. Default states are documented.

### 7.1 Industries

```
IndustriesState {
  activeIndustry: 'compute' | 'energy' | 'logistics' | 'consumer' | 'automation' | 'finance'   // default 'compute' (documented)
  activeInfoTab: 'industries' | 'tiers' | 'merges'                                              // default 'industries'; content mapping OQ-11
}
derived from activeIndustry (data, not markup):
  accent            ← industries[activeIndustry].accentToken
  beaconArt         ← industries[activeIndustry].beaconArt       (over shared sky2.png)
  worksWith[]       ← synergies where requires ∋ activeIndustry → other industry
  synergies[]       ← synergies where requires ∋ activeIndustry → building + pair
  logo, name        ← industries[activeIndustry]
```

| State | Visual | Content | Desktop | Mobile |
|---|---|---|---|---|
| each industry | selected button filled/bordered in accent with glow; bold text recolored to accent; beacon island swaps (crossfade) | Works with chips; Example Synergies cards (1–3) | 6 buttons in one row | 6 buttons in a horizontally scrollable row, 5.5 visible, chevron hint, pagination dots |

Selection is a single-select tablist; keyboard arrows move selection (see `COMPONENT_SYSTEM.md` Tabs).

### 7.2 Buildings

```
BuildingsState {
  activeCategory: 'all' | 'base' | 'industry' | 'synergy'   // default 'all' ("All 18")
  selectedBuilding: BuildingId                               // default: first building of the active category (OQ-15: default building not documented)
  viewerOpen: boolean                                        // default false
  viewerStatus: 'idle' | 'loading' | 'ready' | 'error'       // only while viewerOpen
}
```

| State | Visual | Interaction |
|---|---|---|
| category change | rail filters to category; if selected building is not in category, select first of category | tabs |
| building selected | centre preview crossfades; right panel content swaps; thumb gets accent border+glow | click thumb, prev/next arrows |
| viewer open | modal studio with GLB, orbit controls | View 3D button; Esc / close returns focus to View 3D |
| viewer loading | preview PNG shown with loading indicator | — |
| viewer error | preview PNG + error message (copy OQ-16) | retry / close |

Accent for Buildings: **none documented** — dark block, white text. The mockup's green selected-thumb border derives from the NVIDIA building. Rule: selected thumbnail uses `--site-dark-text-primary` border unless OQ-14 decides industry accents.

### 7.3 Agents

```
AgentsState { activeRole: 'engineer' | 'logistician' | 'trader' | 'scientist' | 'manager' }  // default 'engineer' (documented)
derived: accent, portrait, subtitle, homeSeats[], neighborSeats[], level (1–5), traits[2]
```

Changing role swaps centre portrait (crossfade), right panel content, bold white text colour, bar/level colours. Showcase values are the fixed documented table — never randomized.

### 7.4 Economy

```
EconomyState { activeTab: 'enter' | 'work' | 'exit' | 'prizes' }   // default 'enter' (mockup Enter is first; default not documented explicitly → OQ-19 confirms)
```

Tab change swaps the whole tab panel content (flow, middle column, rules). Header copy and main art do not change.

### 7.5 Rating (remote)

```
RatingState =
  | { kind: 'loading' }
  | { kind: 'empty' }                                   // API returned zero wallet cities → "No wallet cities yet."
  | { kind: 'populated', rows: RatingRow[], you?: WalletRowId }
  | { kind: 'error' }                                   // copy not documented (OQ-22)
query: string                                          // "Find a wallet"; filters rows client-side or server-side (OQ-21)
searching: derived (query !== '')
```

| State | Visual | Content | Notes |
|---|---|---|---|
| initial/loading | table frame with header row; skeleton rows (no fake numbers) | — | skeleton must not show addresses or figures |
| empty (CLOSED) | table frame, header row, centered icon + "No wallet cities yet." | explanation sections below fully visible, not blurred | documented |
| populated (OPEN) | rows `#`, truncated wallet (mono), Influence, Day GDP | from API | documented |
| current user | row has left accent bar + "You" chip in `--site-success` | only when API/wallet identifies the viewer | documented label "You" |
| searching | rows filtered; no-match message copy not documented (OQ-21) | | |
| error | table frame + error message | OQ-22 | |

Demo sessions may view the table; demo cities are never listed (documented data rule, enforced by API).

### 7.6 Leaderboard (remote + time)

```
LeaderboardState =
  | { kind: 'closed', opensAt?: Instant }       // first 6 days of launch (documented); countdown shown only when opensAt known (OQ-23)
  | { kind: 'open', pool?: LivePoolAmounts }    // live pool values only when they really exist (documented)
  | { kind: 'loading' } | { kind: 'error' }
yourStatus?: { positiveDays: number, liveStake: boolean } | 'no-wallet' | 'demo'   // optional (documented "по возможности")
```

| State | Visual |
|---|---|
| closed | weights table blurred (`--site-blur-locked`), lock icon, "Leaderboard opens in", countdown DD/HH/MM/SS, caption (OQ-23); "Weights, not payouts" panel and all explanatory sections visible and sharp |
| closed, opensAt unknown | blurred table + lock + "Leaderboard opens in" label **without** digits (no fabricated countdown) — PROVISIONAL (OQ-23) |
| open | table sharp; weights, chart, example visible; live pool shown only if data present |
| loading / error | only if a remote call exists (OQ-25) |

### 7.7 Three Clocks

```
ThreeClocksState { epoch?: CalendarEpoch }   // absent until calendar epoch is known (documented)
derived when epoch present: dayOfPeriod (1–30), nextSettlementDate
```

Without epoch: static labels and 30-day scale only; "Day N of 30" and next settlement date **hidden** (documented).

### 7.8 Shell

```
ShellState { menuOpen: boolean; playChooserOpen: boolean; tooltip?: id }
```

---

## 8. Data / presentation separation

All content that varies by state lives in typed data modules; markup iterates data. Recommended location follows the existing repository convention (`apps/www/src/content.ts` holds authored content and `pageMeta`): split into `apps/www/src/data/*.ts` when it exceeds ~400 lines (repository rule: files longer than ~400 lines are split).

| Config | Shape (conceptual) | Source of truth |
|---|---|---|
| `industries` | `{ id, name, ticker (never rendered next to logo), logo, accentToken, beaconArt, cardText, pairsWithText }` ×6 | copy §3, README Industries, `content/params/districts.json` (`beacon`, ticker) |
| `synergies` | `{ buildingId, requires: [IndustryId, IndustryId], avatar }` ×6 | `content/params/districts.json` → `synergies` (robotics_lab: compute+energy; drone_depot: compute+logistics; data_center: compute+automation; fleet_yard: energy+logistics; retail_complex: consumer+logistics; clearing_house: automation+finance) |
| `buildings` | `{ id, name, category: base/industry/synergy, industry?/pair?, homeRole?, schedule, chips[], role, levels, tip, lockedLabel?, avatar, model }` ×18 | copy §4, README mapping table, `content/params/buildings.json` (18 ids) |
| `schedules` | `always/office/market/retail` → label + hours | copy §4 microcopy |
| `roles` | `{ id, name, subtitle, homeSeats[], neighborSeats[], tasks[], accentToken, portrait }` ×5 | copy §5 role cards, README Agents |
| `agentShowcase` | `{ roleId, level, traits: [TraitId, TraitId] }` ×5 fixed | README table |
| `traits` | `{ id, name, description }` ×4 | copy §5 |
| `fit` | Home 100% / Neighboring 60% / Incompatible Cannot work | copy §5 |
| `economyTabs` | `{ id, label, icon, flow: Step[4], middle, rules: Rule[], body }` ×4 | copy §7 text + README image slots |
| `economyTables` | who-is-who rows, fee rows, fee caption | copy §7 |
| `ratingFactors` | 4 × `{ id, title, description, raises, zeroes/lever }` | copy Page A §2 |
| `climbTips` | 4 strings | copy Page A §3 |
| `prizeWeights` | places 1–10: weight, share of 10,000 | copy Page B §3 (8,200 … 1,000; 3,224 … 393; sum 25,428; remainder 6) |
| `resetsStays` | two lists | copy Page B §6 |
| `clocks` | city day 25 h; Farm 7 city days / 175 h; Prize period 30 / 750 h; Season 90 | copy "Three clocks" |
| `destinations` | docs, docsAgents, economyGuide, x, playDemo, playWallet, risk | existing `destinations` pattern in `content.ts`; all currently `null` (OQ-05) |
| `contract` | `$CORP` address or `null` → "Contract TBA" | `content/params/launch.json` `deployed.token` (currently empty) |
| remote: rating rows | `{ rank, wallet, influence, dayGdp, isYou }` | API (OQ-21) |
| remote: leaderboard | `opensAt`, live pool, your status | API/epoch (OQ-23, OQ-25, OQ-27) |
| remote: calendar epoch | `{ periodStart, dayOfPeriod, nextSettlement }` | API (OQ-28) |

Numbers in copy (2%, 10%, 6.5%, 5%, 62 min 30 s, 25%, 43.75%, 57.82%, 14.45%, weights) are content: they live in data/copy modules with a source note pointing to the copy document, never in JSX literals.

---

## 9. Component ownership

| Layer | Owns | May be changed by |
|---|---|---|
| GLOBAL | tokens, typography, colours, spacing, containers, Button family, TokenChip, Pill/Badge, Tabs, SegmentedControl, Card, Input/SearchField, Tooltip, Modal, IconButton, Divider, StatusIndicator, DataTable primitives, Empty/Loading/Error states, Header, Footer, MobilePlayBar, PlayChooser, ThreeClocks, Section, Container, Eyebrow/Breadcrumbs, Heading, BodyCopy, ArtLayer | GLOBAL CHANGE only |
| DOMAIN | IndustrySelector, BeaconStage, SynergyCard, BuildingStage, BuildingRail, BuildingDetails, ModelStudio, RoleSelector, RolePortrait, RolePanel, FitBars, LevelMeter, EconomyTabPanel, FlowSteps, RuleList, RatingTable, FactorCards, ZeroTest, PrizeTable, WeightsPanel, WeightsChart, CountdownOverlay, NextCards | the block agent of that block |
| DATA | all configs in §8, API adapters, page state | CONTENT CHANGE; API schema only after OQ answered |

---

## 10. SEO contract

- One `<h1>` per route. Landing H1 = Hero heading. Block headings are `<h2>`.
- Titles/descriptions for `/rating` and `/leaderboard` exactly as documented; landing metadata awaits OQ-32. The current `apps/www/index.html` title/description/OG text is prototype copy (and contains a mis-encoded dash) — not canonical (DC-56).
- Breadcrumbs on subpages as visible text `Corporator / Rating`, `Corporator / Leaderboard`, with `Corporator` linking to `/`. Structured data (BreadcrumbList) optional, not documented.
- Canonical URLs, OG image, domain: not documented (existing HANDOFF release gate).
