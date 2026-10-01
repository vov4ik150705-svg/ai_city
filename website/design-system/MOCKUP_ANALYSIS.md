# Corporator Website — Mockup Analysis

All 14 desktop and 14 mobile mockups in `website/reference/mockups/` were opened and analysed. (`website/design-refernces/**` contains byte-identical copies of the same 28 PNGs, grouped per block; they are not additional references.)

Measurements are **APPROXIMATE**, given as **% of canvas width (x) / height (y)** so they are independent of render scale, with pixel equivalents at the 1440 / 390 reference where useful. Letters follow the required methodology: A canvas · B viewport · C section · D container · E grid · F anchors · G type · H colour · I spacing · J components · K artwork · L state · M interaction cues · N transformation · O keep · P replace · Q obsolete · R placeholder · S uncertain · T confidence.

## 0. Inventory and pairs

| Block | Desktop file | Canvas | Mobile file | Canvas | Mobile viewport note |
|---|---|---|---|---|---|
| Hero | `hero-desktop.png` | 1586×992 (16:10) | `hero-mobile.png` | 853×1844 | full canvas = phone |
| Game | `game-desktop.png` | 1024×728 | `game_mobile.png` | 856×1838 | full canvas |
| Industries | `industries-desktop.png` | 1586×992 | `industries-mobile.png` | 852×1846 | full canvas |
| Buildings | `buildings_desktop.png` | 1536×1024 (3:2) | `buildings_mobile.png` | 904×1740 | full canvas |
| Agents | `agents-desktop.png` | 1671×941 (16:9) | `agents-mobile.png` | 853×1844 | full canvas |
| Economy Enter | `economy_enter_desktop.png` | 1670×942 | `economy_enter_mobile.png` | 1024×1536 | phone column x 15–85% |
| Economy Work | `economy_work_desktop.png` | 1672×941 | `economy_work_mobile.png` | 1024×1536 | phone column x 15–85% |
| Economy Exit | `economy_exit_desktop.png` | 1671×941 | `economy_exit_mobile.png` | 941×1672 | phone column x 6–94% |
| Economy Prizes | `economy_prizes_desktop.png` | 1671×941 | `economy_prizes_mobile.png` | 941×1672 | phone column x 10–90% |
| Rating closed | `rating-closed-desktop.png` | 1024×1536 (long page) | `rating-closed-mobile.png` | 724×2172 | full canvas |
| Rating open | `rating-open-desktop.png` | 1024×1536 | `rating-open-mobile.png` | 737×2134 | full canvas |
| Leaderboard closed | `leadearboard-closed-desktop.png` | 1224×1285 | `leadearboard-closed-mobile.png` | 941×1672 | content x 8–92% |
| Leaderboard open | `leadearboard-open-desktop.png` | 1224×1285 | `leaderboard-open-mobile.png` | 941×1672 | content x 15–85% |
| Footer | `futer_desktop.png` | 2170×725 (3:1) | `futer_mobile.png` | 1024×1536 | full canvas |

Filename typos (`leadearboard`, `futer`) are original; do not rename.

---

## 1. Hero

### Desktop — `hero-desktop.png`
- **A/B** 1586×992 → 1440×900 viewport, full-viewport section.
- **C** one viewport; header inside the art.
- **D** content x 4.7–94.3%; header logo x 6.8% (≈22 px further in than the H1 — treated as mockup accident; global alignment wins).
- **E** 2 zones: copy 4.7–44%, art 44–96%.
- **F** Header centre y 6.3%. Nav 38–62% (centred). Chip x 73–84%. Play Now x 85–94%. H1 y 24–39%, width 39%, 2 lines ("RUN THE MACHINE. / MAKE IT WORK."). Subtitle y 42–51%, width 35%, 3 lines. Robinhood slot y 54–58%, width 14% (+ caption "[Robinhood Chain logo]"). Buttons y 64–70%; Play Now width 12%, How it works 14.5%, gap 1%.
- **G** H1 heavy condensed display, cap height ≈6.3% of height (≈76 px font at 1440); subtitle ≈18 px grey; nav ≈12 px caps tracked; buttons ≈14 px caps.
- **H** sky `#94CEFC` top, white clouds; text `#000–#0E131A`, subtitle `#3A4049`; Play Now `#181E25`; How it works outlined dark.
- **I** H1→subtitle ≈3% h; subtitle→slot ≈3%; slot→buttons ≈6%.
- **J** header, 2 pill buttons (lg), token chip, placeholder box.
- **K** island x 44–96%, y 14–94%, waterfalls to bottom, floating islets at x≈43% and x 91–97%, sun flare top-left. Real file `arts/hero.png` has island centred ≈60% (DC-46).
- **L** none. **M** hover not shown; buttons obvious.
- **O** header composition, H1 variant 1, subtitle (= doc), two CTAs, art placement.
- **P** Robinhood placeholder → real logo + "Robinhood chain".
- **Q** —. **R** Robinhood logo (missing asset). **S** header/content left offset; exact display face.
- Missing vs doc: risk microcopy, 4 fact chips (DC-45).
- **T** High.

### Mobile — `hero-mobile.png`
- **A/B** 853×1844 → 390×844-class phone (full canvas).
- **F** header centre y 3.7%: logo x 7%, chip x 55–84%, hamburger x 89–94%. H1 y 13.5–23%, width 82%, 2 lines. Subtitle y 24.5–30.5%, 3 lines, width 82%. Robinhood slot y 32–34.5%, width 30%. Buttons y 38.5–42% (Play Now x 7.6–35.6%, How it works x 37.6–70%). Island y 46–90%, x 3–97%. Fixed Play Now bar y 93.3–98%, x 4–96% (≈50 px tall at 390).
- **G** H1 ≈44 px at 390; subtitle ≈15 px.
- **K** island stacked below the CTAs, full width, sky continues behind text.
- **N (transformation)** nav → hamburger; Play Now leaves header, appears twice (inline + fixed bar); art moves from right half to below content; buttons stay side by side; line breaks preserved.
- **T** High.

**Implementation rule:** stack art under the CTA group ≤700 px; the fixed bar is global (DC-49).

---

## 2. Game

### Desktop — `game-desktop.png`
- **A/B** 1024×728 (crop of a 1440 section; scale ×1.406).
- **C** ≈ 1 viewport + HUD row. Flat light bg `#F4F5F9` with sky/cloud strip under header.
- **D** x 4.7–95.3%.
- **F** eyebrow "— GAME" y 12%; H1 y 14–24%, width 34%, 2 lines ("A CITY TO OPERATE, / NOT TO BUILD."); paragraph 1 y 26–33.5% width 38% (4 lines); paragraph 2 y 35.5–39%.
- **E / J** Step cards y 41–71%: card widths ≈17.8% / 20.5% / 26.6% / 20.1% with ≈2% gaps and "→" arrows between; each card: artwork on cloud overflowing the card top by ≈40% of art height, then dark number disc (01–04), title (semibold ≈18 px), 3-line body (≈13 px).
- HUD placeholders y 75–92%: Overview 34.6% wide (window dots, large grey block + sidebar), Agents 16.8%, Bank 15.5%, Industries 18%. Caption y 94% "The HUD in the current build".
- **H** text dark; body grey; cards white/glass, 1 px border, radius ≈12 px.
- **K** four step arts = documented files (coin, workshop with worker, workshop complex, bank).
- **O** heading v1, paragraphs, steps & art, arrows, HUD placeholder frames.
- **Q** caption "The HUD in the current build" (DC-47). **R** HUD frames (documented placeholders). **S** eyebrow (OQ-10); unequal card widths (art-driven).
- Missing vs doc: "You do / You don't", tooltips.
- **T** High.

### Mobile — `game_mobile.png`
- **F** eyebrow y 7.3%; H1 y 9–15.5% width 65%; paragraphs y 16–24%. Step cards stacked y 28–74% (4 media-row cards, art left ≈40%, number+title+text right) with "↓" between. HUD placeholders 2×2 y 76–95%. Caption y 96%.
- **N** horizontal stepper → vertical (documented); 1+3 HUD row → 2×2 grid.
- No fixed Play Now visible (crop).
- **T** High.

---

## 3. Industries

### Desktop — `industries-desktop.png` (Compute state)
- **A/B** 1586×992 → 1440×900. Sky full-bleed (`sky2.png` look).
- **D** x 4.9–95.3%.
- **F** eyebrow "03 — INDUSTRIES" y 10.7%; H1 y 18.5–33% width 41% (2 lines); body y 35–41% (2 lines). Beacon island x 55–80%, y 8–48% (AI Research Center tower, NVIDIA). Selector container y 47.5–52.5% full width, 6 cells ≈15.1% each: logo + "COMPUTE — NVDA" + dot; selected cell: green 2 px border + glow. Caption y 53.5–56% "● COMPUTE — NVDA / Computing and research.". Secondary eyebrow "SYNERGY MAP" y 57.5%; secondary heading y 59–68% width 29% ("COMBINE INDUSTRIES. / UNLOCK HIGHER VALUE."); body y 70–74.5%; "WORKS WITH" y 77.5%; chips y 79.5–82.5% (3 pills: logo + name + dot). "EXAMPLE SYNERGIES" y 57%; synergy cards x 36.3–95.3%, y 58.5–85%, 3 cards ≈19% wide: avatar on cloud, name caps, pair row (logo + name + logo + name), 1-line role. Tabs y 88–90.5% centred (Industries active, Tiers, Merges). Lower strip y 91–98%: 4 columns with dot + caps title + 2 lines.
- **H** accents sampled: Compute `#33E01F`, Energy `#FF0014`, Logistics `#FD9B00`, Consumer `#6B01FD`, "Automation" `#006FFE`, "Finance" `#00D3FE` (swapped vs doc, DC-12).
- **O** H1 v1, body (doc para 1), selector structure, beacon over sky, Works with, 3 synergy cards (= documented Compute synergies Robotics Lab, Drone Depot, Data Center), tabs.
- **P** tickers removed; colours per doc; strip/secondary copy replaced by doc content.
- **Q** "03 —" numbering, old nav with FAQ, "SYNERGY MAP / COMBINE INDUSTRIES…", strip copy (DC-13).
- **S** caption slot content (OQ-12), tab-panel mapping (OQ-11).
- **T** High for composition, Medium for copy slots.

### Mobile — `industries-mobile.png`
- **F** eyebrow y 3.3%; H1 y 4.5–10.5%; body y 11–14%; beacon y 14–33% centred (x 22–78%) — shows a different NVIDIA building than desktop (DC-14); selector y 34–39%, ≈5.5 tiles visible (logo above name/ticker), chevron right; dots y 41%; caption y 40–42.5%; secondary eyebrow y 43.7%; heading y 45–49.5%; body y 50–53%; Works with chips y 55–57.5% (3 in a row); "EXAMPLE SYNERGIES" y 58.5%; 3 media-row cards y 60–83%; tabs y 84.5–86.5% (3 equal); info 2×2 y 87.5–97%.
- **N** beacon moves above selector; selector becomes horizontal scroller with dots; cards become media rows; strip 4-col → 2×2.
- **T** High.

---

## 4. Buildings

### Desktop — `buildings_desktop.png`
- **A/B** 1536×1024 → 1440×960. Dark bg `#10181E`, no nav in header (logo only — not a reference).
- **D** x 4.5–97.8%.
- **E** 3 zones: copy 4.5–33%, preview 35–58%, details 63.5–85%, vertical rail 89.6–97.8%.
- **F** eyebrow "02 — BUILDINGS" y 19.5%; H1 y 22.5–31% width 29% ("18 BUILDINGS. / REAL FUNCTIONS."); body y 33–36% (2 lines); link "VIEW ALL BUILDINGS →" y 40%. Preview y 19–75% (AI Research Center tower). Details: NVIDIA logo row y 32–36%; name "DATA CENTER" y 37–42%; category "COMPUTE" y 44.5%; text y 48.5–53.5% width 20%; View 3D (eye circle + label) y 56–62%. Rail: arrows + "1 / 16" y 29.5%; 3 thumbs ≈8.2%×10% at y 33–44 / 45–55 / 56–66%, selected green border. Bottom 25% empty.
- **G** H1 white condensed ≈64 px; name ≈32 px; category label caps.
- **O** dark block, white text, centred preview, details column, View 3D, thumbnail rail.
- **P** name/category/text from doc; logo row (OQ-14).
- **Q** "02 —", "VIEW ALL BUILDINGS", "1 / 16", headline/body not doc, mislabel (DC-06/07/08).
- **R** —. **S** accent of selection (green = NVIDIA), counter, tabs placement (absent, DC-09).
- **T** High composition / Low content.

### Mobile — `buildings_mobile.png`
- **F** header (logo, chip, hamburger); eyebrow y 9%; H1 y 11–18.5%; body y 20.5–23%; link y 26.8%; preview y 29–56% (x 32–65%); logo row y 58–61%; name y 62.5–64.5%; category y 66%; text y 67.5–70.5%; View 3D y 72–76.5%; arrows + "1 / 16" y 79.5%; horizontal rail y 81.5–90.5% (3 thumbs ≈26% each); fixed "Play Now" bar y 93–98% (dark fill, light border).
- **N** 3 columns → vertical stack; vertical rail → horizontal rail under details; fixed Play Now appears (onDark variant).
- **T** High.

---

## 5. Agents

### Desktop — `agents-desktop.png` (Engineer)
- **A/B** 1671×941 → 1440×810. Dark bg `#091117`; no header drawn.
- **E** copy 4.3–34%, portrait 38–57%, panel 65–96%, selector 21–79%.
- **F** eyebrow "06 — AGENTS" y 19.3%; H1 y 22–37.5% width 30%; body y 41–46.5% (2 lines); small line y 49.5%; link "MEET THE AGENTS →" y 56%. Portrait y 11–70%. Panel: hex icon + "ENGINEER" y 14–20%; "PRODUCTION" y 22.7%; rule y 25%; HOME SEAT | NEIGHBORING columns y 28–43% (icons + names, vertical divider); COMPATIBILITY (?) y 45.7%; bars HOME 100% / NEIGHBOR 60% / OTHER — y 48.5–54.5%; rule y 57%; LEVEL "04" + 5 segments (3 lit) | TRAITS chips (Specialist, Steady) y 59–67%. Selector y 73.5–91.5%: 5 skewed cards ≈10.7% wide, selected with yellow border+glow and underline. Caption y 95%.
- **H** accent sampled `#FFC82D` (yellow) — doc says orange (DC-16).
- **O** composition, panel structure, bars, level meter, trait chips, selector cards.
- **Q** "06 —", level/segment mismatch (DC-15), "OTHER —" (DC-18), caption under selector & "Five roles…" (DC-19), neighbor list missing Robotics Lab (DC-17).
- **T** High.

### Mobile — `agents-mobile.png`
- **F** header (yellow logo — artifact); eyebrow y 8%; H1 y 9.5–18%; body y 19–21.5%; line y 23.5%; link y 26.5%; portrait y 26–54% (x 33–67%); panel as bordered card y 55–85.5% (x 6–94%), inner 2 columns preserved; selector y 87–96% (≈4.3 cards visible, scroll); caption y 97%.
- **N** 3 columns → stack; panel gains a card frame; selector scrolls horizontally.
- **T** High.

---

## 6. Economy (four tabs, one system)

### Shared desktop frame (all four)
- **A/B** ≈1671×941 → 1440×810. Sky full-bleed.
- **F** header y 5.5% (old nav, not reference). Eyebrow "07 — ECONOMY" y 14.7%. H1 y 16.5–37.5% width 32%, 3 lines ("$CORP IN. / CAPITAL INSIDE. / $CORP OUT." — "$" renders as "S" in some, DC-24). Body y 39.5–47% (3 lines, = doc para 1). Link "READ THE ECONOMY GUIDE →" y 50.5%. Art x 34–98%, y 12–57% (coin + stack, character, bank island, floating islets) — matches `economy/art/economy-art.png` composition.
- Panel (glass, radius ≈16 px) x 4.6–95.3%, y 56.5–93%, overlapping art bottom. Tab row y 57.5–62%: icon + label, active underline dark; tabs occupy ≈55% of panel width, left-aligned. Three inner columns separated by hairlines: ≈6–38% / 41–67% / 69–94%.
- **H** panel white ≈75% + blur; section titles dark caps ≈16 px; captions grey.

| Tab | Column 1 | Column 2 | Column 3 | Obsolete/replace |
|---|---|---|---|---|
| Enter | "CAPITAL FLOW": $CORP → Vault → Capital → City Actions (images + label + caption) + "LEARN MORE ABOUT CAPITAL →" | "ECONOMIC ASSETS": 6 rows icon + name + purpose (= doc Who's who) | "FEES" table (= doc fee table) | "Build. Upgrade. Grow.", "Learn more…" (DC-21) |
| Work | "WORK FLOW": Work → Payment Requests → Payroll → Paid Work | "PAYROLL": image + 40% burned / 60% payroll chips + 2 short texts | "PAYMENT RULES": 4 rules (icon + title + line) + info note | "Fund / 14 per day. Daily budget = fund / 14" outdated (DC-22) |
| Exit | "EXIT FLOW": 1. Capital → 2. Bank → 3. Voucher → 4. $CORP | "BANK": image, Role, Bank Level follows Finance Tower, L1 25% — L2 43.75% — L3 57.82%, "4th step not reachable…", share text | "EXIT RULES": Bank window, Base markup, Global daily limit ("five pool" typo, DC-23), Voucher + info note | — |
| Prizes | "PRIZE FLOW": DEX → Pools → Qualify → Claim | "PRIZES": Monthly (0.2%, 30-day, flat logo row, 6 positive days / 30 + live stake) and Farm (0.6%, 7 city days / 175 h, fragments) | "PRIZE RULES": 6 rules + note | flat logo row → `stock-tokens.png` (DC-25) |

- **O** composition, tabs, 3-column panel, flow of 4 images with arrows, documented numbers.
- **Q** "07 —", old nav, "Learn more …" links, "Build. Upgrade. Grow.".
- **S** placement of mandatory doc items missing from mockup (DC-26, OQ-19).
- **T** High composition / Medium content.

### Mobile (four files)
- Phone column only (see §0). Header (logo, chip, hamburger); eyebrow; H1 3 lines at ≈48% of phone width on the left; art on the right half, bleeding off the right edge and overlapping the panel top; body + link under H1.
- Panel full phone width, radius ≈16 px: tabs one row of 4 equal cells with icons (active underline dark; green in Prizes, DC-27); flow row of 4 steps kept horizontally; "LEARN MORE …" link (obsolete).
- Lower sections: **Enter** stacks Economic assets then Fees (tables full width). **Work** keeps Payroll | Payment rules two columns. **Exit** keeps Bank | Exit rules two columns. **Prizes** stacks Prizes (Monthly, Farm rows) then Prize rules as a table (icon + title | description) and a note.
- **N** columns → stacks except Work/Exit (DC-54); flow row preserved (R-09).
- **T** High.

---

## 7. Rating

### Desktop — `rating-open-desktop.png` / `rating-closed-desktop.png`
- **A/B** 1024×1536 long page (×1.406 → 1440 wide).
- **D** x 5.4–94.7%. Flat bg `#F3F9FA`.
- **F** header y 2.3% (old nav + compact). Eyebrow "— RATING" y 6.7%. H1 y 7.8–16% ("THE RATING." larger + "EVERY WALLET CITY, / ORDERED BY INFLUENCE." — two variants stacked, DC-29). Intro y 17–19% (= doc). Search y 21–22.7% (x 5.4–31.7%) + chip "One wallet, one row.". Table y 23.5–42%.
  - Open: "EXAMPLE", header # / WALLET / INFLUENCE / DAY GDP, 6 rows (row 1 highlighted with green left bar + "● You" chip), footnote "These rows are an example, not the live list." (DC-28).
  - Closed: header row + empty body with file icon + "No wallet cities yet." centred (body height ≈9% of page).
- Notes y 43–48% (doc section text + tooltips printed). Eyebrow "HOW INFLUENCE IS COUNTED" y 50.7%; display "ONE DAILY SCORE. / FOUR FACTORS." y 52–56.5% (DC-57); text y 57.5–62.5%. Factor cards y 63.8–76%: 4 cards with icon, title, text, "Raises it / Zeroes the day / Your lever", "×" between. Zero test row y 77.5–80.5% (label + 4 icon+switch). How to climb faster y 81.5–85.5% (4 numbered green items). Clocks strip y 87–90% (City day 25 real hours · Farm window 7 city days, 175 hours · Prize period 30 city days, 750 hours · Season 90 city days. It pays nothing. + "OPEN THE LEADERBOARD →" pill) + footnotes y 91%. Footer y 93–97.5% (compact, old nav, ©, 4 social icons — DC-33).
- **H** accent green `#1BB920` (You chip, climb numbers).
- **O** order table→explanation→factors→zero test→climb→clocks; table frame; empty state; search; You marker; factor cards with ×; switches.
- **Q** EXAMPLE, fake wallets, example footnote, old header/footer, stacked H1 variants.
- **S** clocks strip vs documented 30-day scale (DC-31); next cards missing (DC-30).
- **T** High.

### Mobile — `rating-open-mobile.png` / `rating-closed-mobile.png`
- **F** header y 1.3%; eyebrow y 3.8%; H1 y 4.5–10%; intro y 10.8–12.3%; search row y 13.5–15% (field + chip); table y 15.5–29% (4 columns kept + You chip; closed: empty state); notes y 30–35%; section 2 y 36–46%; factor cards stacked y 47–75% with centred ×; zero test card y 76–81.5% (4 switches in one row); climb faster y 82–86.5% (4 micro columns, text ≈9 px at 390 — raised in implementation); clocks 4 cells y 87–89.5%; "OPEN THE LEADERBOARD →" full-width pill y 90–91.8%; footnotes y 92.5–93.7%; footer y 94–99%.
- **N** factor cards stack; everything else keeps structure at smaller scale.
- **T** High.

---

## 8. Leaderboard

### Desktop — `leadearboard-open-desktop.png`
- **A/B** 1224×1285 (×1.18 → 1440).
- **D** x 5–95%.
- **F** header y 3.2% (old nav, blue chip text). Eyebrow "— 08 — LEADERBOARD" y 9%. H1 y 10.5–18% width 38% (2 lines "THE PRIZE / LEADERBOARD."). Subheading y 19–21% "Prizes in Stock Tokens, by place." (H1 v2). Intro y 22–25% (not doc, DC-39). Table y 28–64%: "EXAMPLE", header PLACE / (logo) / WEIGHT / SHARE OF A 10,000 POOL, 10 rows ≈3.2% tall each, company logo per row, "→" per row, row 1 highlighted (green bar). Weights caption block y 66–72% ("Weights, not payouts. Amounts depend on the pool." + doc paragraphs). Logo pills row y 73.5–76% (6 white pills). Divider y 77.5%. Three info cards y 79–91% (hex icons; "01 — QUALIFY / SIX POSITIVE DAYS TO QUALIFY.", "02 — 30 DAYS / 30-DAY PRIZE PERIOD", "03 — GET PAID / THE TOP 10 PLACES SPLIT EACH ASSET.") with vertical dividers. CTA row y 93–95.5%: "OPEN THE RATING →" dark pill left, "PLAY NOW →" text link right.
- **O** table frame and row rhythm, weights caption + logo pills, info-card visual, CTA row.
- **P** row logos → island image (OQ-24).
- **Q** EXAMPLE, row arrows (DC-42), numbered card labels (DC-41), old header.
- **Missing vs doc** chart, example table, pool source, claiming, resets/stays, clocks, your status, next cards (DC-40).
- **T** High composition / Low completeness.

### Desktop — `leadearboard-closed-desktop.png`
- Same frame (canvas 1224×1285 rendered at another scale). Table area y 28–72% blurred with veil; centred lock in hex y 37–40% with side rules; "LEADERBOARD OPENS IN" y 44% (caps tracked); countdown box y 46–52%, x 35–64.5%: 4 cells DAYS / HOURS / MINUTES / SECONDS with digits "06 12 34 27" (fabricated) and hairlines; caption y 54–56% (not doc, DC-38). Weights panel **missing** (hidden by blur — frame error, DC-37). Info cards y 75–88%; CTA row y 90.5–93.5%.
- **T** High.

### Mobile — `leaderboard-open-mobile.png` / `leadearboard-closed-mobile.png`
- Open: eyebrow y 6.4%; H1 y 7.5–13.5%; subheading y 14.5–16%; intro y 16.5–19%; table y 21–50% (columns kept, logos, arrows); caption y 51.5–58.5%; logo pills row y 60.5–63% (6 pills in one row); info cards stacked (bordered) y 64.5–94%; CTA row y 96–98.5%.
- Closed: table blur y 27.5–55.5%, lock y 32–36%, label y 39%, countdown y 40.5–46.5% (4 cells), caption y 48–50%; info cards y 57–96%; bottom CTA row y 94.5–98% overlays the last card → a fixed bar (consistent with documented fixed Play Now).
- **N** cards stack; table unchanged; CTA row fixed.
- **T** High.

---

## 9. Footer

### Desktop — `futer_desktop.png`
- **A/B** 2170×725 (3:1) → 1440×480 band.
- **F** H1 x 5.1–38%, y 33–54%, 2 lines ("YOUR NEXT MOVE / BUILD TOMORROW." — obsolete, DC-43). Buttons y 59–68%: Play Now → (dark, x 5.3–15.9%), Read the Docs (outlined, x 16.8–26.8%), Follow on X (outlined with X icon, x 27.3–37.5%). Island x 42–74%, y 20–95%. Bottom-right: chip x 76.8–86% y 84–90%; links "Rating · Leaderboard · Docs · X" x 87–98% y 87%.
- **K** art matches `arts/futer.png` sky/clouds but real file has the island centred (x 32–64%) (DC-44).
- **Missing** body text, disclaimer.
- **T** High composition / Low copy.

### Mobile — `futer_mobile.png`
- **F** H1 centred y 10–22% width ≈82%; buttons centred stacked y 24–30% / 31.5–37.5% / 39–45% (width ≈44% of canvas); island y 46–86%; bottom row y 91.5–95.5% chip left, links right.
- **N** left text column → centred stack on top; buttons stack; art below; chip+links row stays one line.
- **T** High.

---

## 10. Project-wide analysis

**Global visual language.** Sky/cloud light theme (Hero, Industries, Economy, Footer with art; Game/Rating/Leaderboard flat pale). Two dark studio blocks (Buildings, Agents) adjacent on the landing. Large rendered low-poly art with real buildings; floating islets as recurring motif.

**Recurring components.** Hero-style header (logo · centred caps nav · chip · dark pill) in all 13 frames that show a header; black pill primary + outlined pill secondary (Hero, Footer, Leaderboard, Rating); ArrowLink caps + underline + → (Buildings, Agents, Economy, Rating, Leaderboard, Footer); `$CORP · Contract TBA` chip (every header, footer); glass/white cards 1 px border radius ≈12–16 px (Game, Industries, Economy, Rating, Leaderboard); icon + caps label tabs with underline (Economy, Industries); selection tiles with accent border + glow (Industries, Buildings, Agents); hairline vertical column dividers (Economy, Agents, Leaderboard).

**Recurring typography.** Heavy condensed uppercase display, 2–3 line headings with a period at each line end; caps tracked labels ≈11–12 px for eyebrows, column titles, table headers, tab labels, buttons; grey body ≈14–18 px.

**Recurring spacing.** Content container ≈90% of width (≈5% gutters); heading→body ≈24–28 px; body→CTA ≈40–48 px; card gaps ≈16–24 px; full-viewport block compositions on the landing.

**Recurring interaction patterns.** Single-select state controls that recolour the block (Industries, Agents) or swap panel content (Economy tabs, Buildings rail). Prev/next arrows on rails. Tooltip "?" icon (Agents compatibility).

**Recurring responsive patterns.** Header → logo/chip/hamburger (all mobile frames); art stacks under copy (Hero, Industries, Buildings, Agents, Economy, Footer); horizontal scrolling selectors (Industries, Agents, Buildings rail); card rows → stacks (Game, Industries, Rating, Leaderboard); tab bars and flow rows keep one row (Economy, Industries); tables keep columns (Rating, Leaderboard); fixed bottom Play Now (Hero, Buildings, Leaderboard closed).

**Recurring artwork behaviour.** Single hero-scale focal object per block, never cropped through; floating islets at edges; objects sit on clouds (Game steps, synergy cards); cut-out art over a separate sky (Industries, Economy composite option).

**Recurring state patterns.** Default state documented and shown (Compute, Engineer, Enter); accent drives selected border, glow, bold text, underline, bars; empty vs populated tables; closed = blur + lock + countdown.

**Recurring mockup errors (never copy).** Numbered eyebrows; old nav/FAQ; per-block header variants; EXAMPLE labels and invented data; tickers next to logos; wrong accent colours (Engineer yellow, Automation/Finance swap); state inconsistencies (level 04 with 3 segments; blurred weights panel); obsolete captions ("The HUD in the current build", "Home seats use the full specialty…", "Build. Upgrade. Grow."); "$"→"S" glyph errors; typos ("five pool").
