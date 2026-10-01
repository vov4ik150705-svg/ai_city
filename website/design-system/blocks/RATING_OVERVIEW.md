# RATING — Master Block Contract

Route `/rating` (standalone page). References: `rating-open-desktop.png`, `rating-closed-desktop.png`, `rating-open-mobile.png`, `rating-closed-mobile.png`. Copy §"Страница A" + §"Общий компонент Three clocks". README §Rating.

# Purpose
Give the public list of wallet cities and explain how a place is counted. It shows who is ahead; it pays nobody.

# Documentation Truth
- Meta title "Rating | Corporator"; meta description (verbatim). Breadcrumbs "Corporator / Rating".
- H1 variants: "The Rating" · "Every wallet city, ordered by Influence" · "Influence sets your place" — **one** H1 (DC-29).
- Intro (verbatim).
- Section 1 The table (first on the page): 2 paragraphs; columns **# · Wallet · Influence · Day GDP**; empty state "No wallet cities yet."; tooltips Day GDP / "A row is a score. It is not a payout."; player row marked **You**; field "Find a wallet" above the table.
- Section 2 How Influence is counted: 3 paragraphs (incl. example 9,025 × 30 = 270,750); four cards with × between (GDP against capex, Stability, Efficiency, Coverage — verbatim with Raises it / Zeroes the day / Your lever); Zero test toggles "Turn one factor to zero. The day scores zero."
- Section 3 How to climb faster: 4 items (verbatim).
- Section 4 Where the period stands: Three clocks.
- Section 5 Next: two cards Leaderboard (Open the Leaderboard) and Play Now + link "The full rules are in the Docs."
- Two states: closed (empty table + "No wallet cities yet."; Influence explanation still visible) and open (live rows from API). No "EXAMPLE", no mockup addresses.
- Header and footer as on the landing.
- Optional tooltip "In the game this tab is called Ranking." (OQ-36).

# Desktop Visual Truth
Long page on flat pale background. Eyebrow slot (→ breadcrumbs), H1, intro; search field (≈26% width) + chip "One wallet, one row."; table (full container, 4 columns, row 1 highlighted by green left bar + "● You" chip). Notes; section 2 heading + text; 4 factor cards in a row with "×" between; Zero test row (label + 4 icon+switch pairs); How to climb faster (4 numbered items, green numbers); clocks strip (4 cells) + "Open the Leaderboard →" pill; footnotes; compact footer.

# Mobile Visual Truth
Same order. Search row (field + chip), table keeps 4 columns; factor cards stack with centred ×; zero test card with 4 switches in one row; climb faster 4 micro-columns (raise text size — at 390 the mockup text is ≈9 px, below minimum); clocks 4 cells; full-width Open the Leaderboard pill; fixed Play Now bar.

# Layout
```
Page(theme=light)
 Header
 PageIntro(Breadcrumbs, H1, intro)
 Section table:     SearchField + note · RatingTable (states) · notes + tooltips
 Section influence: H2 + paragraphs · FactorCards(4, ×) · ZeroTest
 Section climb:     ClimbList(4)
 Section clocks:    ThreeClocks
 Section next:      NextCards(Leaderboard, Play Now) + Docs link
 Footer
```
Mockup "Open the Leaderboard" pill in the clocks strip is replaced by the documented Next cards (DC-30).

# Components
Breadcrumbs, Heading `display-1` (H1), BodyCopy, SearchField, TokenChip-style note Pill, DataTable (RatingTable) with YouMarker, EmptyState, LoadingState, ErrorState, Tooltip, FactorCard ×4 + multiply glyph, Toggle ×4 (ZeroTest), NumberedList, ThreeClocks (shared), NextCard ×2, ArrowLink.

# State Model
```
RatingState = closed | loading | open(rows) | error
search: idle | filtering(query) | noMatch
youRow: none | present(index)   (only when a wallet is known; OQ-27)
zeroTest: Record<factor, boolean>  (all on by default; one off → "The day scores zero.")
```
Closed = `GET /rating` returns zero wallet cities. Skeleton bars, with no phrase, only while that request is in flight. A non-empty query filters the returned rows on the client (case-insensitive contains) and, if none match, says "No wallet matches." The public route sets `self` to 0, so there is no You marker until a response marks the viewer. A failed request says "Unavailable" (OQ-22 still has no longer error sentence). ZeroTest is an illustration: toggles do not compute Influence.

# Data Model
API row `{ rank, wallet, influence, dayGdp, isYou }` — endpoint and shape OQ-21; no invented fields. Wallet rendered in `mono`, truncated middle (`0x12ab…9f3c`), full value in `title`/accessible name. Sort is the API's (Influence desc, ties by Day GDP then lower city ID) — the client does not re-sort. Static copy in `data/rating.ts`; clocks from `data/clocks.ts`.

# Assets
No art. Lucide icons: `file-text` (empty state), factor icons, clock icons, search. No company logos in rows.

# Typography
H1 `display-1` (the role already includes `--site-scale`; do not set a separate 53 px size). Intro `body`. Table header `label`, shorter than the row: about 25 px of the 1024 desktop frame. Cells `body-sm`. Row height about 40 px from the table contract (DC-60); the 17 px mobile-frame conversion is not the layout. Numbers `numeric`, left-aligned, tabular. Wallet `mono`. Factor title `heading-4`, text `body-sm`. "Raises it" / "Zeroes the day" / "Your lever" `label` (Roboto Regular only). Climb numbers `numeric`. Clock label `label`, value `caption`.

# Color / Accent
Light. `--site-success` for You marker bar/chip and climb numbers (mockup #1BB920). No industry accent.

# Spacing
`--site-page-top`; intro→search 32 px; search→table 12 px; table→notes 16 px; section gaps 64–96 px; factor card gap 16 px with × in the gap; `--site-reading-max` for paragraphs.

# Interaction
Search input (debounced if API, OQ-21), clear button, Esc clears. Table rows are not links (no row arrows). Tooltips on column headers. Toggles are real switches (`role="switch"`, labelled). Next cards are links.

# Responsive Transformation
Table keeps 4 columns (wallet truncates harder; horizontal scroll only as fallback). Factor cards 4-in-row → stack with × between. Climb list 4 columns → 2×2 with text ≥ 12 px (DC-32). Clocks 4 cells → 2×2 if they don't fit. Fixed Play Now.

# Visual Fidelity Priorities
HIGH: page order (table first), table frame and both states, factor cards with ×, zero test. MEDIUM: search field size, climb list, clocks. LOW: row highlight shade, icon choice.

# Known Conflicts
DC-28, DC-29, DC-30, DC-31, DC-32, DC-33, DC-34, DC-57, DC-58, DC-60.

# Open Questions
OQ-21, OQ-22, OQ-27, OQ-28, OQ-29, OQ-36.

# Implementation Constraints
Never render fake rows, "EXAMPLE", or mockup addresses in production — fixtures only in tests/QA. The table never implies a payout. The explanation stays visible in closed state. Rows appear only from the API.
