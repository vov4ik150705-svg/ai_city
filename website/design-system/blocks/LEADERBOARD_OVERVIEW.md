# LEADERBOARD — Master Block Contract

Route `/leaderboard` (standalone page). References: `leadearboard-open-desktop.png`, `leadearboard-closed-desktop.png`, `leaderboard-open-mobile.png`, `leadearboard-closed-mobile.png`. Copy §"Страница B" + §"Three clocks". README §Leaderboard.

# Purpose
Explain who receives prizes, how much each place receives, and how to claim — honestly, without forecasting amounts.

# Documentation Truth
- Meta title "Leaderboard | Corporator"; meta description (verbatim). Breadcrumbs "Corporator / Leaderboard".
- H1 variants: "The prize Leaderboard" · "Prizes in Stock Tokens, by place" · "Six positive days to qualify" — one H1.
- Intro (verbatim).
- Sections in order: 1 Who qualifies (+ "Your status" card) · 2 One slot per wallet · 3 What is paid (weights table + example paragraph) · 4 Where the pool comes from · 5 Claiming · 6 What resets (Resets / Stays) · 7 Three clocks · 8 Next (Rating / Play Now cards + Docs link).
- Weights table (verbatim): places 1–10; Weight 8,200 · 4,200 · 2,866 · 2,200 · 1,800 · 1,532 · 1,342 · 1,200 · 1,088 · 1,000; Share of a 10,000 pool 3,224 · 1,651 · 1,127 · 865 · 707 · 602 · 527 · 471 · 427 · 393. Example text: weights sum 25,428, 6 units stay in the pool, "This is an arithmetic example, not a forecast."
- Your status: "Positive days: X of 6 · Live stake: yes / no"; no wallet → "Connect a wallet to see your status."; demo → "Demo cities are not part of the Leaderboard."
- Tooltips: Positive day / Qualified (verbatim). Chart caption "Weights, not payouts. Amounts depend on the pool." — always visible, with the six logos from `website/stock-logos` under it.
- UI: one column. No "EXAMPLE". Rows have an island image instead of company logos. Closed during the first 6 days of launch: table blurred with a timer on top; weights panel **not** blurred. Then a bar chart of place weights and the example table. Bottom: two columns Resets / Stays. Mobile: Play Now fixed.
- Live pool amounts only when they really exist.

# Desktop Visual Truth
Pale flat page. Breadcrumb slot, H1 (≈38% width, 2 lines), intro. Table (≈28–64% height): header PLACE / (image) / WEIGHT / SHARE OF A 10,000 POOL, 10 rows ≈3.2% tall each, row 1 highlighted. Weights caption block + 6 logo pills. Divider. Three summary cards with hex icons and vertical dividers. CTA row: dark pill left + text link right. Closed: table area blurred with veil, centred lock icon, "LEADERBOARD OPENS IN", countdown box of 4 cells (Days / Hours / Minutes / Seconds).

# Mobile Visual Truth
Same order at phone width; table keeps its columns; 6 logo pills in one row; summary cards stack as bordered cards; closed countdown 4 cells in one row; CTA row becomes the fixed bottom bar.

# Layout
```
Page(theme=light)
 Header
 PageIntro(Breadcrumbs, H1, intro)
 WeightsTable (open | locked overlay)           ← mockup table = documented weights table
 WeightsCaption + StockLogoRow                  (never blurred)
 WeightsChart (bar chart, OQ-26)
 Sections 1–6 as SummaryCard/Section blocks (Who qualifies + YourStatus, One slot, What is paid, Pool source, Claiming, Resets|Stays)
 ThreeClocks
 NextCards(Rating, Play Now) + Docs link
 Footer
 MobilePlayBar
```
Interpretation (DC-40, confirm OQ-25): the mockup table is the documented weights-by-place table (static rows 1–10), placed first as the page's visual anchor; the "example table" of COPY is the same data and is not rendered twice. The three mockup summary cards (Qualify / 30 days / Get paid) supply the visual pattern for the section summaries; their numbers are dropped (DC-41).

# Components
Breadcrumbs, Heading `display-1`, BodyCopy, DataTable (WeightsTable) with row image cell, LockedOverlay (blur + veil + lock icon + label + Countdown), Countdown (4 cells), StockLogoRow (6 logo pills, no tickers), BarChart (weights), SummaryCard (icon + label + title + text), YourStatusCard, TwoColumnList (Resets / Stays), Tooltip, ThreeClocks, NextCard ×2.

# State Model
```
LeaderboardState = locked(opensAt) | open
Countdown = hidden (opensAt unknown) | running(opensAt) | elapsed → open
YourStatus = noWallet | demo | loading | known({ positiveDays, liveStake }) | unavailable
            (card rendered only if a wallet-connect action exists on the site, OQ-27)
LivePool = none | known(amounts)     (render amounts only when known)
```
Locked: **only the table** is documented as blurred; caption + logos are never blurred; the chart's locked state is not documented (OQ-26). Countdown source (`opensAt`) is not documented and recurrence per period is unknown (OQ-23): without `opensAt` show the lock label without digits. Never show placeholder digits.

# Data Model
`data/leaderboard.ts`: copy, weights[10] `{ place, weight, share }` (verbatim numbers), sections, resets[], stays[], tooltips. Runtime: `opensAt?`, `yourStatus?`, `livePool?` — endpoints not documented (OQ-25, OQ-27). A test asserts Σweight = 25,428 and Σshare = 9,994 (remainder 6).

# Assets
Six logos `website/stock-logos/*` (JPEGs opaque; pills with white surface). Island row image — MISSING (OQ-24): until supplied, the image cell stays empty at its documented size, never filled with company logos. Lucide: lock, hex-style icons for summary cards (or circle), clock.

# Typography
H1 `display-1`; intro `body-lg`; table header `label`, place/weight/share `numeric` tabular right-aligned; caption `body-sm` strong + `caption`; countdown digits `numeric` ≈40 px, unit labels `label`; lock label `label` tracked caps; summary card label `label`, title `heading-4`, text `body-sm`.

# Color / Accent
Light. `--site-success` for row-1 marker only if it denotes "You" (Interpretation: the mockup green row-1 bar on a static weights table has no meaning — not rendered). Locked veil `--site-blur-locked`.

# Spacing
`--site-page-top`; intro→table 32 px; row height ≈ 44 px desktop / 40 px mobile; table→caption 24 px; section gaps 64–96 px; summary card padding 24 px.

# Interaction
Rows are not interactive (no arrows, DC-42). Tooltips on "Positive day" and "Qualified". Countdown updates each second from a server/doc time (not client-invented); `aria-live="off"` with an accessible static label of the target date/time. Reduced motion: no digit flip animation.

# Responsive Transformation
Single column everywhere; table keeps 4 columns (image cell may drop first on narrow widths); logo pills one row (wrap ≤380); summary cards stack; Resets/Stays → stacked; countdown cells stay in one row; fixed Play Now.

# Visual Fidelity Priorities
HIGH: table frame and row rhythm, locked overlay composition (lock, label, countdown box), caption + logo pills always visible, card visual. MEDIUM: chart, status card, clocks. LOW: veil opacity, hex icon style.

# Known Conflicts
DC-35, DC-36, DC-37, DC-38, DC-39, DC-40, DC-41, DC-42, DC-31, DC-33, DC-34, DC-58.

# Open Questions
OQ-09, OQ-22, OQ-23, OQ-24, OQ-25, OQ-26, OQ-27, OQ-28, OQ-29, OQ-34 (claim partial).

# Implementation Constraints
No "EXAMPLE". No fabricated countdown digits. No forecast of amounts; live pool only when real. Weights described as "80% 1 ÷ place + 20% equal", never "Zipf". Claim text must switch to "coming soon" if claim is not live at publication (OQ-34). Prizes are Stock Tokens — never $CORP or Capital.
