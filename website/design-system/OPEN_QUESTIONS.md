# Corporator Website — Open Questions

Unresolved facts. No answer here is invented. "Blocks" = what cannot be finished without the answer. "Until answered" = the only allowed behavior meanwhile.

Resolved decisions stay in this file so their IDs remain valid. They are not open.

## Resolved

**OQ-01 — Display typeface. Resolved.** TT Octosquares Condensed Black is the canonical display typeface for major headlines and display typography. `font-family: "TT Octosquares Condensed"`; `font-weight: 900`; `font-stretch: normal`; `letter-spacing: -0.02em`. Do not substitute another family. File: `website/fonts/tt-octosquares/TT-Octosquares-Trial-Condensed-Black.ttf` (trial build; internal name `TT Octosquares Trl Cnd`).

**OQ-02 — Body/UI typeface. Resolved.** Roboto Regular is the canonical body/UI typeface for body text, navigation, labels, buttons, metadata, tables, and supporting UI text. `font-family: "Roboto"`; `font-weight: 400`. Do not add other Roboto weights. Do not use Inter. Do not use Barlow Condensed. Do not use IBM Plex Sans for the website typography system. Do not synthesize font weights. `font-synthesis: none` stays. File: `website/fonts/roboto/roboto-latin.woff2`.

**OQ-04 — Robinhood Chain logo. Resolved.** Use the official Robinhood Chain logo in the Hero: `Robinhood_Chain_Logo_Black.svg` from `website/brand/robinhood-chain/robinhood-chain-brand-assets-v1.zip` (source: docs.robinhood.com/chain/brand-guidelines). Do not use the "[Robinhood Chain logo]" text placeholder. Do not redraw, recreate, distort, recolor, or otherwise modify the logo. Do not substitute the feather avatar. The accompanying label stays "Robinhood chain" unless the final approved copy is changed separately. The brand guidelines disagree with that label and with placing the logo on the sky; that disagreement is DC-59, not a silent change.

| ID | Question | Blocks | Until answered |
|---|---|---|---|
| **Typography & brand** ||||
| OQ-03 | Is there an official vector logo (mark + "CORPORATOR" wordmark)? Only raster marks exist (`website/industries-cut/mark.png`, HUD `brand/mark.png`); `apps/www/public/favicon.svg` is prototype-authored. | Header, Footer, favicon | raster mark + wordmark typeset in TT Octosquares Condensed |
| **Destinations & chain** ||||
| OQ-05 | URLs: Docs root; Docs agents section ("Meet the agents"); economy guide ("Read the economy guide"); "The full rules are in the Docs."; risk disclaimer target for "Read the risks"; official X account; Play demo; Play with wallet. Is an X brand glyph approved? | Header, Hero, Agents, Economy, Rating, Leaderboard, Footer | existing `Destination` fallback (labelled preview dialog); no invented domains |
| OQ-06 | Production `$CORP` address (currently `content/params/launch.json` `deployed` all empty) and whether the chip offers copy-to-clipboard. | TokenChip | "Contract TBA" + documented tooltip |
| OQ-07 | Audit link: exists or remove the line (COPY §7 "[Audit: ссылка или убрать строку]", check #3). | Economy | line omitted |
| OQ-34 | Exchange hop and prize claim are "Partial" (COPY check #1). Are they functional at publication? If not, exact "coming soon" wording and where it replaces text. | Buildings (Exchange), Economy, Leaderboard (Claiming) | documented intended-behavior text; flagged for publication check |
| **Content decisions** ||||
| OQ-09 | Final copy variant per headline set: Hero (3), Game (3), Industries (3), Buildings (3), Agents (3), Economy (3), Final CTA (3), Rating H1 (3), Leaderboard H1 (3). Mockup-indicated: Hero v1, Game v1, Industries v1, Agents ≈v1, Economy v2, Rating v1(+v2), Leaderboard v1(+v2); Buildings/Final CTA mockup headings are not doc variants. Also: Rating section-2 display line "ONE DAILY SCORE. FOUR FACTORS." (not doc). | all headings | use the mockup-indicated doc variant; where none, variant 1; single variant only, no rotation |
| OQ-10 | May landing blocks show an **unnumbered** eyebrow label (e.g., "Game", "Industries") as in the mockups' eyebrow slot? | Game, Industries, Buildings, Agents, Economy | no eyebrow on landing blocks |
| OQ-11 | Industries: how do the documented industry cards (6), plaques (Access / Choices / Merge / Unstake), button "See what it opens", tooltips and ticker caption map onto the mockup's lower strip and the tabs "Industries · Tiers · Merges"? | Industries | block agent must ask before implementing tab panel content |
| OQ-12 | Industries: the mockup shows a caption under the selector ("● COMPUTE — NVDA / Computing and research."). Is this the slot for the selected industry card text, and may the ticker appear there (not in the same frame as the logo)? Destination of "See what it opens"? | Industries | caption shows industry name + card text without ticker; button hidden until destination known |
| OQ-15 | Buildings details panel: order and presence of chips (layer, home role, hours), Role / Levels / Tip, schedule, lock labels, tabs position; default selected building for each category. | Buildings | order per block contract (Interpretation); default = first building in documented order |
| OQ-14 | Buildings: should the right panel show industry logos above the name (mockup NVIDIA)? Keep prev/next arrows? Show a "n / 18" counter? Should the selected thumb use an industry accent? | Buildings | no logo row, arrows kept, no counter, neutral white selection |
| OQ-18 | Agents: where do Tasks, Levels (1.00×–1.60×, XP text), Traits descriptions, legend Home/Neighbor/Incompatible, tooltip "Agent slots…", caption "Autonomous buildings need no agent.", caption "These values feed into performance. They are not payout percentages." appear? Panel subtitle source (first phrase of role card, e.g., "Production")? | Agents | panel shows documented panel data only (seats, bars, level, traits); other doc items listed in block contract as pending placement |
| OQ-19 | Economy: labels for mockup slots with no exact doc text (flow step captions, rule titles), placement of contracts list, risk box, round-trip accordion, Who's-who and Fees tables (Enter tab only as in mockup?), default tab, icon for "Bank window" rule. | Economy | only doc nouns/sentences in slots; risk box must be visible; default tab Enter |
| OQ-20 | Economy main art: `economy-art.png` whole, or composite `economy-sky-art.png` + `economy-art-png-2.png` / `economy-art-2-png.png`? | Economy | `economy-art.png` whole |
| OQ-35 | Level effects for buildings described generally (COPY check #2). | Buildings | documented general wording |
| OQ-36 | Add Rating tooltip "In the game this tab is called Ranking."? (COPY check #6) | Rating | not shown |
| OQ-37 | Keep the round-trip 14.45% accordion line? (COPY check #4) | Economy | keep verbatim with "It is not a quote." if an accordion placement exists; else omitted pending OQ-19 |
| OQ-42 | Footer: is a copyright line wanted (mockup "© 2026 Corporator. All rights reserved." is not documented)? | Footer | none |
| **Assets** ||||
| OQ-08 | HUD screenshots for Game panels Overview / Agents / Bank / Industries. | Game | documented placeholders (frame with window dots, no fake UI) |
| OQ-13 | `buildings-avatars/*` had opaque black backgrounds. Also `workshop_solo_cloud.png` (Game step 03) is opaque. | Buildings, Industries, Game | Buildings (owner 2026-09-28): previews only from `website/buildings-avatars/`, near-black plate cropped, including Agent Hub. Industries synergy cards stay on `agents-cut` except Robotics Lab (`Robotics Lab.png`; `robotics_lab_png.png` is gone). Game step 03 stays opaque. |
| OQ-24 | Island image file for Leaderboard rows (README: "Файл не назван"). | Leaderboard | empty image cell of the documented size |
| OQ-41 | May Hero and Footer art be scaled/anchored (not edited) to approach the mockup positions (Hero island ≈70% vs 60% in file; Footer island centred vs right-of-centre in mockup)? | Hero, Footer | anchor/scale only, never edit or recompose the art |
| OQ-43 | X brand glyph for "Follow on X" (mockup shows it; no file in repository; Lucide has no X mark). | Footer | text-only button |
| **Data & APIs** ||||
| OQ-21 | Rating API. Decided 2026-10-01: `GET /rating` with no session. Rows match the live board (`rank`, `wallet`, `influence`, `gdp`, `self`). No top-ten cut. Search is client-side case-insensitive contains. No match: "No wallet matches." `self` is 0 on this route; "You" only if a later response sets it. | Rating | live rows, or "No wallet cities yet." |
| OQ-22 | Loading and error copy for Rating/Leaderboard/epoch. | Rating, Leaderboard | skeleton without text; error text withheld from publication |
| OQ-23 | Leaderboard closed state: source of launch date / opening instant; does the closed state recur each 30-day period or only at launch; caption text; behavior when the instant is unknown. | Leaderboard | closed state, lock + "Leaderboard opens in" without digits |
| OQ-25 | Is the Leaderboard table only the documented weights-by-place table, or also a live list of qualified wallets? Source of live Monthly pool amounts. | Leaderboard | static weights table; no pool amounts |
| OQ-27 | "Your status" card: requires wallet connection on the website — in scope? Data source? | Leaderboard | card shows documented "Connect a wallet to see your status." only if a connect action exists; otherwise omitted |
| OQ-28 | Calendar epoch source; 30-day scale marks (Farm windows every 7 days? settlement at day 30?); date format for next settlement. | ThreeClocks | scale with 30 ticks and no marks beyond start/end; status hidden |
| **Design gaps (no mockup)** ||||
| OQ-16 | View 3D studio: layout, controls, background, camera defaults, loading/error copy, mobile gestures. | Buildings | Modal spec in COMPONENT_SYSTEM §19; no error copy published |
| OQ-17 | How does `apps/www` get `three` (add `apps/www/package.json`, or alias to the pnpm store like React)? | Buildings viewer | viewer not implemented |
| OQ-26 | Leaderboard weights bar chart visual. | Leaderboard | not implemented |
| OQ-29 | Footer on `/rating` and `/leaderboard`: identical including CTA heading/buttons (doc literal) — confirm. | Footer | identical |
| OQ-30 | Sticky header scrolled appearance; mobile menu panel; PlayChooser visual. | Header | PROVISIONAL specs in COMPONENT_SYSTEM |
| OQ-31 | Tablet (701–1150) compositions. | all | PROVISIONAL rules in RESPONSIVE_SYSTEM |
| OQ-32 | Landing `/` meta title and description. | SEO | prototype meta not shipped as final |
| OQ-33 | Active nav state on `/` (mockup emphasizes GAME). | Header | follow mockup (GAME emphasized on `/`) |
| OQ-39 | Economy two-column sections below 390 px. | Economy | stack in same order |
| OQ-40 | Accessible `-ink` variants for accent-coloured text on light backgrounds. | Industries | documented accent colours; QA flag |
| OQ-38 | (merged into OQ-05) | — | — |
