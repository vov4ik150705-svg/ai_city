# HERO — Master Block Contract

Route `/`, first block, id `hero`. References: `hero-desktop.png`, `hero-mobile.png`. Copy: COPY §"Блок 1. Hero" + §"Блок 0. Шапка". README §Hero.

# Purpose
Say in five seconds what the game is and let the visitor enter (Play Now) or learn (How it works). Also the canonical visual reference for the shared Header.

# Documentation Truth
- Headline: one of three variants — "Run the machine. Make it work." · "The island is built. The operation is yours." · "Find the next problem worth solving." (OQ-09; mockup shows variant 1).
- Subtitle (verbatim): "A browser 3D city-management game on Robinhood Chain where you switch on the functions of an existing island and keep the work supplied."
- Buttons: **Play Now** (opens PlayChooser) and **How it works** (anchor to the core loop in Game).
- Under buttons: "Demo needs no wallet. No return is guaranteed. Read the risks." — "Read the risks" links to the disclaimer (target OQ-05).
- Facts strip as chips under the buttons: "18 buildings on one shared island" · "5 agent roles" · "6 industries, 6 Stock Tokens" · "Prizes are paid in Stock Tokens" (→ `/leaderboard`).
- Art: `website/arts/hero.png`, island full-screen; do not rebuild the island from the mockup.
- Robinhood: the official Robinhood Chain logo, unmodified, with the label "Robinhood chain". Use the real verified file once it is provided. Do not redraw, recreate, distort, or recolor it. Do not show "[Robinhood Chain logo]".

# Desktop Visual Truth
Full viewport (16:10). Sky art full-bleed behind header and content. Copy column left (≈4.7–44% width): H1 two lines (≈24–39% height, width ≈39%), 3-line grey subtitle (width ≈35%), Robinhood slot (≈14% wide), then two pill buttons (Play Now ≈12% wide, How it works ≈14.5%). Island right (≈44–96% width, ≈14–94% height), waterfalls down to the bottom edge, floating islets at the edges, sun flare top-left.

# Mobile Visual Truth
Header (logo · chip · hamburger). H1 two lines at ≈82% width starting ≈13.5% down; subtitle 3 lines; Robinhood slot; two buttons side by side; island below the buttons, full width (≈46–90% height); fixed Play Now bar at the bottom.

# Layout
```
Section(theme=sky, min-height 100svh)
 ├─ ArtLayer hero.png (full-bleed, focal: island)
 └─ Container
     └─ HeroCopy (max-width --site-hero-copy-max)
         H1 · Subtitle · RobinhoodMark · ButtonGroup · RiskMicrocopy · FactChips
```
Desktop: HeroCopy vertically starts ≈24% from top (≈216 px incl. header). Mobile: HeroCopy then ArtLayer stacked.

# Components
Header (global), Heading `display-hero`, BodyCopy `lg`, RobinhoodMark (image + caption), PrimaryButton `lg`, SecondaryButton `lg`, `caption` text with TextLink, FactChip ×4 (last is a Link), ArtLayer, MobilePlayBar (global).

# State Model
Static. Shell states only (PlayChooser open, menu open).

# Data Model
`data/hero.ts`: headline (chosen variant), subtitle, buttons, risk line, facts[4] `{ text, href? }`. Destinations from `data/destinations.ts`.

# Assets
`website/arts/hero.png` (1671×941, opaque). Official Robinhood Chain wordmark: `website/brand/robinhood-chain/robinhood-chain-brand-assets-v1/Robinhood Chain Brand Assets - V1/Robinhood Chain Logo/Robinhood_Chain_Logo_Black.svg` (transparent, black ink; PNG sibling 6567×863). Use that file unmodified. Do not use `Robinhood_Avatar.jpg`. Label remains "Robinhood chain" (DC-59). Brand mark — see ASSET_MANIFEST §1.

# Typography
H1 `display-hero` in TT Octosquares Condensed Black (`font-family: "TT Octosquares Condensed"`, weight 900, `font-stretch: normal`, `letter-spacing: -0.02em`, ≈76 px / 44 px). Subtitle `body-lg` in Roboto Regular, `--site-text-secondary`. Robinhood caption `caption` (Roboto Regular). Buttons `button` (Roboto Regular). Risk line `caption`. Facts `metadata`. Do not substitute another display face. Do not add another Roboto weight. Do not synthesize weights.

# Color / Accent
Light tokens. No accent. Primary CTA `--site-cta-bg`.

# Spacing
H1→subtitle `--site-heading-to-body`; subtitle→Robinhood 24 px; Robinhood→buttons 32–40 px; buttons gap 14 px; buttons→risk line 16 px; risk→facts 16 px; facts gap 8 px.

# Interaction
Play Now → PlayChooser. How it works → smooth scroll to core loop (instant under reduced motion). Fact chip 4 → `/leaderboard`. "Read the risks" → disclaimer.

# Responsive Transformation
Invariants: copy, order, two buttons, art file. Transformations: art stacks below content; nav → menu; Play Now duplicated in fixed bar; facts chips wrap. See RESPONSIVE_SYSTEM §4 Hero.

# Visual Fidelity Priorities
HIGH: full-viewport composition, H1 size/2-line break/position, island scale & position, CTA pair size/position, header. MEDIUM: subtitle width, Robinhood slot size, spacing. LOW: sun flare, cloud detail.

# Known Conflicts
DC-45 (facts + risk line absent in mockup; mockup placeholder logo is not used), DC-46 (art island position), DC-51 (resolved: TT Octosquares Condensed Black display, Roboto Regular body), DC-59 (official brand rules vs the caption and the sky).

# Open Questions
OQ-05, OQ-09, OQ-41. OQ-01, OQ-02 and OQ-04 are resolved.

# Implementation Constraints
Hero is the only `fetchpriority="high"` image. Never overlay text on the island. Never show "[Robinhood Chain logo]". Never redraw, recreate, distort, or recolor the Robinhood Chain logo. Header styling lives in the global Header, not in Hero. Headline is TT Octosquares Condensed Black; every other Hero text role is Roboto Regular.
