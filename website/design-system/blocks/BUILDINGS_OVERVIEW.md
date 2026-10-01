# BUILDINGS — Master Block Contract

Route `/`, id `buildings`. References: `buildings_desktop.png`, `buildings_mobile.png`. Copy §"Блок 4". README §Buildings. Data: `content/params/buildings.json` (18 ids).

# Purpose
Show all 18 functions of the island without prices and with a clear "why", with a way to inspect each building in 3D.

# Documentation Truth
- Heading variants: "18 buildings, each with a job" · "The buildings are built. The functions are yours to switch on." · "Same island, 18 functions to run". Intro paragraph verbatim.
- Tabs: **All 18 · Base · Industry · Synergy**. Button **View 3D**.
- Schedule labels: Always (00:00–24:00) · Office (08:00–20:00, closed on city Sunday) · Market (08:00–20:00, closed on Sunday) · Retail (09:00–21:00, open on Sunday).
- Chips/tooltips: "Autonomous: works without an agent" / "Prebuilt: active from the start" / "Home role: the agent role that works here at full strength".
- Locked labels: "Needs City Level 2" (Exchange) · "Needs both industries" (synergies).
- Card per building: chips on top (layer, home role, hours) + Role / Levels / Tip (verbatim, 18 entries in COPY §4 Base / Industry / Synergy).
- Dark block, all text white. No "View all buildings". No "1/16". 18 buildings. Centre: preview of the selected building from `website/buildings-avatars`; right: switcher with thumbnails from the same folder.
- View 3D opens a studio window; the model can be rotated. Models: `.glb` in `models/`, not `island*`, not `_experimental`. Neon Residence excluded.

# Desktop Visual Truth
Dark full-bleed. Three zones: copy left (≈4.5–33%: H2 2 lines, 2-line body), large preview centre (≈35–58% width, ≈19–75% height), details right (≈63.5–85%: logo row, name, category, 2-line text, View 3D eye button) and a vertical rail of 3 thumbnails at the far right (≈8%×10% each) with ←/→ above.

# Mobile Visual Truth
Header → copy (H2 ≈11–18.5% height, body 2 lines) → preview centred (≈32–65% width, ≈29–56% height) → details (logo row, name, category, text, View 3D) → ←/→ → horizontal rail of 3 thumbs (≈26% width each, ≈81.5–90.5% height) → fixed Play Now bar (dark fill, light border).

# Layout
```
Section(theme=dark, id=buildings)
 └─ Container
     Copy(H2, intro)
     BuildingTabs (All 18 · Base · Industry · Synergy)   ← documented, not in mockup
     BuildingStage(selected preview)
     BuildingDetails(chips, name, category/pair, Role, Levels, Tip, schedule, locked label, View 3D)
     BuildingRail(thumbnails of active category, orientation: vertical | horizontal, prev/next)
 ModelStudio (Modal)
```
Interpretation (confirm OQ-15): tabs sit under the intro in the copy column on desktop and above the preview on mobile; the details column shows chips → name → category/pair → Role → Levels → Tip → View 3D.

# Components
Heading `display-1` (dark), BodyCopy, Tabs `underline-dark`, BuildingStage (image `contain`, crossfade), InfoChip, LockBadge, Tooltip, IconButton `circle-outline` + label (View 3D), BuildingRail (thumb 1:1 tiles, radius sm, 1 px dark border; selected 2 px border + glow), IconButton arrows, Modal (ModelStudio).

# State Model
`activeCategory` (default `all`), `selectedBuilding` (default first in category, OQ-15), `viewerOpen`, `viewerStatus` (idle/loading/ready/error). Category change keeps selection if the building belongs to it; else selects the first. Prev/next wrap within the active category.

# Data Model
`data/buildings.ts`: 18 × `{ id, name, category, industry | pair, homeRole | autonomous, prebuilt, schedule, lockedLabel?, role, levels, tip, avatar, model }` in COPY order (City Hall, Workshop, Agent Hub, Power Node, Bank, Exchange; AI Research Center, Energy Plant, Logistics Hub, Flagship Store, Cloud Campus, Finance Tower; Robotics Lab, Drone Depot, Data Center, Fleet Yard, Retail Complex, Clearing House). Ids must equal `content/params/buildings.json` keys.

# Assets
Previews come only from `website/buildings-avatars/` (the documented filename, including `Agent Hub.png`, `Robotics Lab.png`, `clearing house.png`). The near-black plate is cropped in place; originals are copied aside before overwrite. Do not use `website/agents-cut/buildings/`. `Neon Residence.png` stays out of the block and is not cropped. Models remain the 18 named files in `models/`; the page does not load a GLB until OQ-16 and OQ-17. Excluded: Neon Residence, island folders, `_experimental`.

# Typography
H2 `display-1` white. Intro uses the existing `type-body-lg` on `--site-dark-text-secondary`. The earlier word `body` is a recorded deviation, not a new style. Name is the live `heading-3` (the token cap stays 24 px; do not raise it to 32 px). Category `label`. Role / Levels / Tip labels `label`, text `body-sm`. Chips `metadata`.

# Color / Accent
Dark tokens. No block accent and no `--site-glow-selected`. Selected thumbnail: white 2 px border.

# Spacing
Use the live `--site-*` tokens. Do not write the contract numbers 96, 1296, or 32 into CSS; those tokens are already multiplied by `--site-scale`. Zone proportions come from the desktop frame, not the 4 / 5 / 3 grid.

# Interaction
Own tablist on the existing `underline-dark` classes. Do not rebuild the shared Tabs component. Rail is a listbox. Arrow labels: "Previous building" and "Next building". No counter. View 3D is drawn and does not open a studio or load a GLB until OQ-16 and OQ-17.

# Responsive Transformation
3 zones → stack; vertical rail → horizontal rail; tabs scroll if needed; ModelStudio full screen on mobile with touch orbit/pinch; fixed Play Now (onDark).

# Visual Fidelity Priorities
HIGH: dark band, preview scale and centring, details column position, rail position/orientation, View 3D affordance. MEDIUM: thumb size, name size, tabs placement. No glow.

# Known Conflicts
DC-01, DC-03, DC-06, DC-07, DC-08, DC-09, DC-10.

# Open Questions
OQ-09, OQ-13, OQ-14, OQ-15, OQ-16, OQ-17, OQ-34 (Exchange partial), OQ-35.

# Implementation Constraints
No prices, costs or tier prices anywhere. Load GLB only on View 3D; dispose on close. Never read `models/` by glob. 18 entries exactly; a test asserts the count and the preview/model mapping.
