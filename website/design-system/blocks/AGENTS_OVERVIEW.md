# AGENTS — Master Block Contract

Route `/`, id `agents`. References: `agents-desktop.png`, `agents-mobile.png` (Engineer state only). Copy §"Блок 5". README §Agents.

# Purpose
Explain the five roles and what "fits in its seat" means, via one stateful showcase driven by the selected role.

# Documentation Truth
- Heading variants: "The right agent in the right seat" · "Five roles, and each has a home" · "You assign the work. The rules settle the result."
- Three paragraphs (verbatim COPY §5 "Текст"; the no-language-model statement is mandatory).
- Five role cards (verbatim): role label, Home seats, Tasks, Neighboring seats.
- Fit: legend Home / Neighbor / Incompatible; table Home 100% · Neighboring 60% · Incompatible Cannot work; caption "These values feed into performance. They are not payout percentages."
- Levels 1–5 with multipliers 1.00× / 1.15× / 1.30× / 1.45× / 1.60× and the XP paragraph.
- Traits: Night Owl, Frugal, Specialist, Steady (verbatim) + paragraph.
- Link **Meet the agents** → Docs agents section (URL unknown). Tooltip "Agent slots: 8 at City Level 1, up to 20 at level 7." Caption "Autonomous buildings need no agent."
- Do **not** write "Home seats use the full specialty…" under the role selector.
- UI: dark block; role selector at the bottom; default **Engineer**; click changes centre image, right panel, colour of bold white text and panel lines.
- Colours: Engineer orange, Logistician blue, Trader violet, Scientist turquoise, Manager white.
- Level = number 1–5 with the same number of lit segments. Showcase set: Engineer 4 · Specialist + Steady; Logistician 2 · Frugal + Night Owl; Trader 5 · Night Owl + Specialist; Scientist 1 · Steady + Frugal; Manager 3 · Frugal + Night Owl. Do not repeat the mockup's "04" with three segments.

# Desktop Visual Truth
Dark full-bleed (#091117). Copy left (≈4.3–34%: H2 3 lines, 2-line body, small line, arrow link). Portrait centre (≈38–57% width, ≈11–70% height). Right panel (≈65–96%): role icon + name, role label, rule; two columns Home seat | Neighboring (icon + building names, vertical divider); Compatibility (?) with three bars; rule; Level (number + 5 segments) | Traits (chips). Bottom selector (≈21–79% width, ≈73.5–91.5% height): 5 skewed cards, selected accent border + glow + underline.

# Mobile Visual Truth
Header → copy → portrait centred (≈33–67% width) → panel as bordered card (inner two columns kept) → selector scrolling horizontally (≈4.3 cards visible).

# Layout
```
Section(theme=dark, id=agents, --block-accent from role)
 └─ Container
     Copy(H2, paragraphs, Meet the agents)          | Portrait stage | RolePanel
     RoleSelector (5 cards, tablist)
     AgentsDetails: role cards · fit table · levels · traits   ← documented, not in mockup
```
Interpretation (confirm OQ-18): documented role cards/fit/levels/traits content that is not in the showcase lives in a details area below the selector (disclosure or second row), not inside the showcase panel.

# Components
Heading `display-1` dark, BodyCopy, ArrowLink, PortraitStage (fixed-height, `contain`, bottom-anchored, crossfade), RolePanel (header, two-column seat list, CompatibilityBars, LevelMeter, TraitChip ×1–2), Tooltip, RoleSelector (SegmentedControl skin, skewed cards with cropped portrait + name), DataTable (fit), Card `solid-dark` (role cards).

# State Model
`activeRole` (default `engineer`). Derived:

| Role | Colour token | Home seats | Neighboring seats | Level | Traits |
|---|---|---|---|---|---|
| Engineer | `--site-role-engineer` (orange) | Workshop, Power Node, Energy Plant | AI Research Center, Logistics Hub, Robotics Lab, Data Center, Fleet Yard | 4 | Specialist, Steady |
| Logistician | `--site-role-logistician` (blue) | Logistics Hub, Drone Depot, Fleet Yard | Workshop, Power Node, Energy Plant, Flagship Store, Retail Complex | 2 | Frugal, Night Owl |
| Trader | `--site-role-trader` (violet) | Bank, Exchange, Finance Tower, Flagship Store, Retail Complex | Clearing House | 5 | Night Owl, Specialist |
| Scientist | `--site-role-scientist` (turquoise) | AI Research Center, Data Center | Agent Hub, Cloud Campus | 1 | Steady, Frugal |
| Manager | `--site-role-manager` (white) | City Hall, Cloud Campus, Clearing House | Bank, Finance Tower | 3 | Frugal, Night Owl |

Compatibility bars: Home 100%, Neighboring 60%, Incompatible "Cannot work" (no "OTHER —", DC-18). Seat lists have variable length (1–5): the column grows; no truncation.

# Data Model
`data/agents.ts`: roles[5] `{ id, name, label, home[], neighboring[], tasks, cardText, portrait, accentToken, showcase: { level, traits[] } }`; fit table; levels[5] multipliers; traits[4]. Seat names must match building names in `data/buildings.ts`.

# Assets
Portraits `website/units/Engineer.png`, `Logistician.png`, `trader.png`, `scientist.png`, `manager.png` (mixed aspect ratios — ASSET_MANIFEST §7). Selector thumbnails crop the same file. Seat icons: Lucide or `website/agents-cut/buildings/*` (undocumented, owner approval; agent_hub and robotics_lab missing there).

# Typography
H2 `display-1` white; body `body` secondary; role name `heading-3`; role label `label` accent; column headers `label`; seat names `body-sm`; bar labels `label`; level digit `numeric` ≈40 px; chips `metadata`.

# Color / Accent
`--block-accent = --site-role-<active>`. Consumers: bold white text in block, panel lines/dividers, bar fills, lit segments, selected card border/glow/underline. Documented orange for Engineer overrides mockup yellow #FFC82D (DC-16). Manager white: selected state must still differ from unselected (use glow + underline, not colour alone).

# Spacing
Copy/portrait/panel column gaps 48 px; panel internal 16–24 px; selector cards gap 12 px; showcase→details 64 px.

# Interaction
Click/tap or arrow keys switch role; crossfade portrait 220 ms after decode; accent 220 ms. No auto-rotation. Tooltip on Compatibility and Agent slots. Preload other portraits on idle.

# Responsive Transformation
3 columns → stack; panel gains a card frame; selector scrolls with snap, selected card scrolled into view; details area stacks. See RESPONSIVE_SYSTEM §4 Agents.

# Visual Fidelity Priorities
HIGH: portrait scale/baseline, panel structure, selector skewed cards and selected state, state correctness (table). MEDIUM: bar geometry, level meter, chip size. LOW: glow, background vignette.

# Known Conflicts
DC-01, DC-15, DC-16, DC-17, DC-18, DC-19, DC-20, DC-55.

# Open Questions
OQ-05, OQ-09, OQ-18, OQ-40.

# Implementation Constraints
Levels and traits are showcase values, not player data. Lit segments = level (test). No LLM/AI-thinking language. Portraits are images, not 3D.
