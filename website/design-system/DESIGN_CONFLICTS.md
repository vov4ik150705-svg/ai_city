# Corporator Website — Design Conflict Register

Format per entry: **A** (source A) · **B** (source B) · **Conflict** · **Doc truth** · **Visual ref** · **Interpretation** · **Rule** · **Severity** (High/Medium/Low) · **Status** (Resolved-by-doc = documentation explicitly decides; Interpretation = decided here by the hierarchy, confirm if desired; Open = needs owner, see OQ).

Abbreviations: README = `website/reference/docs/README.md`; COPY = `website/reference/docs/CORPORATOR_WEBSITE_COPY_2.md`; mockup names are files in `website/reference/mockups/{desktop,mobile}/`.

---

## Global

**DC-01 · Numbered section labels**
A: industries/buildings/agents/economy/leaderboard mockups ("03 — INDUSTRIES", "02 — BUILDINGS", "06 — AGENTS", "07 — ECONOMY", "08 — LEADERBOARD") · B: README, COPY header ("Нумерацию блоков на сайте не писать нигде").
Doc truth: no numbering anywhere. Visual ref: hairline + label eyebrow above headings.
Interpretation: remove numbers; the eyebrow slot survives only as breadcrumbs on subpages and (pending OQ-10) as an unnumbered label on landing blocks.
Rule: never render digits + dash + section name. · High · Resolved-by-doc (eyebrow use Open, OQ-10).

**DC-02 · Header navigation variants**
A: industries, economy_*, rating_*, leaderboard_* mockups (Game · Industries · Buildings · Agents · Economy · FAQ) · B: README/COPY (Game · Leaderboard · Rating · Docs).
Rule: nav = Game · Leaderboard · Rating · Docs only. · High · Resolved-by-doc.

**DC-03 · Header visual variants**
A: buildings_desktop (logo only, white), agents_mobile (yellow logo), game (sky strip header), rating/leaderboard (compact) · B: README "Эталон шапки — только мокап Hero".
Rule: one header, Hero look, on all routes and over all blocks. · High · Resolved-by-doc.

**DC-04 · FAQ** — mockup navs show FAQ; COPY: "Блока FAQ нет". Prototype `apps/www` has FAQ. Rule: no FAQ block, no FAQ link. · High · Resolved-by-doc.

**DC-05 · Homepage Rating/Leaderboard teasers** — prototype `apps/www` landing has Seasons/Rating content; COPY: "Тизера Rating и Leaderboard на лендинге нет". Rule: none on `/`. Hero fact chip "Prizes are paid in Stock Tokens" linking to `/leaderboard` is documented and is not a teaser. · High · Resolved-by-doc.

**DC-49 · Mobile fixed Play Now scope**
A: only hero-mobile and buildings_mobile show a fixed bottom Play Now (leaderboard mobile shows a bottom CTA row) · B: COPY header UI "на мобильном кнопка Play Now закреплена внизу"; Leaderboard UI repeats it.
Interpretation: global on all routes ≤700 px; mockups without it are block crops. · Medium · Interpretation.

**DC-50 · Repository prototype vs documentation**
A: `apps/www` (dark navy theme, routes `/game` `/industries` `/economy` `/seasons`, FAQ, TwoClocks, IBM Plex display headings, art from `assets/website/`) · B: COPY/README/mockups.
Rule: keep infrastructure, replace content/design (see IMPLEMENTATION_GUIDELINES §2). · High · Resolved-by-doc.

**DC-51 · Typography availability**
A: mockups (heavy condensed display face; bold UI) · B: repository HUD face was IBM Plex Sans 400 only. HANDOFF claims Tailwind; none installed.
Rule: website display is TT Octosquares Condensed Black (`font-family: "TT Octosquares Condensed"`, `font-weight: 900`, `font-stretch: normal`, `letter-spacing: -0.02em`). Website body/UI is Roboto Regular (`website/fonts/roboto/roboto-latin.woff2`, weight 400 only). Do not use Inter. Do not use Anton. Do not use Barlow Condensed. Do not use IBM Plex Sans for the website type system. `font-synthesis: none`. · High · Resolved (OQ-01, OQ-02).

**DC-52 · Documentation-internal inconsistencies** (listed in COPY "Несостыковки")
§47 "not pure Zipf" vs HANDOFF "Zipf"; §44 pack 150 vs pack 187; recoup §23 (200%/100%) vs HANDOFF §53 (165%/83%); §46 unstake command.
Rule: website uses COPY text (rules 0.24.0, pack 187): weights described as 80% 1/place + 20% equal; never "Zipf"; never publish recoup/payback figures. · High (financial) · Resolved-by-doc.

**DC-53 · Header source wording** — COPY: "Шапка и футер … берутся со страницы Game: шапка с мокапа Hero" vs README "Шапка — с мокапа Hero". Both name the Hero mockup; the game-desktop header is not a reference. · Low · Resolved-by-doc.

**DC-55 · Accent text contrast**
A: README/COPY "Весь жирный чёрный текст блока красится в цвет выбранной кнопки" (Industries, on light sky) · B: accessibility (green `#33E01F`, orange `#FD9B00`, turquoise `#00D3FE` on white < 3:1).
Rule: implement as documented; QA flags; decision on `-ink` variants pending. · Medium · Open (OQ-40).

**DC-56 · Landing meta** — `apps/www/index.html` title/description/OG are prototype copy ("The city is already built. Now make it work.") with a mis-encoded dash; COPY gives no landing meta. Rule: do not ship prototype meta as canonical. · Medium · Open (OQ-32).

## Hero

**DC-45 · Facts strip and risk microcopy missing in mockup**
A: hero-desktop/mobile (no facts, no microcopy; "[Robinhood Chain logo]" placeholder box) · B: COPY §1 (microcopy "Demo needs no wallet. No return is guaranteed. Read the risks." under buttons; facts strip of 4 chips under buttons; real Robinhood Chain logo + caption "Robinhood chain").
Rule: add microcopy and facts chips under the button group using `caption` + `FactChip`; Robinhood slot above buttons holds `Robinhood_Chain_Logo_Black.svg`, unmodified, with the label "Robinhood chain" (OQ-04 resolved). Do not redraw, recreate, distort, or recolor the logo. Brand-rule disagreements with that label and with the sky background are DC-59. · High · Resolved-by-doc (placement Interpretation).

**DC-46 · Hero art composition vs real asset**
A: hero-desktop (island center ≈70% of width, spans ≈44–96%) · B: `website/arts/hero.png` (island center ≈60%).
Rule: use `hero.png` (never rebuild from mockup); match mockup by art-layer anchoring/scale; QA verifies. · Medium · Open (OQ-41).

**DC-59 · Official Robinhood Chain brand rules vs the Hero caption**
A: `https://docs.robinhood.com/chain/brand-guidelines/` — external copy says "Robinhood Chain" in title case; the logo is not combined with other text; the only listed pairings are black on white, white on black, and black on `#CCFF00`; the feather does not replace the wordmark; the mark is not used on a token or NFT.
B: OQ-04 and COPY §1 — the Hero keeps the label "Robinhood chain" next to the logo, on the sky art.
Rule: the Hero image is `Robinhood_Chain_Logo_Black.svg`, unmodified. The caption and the sky placement stay as decided until the owner changes the copy. Do not retitle the caption and do not invent a white plate under the logo. · Medium · Open.

## Game

**DC-47 · Game content deltas**
A: game-desktop/mobile (caption "The HUD in the current build"; no "You do / You don't" columns; no tooltips) · B: COPY §2 (caption forbidden; two columns required; three tooltips).
Rule: drop caption; add two columns; tooltips on Capital/Tick/Payroll terms. Placement of columns: after the 4-step loop, before HUD placeholders (Interpretation: doc order "Core loop → Две колонки"). · High · Resolved-by-doc (placement Interpretation).

**DC-48 · Game eyebrow "— GAME"** — mockup shows an unnumbered eyebrow; docs neither require nor forbid unnumbered labels. · Low · Open (OQ-10).

## Industries

**DC-11 · Tickers with logos** — mockup buttons/cards "COMPUTE — NVDA", synergy pair rows; README/COPY: logo + industry name, no ticker. Rule: no ticker in selector tiles, Works with chips, synergy cards. · High · Resolved-by-doc.

**DC-12 · Automation/Finance colours swapped** — mockup Automation blue `#006FFE`, Finance cyan `#00D3FE`; README: Automation turquoise, Finance blue. Rule: documented mapping (`--site-ind-automation` turquoise, `--site-ind-finance` blue). · High · Resolved-by-doc.

**DC-13 · Industries copy and lower strip**
A: mockup ("SYNERGY MAP", "COMBINE INDUSTRIES. UNLOCK HIGHER VALUE.", "Industries work together…", lower strip "Industry system / 6 branches / 6 stock tokens / Synergies") · B: COPY §3 (heading variants, two paragraphs, 6 industry cards with Pairs-with, plaques Access / Choices / Merge / Unstake, button "See what it opens", tooltips, caption on tickers; tabs "Industries · Tiers · Merges остаются").
Rule: mockup copy is obsolete; visual slots are reused for doc content; exact mapping of plaques/cards into the tab strip is Open. · High · Open (OQ-11, OQ-12).

**DC-14 · Mobile beacon differs** — industries-mobile shows a different NVIDIA building (Robotics-like) than desktop; README: Compute beacon = `AI-RESEARCH-CENTER.png`. Rule: same documented beacon on all viewports. · Medium · Resolved-by-doc.

## Buildings

**DC-06 · Counter and "View all buildings"** — mockup "1 / 16", "VIEW ALL BUILDINGS →"; README: no link, no "1/16", 18 buildings. Rule: remove both; prev/next arrows kept as rail navigation; any counter pending OQ-14. · High · Resolved-by-doc.

**DC-07 · Mislabelled preview** — mockup shows the AI Research Center tower labelled "DATA CENTER · COMPUTE" with NVIDIA logo and description "Powers your city's computing infrastructure…". Rule: name, category, text from COPY §4 data; image from mapping table. · High · Resolved-by-doc.

**DC-08 · Buildings heading/body** — mockup "18 BUILDINGS. REAL FUNCTIONS." / "Activate functions, upgrade capabilities…peak efficiency"; COPY variants: "18 buildings, each with a job" / "The buildings are built…" / "Same island, 18 functions to run"; intro text given. Rule: doc copy. · High · Resolved-by-doc (variant choice OQ-09).

**DC-09 · Missing documented UI** — tabs All 18 · Base · Industry · Synergy, card chips (layer, home role, hours), Role/Levels/Tip, schedule labels, lock labels absent from mockup. Rule: required; placement in details panel Interpretation (block contract), confirm OQ-15. · High · Open (OQ-15).

**DC-10 · Opaque black avatars** — Owner 2026-09-28: Buildings previews are only `website/buildings-avatars/`, and the near-black plate is cropped (including Agent Hub). `Neon Residence.png` is not cropped. Industries synergy cards stay on `agents-cut` except Robotics Lab (`Robotics Lab.png`). Game step 03 (`workshop_solo_cloud.png`) stays opaque. · High · Closed for Buildings (OQ-13).

## Agents

**DC-15 · Level vs segments** — mockup "04" with 3 filled segments; README: filled segments = level. Rule: `filled = level`. · High · Resolved-by-doc.

**DC-16 · Engineer accent** — mockup yellow `#FFC82D`; README: Engineer orange. Rule: orange token. · High · Resolved-by-doc.

**DC-17 · Engineer neighboring seats** — mockup lists AI Research Center, Data Center, Logistics Hub, Fleet Yard; COPY (pack 187): AI Research Center, Logistics Hub, Robotics Lab, Data Center, Fleet Yard. Rule: doc lists for all roles. · High · Resolved-by-doc.

**DC-18 · "OTHER —" compatibility row** — mockup third bar "OTHER —"; COPY Fit: Incompatible = "Cannot work"; 25% foreign removed. Rule: rows Home 100% · Neighbor 60% · Incompatible Cannot work (labels per legend "Home / Neighbor / Incompatible"). · Medium · Resolved-by-doc.

**DC-19 · Caption under selector and extra body** — mockup "Home seats use the full specialty. Neighboring seats use 60%. Incompatible seats cannot work." under selector; README/COPY: must not appear there. Mockup "Five roles. Different strengths. One workforce." not in doc. Rule: remove both. · High · Resolved-by-doc.

**DC-20 · Agents heading/body** — mockup "THE RIGHT AGENT. THE RIGHT SEAT." + "You assign the work. The rules settle the result."; COPY heading variants (1) "The right agent in the right seat", (3) "You assign the work. The rules settle the result."; body = three doc paragraphs. Rule: one heading variant (OQ-09) + doc paragraphs; do not use a second variant as body. · Medium · Open (OQ-09).

## Economy

**DC-21 · Obsolete captions and links** — "Build. Upgrade. Grow." (City Actions), "Learn more about capital/work/exit/prizes →", flow captions like "Funds reach your balance". COPY: product does not build; texts from doc only. Rule: remove; only doc-derived labels (OQ-19). · High · Resolved-by-doc.

**DC-22 · Payroll rule outdated** — mockup "Fund / 14 per day. Daily budget = fund / 14, split across 24 ticks."; COPY (pack 187): budget = max(fund ÷ 14, average inflow of last 3 city days), set at start of day, 24 ticks, pool = requests × boost (8× first 7 city days, then 3×) cut to tick budget and fund. Rule: doc text; image `fund_14_per_day.png` stays in its slot. · High · Resolved-by-doc.

**DC-23 · Exit typo** — "5% of five pool depth in ETH" → doc "5% of live pool depth in ETH". · Low · Resolved-by-doc.

**DC-24 · "SCORP" glyph** — desktop Economy headings render "$" as "S" ("SCORP OUT."). Rule: "$CORP". · Low · Resolved-by-doc.

**DC-25 · Flat icons** — mockup flat icons/logo rows (e.g., Monthly card six ticker logos) vs README "Плоские значки не рисовать заново" + documented images (`stock-tokens.png` etc.). Rule: documented images in slots; the Monthly logo row maps to `stock-tokens.png` (Interpretation). · Medium · Interpretation.

**DC-26 · Missing documented Economy content** — tab paragraphs, "100% of the $CORP supply is public…", Studio 0.2% line, contracts list, risk box, round-trip accordion line, fee caption "These apply to different operations…", tooltips Backing/Voucher. Rule: all mandatory (risk box non-negotiable); placement Open. · High · Open (OQ-19).

**DC-27 · Mobile active tab colour** — economy_prizes_mobile underline green, desktop dark. Rule: dark `--site-border-active`. · Low · Interpretation.

**DC-54 · Mobile two-column sections** — Work/Exit mobile keep 2 columns, Enter/Prizes stack. Rule: follow per-tab mockups at 390–430; stack below 390 (PROVISIONAL). · Low · Open (OQ-39).

## Rating

**DC-28 · EXAMPLE and fabricated rows** — rating-open shows "EXAMPLE", six fake wallets, "These rows are an example, not the live list." Rule: API rows only; no EXAMPLE; no footnote. · High · Resolved-by-doc.

**DC-29 · Two H1 variants shown together** — "THE RATING." + "EVERY WALLET CITY, ORDERED BY INFLUENCE." Rule: one H1 variant; COPY lists alternatives, not a stack. · Medium · Open (OQ-09).

**DC-30 · Next section** — mockup has only "OPEN THE LEADERBOARD →" inside the clocks strip; COPY: two cards (Leaderboard / Play Now) + Docs link. Rule: two cards + link. · Medium · Resolved-by-doc.

**DC-31 · Three Clocks presentation** — mockup: 4-cell strip, no 30-day scale; COPY: horizontal 30-day scale with marks; "Day N of 30" + next settlement hidden until epoch. Rule: cells from mockup + documented scale + hidden status. · Medium · Open (OQ-28, scale visual).

**DC-32 · Tooltips printed as body** — mockup prints "Day GDP: …" and "A row is a score. It is not a payout." as lines under the table; COPY defines them as tooltips. Rule: tooltips on the Day GDP header and on rows/legend; the section text (rows sort…, one wallet…) printed. Also mobile micro-text (How to climb faster 4-col ≈9 px) raised to ≥12 px (2×2). · Low · Interpretation.

**DC-33 · Subpage footer variant** — compact footer with old nav, "© 2026 Corporator. All rights reserved.", X/Telegram/Discord/YouTube. Rule: shared futer footer; links only X and Docs (COPY #7: Terms/Privacy removed). · High · Resolved-by-doc.

**DC-34 · Breadcrumbs** — mockup eyebrow "— RATING"; COPY breadcrumbs "Corporator / Rating". Rule: breadcrumbs in the eyebrow slot. · Medium · Interpretation.

**DC-57 · Rating section 2 display heading** — mockup "ONE DAILY SCORE. FOUR FACTORS." with eyebrow "HOW INFLUENCE IS COUNTED"; COPY section title is "How Influence is counted" only. Rule: section heading = "How Influence is counted"; the mockup display line is not doc copy. · Medium · Open (OQ-09).

**DC-60 · Rating row height vs the double-scale mobile frame** — `rating-open-mobile.png` is 737 px wide, about a 2× phone. A 33 px row on that canvas is about 17 px at 390. `body-sm` does not fit. Rule: the row on `/rating` is about 40 px from the table contract. The 17 px figure is a measurement discrepancy, not the layout. The column header is shorter than that 40 px: about 25 px of the 1024 desktop frame. Numbers stay left-aligned, as on the frame. · Medium · Resolved-by-owner 2026-09-28.

## Leaderboard

**DC-35 · Company logos in rows** — mockup NVDA/TSLA/… logos per row; README: island image instead (file not named). · High · Open (OQ-24).

**DC-36 · EXAMPLE label** — remove; keep documented caveat "This is an arithmetic example, not a forecast." · High · Resolved-by-doc.

**DC-37 · Weights panel blurred when closed** — closed mockup hides "Weights, not payouts" under blur; README: frame error, panel not blurred. · High · Resolved-by-doc.

**DC-38 · Closed-state timing and caption** — mockup caption "The leaderboard will be available after the first six days of the 30-day period." and digits "06 12 34 27"; README/COPY: closed during the first 6 days **of launch**. Rule: no fabricated digits; caption copy not documented; recurrence per period unknown. · High · Open (OQ-23).

**DC-39 · Leaderboard intro** — mockup subheading "Prizes in Stock Tokens, by place." (H1 variant 2) and intro "Six positive days to qualify. One slot per wallet. Places go by influence."; COPY intro: "The Leaderboard is the prize list. It is stricter than the Rating: only qualified cities count, and each wallet gets one slot. Places go by Influence." Rule: one H1 variant + doc intro. · Medium · Open (OQ-09).

**DC-40 · Missing documented sections** — bar chart of weights, example table, pool source, claiming, Resets/Stays, ThreeClocks, Your status, Next cards, tooltips; mockup shows 3 summary cards + CTA row. Rule: documented section order; summary cards' visual reused for section summaries (block contract). · High · Resolved-by-doc (visual of new parts Open, OQ-26).

**DC-41 · Card numbering "01 — QUALIFY"** — numbered labels inside Leaderboard cards. Rule: drop numbers (anti-numbering rule), keep the label word. · Medium · Interpretation.

**DC-42 · Row arrows "→"** — per-row arrow implies navigation; nothing documented. Rule: no row arrow/interaction. · Medium · Interpretation.

## Footer

**DC-43 · Footer copy** — mockup "YOUR NEXT MOVE BUILD TOMORROW." (contradicts "A city to operate, not to build"); no body, no disclaimer. COPY §9: headings (Start with one working operation / The island is waiting for an operator / Try the demo. No wallet needed.), text, 3 buttons, disclaimer, links, chip. Rule: doc copy; disclaimer mandatory. · High · Resolved-by-doc (variant OQ-09).

**DC-44 · Footer art vs mockup** — mockup island ≈42–74% of width (right of centre); `futer.png` island ≈32–64% (centred). Rule: real art; text column must not overlap the island; QA the overlap at 1440 and 1150. · Medium · Open (OQ-41).

**DC-58 · Footer on subpages** — COPY: header and footer identical on `/`, `/rating`, `/leaderboard`; the landing TOC calls block 9 "Финал и футер"; subpages already have their own Next cards. Rule: identical footer composition everywhere (doc literal), including the CTA heading/buttons. · Medium · Open (OQ-29).
