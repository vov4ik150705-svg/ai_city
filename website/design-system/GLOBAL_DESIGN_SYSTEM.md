# Corporator Website — Global Design System

Status: canonical working reference for all website design and implementation agents.
Scope: `/`, `/rating`, `/leaderboard`.
Derived from: `website/reference/docs/README.md`, `website/reference/docs/CORPORATOR_WEBSITE_COPY_2.md` (rules 0.24.0, pack 187), 14 desktop + 14 mobile mockups in `website/reference/mockups/`, and the repository (`apps/www`, `art/fonts`, `website/*`, `models/`, `content/params/*`).

Evidence for every value is in `MOCKUP_ANALYSIS.md`. Conflicts are in `DESIGN_CONFLICTS.md` (DC-xx). Unknowns are in `OPEN_QUESTIONS.md` (OQ-xx).

Legend used in this file:

- **VERIFIED** — read from a repository file or the documentation.
- **APPROXIMATE** — estimated from a mockup; visual QA confirms or adjusts it. Do not treat as exact.
- **PROVISIONAL** — required to build, not evidenced by any source; must be confirmed by the owner (linked OQ).

All desktop pixel values are normalized to a **1440 px** wide reference viewport. All mobile pixel values are normalized to a **390 px** wide reference viewport (mobile canvases are ~2× renders of a 390–430 px phone; economy/footer mobile canvases show the phone column inside a wider sky frame, see `MOCKUP_ANALYSIS.md` §0).

---

## 0. Visual constitution in one paragraph

A bright, sky-lit editorial site. Light sections sit on a blue sky with volumetric white clouds and floating low-poly islands; content is dark ink on that sky. Two blocks — **Buildings** and **Agents** — are dark "studio" blocks (near-black blue-green) with white text and a single state accent. Headlines are heavy, condensed, uppercase display type set in two lines; body copy is a quiet grotesk in grey. Primary actions are black pills; secondary actions are outlined pills. Cards are white or frosted-white, thin-bordered, softly rounded. Colour is used only as **state accent** (selected industry, selected role, success/You). Artwork is large, rendered, and real — never redrawn.

---

## 1. Typography

### 1.1 Repository audit (VERIFIED)

| File | Family | Weights present | Notes |
|---|---|---|---|
| `art/fonts/ibm_plex_sans.woff2` | IBM Plex Sans | **400 only** (static, `usWeightClass=400`, no `fvar`) | OFL (`OFL-IBMPlexSans.txt`). Used by `apps/www/src/index.css` and HUD. |
| `art/fonts/jetbrains_mono.woff2` | JetBrains Mono | 400 | OFL. HUD role "log" (technical/data). |
| `art/fonts/source_serif_4.woff2` | Source Serif 4 | — | Not used by any mockup. Do not use. |
| `art/fonts/press_start_2p.*` | Press Start 2P | — | Pixel face. Not used by any mockup. Do not use. |

`apps/www/src/index.css` sets `font-synthesis: none`. That rule stays for the website. IBM Plex Sans remains in the repository for the HUD and the current prototype. It is not a website face (OQ-02, resolved).

### 1.2 Canonical families (owner decision, OQ-01 and OQ-02 resolved)

- **Display:** TT Octosquares Condensed Black. Major headlines and display typography (`display-hero`, `display-1`, `display-2`, `heading-3`, `numeric-lg`). One family for the whole site. `font-family: "TT Octosquares Condensed"`; `font-weight: 900`; `font-stretch: normal`; `letter-spacing: -0.02em`. Weight 900 is the Black face itself, not synthesized bold. Do not substitute another family. File: `website/fonts/tt-octosquares/TT-Octosquares-Trial-Condensed-Black.ttf` (trial; internal name `TT Octosquares Trl Cnd`).
- **Body/UI:** Roboto Regular. Body text, navigation, labels, buttons, metadata, tables, and supporting UI text. `font-family: "Roboto"`; `font-weight: 400`. File: `website/fonts/roboto/roboto-latin.woff2` (latin-ext loaded with it). Only Regular is loaded. Do not add Roboto 500 or 600. Do not use Inter. Do not use Barlow Condensed. Do not use IBM Plex Sans for the website typography system.
- **Mono:** JetBrains Mono. Unchanged. Contract address in the `$CORP` chip, once deployed, and wallet addresses in the Rating table.

Mockup headlines are uppercase and heavy, and the drawn face varies slightly between frames. Those frame-to-frame differences stay generation artifacts. They do not choose the family. The family is TT Octosquares Condensed.

### 1.3 Family tokens

| Token | Value | Status |
|---|---|---|
| `--site-font-display` | `"TT Octosquares Condensed"` | CANONICAL (OQ-01). Weight 900, `font-stretch: normal`, `letter-spacing: -0.02em`. No fallback family. |
| `--site-font-body` | `"Roboto", system-ui, sans-serif` | CANONICAL (OQ-02). `website/fonts/roboto/roboto-latin.woff2`, weight 400 only. |
| `--site-font-mono` | `'JetBrains Mono', ui-monospace, monospace` | VERIFIED. |

`font-synthesis: none` on the website. No synthetic bold, no synthetic italic.

Numbers in tables, countdowns, levels and weights use `font-variant-numeric: tabular-nums`.

### 1.4 Type scale

Desktop = 1440 reference. Mobile = 390 reference. Between them scale fluidly (`clamp()`), never step abruptly inside a single breakpoint band.

| Role | Family | Weight | Desktop size / line-height | Mobile size / line-height | Letter-spacing | Case | Max width / wrapping | Used by |
|---|---|---|---|---|---|---|---|---|
| `display-hero` | display (TT Octosquares Condensed) | 900 | ≈76 px / 0.95 | ≈44 px / 0.95 | −0.02em | UPPER | 2 lines; ≈40% of container desktop, ≈82% of viewport mobile. `text-wrap: balance`. | Hero H1 |
| `display-1` | display (TT Octosquares Condensed) | 900 | ≈64 px / 0.95 (measured 58–72) | ≈38 px / 0.95 | −0.02em | UPPER | 2 lines typical; ≈45% container desktop, full column mobile | Section H2 (Game, Industries, Buildings, Agents, Economy, Final CTA), page H1 (Rating, Leaderboard) |
| `display-2` | display (TT Octosquares Condensed) | 900 | ≈40 px / 1.0 | ≈28 px / 1.0 | −0.02em | UPPER | 2 lines max | Secondary display headings (Industries secondary heading slot, Rating "How Influence is counted" heading slot) |
| `heading-3` | display (TT Octosquares Condensed) | 900 | ≈24 px / 1.1 | ≈20 px / 1.1 | −0.02em | UPPER | 1–2 lines | Economy panel column titles (flow / rules), Leaderboard card titles, building name, role name |
| `heading-4` | body (Roboto) | 400 | ≈18 px / 1.3 | ≈16 px / 1.3 | 0 | Sentence | 1–2 lines | Game step titles ("Get Capital."), card titles |
| `body-lg` | body (Roboto) | 400 | ≈18 px / 1.5 | ≈15 px / 1.5 | 0 | Sentence | ≈560 px (≈35–40% container) | Hero subtitle, block intro paragraphs |
| `body` | body (Roboto) | 400 | 16 px / 1.6 | 15 px / 1.55 | 0 | Sentence | 60–72ch | Standard paragraphs |
| `body-sm` | body (Roboto) | 400 | 14 px / 1.5 | 13 px / 1.5 | 0 | Sentence | column width | Card body, table notes, rule descriptions |
| `caption` | body (Roboto) | 400 | 12 px / 1.45 | 12 px / 1.45 | 0 | Sentence | column width | Captions ("Weights, not payouts…"), risk microcopy, footnotes |
| `label` | body (Roboto) | 400 | 12 px / 1.2 | 11 px / 1.2 | 0.08em | UPPER | 1 line | Column titles, chip labels, table headers, clock labels |
| `eyebrow` | body (Roboto) | 400 | 12 px / 1.2 | 11 px / 1.2 | 0.14em | UPPER | 1 line, preceded by a 32 px hairline rule | Breadcrumbs on subpages; landing eyebrow slot only per OQ-10 |
| `nav` | body (Roboto) | 400 | 12–13 px / 1 | — (menu) | 0.12em | UPPER | 1 line | Header nav |
| `button` | body (Roboto) | 400 | 13–14 px / 1 | 14–15 px / 1 | 0.06em | UPPER | 1 line, never wraps | All pill buttons |
| `metadata` | body (Roboto) | 400 | 12 px / 1.3 | 12 px / 1.3 | 0.02em | Sentence | 1 line | Token chip text, schedule chips |
| `numeric-lg` | display (TT Octosquares Condensed) | 900 | ≈40 px / 1 | ≈32 px / 1 | −0.02em | — | tabular | Countdown digits, agent level number |
| `numeric` | body (Roboto) | 400 | 15 px / 1.3 | 14 px / 1.3 | 0 | — | tabular | Table figures (Influence, Day GDP, Weight) |
| `table` | body (Roboto) | 400 | 14–15 px / 1.4 | 13–14 px / 1.4 | 0 | — | cells nowrap for numbers | Rating/Leaderboard tables |
| `tooltip` | body (Roboto) | 400 | 13 px / 1.45 | 13 px / 1.45 | 0 | Sentence | max 280 px | Tooltips |
| `mono` | mono | 400 | 13–14 px | 13 px | 0 | — | truncate middle (`0x6B…C41`) | Addresses |

Rules:

1. Display headings are always uppercase via CSS `text-transform`, not by retyping copy. Source copy stays in documented case.
2. Headline line breaks come from width constraints, not `<br>`. Where the mockup breaks after a period ("RUN THE MACHINE. / MAKE IT WORK."), the max-width token produces that break at the reference viewport; visual QA verifies.
3. Bold inside body copy (Industries "all bold black text", Agents "bold white text") is the **accent-recolor target** of that block (see §2.5). No other block recolors bold.
4. No text below 12 px. Mockup micro-text (Rating mobile "How to climb faster" ≈9 px) is raised to 12 px minimum (DC-noted in `RESPONSIVE_SYSTEM.md`).
5. Display roles use TT Octosquares Condensed Black only: weight 900, `font-stretch: normal`, `letter-spacing: -0.02em`. That weight is the face itself. Do not substitute another display family. Body/UI roles use Roboto Regular only: weight 400. Do not add Roboto 500 or 600. Do not synthesize.

---

## 2. Color system

Tokens use the `--site-*` namespace to avoid collision with HUD tokens (`--hud-tone-*`) and the obsolete prototype variables (`--bg`, `--panel`, `--cyan` in `apps/www/src/index.css`, DC-50).

### 2.1 Light (default theme)

| Token | Value | Status | Evidence |
|---|---|---|---|
| `--site-bg-light` | `#F4F6F9` | APPROXIMATE | Game `#F4F5F9`, Rating `#F3F9FA` flat areas |
| `--site-sky-fallback` | `#9CCFF8` | APPROXIMATE | Hero sky top `#94CEFC`; used only as background-color under loading art |
| `--site-surface` | `#FFFFFF` | APPROXIMATE | cards, tables |
| `--site-surface-glass` | `rgba(255,255,255,0.72)` | APPROXIMATE | Game step cards, Industries selector, Economy panel over sky |
| `--site-surface-elevated` | `#FFFFFF` + `--site-shadow-card` | APPROXIMATE | countdown box, chooser |
| `--site-text-primary` | `#0B0F14` | APPROXIMATE | headings sampled `#000000`–`#0E131A` |
| `--site-text-secondary` | `#3A4049` | APPROXIMATE | hero subtitle sampled `#3A4049` |
| `--site-text-muted` | `#6B7380` | APPROXIMATE | captions, table notes |
| `--site-text-inverse` | `#FFFFFF` | — | text on CTA |
| `--site-border` | `rgba(11,15,20,0.12)` | APPROXIMATE | card and table borders |
| `--site-border-subtle` | `rgba(11,15,20,0.07)` | APPROXIMATE | row dividers |
| `--site-border-active` | `#0B0F14` | APPROXIMATE | secondary button outline, active tab underline |
| `--site-chip-border` | `#9DB7D3` | APPROXIMATE | `$CORP · Contract TBA` chip outline (blue-grey) |
| `--site-input-bg` | `rgba(255,255,255,0.85)` | APPROXIMATE | "Find a wallet" field |

### 2.2 Dark (Buildings, Agents only)

| Token | Value | Status | Evidence |
|---|---|---|---|
| `--site-dark-bg` | `#0C151B` | APPROXIMATE | Agents `#091117`, Buildings `#10181E` (one token; difference is LOW precision) |
| `--site-dark-surface` | `#121C24` | APPROXIMATE | agent panel card (mobile), thumbnails |
| `--site-dark-text-primary` | `#FFFFFF` | VERIFIED by doc ("весь текст белый") | |
| `--site-dark-text-secondary` | `#C8D0D8` | APPROXIMATE | body copy |
| `--site-dark-text-muted` | `#8793A0` | APPROXIMATE | labels |
| `--site-dark-border` | `rgba(255,255,255,0.12)` | APPROXIMATE | panel dividers, thumbnail borders |
| `--site-dark-border-active` | current role/industry accent | — | selected thumbnail / role card |

### 2.3 Interaction

| Token | Value | Status |
|---|---|---|
| `--site-cta-bg` | `#151A21` (sampled `#181E25`) | APPROXIMATE |
| `--site-cta-bg-hover` | `#262D36` | PROVISIONAL |
| `--site-cta-bg-active` | `#000000` | PROVISIONAL |
| `--site-cta-text` | `#FFFFFF` | APPROXIMATE |
| `--site-secondary-border` | `#151A21` 1.5 px | APPROXIMATE |
| `--site-secondary-bg-hover` | `rgba(11,15,20,0.06)` | PROVISIONAL |
| `--site-cta-on-dark-bg` | `#0B1116` with `rgba(255,255,255,0.45)` 1 px border | APPROXIMATE (Buildings mobile fixed bar) |
| `--site-selected` | block accent (§2.4, §2.5) | — |
| `--site-disabled-opacity` | `0.4` | PROVISIONAL |
| `--site-success` | `#1BB920` | APPROXIMATE (Rating "You" chip, climb-step numbers, leaderboard row marker) |
| `--site-info` | `#2F6FEB` | APPROXIMATE (Economy info-note icon) |
| `--site-warning` | `#F5A524` | PROVISIONAL (no mockup use except Economy "40% burned" which is section-specific) |
| `--site-danger` | `#E5484D` | PROVISIONAL (error states only; no mockup evidence) |
| `--site-focus` | `#2F6FEB`, 2 px outline, 3 px offset | PROVISIONAL (repository convention: visible `:focus-visible` outline) |

### 2.4 Industry accents (Industries block, industry chips elsewhere)

Colour **names** are documented (README, copy §3). Hex values are sampled from the mockup and are APPROXIMATE. Automation and Finance are **swapped in the mockup** (DC-12): the documented mapping wins.

| Industry | Doc colour | Token | Value | Mockup evidence |
|---|---|---|---|---|
| Compute | green | `--site-ind-compute` | `#33E01F` | sampled on Compute button |
| Energy | red | `--site-ind-energy` | `#FF0014` | sampled |
| Logistics | orange | `--site-ind-logistics` | `#FD9B00` | sampled |
| Consumer | violet | `--site-ind-consumer` | `#6B01FD` | sampled |
| Automation | turquoise | `--site-ind-automation` | `#00D3FE` | mockup shows this turquoise on **Finance** |
| Finance | blue | `--site-ind-finance` | `#006FFE` | mockup shows this blue on **Automation** |

Text-on-light contrast: green/orange/turquoise text on white fails WCAG AA. A darker `-ink` variant per industry for text use is required but not evidenced (DC-55, OQ-40). Until decided, accent tokens are used for borders, dots, glows, underlines and fills; recolored bold text uses the accent as documented and is flagged in QA.

### 2.5 Role accents (Agents block)

| Role | Doc colour | Token | Value | Status |
|---|---|---|---|---|
| Engineer | orange | `--site-role-engineer` | `#F28C28` | APPROXIMATE (doc says orange; mockup yellow `#FFC82D` is wrong, DC-16; hue cross-checked with `Engineer.png` suit `#CC7711`) |
| Logistician | blue | `--site-role-logistician` | `#3D6BD9` | APPROXIMATE (from `Logistician.png` `#3355AA`, brightened for dark bg) |
| Trader | violet | `--site-role-trader` | `#9B5CFF` | PROVISIONAL |
| Scientist | turquoise | `--site-role-scientist` | `#1FC8C8` | PROVISIONAL |
| Manager | white | `--site-role-manager` | `#FFFFFF` | VERIFIED by doc |

### 2.6 Accent mechanics (global pattern)

One CSS custom property per stateful block, `--block-accent`, is set on the block root from data (industry or role). Every accent consumer (selected button border, glow, bold text, bar fill, level segment, underline) reads `--block-accent`. Blocks never hardcode an industry or role hex.

---

## 3. Spacing

Base unit 4 px. One scale for the whole site.

| Token | px | Use |
|---|---|---|
| `--site-space-1` | 4 | micro: icon–label gap in chips |
| `--site-space-2` | 8 | control inner gap, chip gap |
| `--site-space-3` | 12 | text-to-text (label→value), tab icon gap |
| `--site-space-4` | 16 | card padding (compact), button group gap (mobile) |
| `--site-space-5` | 24 | card padding (standard), paragraph→control |
| `--site-space-6` | 32 | card gap, heading→body |
| `--site-space-7` | 48 | column gap, body→CTA group |
| `--site-space-8` | 64 | sub-section gap inside a block |
| `--site-space-9` | 96 | section padding (desktop) |
| `--site-space-10` | 128 | hero top offset (desktop, incl. header) |

Semantic aliases:

| Alias | Desktop | Mobile | Evidence |
|---|---|---|---|
| `--site-section-y` | 96 px | 56 px | APPROXIMATE; blocks are full-viewport compositions on desktop (Hero, Industries, Buildings, Agents, Economy) |
| `--site-page-top` (subpages) | header + 48 px | header + 24 px | Rating/Leaderboard eyebrow ≈ 60 px below header |
| `--site-page-bottom` | 96 px before footer | 56 px | |
| `--site-heading-to-body` | 24 px | 16 px | Hero H1→subtitle ≈ 28 px at 1440 |
| `--site-body-to-cta` | 48 px | 32 px | Hero subtitle→buttons incl. Robinhood slot |
| `--site-card-pad` | 24 px | 16–20 px | Game cards, Economy panel |
| `--site-card-gap` | 16–24 px | 12–16 px | Game step cards ≈ 20 px, synergy cards ≈ 18 px |
| `--site-column-gap` | 48 px | — (stacked) | Economy panel columns, Agents panel columns |

Blocks may not introduce spacing values outside this scale. If a mockup relationship cannot be met, the nearest token is used and the delta is reported by visual QA.

---

## 4. Containers

| Token | Value | Evidence |
|---|---|---|
| `--site-container-max` | 1296 px | content spans ≈4.7%–95.3% of width in Hero, Game, Industries, Economy, Rating, Leaderboard mockups → 1440 − 2×72 |
| `--site-gutter-desktop` | `clamp(40px, 5vw, 72px)` | ≈5% gutter measured |
| `--site-gutter-tablet` | 36 px | repository `@media (max-width:1150px)` uses `calc(100% - 72px)` |
| `--site-gutter-mobile` | 24 px (20 px ≤380 px) | mockups ≈7–8% (≈28–30 px @390); repository uses 20 px ≤700 and 16 px ≤380 → 24/20 is the reconciled value; QA confirms |
| `--site-reading-max` | 640 px | long paragraphs (Rating/Leaderboard explanations) |
| `--site-hero-copy-max` | 40% of container (≈560 px) | Hero H1/subtitle |

Full-bleed rules:

- **Background art** (Hero, Industries sky, Economy sky, Footer) is full-bleed (100vw), content sits in the container.
- **Dark blocks** (Buildings, Agents) are full-bleed backgrounds; content in container.
- **Artwork bleed:** Hero island may extend under the right gutter; Economy art may extend to the right viewport edge; nothing else bleeds.
- **Full-viewport:** Hero is `min-height: 100svh` (desktop mockup 1586×992 = 16:10 viewport, header included). Industries, Buildings, Agents, Economy are designed as ≈one-viewport compositions on desktop but must grow with content (never clip).

---

## 5. Grid

- Desktop: 12 columns inside `--site-container-max`, column gap 24 px. Block zones are expressed as spans:
  - Hero: copy 5 cols, art 7 cols (art layer is background, see block contract).
  - Industries: intro 6 / beacon art 6; secondary row: text 4 / synergy cards 8.
  - Buildings: copy 4 / preview 5 / details+rail 3.
  - Agents: copy 4 / portrait 4 / panel 4; selector row centered 8.
  - Economy: copy 5 / art 7; tab panel 12 split into 3 inner columns ≈ 5 / 4 / 3 (flow / middle / rules), divided by hairlines.
  - Game: copy 6; step cards 12 as 4 unequal cards (step 3 wider, ≈ 3 / 3 / 3.5 / 2.5 → implement as flexible `grid-template-columns` with fractional weights, APPROXIMATE).
  - Rating / Leaderboard: single column 12 (Leaderboard doc: "одна колонка"); factor cards 4×3.
- Tablet (701–1150): 8 columns, desktop compositions compressed; block-specific fallbacks in `RESPONSIVE_SYSTEM.md` (PROVISIONAL, OQ-31).
- Mobile (≤700): 4 columns, single content column; artwork full column width or bleeding to viewport edges where mockup shows it.

---

## 6. Radius

| Token | Value | Use | Evidence |
|---|---|---|---|
| `--site-radius-xs` | 6 px | small icon tiles, economy asset icons | APPROXIMATE |
| `--site-radius-sm` | 8 px | inputs, table container, thumbnails, selector tiles | Rating table, building thumbs |
| `--site-radius-md` | 12 px | cards (Game steps, synergy cards, factor cards) | APPROXIMATE |
| `--site-radius-lg` | 16 px | large panels (Economy tab panel, countdown box, agent panel mobile) | APPROXIMATE |
| `--site-radius-pill` | 999 px | buttons, token chip, industry chips, trait chips, toggles | all mockups |
| `--site-radius-modal` | 16 px | modal, View 3D studio | PROVISIONAL |
| `--site-radius-image` | 0 (art is unframed) / 12 px inside cards | art is never boxed except inside cards | |

---

## 7. Borders

| Token | Value | Use |
|---|---|---|
| `--site-border-w` | 1 px | default card, table, chip, divider |
| `--site-border-w-strong` | 1.5 px | secondary button, selected tile |
| `--site-border-w-active` | 2 px | selected industry button, selected building thumb, selected role card, active tab underline |
| default | `--site-border` | light cards |
| subtle | `--site-border-subtle` | table rows, column hairlines |
| active | `--site-border-active` | tab underline (light) |
| selected | `--block-accent` | stateful selections |
| divider | 1 px `--site-border-subtle` (light) / `--site-dark-border` (dark); vertical hairlines between panel columns | Economy, Agents, Leaderboard cards |

---

## 8. Effects

Only effects evidenced by mockups or documentation.

| Token | Value | Use | Status |
|---|---|---|---|
| `--site-shadow-card` | `0 1px 2px rgba(11,15,20,.04), 0 8px 24px rgba(11,15,20,.06)` | light cards over sky | APPROXIMATE |
| `--site-backdrop-glass` | `blur(12px) saturate(1.1)` behind `--site-surface-glass` | cards/panels over sky art | APPROXIMATE; disable where `backdrop-filter` unsupported (fallback: opaque 0.9 white) |
| `--site-glow-selected` | `0 0 0 1px var(--block-accent), 0 0 24px color-mix(in srgb, var(--block-accent) 35%, transparent)` | selected role card, selected building thumb, selected industry button | APPROXIMATE |
| `--site-blur-locked` | `blur(8px)` on content + `rgba(255,255,255,.35)` veil | Leaderboard closed table (**documented**) | VERIFIED behavior, APPROXIMATE value |
| hover lift | none (no mockup evidence) | — | Do not add |

Forbidden: parallax, animated gradients, neon glows on light sections, drop shadows on display text.

---

## 9. Motion

| Token | Value | Use |
|---|---|---|
| `--site-dur-hover` | 150 ms | colour/border changes on hover |
| `--site-dur-press` | 100 ms | active press |
| `--site-dur-state` | 220 ms | tab content crossfade, industry/role state change (image crossfade + accent transition) |
| `--site-dur-modal` | 240 ms in / 180 ms out | modal, chooser, mobile menu |
| `--site-ease` | `cubic-bezier(0.2, 0, 0, 1)` | all |

Rules:

- State change = opacity crossfade of the changing layer (art, panel content). No slide, no scale, no stagger.
- Anchor scroll smooth unless reduced motion (repository `App.tsx` already checks `prefers-reduced-motion`).
- `prefers-reduced-motion: reduce` → all durations 0, crossfades become instant swaps, 3D viewer does not auto-rotate. Repository `index.css` already contains a global reduced-motion rule; keep it.
- Countdown digits update without animation.

---

## 10. Iconography

- Library: `lucide-react` (VERIFIED: resolved via `apps/www/vite.config.ts` alias to root `node_modules/lucide-react`; used by the current prototype). Stroke icons 1.5–2 px, 16–20 px, colour = current text colour.
- Uses in mockups that map to Lucide: eye (View 3D), arrows (→, ←), home, wrench, zap, factory, dollar/briefcase/log-out/trophy (Economy tabs), clock, percent, globe, calendar, lock, gift, info, search, help-circle (tooltips), menu (hamburger), X logo (social).
- **Project assets override icons** wherever the documentation names an image (economy flow/rule images, stock logos, building avatars). Do not substitute a Lucide icon for a documented image.
- X (Twitter) mark: not in Lucide as brand; use an inline SVG of the X mark only if the owner supplies/approves it (OQ-05). Until then text link "X".

---

## 11. Brand marks

| Mark | Source | Status |
|---|---|---|
| Corporator hexagon "C" mark | `website/industries-cut/mark.png` (96×110, transparent), `apps/client/assets/hud/brand/mark.png` (128×128, transparent), `website/logo solo.png` (1254², opaque, with "$CORP") | VERIFIED raster; no vector (OQ-03) |
| "CORPORATOR" wordmark | typeset in TT Octosquares Condensed; no asset file | OQ-03 |
| `$CORP` coin | `website/design-refernces/economy/assets/CORP.png` | for Economy only |
| Robinhood Chain logo | `Robinhood_Chain_Logo_Black.svg` from the official v1 brand zip. Unmodified. Hero on light sky uses the black wordmark. No text placeholder. Do not redraw, recreate, distort, or recolor. Feather avatar is not this logo. | OQ-04 resolved. Caption vs brand rules: DC-59 |
| Stock logos | `website/stock-logos/*` | Industries, Leaderboard weights panel |

---

## 12. Token governance

1. Tokens live in one file in the implementation (`apps/www/src/styles/tokens.css` recommended; see `IMPLEMENTATION_GUIDELINES.md`).
2. APPROXIMATE values may be tuned only through visual QA against the mockups, and the change is written back into this file.
3. PROVISIONAL values change only after the linked OQ is answered.
4. A block agent that needs a value not in this file raises a GLOBAL CHANGE (see `IMPLEMENTATION_GUIDELINES.md` §Change control); it does not add a local literal.
