# Corporator Website — Component System

Every value references `GLOBAL_DESIGN_SYSTEM.md` tokens. Dimensions are at the 1440 / 390 reference viewports and are APPROXIMATE unless marked.

## 0. Naming and reuse

The repository prototype (`apps/www/src/components.tsx`) already defines `Link`, `Destination`, `Logo`, `Header`, `Footer`, `Eyebrow`, `Section`, `SectionHeading`, `PageIntro`, `RiskNote`, `PreviewDialog`, `SiteContext`. Keep those names and patterns; restyle and re-scope them. New components use the same PascalCase, one-component-per-concern style.

| Spec name (task) | Repository name | Action |
|---|---|---|
| SiteHeader | `Header` | keep name, rebuild to Hero-mockup look |
| SiteFooter | `Footer` | keep name, rebuild to `futer.png` composition |
| Container | `.container` CSS class | keep concept, new tokens |
| Section | `Section` | keep |
| Eyebrow | `Eyebrow` | keep; add `Breadcrumbs` variant |
| Heading | `SectionHeading` / `PageIntro` | keep; `Heading` levels map to type roles |
| TextLink | `Link` | keep (internal navigation via `SiteContext.navigate`) |
| external CTA | `Destination` | keep (handles `null` destinations, `noopener noreferrer`) |
| Modal | `PreviewDialog` | generalize into `Modal`; PreviewDialog becomes a Modal usage |
| risk text | `RiskNote` | keep |

**Reuse gate.** Before creating any button, card, tab, input, tooltip, modal, text style, spacing value, colour or layout primitive, the agent answers "Does this already exist globally?" using this file. Section-specific variants are allowed only when a real visual difference exists in the mockups and the documentation supports it; they are registered here as a named variant.

Forbidden duplicates: a second button family, a second tab primitive, a second header/footer, a second search field, a second modal primitive, a block-local type scale.

---

## 1. Header (`SiteHeader`)

Canonical reference: `hero-desktop.png` / `hero-mobile.png` only (DC-02, DC-03, DC-53).

**Anatomy (desktop):** `[Logo mark + wordmark]` left · `[Nav: Game · Leaderboard · Rating · Docs]` centered · `[TokenChip] [Play Now]` right.

| Property | Desktop | Mobile |
|---|---|---|
| Height | ≈88 px band; controls centered at ≈56 px from top on Hero (Hero adds top breathing) | ≈64 px |
| Logo mark | ≈34 px tall | ≈26 px |
| Wordmark | display face, ≈17 px, UPPER, ls 0.02em, gap 12 px after mark | ≈16 px |
| Nav | `nav` type, item gap ≈40 px, group centered on viewport | hidden → hamburger menu |
| TokenChip | ≈155×34 px, pill, 1 px `--site-chip-border`, `metadata` type | kept, compact ≈32 px tall |
| Play Now | Button size `sm` (≈136×38), primary | hidden in header; moved to `MobilePlayBar` |
| Hamburger | — | `IconButton` 44×44 hit area, 24 px icon, right edge |
| Horizontal | logo at container left, Play Now at container right | gutter 24 px |

**Nav behavior (documented):** Game → `/#game` (scroll on `/`); Leaderboard → `/leaderboard`; Rating → `/rating`; Docs → docs destination (OQ-05). Industries/Buildings/Agents/Economy/FAQ are never nav items.

**Active state:** current page item (`/rating`, `/leaderboard`) uses `--site-text-primary` at weight 600 with a 2 px underline offset 8 px (mockup shows darker label; underline evidenced in Industries/Economy mockup headers, visual structure only). Inactive: `--site-text-muted`. On `/` the mockup emphasizes GAME (OQ-33).

**Hover:** colour to `--site-text-primary`, `--site-dur-hover`. No background.

**Sticky (documented "sticky-шапка"):** header stays at top. Over the Hero art it is transparent (as mockup). After the Hero, it needs a surface; no scrolled mockup exists → PROVISIONAL: `--site-surface-glass` + `--site-backdrop-glass` + bottom 1 px `--site-border-subtle`, same light look above dark blocks (the header does **not** turn dark over Buildings/Agents; dark-header mockups are not references). OQ-30.

**Mobile menu:** hamburger opens a panel listing Game · Leaderboard · Rating · Docs. No mockup → PROVISIONAL full-width sheet below header, `Modal`-grade focus trap, Esc/close, links in `heading-4` size, 56 px rows (OQ-30).

**Play Now (documented):** opens `PlayChooser` with **Play demo** and **Play with wallet** and the hint "Demo is an isolated city. No real assets move, and demo progress does not transfer to a wallet city." Destinations unknown (OQ-05).

Forbidden: section links in nav, FAQ, dark header variant, yellow logo (Agents mobile artifact), different header per page.

## 2. MobilePlayBar

Documented: "на мобильном кнопка Play Now закреплена внизу". Global on all three routes at ≤700 px (DC-49).

- Fixed bottom, inset `--site-gutter-mobile` left/right, bottom `max(12px, env(safe-area-inset-bottom))`.
- Button `lg` full width, height ≈50 px, primary pill, label "PLAY NOW" (`button` type 15 px).
- Over dark blocks the bar uses variant `onDark` (`--site-cta-on-dark-bg`, light border) — evidenced by `buildings_mobile.png`. Switch by intersection with dark block, crossfade `--site-dur-state`.
- Page bottom gets padding equal to bar height + 24 px so the footer is never covered.
- Opens `PlayChooser`.

## 3. PlayChooser

Choice after Play Now (documented). No mockup → PROVISIONAL visual: `Modal` (mobile bottom sheet) with two `Button lg` (Play demo = primary, Play with wallet = secondary) and the documented hint as `caption`. Unavailable destinations follow the existing `Destination` fallback. OQ-30.

## 4. Footer (`SiteFooter`)

Full contract: `blocks/FOOTER_OVERVIEW.md`. Identical on `/`, `/rating`, `/leaderboard` (documented). Art `website/arts/futer.png`. Contents: final CTA heading + text, buttons Play Now · Read the Docs · Follow on X, links Rating · Leaderboard · Docs · X, `$CORP` TokenChip with address, disclaimer. Mockup subpage footers (compact bar, ©, Telegram/Discord/YouTube, old nav) are obsolete (DC-33).

## 5. Layout primitives

**Container** — `max-width: --site-container-max`, inline padding = gutter token for the band. No block sets its own max-width except `--site-reading-max` for long text and `--site-hero-copy-max`.

**Section** — props: `id`, `theme: 'light' | 'sky' | 'dark'`, `artLayer?`. Applies `--site-section-y`, sets text colour tokens per theme, and hosts the `--block-accent` custom property. `sky` = background art full-bleed + light tokens.

**ArtLayer** — renders a documented image as a positioned, non-interactive layer: `src`, `alt` (empty when decorative), `focalPoint` (x%, y%), `fit: cover | contain`, `anchor`, `priority` (hero only), `sizes`. Used by Hero, Industries sky/beacon, Economy, Footer. Never used for content imagery that carries meaning (synergy avatars, role portraits use `<img>` with alt inside components).

## 6. Text primitives

**Eyebrow** — 32 px hairline + `eyebrow` label. Variants: `label` (plain section name, **never numbered**, use gated by OQ-10), `breadcrumbs` (`Corporator / Rating`, first segment is a link). Colour `--site-text-secondary` (light) / `--site-dark-text-secondary` (dark).

**Heading** — `level` (1–4) × `role` (`display-hero`, `display-1`, `display-2`, `heading-3`, `heading-4`). Semantic level and visual role are independent. Uppercase via CSS. `accentBold` prop not allowed — accent recolor happens via `<strong>` + block `--block-accent` rule scoped to Industries/Agents.

**BodyCopy** — `size: lg | md | sm`, `tone: secondary | muted | inverse`, max-width token. `<strong>` inside inherits the block's bold rule.

## 7. Buttons

One family, three emphasis variants, three sizes.

| Size | Height | Padding-x | Type | Evidence |
|---|---|---|---|---|
| `sm` | 38 px | 20 px | `button` 12–13 px | header Play Now |
| `md` | 44 px | 28 px | `button` 13 px | footer buttons, Leaderboard/Rating lower CTAs |
| `lg` | 52 px desktop / 48–50 px mobile | 36 px | `button` 14–15 px | Hero Play Now / How it works (≈174 / 208 px wide), MobilePlayBar |

| Variant | Rest | Hover | Active | Disabled | Focus |
|---|---|---|---|---|---|
| **PrimaryButton** | `--site-cta-bg`, `--site-cta-text`, pill | `--site-cta-bg-hover` | `--site-cta-bg-active` | opacity `--site-disabled-opacity`, no pointer | `--site-focus` ring |
| **SecondaryButton** (light) | transparent / `rgba(255,255,255,.6)` over sky, 1.5 px `--site-secondary-border`, text primary | `--site-secondary-bg-hover` | darker bg | same | same |
| **SecondaryButton** (`onDark`) | transparent, 1 px `rgba(255,255,255,.45)`, white text | `rgba(255,255,255,.08)` | | | |
| **Ghost/TextButton** | = ArrowLink | | | | |

Optional trailing icon (→) 16 px, gap 10 px (footer Play Now, "Open the Rating"). Leading icon (X logo) 16 px.

Loading: label replaced by 16 px spinner, width preserved, `aria-busy`. Only used where a real async action exists (none documented on the website except external navigation).

Groups: gap 12–14 px desktop, stacked with 12 px gap on mobile **only where the mockup stacks** (footer mobile stacks; hero mobile keeps two buttons side by side).

Forbidden: gradient buttons, square buttons, colour-per-block CTAs, buttons that fake success.

## 8. Links

**TextLink** — inline, `--site-text-primary`, underline 1 px offset 3 px; hover underline 2 px.

**ArrowLink** — uppercase `label`/`button` type 12–13 px, ls 0.08em, 1 px underline under the text only, trailing → 16 px with 10 px gap. Evidence: "READ THE ECONOMY GUIDE →", "MEET THE AGENTS →", "OPEN THE LEADERBOARD →", "PLAY NOW →". On dark: white.

Only documented ArrowLinks exist: Read the economy guide (Docs), Meet the agents (Docs agents section), "The full rules are in the Docs.", Open the Leaderboard / Open the Rating (inside Next cards). Mockup "Learn more about capital/work/exit/prizes" and "View all buildings" are obsolete (DC-06, DC-21).

## 9. TokenChip

`$CORP · Contract TBA` pill.

- Anatomy: `$CORP` (weight 600) · separator dot · status text (`Contract TBA` or truncated address in mono).
- Size: desktop ≈34 px tall, padding-x 16 px; mobile ≈32 px.
- Border 1 px `--site-chip-border`, bg `rgba(255,255,255,.5)` on sky; on dark (footer is light) not needed.
- Tooltip (documented): "The contract address will appear here once it is deployed. Copy it only from this site or from our official X account."
- Deployed state (future): `content/params/launch.json` → `deployed.token` non-empty → show `0x1234…abcd` + copy action (PROVISIONAL, OQ-06). Currently all `deployed` fields are empty → **TBA**.
- Never shows a fabricated address.

## 10. Pill / Badge / Chip

| Variant | Anatomy | Size | Use |
|---|---|---|---|
| `FactChip` | text | 32 px tall, pill, 1 px border, glass bg | Hero facts strip (documented; absent in mockup DC-45) |
| `IndustryChip` | stock logo (20 px) + industry name (`label`, accent colour) + optional accent dot | 32–36 px tall, pill, 1 px accent-tinted border | Industries "Works with", synergy card pair row, never with ticker |
| `TraitChip` | text | 28 px, pill, 1 px `--block-accent` 60% border, dark bg | Agents traits |
| `InfoChip` | icon + text | 28 px | building chips: layer, home role, hours; "Autonomous…", "Prebuilt…", "Home role…" (tooltips as documented) |
| `LockBadge` | lock icon + text | 28 px | "Needs City Level 2" (Exchange), "Needs both industries" (synergy buildings) |
| `YouBadge` | dot + "You" | 24 px, pill, `--site-success` text + 10% tint bg | Rating current-user row |
| `StatusDot` | 6–8 px circle | — | industry accent dot, live indicator |

## 11. Tabs

One primitive (`Tabs`, ARIA tablist) with visual variants.

| Variant | Visual | Evidence | Used by |
|---|---|---|---|
| `underline` | label (+ optional 20 px icon) in `label` type; active: `--site-text-primary` + 2 px underline (`--site-border-active` or `--block-accent`); inactive: `--site-text-muted`; equal-width cells | Economy tabs (icon + label), Industries info tabs (Industries · Tiers · Merges) | Economy, Industries info strip, Buildings category tabs (All 18 · Base · Industry · Synergy — no mockup, use this variant) |
| `underline-dark` | same on dark tokens | — | Buildings category tabs |

Behavior: arrow keys move focus+selection (automatic activation), Home/End supported; tab panels `role="tabpanel"` with `aria-labelledby`. On mobile the Economy tabs stay one row of four with icons (mockup); Buildings tabs scroll horizontally if they do not fit.

## 12. SegmentedControl (selection tile groups)

Generic single-select tile group (`role="tablist"` when it swaps a panel, which it does in both uses). Domain skins:

- **IndustrySelector tile** (Industries): white tile, logo 28–32 px + name `label` (+ ticker **removed**, DC-11) + accent dot; 6 tiles in one row inside a glass container ≈ full container width × 56 px desktop (tile ≈ 16% width); selected: 2 px `--block-accent` border + glow + tint. Mobile: tiles ≈ 72×56 px (logo above name), horizontal scroll with chevron and dots (mockup).
- **RoleSelector card** (Agents): skewed parallelogram card (≈110×110 px desktop, skew ≈ −8°), dark surface, 1 px `--site-dark-border`, portrait crop + name `label`, bottom 2 px accent line under name; selected: 2 px `--block-accent` border + `--site-glow-selected`. Mobile: horizontally scrolling row, ≈4.5 cards visible.

The skewed card is a **section-specific variant** (evidenced only in Agents); it may not be reused elsewhere.

## 13. Card

| Variant | Surface | Radius | Padding | Border | Use |
|---|---|---|---|---|---|
| `glass` | `--site-surface-glass` + backdrop | md | 24 | 1 px `--site-border` | Game step cards, Economy panel (lg radius), Industries selector container |
| `solid` | `--site-surface` | md | 24 | 1 px `--site-border` | Rating factor cards, synergy cards, Next cards, Leaderboard summary cards |
| `dark` | `--site-dark-surface` | lg | 24 | 1 px `--site-dark-border` | Agents panel (mobile shows it as a bordered card; desktop panel is frameless) |
| `feature` | glass, artwork overflows top edge by ≈30% of art height | md | 24 | 1 px | Game step cards (art on cloud sits above/over card) |
| `media-row` | solid, image left ≈40% / text right | md | 16 | 1 px | Industries synergy cards on mobile |
| `info` | transparent, hex-outline icon 56 px left, text right, vertical hairline separators | — | 0 | — | Leaderboard summary cards (desktop row of 3; mobile stacked bordered cards) |

Hover: none on non-interactive cards. Interactive cards (Next cards) show border `--site-border-active`.

## 14. Input / SearchField

- `SearchField`: search icon 16 px at 12 px left, placeholder `Find a wallet` (documented), height 40 px, width ≈380 px desktop / full width minus side chip on mobile, radius sm, bg `--site-input-bg`, 1 px `--site-border`; focus: `--site-focus` ring, **no yellow autofill tint** (repository HUD rule; apply `:-webkit-autofill` neutralization globally).
- Clear button appears when non-empty (IconButton 32).
- No submit button; filters as you type with 150 ms debounce (behavior against API: OQ-21).

## 15. Tooltip

- Trigger: `help-circle` 14–16 px icon button or dotted-underlined term. Accessible as `button` with `aria-describedby`.
- Opens on hover (desktop, 150 ms delay), focus, and tap (mobile, toggles; tap outside closes).
- Surface PROVISIONAL (no mockup): `--site-cta-bg` background, white `tooltip` text, radius 8, padding 10×12, max-width 280 px, 8 px offset, arrow optional.
- Content is only documented tooltip text (list in `WEBSITE_ARCHITECTURE.md` data + block contracts). Never put required information only in a tooltip on mobile if the mockup prints it (Rating prints notes; see DC-32).

## 16. IconButton

44×44 px hit area (visual 32–40 px), icon 20–24 px, `aria-label` required. Variants: plain (hamburger, close), `circle-outline` (Buildings "View 3D" eye: ≈48 px circle, 1 px white 45% border; label "VIEW 3D" sits beside it and is part of the same button), arrow (Buildings prev/next, Industries mobile chevron).

## 17. Divider

1 px hairline. Horizontal between stacked groups; vertical between panel columns (Economy, Agents panel HOME|NEIGHBORING, Leaderboard summary cards). Colour `--site-border-subtle` / `--site-dark-border`.

## 18. StatusIndicator

Dot + label. Uses: industry dot (accent), "You" (success), live pool indicator (only when live data exists). No pulsing animation.

## 19. Modal

Base for PlayChooser, ModelStudio, mobile menu.

- Overlay `rgba(11,15,20,.55)`; panel radius `--site-radius-modal`; max-width 560 px (chooser) / `min(1100px, 92vw) × min(760px, 86vh)` (ModelStudio).
- Mobile: chooser = bottom sheet; ModelStudio = full-screen.
- Focus trap, `aria-modal`, labelled title, Esc closes, click on overlay closes (not during drag in the 3D viewer), focus returns to trigger, body scroll locked.
- Motion `--site-dur-modal` fade; reduced motion instant.

## 20. DataTable primitives

`Table`, `TableHeader`, `TableRow`, `TableCell`, `TableEmpty`, `TableSkeleton`.

- Container: `solid` card, radius sm, 1 px border.
- Header row: `label` type, `--site-text-muted`, height 40 px, bottom border.
- Row: height 44–48 px desktop / 40 px mobile, `table` type, divider `--site-border-subtle`. Numbers `numeric` + tabular nums.
- Highlight row (You / place 1 marker): 3 px left bar (`--site-success`) + 8% success tint (mockup).
- Semantics: real `<table>` with `<th scope="col">`; caption visually hidden or visible as documented.
- Mobile: tables keep their columns (both Rating and Leaderboard mobile mockups keep 4 columns) with tighter cell padding; horizontal scroll inside the card only if content overflows at ≤360 px.
- Forbidden: "EXAMPLE" labels, placeholder addresses, fake rows (DC-28, DC-36).

## 21. EmptyState / LoadingState / ErrorState

- **EmptyState:** 32 px outline icon (`file-text` per mockup), `body` text, centered, min-height ≈320 px desktop / 200 px mobile inside the table body. Rating copy (documented): "No wallet cities yet."
- **LoadingState:** skeleton bars in table rows (no text), `aria-busy="true"`, polite live region announces loading. No spinners over art.
- **ErrorState:** icon + message + optional retry TextButton. Copy not documented (OQ-22) — must be approved before publication; do not invent claims about data.

## 22. Toggle (Switch)

Used by Rating Zero test (documented "Тумблеры «Zero test»"). Pill track 36×20 px, knob 16 px, off = `--site-border` track, on = `--site-text-primary` track. `role="switch"`, `aria-checked`, label = factor name with its icon (mockup). Mobile: four switches in one row (mockup), 44 px hit targets.

## 23. ThreeClocks (global domain component)

Used on `/rating` and `/leaderboard` (documented shared component). Implemented once.

**Content (documented):**
- Lead: "A city day lasts 25 real hours."
- Items: **Farm window** — 7 city days (175 hours). Fragments for the Farm pool. · **Prize period** — 30 city days (750 hours, about 31 real days). Influence and the Monthly prize. · **Season** — 90 city days, three prize periods. A calendar label. It pays nothing on its own.
- Footnote: "A new city joins the current period and counts from its creation. Earlier days are not backfilled."
- UI (documented): horizontal scale of 30 days with marks. When the calendar epoch is known: "Day N of 30" and the date of the nearest settlement. **Hidden before that.**

**Visual (mockup, APPROXIMATE):** one `solid` card, ≈ full container width × 72 px desktop, cells separated by vertical hairlines, each cell = 32 px outline icon + `label` title + `caption` value. The mockup shows four cells (City day · Farm window · Prize period · Season); City day maps to the documented lead sentence. The mockup lacks the 30-day scale (DC-31) and the mockup's "Open the Leaderboard" pill inside the strip belongs to the Next section, not to ThreeClocks.

**Structure (contract):**
```
ThreeClocks
 ├─ ClockCells: [City day (25 real hours)] [Farm window] [Prize period] [Season]
 ├─ PeriodScale: 30 day ticks; marks (OQ-28); current-day marker only when epoch known
 ├─ PeriodStatus: "Day N of 30" · next settlement date   ← hidden without epoch
 └─ Footnote
```

Mobile: four cells in one row (mockup) with 12 px minimum text; scale full width below; status line below scale.

## 24. Domain components (owned by blocks, listed for discovery)

IndustrySelector, BeaconStage, WorksWith, SynergyCard, IndustryInfoTabs · BuildingTabs, BuildingStage, BuildingDetails, BuildingRail, ModelStudio · RolePortrait, RolePanel, FitBars, LevelMeter, RoleSelector · EconomyTabPanel, FlowSteps, AssetTable, FeeTable, RuleList, PayrollSplit, BankLevels, PrizeCards · RatingTable, FactorCards, ZeroTest, ClimbTips, NextCards · PrizeTable, CountdownOverlay, WeightsPanel, WeightsChart, ResetsStays, YourStatusCard.

Each is specified in its block contract. A domain component may compose global components; it may not restyle them outside a registered variant.
