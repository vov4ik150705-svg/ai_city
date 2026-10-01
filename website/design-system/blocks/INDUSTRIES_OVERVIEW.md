# INDUSTRIES — Master Block Contract

Route `/`, id `industries`. References: `industries-desktop.png`, `industries-mobile.png` (Compute state only). Copy §"Блок 3". README §Industries. Data: `content/params/districts.json` (`districts.*.beacon`, `synergies`).

# Purpose
Show the six industry branches and how industry pairs unlock synergy buildings — one stateful block driven by the selected industry.

# Documentation Truth
- Heading variants: "Six industries, six Stock Tokens" · "Each industry opens a branch of the city" · "Pick your industries. Pairs open more." (mockup: v1).
- Two paragraphs (verbatim): "External Stock Tokens open six industry branches…" and "Market conditions move industry efficiency between 85% and 115%…".
- Six industry cards (Compute · NVDA … Finance · COIN) with description and *Pairs with* (COPY §3 "Карточки").
- Plaques: Access, Choices, Merge, Unstake (verbatim).
- Button **See what it opens**; tooltips Stock Token and Tier nodes; caption "A ticker identifies the token. It does not describe all of its rights. Check each issuer's terms."
- Six clickable industry buttons; default **Compute**. Click changes: beacon island, Works with, Example Synergies, colour of all bold black text, selected button colour.
- Colours: Compute green, Energy red, Logistics orange, Consumer violet, Automation turquoise, Finance blue.
- Buttons and synergy cards: original logo from `website/stock-logos` + industry name, **no ticker** in the same frame.
- Main art: background `website/design-refernces/industries/assets/sky2.png`, beacon island of the selected industry on top.
- Synergy images from `website/buildings-avatars`; pair logos + names on each card.
- Tabs "Industries · Tiers · Merges" remain.

# Desktop Visual Truth
Sky full-bleed. Top row: copy left (H1 2 lines ≈41% width, 2-line body) / beacon island right (≈55–80% width, top ≈8–48% height). Full-width glass selector strip (≈5% height) with 6 equal tiles, selected tile accent-bordered with glow. Below: left column (≈30%) caption line, secondary heading slot, body, "Works with" chips; right (≈59%) 3 synergy cards (avatar on cloud, name, pair row, one-line role). Bottom: centred 3 tabs and a 4-column info strip.

# Mobile Visual Truth
Copy → beacon centred (≈70% width) → horizontally scrolling selector (≈5.5 tiles, chevron, dots) → caption → secondary heading slot → body → Works with chips (wrap) → Example Synergies media-row cards → 3 tabs → 2×2 info grid.

# Layout
```
Section(theme=sky, id=industries, --block-accent from state)
 ├─ ArtLayer sky2.png
 └─ Container
     Intro(H2 + 2 paragraphs)        | BeaconStage(beaconArt)
     IndustrySelector (6 tiles, tablist)
     SelectedCaption                 | SynergyCards (1–3)
     SecondarySlot (OQ-11)           |
     WorksWith chips                 |
     IndustryInfoTabs (Industries · Tiers · Merges) + InfoStrip (OQ-11)
```

# Components
Heading `display-1`, BodyCopy, ArtLayer, BeaconStage (fixed-height stage, `contain`, bottom-anchored, crossfade), SegmentedControl skin IndustrySelector, IndustryChip, SynergyCard (`solid`/`feature` desktop, `media-row` mobile), Tabs `underline`, InfoStrip columns, Tooltip, Button (See what it opens — destination unknown, OQ-12).

# State Model
`activeIndustry` (default `compute`), `activeInfoTab` (default `industries`). Derived per state:

| Industry | Beacon file | Works with | Example Synergies (building · pair) |
|---|---|---|---|
| Compute | `AI-RESEARCH-CENTER.png` | Energy, Logistics, Automation | Robotics Lab (Compute+Energy), Drone Depot (Compute+Logistics), Data Center (Compute+Automation) |
| Energy | `ENERGY-PLANT.png` | Compute, Logistics | Robotics Lab (Compute+Energy), Fleet Yard (Energy+Logistics) |
| Logistics | `LOGISTICS-HUB.png` | Compute, Energy, Consumer | Drone Depot (Compute+Logistics), Fleet Yard (Energy+Logistics), Retail Complex (Consumer+Logistics) |
| Consumer | `FLAGSHIP-STORE.png` | Logistics | Retail Complex (Consumer+Logistics) |
| Automation | `CLOUD-CAMPUS.png` | Compute, Finance | Data Center (Compute+Automation), Clearing House (Automation+Finance) |
| Finance | `FINANCE-TOWER.png` | Automation | Clearing House (Automation+Finance) |

Works with and Synergies are **computed from `synergies` data** (documented rule: "Works with" = the other industry of each synergy containing the selected one); the table above is the expected output and doubles as a test oracle. Card count varies 1–3: the synergy row keeps card width and left-aligns (no stretching a single card to full width).

# Data Model
`data/industries.ts` (id, name, ticker [not rendered with logo], logo, accentToken, beaconArt, cardText, pairsWith) and `data/synergies.ts` (mirrors `content/params/districts.json` → `synergies`; building id, requires pair, avatar). A unit test may assert the site data equals the pack's synergy pairs.

# Assets
Sky + 6 beacons in `website/design-refernces/industries/assets/`; 6 logos in `website/stock-logos/`; 6 synergy avatars in `website/buildings-avatars/` (note `clearing house.png`). See ASSET_MANIFEST §5.

# Typography
H2 `display-1`; paragraphs `body-lg`/`body`; tile name `label`; caption line `label` + `body-sm`; secondary heading `display-2`; synergy name `heading-3`; pair names `label` in industry accent; info strip title `label`, text `body-sm`.

# Color / Accent
`--block-accent = --site-ind-<active>`. Consumers: selected tile border/glow/tint, accent dots, `<strong>` text in block, Works-with chip dots, active info-tab underline. Pair names on synergy cards use **their own** industry accent (mockup: "COMPUTE" green, "ENERGY" red). Documented mapping; mockup Automation/Finance swap ignored (DC-12).

# Spacing
Intro→selector 32 px; selector→lower area 32 px; lower columns gap 48 px; synergy card gap 16–24 px; lower area→tabs 48 px; tabs→strip 16 px.

# Interaction
Click/tap or arrow keys on the selector change `activeIndustry`; crossfade beacon (220 ms) after image decode; accent transitions 220 ms. No auto-rotation of industries. Tabs switch info panel. Preload the 5 other beacons after first paint (idle).

# Responsive Transformation
See RESPONSIVE_SYSTEM §4 Industries. Beacon moves above the selector; selector scrolls horizontally with snap; synergy cards → media rows; strip → 2×2.

# Visual Fidelity Priorities
HIGH: beacon scale/position per state, selector strip proportions and selected-state treatment, 3-card synergy row, state correctness (table above). MEDIUM: chip sizes, secondary text widths, tab/strip spacing. LOW: glow radius, cloud overlap.

# Known Conflicts
DC-01, DC-02, DC-11, DC-12, DC-13, DC-14, DC-10 (avatars on white cards), DC-55.

# Open Questions
OQ-09, OQ-10, OQ-11, OQ-12, OQ-13, OQ-40.

# Implementation Constraints
Never infer relationships from the mockup — compute from data. Never render a ticker next to a logo. One `--block-accent`; no per-industry CSS classes with hardcoded hex. Keep the beacon baseline identical across the six differently-sized files.
