# ECONOMY — Master Block Contract

Route `/`, id `economy`. References: `economy_enter_desktop.png`, `economy_work_desktop.png`, `economy_exit_desktop.png`, `economy_prizes_desktop.png` and `economy_{enter,work,exit,prizes}_mobile.png`. Copy §"Блок 7". README §Economy.

# Purpose
Explain where `$CORP` goes and where the limits are, without any promise of income. One art + one tabbed panel (Enter / Work / Exit / Prizes).

# Documentation Truth
- Heading variants: "How money moves through the city" · "$CORP in, Capital inside, $CORP out" · "What backs Capital, and what doesn't" (mockup: v2).
- Three intro paragraphs (verbatim; includes "100% of the $CORP supply is public from launch…" and the 0.2% Studio sentence).
- "Who's who" table (6 rows: $CORP, Capital, Stock Tokens, Payroll, Influence, Fragments) — verbatim.
- Tab texts Enter / Work / Exit / Prizes — verbatim from COPY; mockup texts are not used. Work text is the pack-187 rule (max of fund ÷ 14 and 3-day inflow; boost 8× then 3×; proportional share; empty fund pays zero).
- Farm paragraph (verbatim).
- Fee table (10 rows, verbatim) + caption "These apply to different operations. Do not simply add them together."
- Accordion line: "Reference: a full round trip is modeled at 14.45% under generated assumptions. It is not a quote." (may be removed, OQ-37).
- "What contracts do": 4 statements + audit line (link or removed, OQ-07).
- Risk box (verbatim, mandatory).
- Tooltips Backing / Voucher (verbatim). Button **Read the economy guide** (Docs).
- UI: art on top, tab panel Enter / Work / Exit / Prizes. No "07 — Economy". Art: `economy-art.png` whole, or `economy-sky-art.png` + cut-out. Tab images from `economy/assets` by mockup slots; flat icons replaced by these images; City Actions step uses `city_actions.png`; `city_actions_2.png` not used.

# Desktop Visual Truth
Sky full-bleed. Copy top-left (≈4.6–37% width; H2 3 lines ≈16.5–37.5% height; 3-line body; arrow link). Art top-right (≈34–98% width, ≈12–57% height). Glass panel (≈4.6–95.3% width, ≈56.5–93% height, radius ≈16 px) overlapping the art bottom: tab row left-aligned (icon + label, active dark underline), then three columns separated by hairlines (≈6–38% / 41–67% / 69–94%): column 1 = 4-step image flow with arrows, column 2 = main content, column 3 = rules/fees. See MOCKUP_ANALYSIS §6 table for per-tab slots.

# Mobile Visual Truth
Phone column: copy left (H2 ≈48% of width) with art bleeding off the right edge and overlapping the panel top. Panel full width: 4 equal tab cells with icons; flow row of 4 steps stays horizontal; lower content stacks (Enter, Prizes) or keeps two columns (Work, Exit — DC-54).

# Layout
```
Section(theme=sky, id=economy)
 ├─ ArtLayer (option A or B, OQ-20)
 └─ Container
     Copy(H2, 3 paragraphs, Read the economy guide)
     EconomyPanel
       Tabs(Enter · Work · Exit · Prizes)
       TabPanel: FlowRow(4 images) | Main column | Rules column
     EconomyReference (documented, not in mockup; OQ-19):
       Who's who table · Fee table + caption + round-trip accordion · What contracts do · RiskBox
```
Interpretation (confirm OQ-19): tab panel columns carry the documented tab text + images per slot; Who's who sits in the Enter main column (mockup "Economic assets"), Fee table in the Enter rules column (mockup "Fees"); Farm paragraph in the Prizes main column (mockup Farm row); "What contracts do" and RiskBox follow the panel as a full-width row. Risk box is never hidden inside a tab.

# Components
Heading `display-1`, BodyCopy, ArrowLink, ArtLayer, Card `glass` panel, Tabs `icon-underline`, FlowRow (FlowStep image + label + caption, Arrow), DataTable (Who's who, Fees), RuleItem (image/icon + title + line), InfoNote, Accordion (round trip), ContractsList, RiskBox (Card with warning icon, `body-sm`), Tooltip.

# State Model
`activeTab` ∈ enter | work | exit | prizes; default `enter` (Interpretation, OQ-19). Accordion open/closed. Tabs follow the WAI-ARIA tabs pattern; content height may differ per tab — panel height is content-driven (no fixed height that clips text).

# Data Model
`data/economy.ts`: heading, paragraphs[3], whoIsWho[6], tabs[4] `{ id, label, icon, flow[4] { label, caption?, art }, main, rules[] { title, text, art? }, note? }`, farm, fees[10] + caption, roundTrip, contracts[4], audit `{ href } | null`, risk, tooltips. All numbers (2%, ×2,000, 2%/day, 40/60, 14, 3 days, 24 ticks, 8×/3×, 7 days, 08:00–20:00, 10%/6.5%, 5%, 62 min 30 s, 0.2%/0.6%, 1%, 3%) are copy strings from COPY, not computed.

# Assets
Main art per ASSET_MANIFEST §8.1 (A vs B OQ-20). Tab images per §8.2 (`stock-tokens.png` and `live_stake.png` are opaque — verify on the glass surface, OQ-13). Exit "Bank window" rule has no image (OQ-19). Work "40% burned" has no image.

# Typography
H2 `display-1`; paragraphs `body-lg`/`body`; tab label `label`; column title `label` ≈16 px caps; flow label `heading-4`, caption `caption`; table `body-sm`, header `label`; numeric cells `numeric` right-aligned; risk box `body-sm`.

# Color / Accent
Light. No industry accent. Active tab underline `--site-border-active` in all tabs (mobile green Prizes underline is a mockup accident, DC-27). Risk box uses neutral surface + `--site-warning` icon only (no red alarm styling; PROVISIONAL).

# Spacing
Copy→panel: panel overlaps art (negative top relative to art); panel padding 24–32 px; tab row→content 24 px; column gap 48 px with hairline; flow step gap 12 px; reference row gap 48 px.

# Interaction
Tabs (click, arrow keys, Home/End); crossfade panel 220 ms (instant under reduced motion). Accordion. Tooltips on Backing and Voucher terms. Read the economy guide → Docs (URL OQ-05).

# Responsive Transformation
Columns stack; flow row stays horizontal in 4 cells and scales (R-09); Work/Exit two-column lower area kept at ≥390 (below — stack, OQ-39); tables scroll horizontally only if cell text cannot wrap. See RESPONSIVE_SYSTEM §4 Economy.

# Visual Fidelity Priorities
HIGH: art/copy/panel composition and overlap, tab row, 3-column panel with flow images, documented texts. MEDIUM: image sizes inside flow, table styling. LOW: glass blur strength, floating islets.

# Known Conflicts
DC-01, DC-02, DC-21, DC-22, DC-23, DC-24, DC-25, DC-26, DC-27, DC-54.

# Open Questions
OQ-05, OQ-06, OQ-07, OQ-09, OQ-19, OQ-20, OQ-37, OQ-39.

# Implementation Constraints
No ROI, APY, recoup, "earn", price or payout projection. Studio/fee lines exactly as documented. Do not add the fee rates together anywhere. `$` must render as `$` (DC-24). Risk box always visible.
