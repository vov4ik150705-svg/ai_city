# GAME — Master Block Contract

Route `/`, id `game` (target of nav "Game" and `/#game`), inner anchor for the core loop (target of Hero "How it works"). References: `game-desktop.png`, `game_mobile.png`. Copy §"Блок 2". README §Game.

# Purpose
Explain that the player operates an existing city, not builds it, and show the four-step core loop.

# Documentation Truth
- Heading variants: "A city to operate, not to build" · "Everything is already here. You decide what runs." · "The layout is finished. The work is not." (mockup: v1).
- Two paragraphs (verbatim COPY §2 "Текст").
- Core loop, 4 steps (verbatim titles and texts): 1 Get Capital · 2 Switch on and staff · 3 Supply the work · 4 Get paid, then decide.
- Two columns: *You do* / *You don't* (verbatim).
- Tooltips: Capital, Tick, Payroll (verbatim).
- UI: horizontal 4-step stepper (vertical on mobile), two columns. Step art: 01 `website/assets/logo_cloud_png.png`, 02 `website/assets/workshop_cloud_png.png`, 03 `website/assets/workshop_solo_cloud.png`, 04 `website/assets/bank_cloud_png.png`.
- Lower panels Overview, Agents, Bank, Industries = HUD screenshots; not available → placeholders.
- Caption "The HUD in the current build" is **not** written.

# Desktop Visual Truth
Light flat background with a cloud strip under the header. Copy column ≈38% wide: heading 2 lines, paragraph 1 (4 lines), paragraph 2 (2 lines). Step row full container width, four glass cards of unequal width (≈18 / 20.5 / 26.5 / 20%, art-driven) with "→" between; art sits on a cloud and overflows the card top; number disc + title + 3-line text. HUD placeholder row: Overview ≈35% + Agents / Bank / Industries ≈16–18% each, window-chrome dots, grey blocks.

# Mobile Visual Truth
Heading ≈65% width, paragraphs full width. Four media-row cards stacked (art left ≈40%, number + title + text right) with "↓" between. HUD placeholders 2×2.

# Layout
```
Section(theme=light, id=game)
 └─ Container
     Heading · BodyCopy×2
     CoreLoop (anchor)        4 × StepCard + 3 × Arrow
     DoDont                   two columns (documented; not in mockup)
     HudPlaceholders          4 frames
```
Placement of DoDont after the loop and before HUD placeholders follows documentation order (DC-47, Interpretation).

# Components
Heading `display-1`, BodyCopy, Card `feature` (desktop) / `media-row` (mobile), number disc (dark 28 px circle, `label` white), Arrow icon, Tooltip (inline terms Capital / Tick / Payroll), two-column text group, HudPlaceholder (Card with window dots and neutral blocks; no fake UI content, no labels other than the documented panel names).

# State Model
Static. Tooltips only.

# Data Model
`data/game.ts`: heading, paragraphs[2], steps[4] `{ n, title, text, art }`, doDont `{ do, dont }`, tooltips `{ capital, tick, payroll }`, hudPanels[4] `{ name, screenshot: null }`.

# Assets
Four step arts above (01, 02, 04 have alpha; 03 `workshop_solo_cloud.png` is opaque — verify on the card surface, OQ-13). HUD screenshots MISSING (OQ-08).

# Typography
Heading `display-1`; paragraphs `body`; step title `heading-4`; step text `body-sm`; HUD panel names `heading-4` small / `label`.

# Color / Accent
Light. No accent. Number discs `--site-cta-bg`.

# Spacing
Heading→body 24 px; paragraph gap 16 px; body→loop 48 px; card gap ≈24 px (arrows centred in the gap); loop→DoDont 64 px; →HUD 64 px.

# Interaction
Tooltips on the three terms. Arrows are decorative (`aria-hidden`). The loop is an ordered list semantically.

# Responsive Transformation
Horizontal stepper → vertical (documented); art left/text right; ↓ arrows; HUD 1+3 → 2×2; DoDont stacks.

# Visual Fidelity Priorities
HIGH: 4-step row composition, art scale on cloud overflowing card, card order, HUD row proportions. MEDIUM: card widths, text sizes, number disc. LOW: cloud strip under header, card shadow.

# Known Conflicts
DC-47 (caption removed; DoDont/tooltips added), DC-48 (eyebrow).

# Open Questions
OQ-08, OQ-09, OQ-10, OQ-13.

# Implementation Constraints
Do not invent HUD UI inside placeholders. Do not restore the caption. Step numbers 01–04 are documented core-loop numbering (allowed); they are not section numbering.
