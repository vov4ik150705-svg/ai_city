# Corporator Website — Responsive System

Desktop mockups define the base composition. Mobile mockups define the actual transformation. Mobile never adds content, states or behavior. Detailed per-mockup measurements: `MOCKUP_ANALYSIS.md`.

## 1. Reference viewports

| Reference | Width | Basis |
|---|---|---|
| Desktop | 1440 px (16:10 / 16:9) | desktop canvases 1586×992, 1671×941, 1536×1024, 1024×728, 1224×1285, 1024×1536, 2170×725 normalized to 1440 |
| Mobile | 390 px (valid 360–430) | mobile canvases 853–904 px wide are ~2× renders of a ≈390–430 px phone. `economy_*_mobile`, `futer_mobile`, `leadearboard-*-mobile` place the phone column inside a wider sky frame: only the central column is the viewport (Economy: ≈69% of canvas width) |

## 2. Breakpoints

Reuse the repository's existing breakpoints (`apps/www/src/index.css`) — repository wins for conventions.

| Band | Range | Composition |
|---|---|---|
| `xl` | ≥1600 | desktop composition, container capped at 1296 px, art scales up, type does not exceed desktop scale |
| `desktop` | 1151–1599 | desktop composition (reference 1440) |
| `tablet` | 901–1150 | desktop composition compressed; gutter 36 px; blocks with 3 columns apply their tablet fallback (§5) |
| `tablet-sm` | 701–900 | block tablet fallbacks active; header still desktop layout if it fits, else mobile header (PROVISIONAL, OQ-31) |
| `mobile` | ≤700 | mobile composition (reference 390) |
| `mobile-xs` | ≤380 | mobile composition, gutter 20 px, display type scales down one step |

No tablet mockups exist. Tablet rules below are PROVISIONAL and marked (OQ-31). They use only transformations already seen in the mobile mockups.

Typography scales fluidly with `clamp(mobileSize, vw-based, desktopSize)` between 390 and 1440.

## 3. Global responsive rules (patterns repeated across ≥2 sections or documented)

| ID | Rule | Evidence |
|---|---|---|
| R-01 | **Header** → logo left, TokenChip compact, hamburger right; nav moves into menu; Play Now leaves the header. | Hero, Game, Industries, Buildings, Agents, Economy, Rating, Leaderboard mobile mockups (all show logo + chip + hamburger) |
| R-02 | **Fixed Play Now bar** at bottom on all routes ≤700 px. | documented (header UI; Leaderboard UI); visible in Hero and Buildings mobile |
| R-03 | **Vertical content flow:** heading → body → CTA/links → artwork → interactive panel. Artwork moves below the copy. | Hero, Industries, Buildings, Agents, Economy mobile |
| R-04 | **Headline keeps its 2–3 line break** and scales to ≈80–85% of viewport width. | all mobile mockups |
| R-05 | **Horizontal selector rows scroll** (never wrap into a grid) with the first item aligned to the gutter and the last item partially visible as affordance. | Industries selector, Agents role selector, Buildings rail |
| R-06 | **Tab bars stay one row** of equal cells with icons; they do not become dropdowns. | Economy (4 tabs), Industries info tabs (3 tabs) |
| R-07 | **Card rows become stacks** of full-width cards; horizontal card content becomes image-left/text-right media rows where the mockup shows it. | Game steps, Industries synergy cards, Rating factor cards, Leaderboard summary cards |
| R-08 | **Tables keep their columns**; cell padding shrinks; no column dropped; horizontal scroll only inside the table card at ≤360 px. | Rating and Leaderboard mobile |
| R-09 | **Flow diagrams keep 4 steps in one row** with arrows. | Economy Enter/Work/Exit/Prizes mobile |
| R-10 | **Background art switches from side-by-side to top/bottom crop**; the art's focal object stays whole (never cut through a building). | Hero, Industries, Economy, Footer |
| R-11 | **Minimum text 12 px, minimum touch target 44×44 px** even where mockup micro-text is smaller. | accessibility contract; Rating mobile micro-text (≈9–10 px) is raised |

Not promoted to global (one-off): skewed role cards (Agents), frosted phone frame around Economy mobile (presentation artifact), Rating mobile 4-column "How to climb faster" micro-grid (see §4 Rating).

## 4. Per-block transformations

Each entry: **Invariants** (must not change) / **Transformations** (what changes) / **Implementation rule**.

### Header — see `COMPONENT_SYSTEM.md` §1. Invariants: logo, chip, single look. Transformations: nav→menu, Play Now→fixed bar.

### Hero
- Invariants: headline copy and 2-line break, subtitle, Robinhood slot above buttons, two buttons, `hero.png` as art, sky continuity to the top edge (behind header).
- Transformations: copy block moves to the top (starts ≈140 px from top incl. header); island art moves **below** the buttons, full-bleed, island ≈100% of viewport width, cropped so waterfalls reach the bottom; buttons stay side by side (Play Now ≈34% / How it works ≈40% width); facts chips (documented, DC-45) wrap into rows under the buttons; Play Now also in fixed bar.
- Rule: at ≤700 the art is a separate stacked layer (`object-fit: cover`, focal point on island center), not the background under the text. The sky behind the text comes from the top of the same art or `--site-sky-fallback` gradient continuation.

### Game
- Invariants: heading, two paragraphs, 4 numbered steps with the four documented artworks, arrows between steps, 4 HUD placeholder panels.
- Transformations: steps change from a horizontal row of 4 cards to a **vertical stack** of 4 `media-row` cards (art left ≈40%, number+title+text right) with ↓ arrows between (documented "вертикальный на мобильном"); HUD panels change from 1 wide + 3 narrow in one row to a **2×2 grid**; "You do / You don't" columns (documented, missing in mockup) stack vertically.
- Rule: step order 01→04 top-to-bottom; art never above the number on mobile.

### Industries
- Invariants: 6 industries, Compute default, accent behavior, beacon over sky2, Works with, Example Synergies, info tabs.
- Transformations: beacon art moves from right column to **between intro and selector**, centered, ≈70% viewport width; selector row becomes horizontally scrollable (≈5.5 tiles visible, logo above name, chevron, pagination dots); secondary heading full width; Works with chips wrap (3 per row); synergy cards become `media-row` stack; info strip becomes 2×2 grid under tabs.
- Rule: selection state is shared between desktop and mobile (same state object).

### Buildings
- Invariants: dark block, white text, selected preview centered, details, View 3D, rail of the same 18 avatars, category tabs.
- Transformations: layout from 3 columns (copy / preview / details+vertical rail) to stack: copy → preview (≈70% width, centered) → details → prev/next arrows → **horizontal rail** of thumbnails (3 visible, scroll) → fixed Play Now bar (onDark variant).
- Rule: vertical rail on desktop and horizontal rail on mobile are the same component with `orientation`.
- Tablet (PROVISIONAL): copy on top full width; preview + details side by side; rail horizontal below.

### Agents
- Invariants: dark block, role portrait, role panel content, 5-role selector, Engineer default.
- Transformations: from 3 columns (copy / portrait / panel) + bottom-centered selector to stack: copy → portrait (≈55% width) → panel as a bordered `dark` card → selector row (horizontal scroll, ≈4.5 cards visible). Panel keeps its internal 2 columns (Home seat | Neighboring).
- Tablet (PROVISIONAL): copy + portrait in row one, panel full width, selector below.

### Economy
- Invariants: heading, body, "Read the economy guide", main art, 4 tabs, per-tab content.
- Transformations: art shrinks and moves to the right of/under the copy, overlapping the panel top edge (mockup: art occupies right ≈55% of viewport, bleeding off the right edge, bank + character behind the copy's right side); tab panel becomes full width; inside the panel: flow row (4 steps) stays one row; lower sections per tab:
  - Enter: sections stack (Capital flow → Economic assets → Fees).
  - Work: Payroll | Payment rules stay **two columns**.
  - Exit: Bank | Exit rules stay **two columns**.
  - Prizes: Prizes (Monthly, Farm) and Prize rules **stack**.
- Rule: follow the per-tab mobile mockup exactly at 390–430 px. Below 390 px, two-column sections stack in the same order (PROVISIONAL, OQ-39; DC-54).

### Rating
- Invariants: breadcrumbs, H1, intro, search, table columns, empty/open states, explanation, 4 factors with ×, zero test, climb tips, ThreeClocks, next.
- Transformations: search field full width with the "One wallet, one row." chip beside it; table keeps 4 columns + You chip; factor cards stack with centered × between; zero test switches stay a 4-in-a-row card; climb tips shown in the mockup as 4 tiny columns → **implementation stacks them 2×2** to satisfy R-11 (deviation recorded, DC-32 note); ThreeClocks 4 cells in a row; Next cards stack.
- Rule: nothing below the table is blurred or hidden in either state.

### Leaderboard
- Invariants: breadcrumbs, H1, intro, prize table with 10 places, weights panel, sections, ThreeClocks, next.
- Transformations: table keeps columns; stock logo row stays one row of 6 pills; summary/info cards stack as bordered cards; countdown box shrinks to ≈80% width, four cells kept; lower CTA pair ("Open the Rating" / "Play now") is a row; fixed Play Now bar present (documented).
- Rule: closed-state blur covers only the table on mobile too; panel stays sharp.

### Footer
- Invariants: `futer.png`, heading, three buttons, TokenChip, links, disclaimer.
- Transformations: text and buttons centered on top; buttons stack full-width-ish (≈65% width, centered); island art below buttons; chip + links row at bottom (chip left, links right, one row; wraps under 360 px).
- Rule: art is a stacked layer cropped to keep the island whole; sky continues upward behind the heading.

## 5. Touch, overflow, fixed/sticky, modals, tables

- Touch targets ≥44×44 px (selector tiles, chips with actions, toggles, thumbnails, tabs).
- Horizontal scrollers: `overflow-x: auto`, `scroll-snap-type: x mandatory`, `scroll-padding-inline: gutter`, visible focus, no hidden scrollbar trap on desktop.
- Fixed elements: only the MobilePlayBar. Header sticky. Nothing else fixed.
- Modals on mobile: PlayChooser = bottom sheet; ModelStudio = full screen with close top-right, gestures: one-finger orbit, pinch zoom; page scroll locked.
- Tables: see R-08.
- Hover-only information is never the sole carrier on touch; tooltips open on tap.

## 6. Artwork transformation rules

| Art | Desktop | Mobile |
|---|---|---|
| `arts/hero.png` | full-bleed background, island right half | stacked below buttons, full width, cover crop around island |
| `industries/assets/sky2.png` + beacon | sky full-bleed; beacon right column ≈38% width | sky full-bleed; beacon centered ≈70% width between intro and selector |
| `economy/art/economy-art.png` (or composite) | right ≈60% of block, top | right-side, ≈100% width band behind/under copy, overlapping panel top |
| `buildings-avatars/*` | centered ≈30% width | centered ≈70% width |
| `units/*` | centered ≈28% width, feet at selector top | ≈55% width |
| `arts/futer.png` | full-bleed band, 3:1 | stacked below buttons, cover crop, island whole |
| economy flow/rule images | 64–88 px tiles | 56–72 px tiles |

Serve responsive sizes (`srcset`/`sizes`); never ship the 1.5–2.5 MB originals to mobile (see `IMPLEMENTATION_GUIDELINES.md` §Performance).
