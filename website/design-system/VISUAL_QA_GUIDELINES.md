# Corporator Website — Visual QA Guidelines

Every implemented block is compared against its **desktop** and **mobile** reference. The references are visual truth only where they do not conflict with documentation — always check the block's Known Conflicts first so obsolete mockup content is not reported as "missing".

## 1. Setup

- Run: `npx vite --config apps/www/vite.config.ts --host 127.0.0.1 --port 5180`.
- Viewports: **1440×900** (Hero/Industries/Buildings — 16:10 references), **1440×810** (Agents/Economy — 16:9 references), **390×844** and **430×932** (mobile). Spot-check 1920, 1150, 900, 768, 360.
- Reference files: `website/reference/mockups/desktop/*` and `mobile/*` (read-only). Pairing table in `MOCKUP_ANALYSIS.md` §0.
- Method: capture a screenshot at the reference viewport, place it next to (or overlay at 50% opacity on) the mockup scaled to the same width. For long pages (Rating, Leaderboard) compare section by section, aligned on the section top.
- States: capture every documented state (each industry, each role, each economy tab, rating empty/open/You, leaderboard closed/open, viewer open/loading/error).
- Real data only: where the mockup shows fake data, compare structure (row height, columns) not content.

## 2. Checklist

**GLOBAL** — Header matches Hero mockup (height, logo size/position, nav centered, chip, Play Now); Footer uses `futer.png`; page background (sky vs flat light vs dark); container width and gutters; typography families.

**LAYOUT** — section height relative to viewport; content width; column ratios; alignment lines (headline left edge = container left); gaps; vertical rhythm between heading/body/CTA/panel.

**ARTWORK** — correct documented file; scale (± 5% of reference width); crop (focal object whole); position/anchor; bleed; z-index relative to text and panels.

**UI** — button size/shape/label; tab bar; cards (surface, border, radius); icons; selected state accent; active state.

**TYPOGRAPHY** — font family; weight; size (± 1 step of the scale); line-height; wrapping/line breaks of display headings; letter-spacing on labels/buttons.

**RESPONSIVE** — stacking order; ordering of art vs copy; horizontal scrollers; fixed Play Now bar; sticky header; artwork transformation; tables keep columns; touch targets ≥44 px; text ≥12 px.

**TRUTH** (always P0) — no numbering labels; no FAQ/old nav; no EXAMPLE; no fake addresses/rows/pool/countdown; no tickers next to logos in Industries; no prices; no ROI; correct industry/role colours per documentation; agent level segments = level number; 18 buildings, no Neon Residence.

## 3. Precision classes

| Class | Items | Tolerance |
|---|---|---|
| HIGH | major composition, section proportions, artwork file/scale/crop/position, content width, headline size and breaks, primary CTA, state controls, state representation | tight: ±3–5% position/size; exact file; exact state |
| MEDIUM | type scale, card proportions, spacing, border widths, control dimensions | ±1 token step |
| LOW | subtle shadows, blur radius, anti-aliasing, icon glyph differences, exact tints | visible-difference only |

Per-block HIGH/MEDIUM/LOW lists are in each block contract under "Visual Fidelity Priorities".

## 4. Issue format (mandatory)

```
ISSUE:           <what differs, one sentence, measurable>
EXPECTED:        <reference value/relationship + source (mockup file / doc section / token)>
ACTUAL:          <measured value in the build>
SEVERITY:        P0 | P1 | P2 | P3
ROOT CAUSE:      <token, component, data, asset, or layout rule responsible>
RECOMMENDED FIX: <actionable change, naming the token/component/rule>
```

Example:

```
ISSUE:           Hero island renders ≈10% smaller and starts too far from the right edge.
EXPECTED:        island spans ≈44–96% of viewport width at 1440 (hero-desktop.png).
ACTUAL:          island spans ≈50–90%.
SEVERITY:        P1
ROOT CAUSE:      ArtLayer uses object-fit: cover with centered focal point on hero.png, whose island is centered at ≈60%.
RECOMMENDED FIX: set ArtLayer focalPoint/anchor right and scale the art layer to ≈115% width so the island center lands at ≈70%; keep waterfalls uncropped.
```

Forbidden phrasing: "make it closer", "tweak", "looks off".

## 5. Priority

| P | Class | Examples |
|---|---|---|
| P0 | structure/truth | wrong section order, missing documented section, obsolete element present, wrong state/default, wrong major asset, wrong major position, wrong section size, wrong container, fabricated data |
| P1 | primary visual | artwork scale/crop, typography scale, spacing between major groups, card proportions |
| P2 | detail | colours, borders, radii, shadows, icons |
| P3 | micro | anti-aliasing, 1 px offsets |

Do not fix P3 while any P0/P1 is open on the block.

## 6. Reporting

One QA report per block per pass: viewport list, states captured, issues (format above) sorted by priority, and the list of intentional deviations (DC ids) that were **not** reported as issues.
