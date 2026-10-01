# HUD Design System — repository ingest

- Source path: `C:\Users\sk640\Desktop\corporator_hud_system.md`
- Source SHA256: `08C3621AB06F13E73BAE1F753CAA1FDD2D043219CF7B39944ADC0F4425FC51D4`
- Ingestion date: 2026-09-15
- Authority / status: errata only (no Settings, no bottom nav, Recent Activity ≤ 3). Not the lock of look. Live HUD look is `hud/design-reference/` (`00` + `DESIGN_SCHEME.md`) and `.cursor/rules/hud-visual.mdc`. `docs/SCREENS.md` remains the mechanical screen, route, and refusal contract. `docs/archive/reports/hud_prompt.md` and `docs/archive/reports/TZ_HUD.md` are archive (`R-V-102`); do not execute them. Do not restore `HUD.md`.

## Phase 1 Errata

These errata resolve already-audited contradictions in the ingested v1.1 body. They do not add mechanics, screens, routes, or data sources, and they do not rewrite the specification body. Where the body conflicts with this block, this block wins. This block does not win over `hud/design-reference/`. Do not invent v1.2 or new 8.x sections.

1. **No permanent bottom navigation.** There is no permanent bottom nav on any device. Old STEP 5 wording and any bottom-dock wording in the body are historical and non-executable. Do not restore a bottom dock, a priority bar, or a More bar.

2. **Settings is absent.** Settings is not a HUD destination or control. The Lucide Settings glyph is an icon-registry entry only and must not create section 8.10, an Assistance workspace, or a Settings control.

3. **Recent Activity default is at most 3 rows.** Persistent default Recent Activity shows a maximum of 3 rows. Body wording of 3–5 is not the default HUD. An expanded Journal view does not create another event system.

4. **ResearchCard is a semantic template.** Section 22’s “Do NOT create ResearchCard” applies only to building-specific card proliferation (do not fork BuildingCard into WorkshopCard, BankCard, ResearchCard, or similar). ResearchCard remains the one semantic template for the five existing research items. It is not a building card and not a new primary destination. Research Detail maps to the existing research screen/tab; it does not create a new destination, route, or screen.

5. **Version labels are section-local history.** Labels such as UPDATE v1.1 / v1.3 / … / v1.8 in the body are section-local history of those sections. They do not change the authority or status of this ingested copy.

6. **Typography.** IBM Plex Sans for UI text; JetBrains Mono for technical and data text (balances, time, statuses, tabular values). Both faces are local/vendored; no CDN. Source Serif 4 from archived `hud_prompt.md` is not a live HUD face.

7. **Look lock is outside this file.** `hud/design-reference/` is the visual source. Navy glass and older type ramps in the ingested body are not executable look.

---
CORPORATOR — HUD DESIGN SYSTEM v1.1
CANONICAL CONSOLIDATED SPECIFICATION — CLEANED

==================================================
CANONICAL RECONCILIATION / SOURCE OF TRUTH
==================================================

The rules below resolve obsolete or conflicting instructions that appeared in earlier revisions of this document.
They do not introduce new gameplay, data sources, API routes, or UI mechanics.

1. PERMANENT BOTTOM NAVIGATION
Permanent Bottom Navigation is REMOVED.
There is no permanent bottom navigation on Desktop, Tablet, or Mobile.
Overview, Agents, Exchange, Bank, Industries, and Journal are NOT permanent bottom-navigation destinations.
Responsive layouts must not restore bottom navigation or replace it with a priority/More navigation bar.

2. SETTINGS
Settings is intentionally REMOVED from the Corporator HUD and is NOT a current workspace or HUD destination.
Do not restore a Settings workspace, Settings navigation item, or Settings control.

3. SECTION 8.10
Section 8.10 is intentionally omitted and must remain omitted.
There is no 8.10 workspace in the current HUD system.
Do not recreate or renumber content to restore a 8.10 workspace.

4. BUILDING COUNT
Corporator has 18 functional/playable buildings.
There is a 19th building asset used as decoration; it is NOT a functional/playable building and must not be treated as one in functional BuildingCard, building-function, industry, staffing, or management rules.

5. VISUAL SYSTEM
The approved HUD visual system is BRIGHT BLUE / SKY / CORPORATE GAME UI.
Older dark navy / dark graphite visual wording is obsolete unless it is explicitly used only as a prohibition or historical rejection.

6. DOCUMENT STATUS
The substantive HUD specifications recorded in this document remain preserved.
This file is a cleaned consolidation of those approved rules; obsolete conflicting wording is corrected rather than treated as an additional design variant.

==================================================
END CANONICAL RECONCILIATION
==================================================


1. CORE HUD PHILOSOPHY

The island is the primary interface and the main visual focus.

Core interaction model:

ISLAND → BUILDING → CONTEXT → MANAGEMENT

The player should primarily interact with the game by clicking existing buildings on the island.

Click building → inspect function → Manage → open management workspace.

The HUD must support the world, not replace it with a dashboard.

The physical island is authored and unchanged by player actions. The player does not place buildings, modify terrain, create construction sites, move anchors, or create new physical building instances.

2. PERMANENT BOTTOM NAVIGATION

REMOVE PERMANENT BOTTOM NAVIGATION COMPLETELY.

Do NOT implement:
- Overview
- Agents
- Exchange
- Bank
- Industries
- Journal

as a permanent bottom navigation bar.

The game must not feel playable entirely through one generic navigation panel.

Management systems should be reached through:
- building interaction;
- contextual UI;
- relevant workspace entry points;
- other existing interaction paths.

3. DEFAULT HUD STRUCTURE

The default HUD contains only essential persistent information.

MAIN AREAS:

A. TOP BAR
B. LEFT ECONOMY PANEL
C. RIGHT CITY STATUS PANEL
D. LOWER-LEFT ACTIVE FUNCTIONS
E. LOWER-RIGHT RECENT ACTIVITY
F. CENTRAL 3D ISLAND

The central island must remain visually dominant.

4. TOP BAR

LEFT:
- CORPORATOR logo/name
- City identity
- City Level
- No fake city selector

Recommended:
CORPORATOR
CITY 01 · LEVEL 3

CENTER:
CITY TIME
DAY number
HH:MM
day/night indicator
small time-of-day working-hours strip

Example:
DAY 17 · 14:32

RIGHT:
- Bank status
- Season / Period
- Notifications
- Connection status

Example:
BANK OPEN
SEASON 01 · PERIOD 02

Use personal city time for schedules and Bank state.
Personal city time and global protocol time must remain visually distinguishable.

5. LEFT PANEL — ECONOMY

One compact panel, approximately 250–270 px wide.

Priority:

CAPITAL
↓
PAYROLL
↓
RESOURCES

Example:

CAPITAL

124,800
+1,240 · Paid last tick

----------------

PAYROLL
████████████░
86%
Last tick coverage

----------------

ENERGY       800 / 1,000
COMPUTE      400 / 600

Rules:
- Capital is the primary number.
- Use explicit payment terminology.
- Do not use ambiguous "+N / h".
- Payroll must represent a defined ratio and scope.
- Energy and Compute remain compact.
- Never convert unavailable/missing data into zero.
- Never mix spendable Capital with wallet $CORP, Vault backing, pending transactions, or other monetary concepts.

6. RIGHT PANEL — CITY STATUS

One compact panel, approximately 250–270 px wide.

Example:

CITY STATUS

POPULATION        1,284
CITY LEVEL        4

PRODUCTIVITY      82%
HAPPINESS         71%
STABILITY         94%

View details →

Population may include progress toward the next City Level.

Do not use fake trend arrows.
Only show trends when a comparison period actually exists.

Detailed metrics belong in a workspace or expandable detail view rather than permanently occupying the screen.

7. LOWER-LEFT — ACTIVE FUNCTIONS

This is NOT navigation.

It is a compact shortcut/overview of currently active or recently selected functions.

Example:

ACTIVE FUNCTIONS

[Workshop] [Power Node] [Bank] [Exchange] [AI Research]

View all →

Each item:
- real building thumbnail;
- building name;
- status indicator;
- click selects the actual existing building/function.

Do not imply physical construction.

Do not merge:
- active function count;
- building archetype count;
- logical slots;
- agent slots.

8. LOWER-RIGHT — RECENT ACTIVITY

Compact block with approximately 2–3 important events.

Example:

RECENT ACTIVITY

14:31  WORKSHOP
Work resumed · Energy available

14:12  POWER NODE
Stopped · Insufficient Energy

13:48  EXCHANGE
Trade completed

View all →

The full journal exists separately.

Do not create a constantly auto-scrolling event stream.

Important failures must remain accessible beyond temporary toasts.

9. CENTRAL SCENE

The island occupies the visual center.

Do not place large permanent panels over the island.

Do not make the interface resemble a full-screen dashboard.

The HUD should frame the island rather than cover it.

Visual priority:

1. Island
2. Important city/economic state
3. Selected building
4. Actions/details

10. BUILDING SELECTION

Clicking a building should:
1. Select/highlight the actual existing building.
2. Open a compact contextual popover.
3. Show essential building information.
4. Allow the player to open management with MANAGE.

Use the existing Three.js picking path.

Do not use guessed screen coordinates.

Do not open construction UI when clicking empty terrain.

HUD pointer interactions must not accidentally affect the scene.

11. BUILDING POPOVER

Compact contextual card, approximately 280–340 px wide.

Example:

[BUILDING IMAGE]

WORKSHOP             LV 2
● RUNNING

Engineer · Alex R.
Produce

+24 Capital / paid tick

[ MANAGE ]

Optional:
Schedule: Always
or
Closed until 08:00 city time

The popover contains:
- building thumbnail;
- building name;
- level;
- status;
- worker or Autonomous;
- task where relevant;
- main current metric/output;
- Manage action;
- relevant schedule/reason when useful.

Position it relative to the actual building: prefer a slot below the projected GLB box, flip above (or beside) when the lower slot would cover the mesh or chrome.

Keep the selected building visible whenever possible.

Do not allow the popover to cover the selected building unnecessarily.

12. WORKSPACE MODEL

When MANAGE is pressed:
- building popover closes;
- one primary workspace opens;
- unnecessary persistent panels can be hidden/suppressed;
- island remains visible;
- no multiple large management windows.

Overlay hierarchy:

1. Persistent HUD
2. One primary workspace
3. Context popover
4. Confirmation dialog
5. Tooltip / toast

Desktop workspace:
- normal: approximately 420–520 px;
- data-dense: approximately 760–960 px.

Mobile:
- large bottom sheet or full-screen workspace.

13. VISUAL DIRECTION

The previous dark graphite HUD direction is REJECTED.

Approved direction:

BRIGHT BLUE / SKY / CORPORATE GAME UI

The HUD must visually belong to the existing Corporator island:
- bright sky-blue environment;
- stylized low-poly world;
- colorful branded buildings;
- warm building illumination;
- playful premium 3D game aesthetic.

The HUD should be calmer than the world and must not compete with the buildings.

Visual relationship:

WORLD = EXPRESSIVE
HUD = CONTROLLED

The interface should feel like a premium stylized game interface.

Avoid:
- generic SaaS dashboard appearance;
- generic DeFi/crypto dashboard appearance;
- dark sci-fi control-panel appearance;
- excessive neon;
- excessive glow;
- excessive cyan borders;
- excessive blur;
- overly heavy shadows.

14. APPROVED COLOR SYSTEM v1

BASE BLUE:

HUD BLUE:
#245A9A

HUD BLUE DARK:
#1D4B86

HUD BLUE LIGHT:
#2E68AA

PRIMARY PANEL GRADIENT:

TOP:
#2C67AA

BOTTOM:
#1E4F8C

The gradient must remain subtle.

TEXT:

TEXT PRIMARY:
#F4F7FA

TEXT SECONDARY:
#C7D5E3

TEXT MUTED:
#8FA8C0

INTERACTION:

PRIMARY BLUE:
#45C7F4

SELECTED AMBER:
#FFB64A

SEMANTIC:

SUCCESS:
#63D68A

WARNING:
#F0B85B

ERROR:
#E97878

15. COLOR USAGE RULES

The HUD should be predominantly blue + neutral text.

Color must have semantic purpose.

PRIMARY BLUE:
- interaction;
- active controls;
- hover;
- important interactive states.

AMBER:
- selected building;
- important attention;
- selection state.

GREEN:
- running;
- success;
- completed.

RED:
- error;
- failed;
- blocked.

WARNING:
- warning state only.

Do NOT color every panel cyan.

Do NOT give every component its own accent color.

Do NOT use bright borders around every UI block.

16. PANEL MATERIAL

Panels should use the approved blue palette with subtle depth.

General direction:
- blue surface;
- subtle transparency where appropriate;
- soft gradient;
- thin restrained border;
- subtle internal highlight;
- soft shadow.

The UI should feel slightly dimensional but not glossy.

Avoid:
- huge drop shadows;
- heavy blur;
- glassmorphism everywhere;
- glowing borders;
- flat pure-blue rectangles.

17. SHAPE LANGUAGE

Standard radius:

CONTROL:
8 px

CARD:
12 px

PANEL:
16 px

Large pill shapes are NOT the standard.

Use pill shapes only for:
- status chips;
- badges;
- short tags.

Standard cards/panels should feel compact and structured rather than like giant rounded mobile-app controls.

18. HUD AS A CONSTRUCTOR

The HUD must be built as a reusable design system.

Do not create every screen independently.

Do not invent new spacing values, fonts, borders, card shapes, or layout patterns for individual screens.

The agent should assemble the interface from approved primitives.

Core rule:

EXISTING PRIMITIVE + VARIANT + DATA

NOT:

NEW CUSTOM COMPONENT + NEW CSS STYLE

19. SPACING SYSTEM

Use only:

4
8
12
16
20
24
32

Guideline:
- 4 = micro spacing;
- 8 = label/value relationships;
- 12 = elements within sections;
- 16 = default component padding;
- 20 = medium separation;
- 24 = section separation;
- 32 = large layout separation.

Do not introduce random values such as 17px, 23px, 27px without a specific system-level reason.

20. TYPOGRAPHY SYSTEM

Primary font:

IBM Plex Sans

Display:
36–44 px

Heading:
14–16 px

Body:
13–15 px

Metadata:
12–13 px

Technical:
monospace

Balances, time, and tabular data:
tabular numerals

Uppercase:
- panel headers;
- short labels;
- status chips;
- short navigation-like labels where appropriate.

Do NOT use uppercase for paragraphs or dense explanatory text.

21. CORE COMPONENT INVENTORY

The approved foundation:

HUDShell
TopBar

Panel
PanelHeader
Section

Metric
MetricRow
Progress
StatusChip

Card
BuildingCard
AgentCard

ListItem
RequirementRow

Button
Tabs

Thumbnail
BuildingThumbnail
AgentPortrait

BuildingPopover
Workspace
Dialog

22. COMPONENT RULE

One data type = one visual template.

18 functional buildings must use ONE BuildingCard component. The 19th building asset is decorative and is not a functional BuildingCard target.

Do NOT create:
- WorkshopCard
- BankCard
- ExchangeCard
- ResearchCard
- etc.

Instead:

BuildingCard
with variants such as:
- running
- idle
- locked
- frozen
- unavailable
- loading
- error

Only data and state change.

23. BUILDING CARD

BuildingCard must support:
- image;
- name;
- level;
- status;
- worker;
- task;
- schedule;
- primary metric;
- attention state.

One layout is used for all building types.

All 18 functional building assets are real approved/canonical artwork. The 19th building asset is decorative and is not part of the functional building system.

Do not generate or redesign building artwork for HUD usage when an approved asset exists.

24. AGENT CARD

AgentCard must support:
- portrait;
- name or stable identifier;
- role;
- level;
- XP;
- workplace;
- task;
- status;
- attention reason.

The five role assets are:
- Engineer
- Logistician
- Manager
- Scientist
- Trader

One AgentCard component is used for all roles.

25. METRIC COMPONENT

Structure:

LABEL
VALUE
SUPPORTING INFORMATION

Example:

CAPITAL
124,800
+1,240 · Paid last tick

The value has the strongest visual hierarchy.

Do not make every metric its own card.

26. METRIC ROW

Used for compact values.

Example:

ENERGY             800
COMPUTE            400
POPULATION       1,284

Rule:
label left → value right

27. STATUS CHIP

Single reusable component.

Possible states:
- RUNNING
- IDLE
- LOCKED
- FROZEN
- UNAVAILABLE
- PENDING
- CONFIRMED
- ERROR

Color alone is never sufficient.
Status text must remain visible.

28. PROGRESS COMPONENT

One standardized progress component for:
- Payroll;
- XP;
- Population progression;
- capacity;
- resource comparisons.

Example:

LABEL                       VALUE
██████████████░░              86%

One progress bar = one semantic quantity.

29. THUMBNAILS

Building thumbnails:
- use real approved building assets;
- consistent aspect ratio;
- consistent crop;
- consistent internal padding;
- consistent visual height.

Agent portraits:
- use existing canonical role artwork;
- consistent treatment.

Do not randomly crop different buildings differently.

30. BUTTON SYSTEM

Three main levels:

PRIMARY
- Manage
- Confirm
- Stake
- other major action

SECONDARY
- View Details
- Cancel
- secondary action

GHOST
- utility;
- icon actions;
- low-priority controls.

Desktop height:
approximately 36–40 px.

Touch/mobile minimum:
44 px.

31. REQUIREMENT ROW

For requirements, show the actual condition clearly.

Example:

ENERGY
Required 120
Available 80

✕ Insufficient Energy

States:
- met;
- warning;
- failed;
- unavailable.

Use this pattern for activation, upgrades, research, staking, training, etc.

32. LIST ITEM

Use one shared layout for lists:

[THUMBNAIL] TITLE
            SECONDARY INFO            STATUS

Example:

[IMG] WORKSHOP
      Engineer · Produce               ● RUNNING

Do not redesign list items separately for Agents, Functions, Journal, Industries, etc.

33. APPROVED DEVELOPMENT ORDER

STEP 1
HUD Layout
APPROVED

STEP 2
Color System
APPROVED

STEP 3
Core primitives:
- Panel
- Card
- Metric
- StatusChip
- Thumbnail
- Button
- Section
- Progress
- ListItem
- RequirementRow

STEP 4
Semantic components:
- BuildingCard
- AgentCard
- BuildingPopover
- Workspace

STEP 5
Assemble the Default HUD

STEP 6
Build management workspaces

34. CURRENT STATUS

The core HUD primitive system and the canonical HUD/workspace specifications recorded in this document are already approved through the current sections below.

The primitives that form the foundation are:
1. Panel
2. Card
3. Metric
4. StatusChip
5. Thumbnail
6. Button
7. Section
8. Progress
9. ListItem
10. RequirementRow

Semantic components and workspaces build on those shared primitives.

Do not create a second visual system for later screens; continue using the shared constructor rules defined in this document.

35. FINAL HARD RULES

ISLAND REMAINS THE CENTER.

BUILDINGS ARE THE PRIMARY GAME INTERACTION.

NO PERMANENT BOTTOM NAVIGATION.

NO PHYSICAL CONSTRUCTION UI.

NO GRID PLACEMENT UI.

NO GIANT DASHBOARD PANELS.

NO RANDOM UI STYLES.

NO RANDOM SPACING.

NO RANDOM TYPOGRAPHY.

NO RANDOM CARD DESIGNS.

NO FAKE DATA.

NO COLOR WITHOUT SEMANTIC PURPOSE.

USE REAL BUILDING AND AGENT ARTWORK.

ONE COMPONENT PER DATA TYPE.

USE VARIANTS INSTEAD OF CREATING NEW VISUAL COMPONENTS.

DATA + VARIANT, NOT NEW DESIGN EVERY TIME.

HUD MUST BE EASY TO ASSEMBLE AND MAINTAIN THROUGH AI AGENTS.

CORPORATOR — HUD DESIGN SYSTEM
UPDATE v1.1
CHANGES AFTER v1.0

1. DEFAULT HUD — COMPACT LOWER PANELS

The Lower-Left Active Functions panel and Lower-Right Recent Activity panel must be smaller than in the previous mockup.

The purpose of both panels is secondary information.
They must not compete visually with the island.

2. ACTIVE FUNCTIONS

Location:
Lower-left corner.

Approved size:
Width: 250–280 px
Height: approximately 116–132 px

Recommended default:
260 × 124 px

Structure:

ACTIVE FUNCTIONS                           View all →

[building] [building] [building] [building] [building]

Each item:
- 48–56 px building thumbnail
- small status indicator
- short building name

Do not increase the panel height to fit additional information.

Do not add descriptions, metrics, workers, levels, or large text inside this compact strip.

Maximum visible building shortcuts:
5 on desktop.

The component remains a quick-access strip, NOT navigation.

The panel should visually recede behind the central island:
- compact padding;
- minimal vertical spacing;
- restrained typography;
- no excessive glow;
- no large header area.

3. RECENT ACTIVITY

Location:
Lower-right corner.

Approved size:
Width: 250–280 px
Height: approximately 150–170 px

Recommended default:
270 × 160 px

Structure:

RECENT ACTIVITY                         View all →

14:31   [icon] WORKSHOP
        Work resumed · Energy available

14:12   [icon] POWER NODE
        Stopped · Insufficient Energy

13:48   [icon] EXCHANGE
        Trade completed

Maximum visible events:
3.

Do not show 5–6 events in the persistent HUD.

Full event history belongs to the Journal workspace.

Event rows must remain compact:
- small category icon;
- timestamp;
- short title;
- one short consequence/reason line.

Do not add large event cards, long descriptions, or excessive vertical separators.

4. RELATIVE VISUAL PRIORITY

The visual hierarchy of the default HUD is:

1. Island
2. Selected building / contextual interaction
3. Economy
4. City Status
5. Top Bar
6. Active Functions
7. Recent Activity

The lower panels must therefore be visually quieter than Economy and City Status.

5. DEFAULT HUD SPATIAL RULE

Lower panels must stay outside the main island silhouette whenever possible.

They should occupy the corners rather than extend horizontally toward the center.

Maintain clear breathing room around the island.

Do not enlarge lower panels just because there is unused viewport space.

6. AI IMPLEMENTATION RULE

These dimensions are system rules, not approximate visual suggestions.

Use reusable layout tokens / component variants.

Recommended desktop tokens:

--active-functions-width: 260px;
--active-functions-height: 124px;

--recent-activity-width: 270px;
--recent-activity-height: 160px;

The implementation may adapt within the approved ranges for responsive layouts, but must preserve the same visual proportions and hierarchy.

7. CURRENT DEFAULT HUD

The approved default composition is now:

TOP:
- Corporation identity
- City identity / level
- City Time
- Bank status
- Season / Period
- utility controls

LEFT:
- Compact Economy panel

RIGHT:
- Compact City Status panel

CENTER:
- Large unobstructed 3D island

LOWER LEFT:
- Compact Active Functions strip
- 260 × 124 px recommended

LOWER RIGHT:
- Compact Recent Activity panel
- 270 × 160 px recommended

SELECTED BUILDING:
- Contextual Building Popover near the selected building

There is NO permanent bottom navigation bar.

8. DESIGN PRINCIPLE

The lower UI must behave as supporting information, not as a second interface layer.

The player should visually perceive:

CITY FIRST → BUILDING SECOND → HUD THIRD

not:

HUD FIRST → HUD SECOND → ISLAND THIRD

CORPORATOR — HUD DESIGN SYSTEM
UPDATE AFTER LAST DOCUMENT SAVE

1. BUILDING CARD / AGENT CARD / BUILDING POPOVER

These three components are now part of the approved HUD system.

They must reuse the existing global Design System:
- approved blue palette;
- approved typography;
- approved spacing;
- approved radii;
- approved buttons;
- approved status system;
- approved thumbnails.

Do not create separate visual styles for these components.

2. BUILDING CARD

One shared component for all 18 functional buildings. The decorative 19th building is excluded from functional BuildingCard semantics.

Use for:
- Active Functions;
- building lists;
- workspace lists;
- related building displays;
- management interfaces.

Standard structure:

BUILDING THUMBNAIL
↓
BUILDING NAME + LEVEL
↓
STATUS
↓
WORKER / AUTONOMOUS
↓
TASK
↓
PRIMARY OUTPUT / METRIC
↓
PRIMARY ACTION

Example:

WORKSHOP                         LV 2
● RUNNING

Engineer · Alex R.
Produce

+24 Capital / paid tick

[ MANAGE → ]

Approved standard size:
approximately 320 × 250–280 px

Thumbnail:
approximately 96 × 96 px

Padding:
16 px

Internal spacing:
8 / 12 px

Radius:
12 px

Supported visual variants:

- running
- idle
- locked
- frozen
- unavailable
- loading
- error

All variants keep the same basic layout.

Do not create separate designs such as WorkshopCard, BankCard, ExchangeCard, etc.

3. BUILDING CARD DATA RULE

Use only supported building/function information:

- function name;
- functional level;
- status;
- worker or Autonomous;
- current task where relevant;
- schedule where relevant;
- last evaluated request/payment or resource output;
- relevant operating/attention state.

The 19th decorative building asset is excluded from this functional building data contract.

Do not invent additional gameplay data.

4. AGENT CARD

One shared component for all five roles.

Supported roles:

- Engineer
- Logistician
- Manager
- Scientist
- Trader

Structure:

AGENT PORTRAIT
↓
NAME + LEVEL
↓
ROLE
↓
WORKPLACE
↓
TASK
↓
OPERATING STATE
↓
XP PROGRESS

Example:

ALEX R.                         LV 3
ENGINEER

WORKSHOP
PRODUCE
● WORKING

XP
██████████░░
420 / 800

Approved standard portrait:
approximately 72 × 88 px

Agent Card must use the existing canonical role artwork.

5. AGENT DATA RULE

Supported agent information includes:

- portrait;
- name if supplied, otherwise stable display identifier;
- role;
- level;
- XP progress;
- workplace;
- task;
- operating state;
- attention reason;
- traits and detailed XP can appear in Agent Detail.

Do not invent persistent personalities, biographies, NFT traits, or unsupported agent data.

XP is valid game data:
- normal valid paid tick gives base +1 XP;
- successful training gives base +1 XP to an eligible same-city target;
- XP remainder persists;
- maximum agent level is 5.

However, current runtime agent execution is partial, so prototype values must be clearly fixture-backed where applicable.

6. BUILDING POPOVER

The Building Popover is the compact interaction layer opened when the player clicks a building.

Interaction flow:

3D BUILDING
→ CLICK
→ BUILDING POPOVER
→ MANAGE
→ BUILDING MANAGEMENT WORKSPACE

Approved size:
approximately 280–340 px

Structure:

BUILDING THUMBNAIL
NAME + LEVEL
STATUS
WORKER / AUTONOMOUS
TASK
PRIMARY OUTPUT / PAYMENT / RESOURCE VALUE
MANAGE

Example:

WORKSHOP                         LV 2
● RUNNING

Engineer · Alex R.
Produce

+24 Capital / paid tick

[ MANAGE → ]

Optional:
Schedule: Always
or
Closed until 08:00 city time

7. BUILDING POPOVER RULES

The Popover shows only information useful for the next decision.

Do NOT put inside the Popover:
- full modifier stacks;
- full event history;
- XP;
- full economic breakdown;
- large tables;
- multiple tabs;
- long descriptions.

Those belong in the Workspace.

The Popover must:
- use the real building thumbnail;
- be positioned relative to the actual selected building;
- keep the selected building visible where possible;
- stay outside fixed HUD rails;
- avoid the Top Bar;
- clamp to the safe scene area;
- change left/right position when necessary;
- dock to a stable location if the building is off-screen;
- never float over an unrelated building.

Use a subtle amber selected state.

Do not use a large glowing outline.

8. BUILDING SELECTION

Use existing Three.js picking and authored metadata.

Do not use guessed screen coordinates.

Empty ground must never open construction UI.

Camera drag must not be interpreted as a building click.

HUD interaction must not leak pointer events into the scene.

9. BUILDING MANAGEMENT WORKSPACE

A new approved workspace template is now defined.

Entry:

BUILDING POPOVER
→ MANAGE
→ WORKSPACE

10. WORKSPACE POSITION

Desktop:
- right-side workspace;
- recommended width: 480 px;
- allowed range: 420–520 px;
- right margin: 24 px;
- top: below Top Bar;
- bottom: 24 px.

The island must remain clearly visible on the left.

11. DEFAULT HUD WHEN WORKSPACE IS OPEN

Remain visible:
- Top Bar;
- Economy;
- 3D island.

Hide/suppress:
- City Status;
- Recent Activity;
- selected Building Popover.

Only one primary workspace may be open at a time.

12. WORKSPACE STRUCTURE

WORKSPACE HEADER
↓
TABS
↓
ACTIVE TAB CONTENT
↓
PRIMARY ACTION AREA

13. WORKSPACE HEADER

Header contains:

BUILDING THUMBNAIL

WORKSHOP
Level 2
● RUNNING

CLOSE

Do not duplicate unnecessary detailed information in the header.

14. BUILDING MANAGEMENT TABS

Approved tabs:

Overview
Staffing
Upgrades
Activity

15. OVERVIEW TAB

Show only supported information:

- what the function does;
- required industries;
- schedule;
- inputs / outputs;
- relevant capacity;
- current operating reason;
- relevant modifiers.

Do not invent unsupported information.

16. STAFFING TAB

Show:

- current assignment;
- compatible agents;
- Home affinity;
- Neighboring affinity;
- Accepted foreign affinity;
- incompatible-role rejection;
- Autonomous explanation where applicable.

Autonomous functions must not imply a required worker.

17. UPGRADES TAB

Show when supported:

- current functional level;
- next functional level;
- Capital cost;
- defined effect change;
- supplied upgrade duration only when actually available.

API `commit:upgrade` is live: the client posts `building_id`. Cost is
`generated.balance.level_cost` for the next level; City Hall is not
player-upgraded. Cap is `TIER_NOT_UNLOCKED`.

Never invent:
- construction state;
- construction timer;
- physical upgrade animation;
- plot selection.

18. ACTIVITY TAB

Show events associated with the selected function.

Keep them:
- compact;
- chronological;
- readable;
- categorized.

Do not turn the Activity tab into the global Journal.

19. WORKSPACE ACTIONS

Typical bottom actions:

[ DEACTIVATE ]    [ UPGRADE ]

Only show actions that are actually applicable.

Disabled actions must explain why.

Deactivation must communicate:

“Deactivation does not release this function’s logical slot.”

Do not imply automatic refund or physical deletion.

20. WORKSPACE COMPONENT COMPOSITION

Use existing primitives:

Workspace
├── PanelHeader
├── BuildingThumbnail
├── StatusChip
├── Tabs
├── Section
├── Metric / MetricRow
├── RequirementRow
├── BuildingCard / AgentCard
├── Progress where needed
└── Button

Do not create a separate visual system for the Workspace.

21. RESPONSIVE WORKSPACE

Desktop:
right-side workspace.

Tablet:
wider side sheet or bottom sheet.

Mobile:
large bottom sheet or full-screen management workspace.

Never squeeze the 480px desktop workspace into a narrow mobile column.

22. CURRENT APPROVED INTERACTION ARCHITECTURE

The world-driven flow is now:

ISLAND
↓
BUILDING CLICK
↓
BUILDING POPOVER
↓
MANAGE
↓
BUILDING MANAGEMENT WORKSPACE
↓
TABS / ACTIONS

The 3D world remains the primary interaction surface.

23. CURRENT COMPONENT ARCHITECTURE

The approved hierarchy is now:

HUD
│
├── Persistent HUD
│
├── BuildingPopover
│
├── Workspace
│
├── BuildingCard
│
├── AgentCard
│
└── Shared primitives

All components must use:

TOKENS + PRIMITIVE + VARIANT + DATA

Never:

NEW DESIGN + NEW CSS + NEW SPACING

CORPORATOR — HUD DESIGN SYSTEM
UPDATE v1.3
AGENTS WORKSPACE

1. AGENTS WORKSPACE PURPOSE

Agents Workspace is the primary workforce-management interface.

It is opened through the game’s building/context interaction system and uses the established HUD Design System.

The workspace must feel like a dense professional roster, not a collection of large character cards.

2. WORKSPACE SIZE

Because Agents is a data-dense workspace:

Desktop width:
760–960 px

Do not squeeze the roster into the standard 420–520 px building workspace.

The island must remain visible on the left whenever the viewport allows.

3. WORKSPACE HEADER

Header:

AGENTS

Right side:

12 / 14 SLOTS

[ HIRE ]

Capacity is displayed as an explicit slots metric.

Do not invent additional capacity concepts.

4. FILTER BAR

Approved filters:

SEARCH
ROLE
STATE

State options:

- Working
- Idle
- Unassigned

Do not add unsupported filters or management systems.

5. AGENT ROSTER

Use a compact list/roster, not large standalone cards.

Each roster item contains:

- Portrait
- Name if supplied, otherwise stable display identifier
- Role
- Level
- XP progress
- Workplace
- Task
- Operating state
- Attention reason when applicable

Basic structure:

[ PORTRAIT ]

ALEX R.
ENGINEER
WORKSHOP · PRODUCE
LV 3
XP ████████░░

● WORKING

6. AGENT CARD / ROSTER VARIANT

The global AgentCard component must support a compact roster variant.

Do not create a separate visual system for the Agents workspace.

Use:

AgentCard
variant="roster"

The same underlying component system is used for:
- roster;
- detail;
- other agent-related surfaces where appropriate.

7. AGENT DETAIL

Selecting an agent opens a detailed profile within the workspace.

Show:

- Portrait
- Identity
- Role
- Traits
- Level
- Level multiplier
- XP earned / next threshold
- Assignment
- Task
- Resource implications
- Recent activity

Do not invent persistent personality, biography, NFT traits, or unsupported identity data.

8. XP

XP is valid canonical game data.

Supported rules:

- valid paid work tick gives base +1 XP;
- successful Train gives base +1 XP to an eligible same-city target;
- normal XP and training XP can combine;
- XP remainder persists;
- maximum agent level is 5.

Main roster:

Show whole XP progress clearly.

Detailed fractional remainder:

Show only in Agent Detail or tooltip.

Do not make fractional XP a prominent roster element.

9. ASSIGNMENT

Assignment section shows:

CURRENT WORKPLACE

WORKSHOP

ROLE FIT

HOME · 100%

Action:

[ CHANGE ASSIGNMENT ]

When selecting another workplace, show the actual affinity category:

- Home
- Neighboring
- Accepted foreign
- Incompatible

Home / Neighboring / Accepted foreign values are:

100%
60%
25%

Incompatible roles cannot work.

Do not visually present foreign assignment as equivalent to Home assignment.

10. TASK

Show current task and its effect.

Task examples supported by current rules include:

- Produce
- Overclock
- Route
- Stockpile
- Desk
- Quote
- Train
- Research
- Focus

When task modifiers are displayed:

Use modifier language and exact effect context.

Do not describe a modifier as guaranteed final profit.

11. TRAIN

Training is a dedicated agent action.

Show:

TRAIN

Trainer:
selected current agent

Target:
eligible same-city agent

Compute cost:
supplied value

Base reward:
+1 XP

[ TRAIN ]

Rules:

- target must belong to the same city;
- target cannot be idle or fired;
- base training reward is +1 XP before target/city modifiers;
- trainer receives the training reward only when the actual rules say so; do not imply automatic self-award;
- training affects Compute cost through the defined trainer/task modifiers.

12. AGENT STATES

Supported UI states include:

- Working
- Idle
- Unassigned
- Unavailable
- Error

Do not rely on color alone.

Use:
- state icon;
- state text;
- semantic color.

13. ATTENTION REASONS

When an agent needs attention, display a short reason.

Examples may include:
- incompatible assignment;
- unavailable workplace;
- idle;
- missing required condition.

Do not invent economic causes that are not supplied by the server/content state.

14. VISUAL DESIGN

Use the approved HUD Design System v1.

Agents workspace uses:

- approved blue palette;
- approved typography;
- approved spacing;
- approved radii;
- approved buttons;
- approved status chips;
- approved thumbnails;
- approved progress bars.

Do not create a new visual language for Agents.

15. AGENT PORTRAITS

Use the existing canonical role artwork.

Canonical roles:

- Engineer
- Logistician
- Manager
- Scientist
- Trader

Do not replace them with generated portraits when approved assets are available.

16. DENSITY RULE

The roster should allow several agents to remain visible simultaneously.

Prioritize:

Name
Role
Level
Workplace
Task
State
XP

Secondary information stays visually quiet.

Clicking one agent transitions attention from:

ROSTER → DETAIL

17. INTERACTION FLOW

AGENTS WORKSPACE

→ FILTER / SEARCH
→ SELECT AGENT
→ AGENT DETAIL
→ ASSIGN / CHANGE TASK / TRAIN
→ CONFIRM
→ SERVER / FIXTURE RESULT

Do not create unrelated management actions.

18. IMPLEMENTATION RULE

The Agents workspace is assembled from existing primitives:

Workspace
├── PanelHeader
├── Search / Filters
├── AgentCard variant="roster"
├── Agent Detail
├── AgentPortrait
├── StatusChip
├── Progress
├── MetricRow
├── RequirementRow
└── Button

Do not create custom one-off styling for individual agents.

19. RUNTIME QUALIFICATION

The current repository documents the agent system as partially implemented.

Therefore:

- canonical UI structure may be designed fully;
- prototype fixture state may be used;
- live values must come from live adapters when available;
- missing live data must be shown as unavailable;
- do not pretend fixture-backed agent data is live.

20. VISUAL ACCEPTANCE

Agents Workspace must look like:

A PROFESSIONAL WORKFORCE ROSTER

not:

A GRID OF LARGE CHARACTER PORTRAITS

The roster is compact.

The selected agent becomes detailed.

The island remains visible beside the workspace.

The established Corporator blue visual language remains unchanged.

CORPORATOR — HUD DESIGN SYSTEM
UPDATE v1.4
INDUSTRY OVERVIEW

1. PURPOSE

Industry Overview is the main summary screen for the six playable industries.

The goal is to let the player immediately understand:

- which industries are accessible;
- current access state;
- tier;
- stake;
- efficiency;
- attention state.

Do not turn this screen into the detailed progression / merge / staking workspace.

2. WORKSPACE SIZE

Desktop:
760–960 px

The island remains visible on the left.

Use the existing data-dense Workspace system.

3. HEADER

Header:

INDUSTRIES

Right side:

6 INDUSTRIES

Optional utility/help icon if a real help surface exists.

Do not add unrelated global navigation.

4. INDUSTRY GRID

Desktop layout:

3 columns × 2 rows

All six industries are shown together.

Industries:

COMPUTE — NVDA
ENERGY — TSLA
LOGISTICS — AMZN
CONSUMER — AAPL
AUTOMATION — MSFT
FINANCE — COIN

5. INDUSTRY CARD

All six industries use ONE shared component:

IndustryCard

Do not create separate visual card designs for NVDA, TSLA, AMZN, AAPL, MSFT, or COIN.

Structure:

[ INDUSTRY / BEACON IMAGE ]

NAME                         TICKER

ACCESS STATE                 TIER

STAKE
value

EFFICIENCY
value

ATTENTION
only when applicable

[ VIEW INDUSTRY → ]

6. INDUSTRY IMAGE

Use the existing canonical beacon/building artwork.

Canonical mapping:

NVDA → AI Research Center
TSLA → Energy Plant
AMZN → Logistics Hub
AAPL → Flagship Store
MSFT → Cloud Campus
COIN → Finance Tower

Do not generate or redesign these assets.

7. ACCESS STATES

IndustryCard supports the canonical states:

- Below threshold
- Eligible to open
- Open
- Grace period
- Frozen

Do not collapse all of these into one generic “status”.

8. BELOW THRESHOLD

Example:

● LOCKED

Stake
0 / S_min

Need:
1 × S_min

Show the missing requirement clearly.

9. ELIGIBLE TO OPEN

Example:

● AVAILABLE

Stake
1.0 × S_min

[ OPEN INDUSTRY ]

10. OPEN

Example:

● OPEN

Tier 2

STAKE
2.4 × S_min

EFFICIENCY
108%

11. GRACE PERIOD

Example:

● GRACE PERIOD

Stake below requirement

Freezes in:
18:42 city time

Grace uses personal city time.

Do not imply that withdrawn tokens remain live stake during settlement merely because gameplay grace is still active.

12. FROZEN

Example:

● FROZEN

Industry access unavailable

Explain the current access condition when useful.

13. STAKE DISPLAY

Stake is token quantity, not dollar quantity.

Primary compact display may use:

1.42 × S_min

or the actual verified token quantity.

Do not present a dollar value as the canonical stake requirement unless a current supported quote is explicitly available.

S_min is a frozen threshold from the current content snapshot.

14. TIER

Display:

Tier 1
Tier 2
Tier 3

Current tier progression gates:

Tier 1:
City Level 1
1× S_min

Tier 2:
City Level 3
2× S_min

Tier 3:
City Level 5
3× S_min

15. EFFICIENCY

Show:

EFFICIENCY
108%

Efficiency is an industry modifier / market-related measure.

Do not relabel it as guaranteed profit, payout, or guaranteed production increase.

16. ATTENTION

Attention appears only when an actual condition exists.

Examples:

⚠ BELOW STAKE REQUIREMENT

⚠ GRACE PERIOD

Do not add decorative warnings.

17. PRIMARY ACTION

Default card action:

VIEW INDUSTRY →

For an eligible-but-not-open industry:

OPEN INDUSTRY →

The action must reflect the actual access state.

18. WHAT DOES NOT BELONG IN INDUSTRY OVERVIEW

Do not show here:

- full progression tree;
- exclusive node choices;
- merge combinations;
- staking transaction form;
- unstaking transaction form;
- detailed market charts;
- token addresses;
- full industry description;
- complete building/function lists.

These belong in Industry Detail / related workspaces.

19. VISUAL DESIGN

Use the approved Corporator HUD system:

- Bright Blue / Sky / Corporate Game UI;
- approved blue palette;
- approved typography;
- approved spacing;
- approved radii;
- approved buttons;
- approved status chips;
- approved thumbnail system.

The six cards must clearly read as ONE SYSTEM.

Corporate logos and building/beacon artwork may differ visually, but the surrounding UI structure must remain identical.

20. COMPONENT ARCHITECTURE

Industry Overview is assembled from existing primitives:

Workspace
├── PanelHeader
├── Section
├── IndustryCard
│   ├── BuildingThumbnail / BeaconThumbnail
│   ├── StatusChip
│   ├── Metric / MetricRow
│   ├── Attention state
│   └── Button
└── Grid layout

Do not create custom UI styles for individual industries.

21. DATA RULE

Use only supported industry fields:

- Name
- Ticker
- Beacon image
- Access state
- Stake quantity
- S_min requirement
- Tier
- Efficiency
- Attention state

Do not invent additional industry statistics.

22. INTERACTION

Industry Overview:

INDUSTRY CARD
→ VIEW INDUSTRY
→ INDUSTRY DETAIL

The detailed industry screen is a separate stage.

23. FINAL VISUAL RULE

Industry Overview should feel like:

ONE CONTROL CENTER FOR SIX INDUSTRIES

not:

SIX DIFFERENT BRAND PAGES.

Keep the hierarchy:

Industry identity
→ access state
→ tier / stake
→ efficiency
→ attention
→ action

24. APPROVAL STATUS

INDUSTRY OVERVIEW v1.0
APPROVED

CORPORATOR — HUD DESIGN SYSTEM
UPDATE v1.5
INDUSTRY DETAIL

1. PURPOSE

Industry Detail is the detailed management view for one selected industry.

It is opened from:

INDUSTRY OVERVIEW
→ SELECT INDUSTRY
→ INDUSTRY DETAIL

It is not the same as Industry Overview and must not become a progression/merge workspace.

2. WORKSPACE

Desktop:
- data-dense right-side workspace;
- approximately 760–960 px wide;
- island remains visible on the left;
- use the approved Workspace system.

3. HEADER

Header contains:

- Beacon / industry artwork;
- Industry name;
- Ticker;
- Access state;
- Current tier;
- Close control.

Example:

COMPUTE
NVDA
● OPEN
TIER 2

Do not duplicate detailed information in the header.

4. MAIN FUNCTION

Show the canonical function/role of the selected industry.

Canonical mapping:

NVDA → AI / Compute
TSLA → Energy
AMZN → Logistics
AAPL → Consumer
MSFT → Automation
COIN → Finance

Do not rename or reinterpret these roles.

5. RESOURCES / DEPENDENCIES

Show the real resources or dependencies associated with the selected industry.

Examples:

NVDA:
- Compute
- AI Research / related compute functions

TSLA:
- Energy

AMZN:
- idle_reduction modifier

AAPL:
- population conversion

MSFT:
- offline cap

COIN:
- fund share

Important:
A modifier must not be presented as a physical resource or inventory item.

Do not invent dependencies that are not supplied by the content/rules.

6. STAKE

Dedicated Stake section.

Show:

CURRENT STAKE
REQUIRED STAKE FOR RELEVANT TIER

Primary actions where applicable:

[ STAKE ]
[ UNSTAKE ]

Stake is token quantity, not dollar quantity.

Compact display may use:

1.8 × S_min

Exact token quantity may be shown as secondary detail.

Do not calculate or display a live dollar requirement from stale fixture data.

7. TIER PROGRESSION

Show all three tiers:

Tier 1
Tier 2
Tier 3

For each tier show:

- City Level gate;
- Stake multiplier;
- current/locked status.

Canonical gates:

Tier 1:
City Level 1
1 × S_min

Tier 2:
City Level 3
2 × S_min

Tier 3:
City Level 5
3 × S_min

Show the current tier prominently.

Do not place exclusive Tier node choices inside this section.
Those belong to the separate progression flow.

8. SYNERGIES

Show existing synergies associated with the selected industry.

Keep Synergies visually and conceptually separate from Merges.

Do not describe a Merge as a Synergy.

Do not animate or imply creation of a new physical building as a synergy effect.

9. ASSOCIATED ACTIVITY

Show a compact list of activity related to the selected industry.

Structure:

TIMESTAMP
ACTIVITY
SHORT DESCRIPTION

Use only events actually associated with the selected industry/function.

Provide:

[ VIEW ALL ]

Do not convert this section into the global Journal.

10. ACCESS STATES

Industry Detail supports:

- Below threshold
- Eligible to open
- Open
- Grace period
- Frozen

Each state must use the appropriate component variants.

11. BELOW THRESHOLD

Show:

LOCKED

CURRENT STAKE
REQUIRED STAKE

Clearly explain the missing requirement.

12. ELIGIBLE TO OPEN

Show:

AVAILABLE

Required stake / gate

Primary action:

[ OPEN INDUSTRY ]

13. GRACE PERIOD

Show:

GRACE PERIOD

Stake requirement lost

Remaining grace time in personal city time.

Canonical grace:
24 city hours.

Do not imply that withdrawn tokens remain live stake during settlement merely because gameplay grace remains active.

14. FROZEN

Show:

FROZEN

Explain the relevant access restriction.

Disable actions that are not actually available.

15. EFFICIENCY

Efficiency may be displayed as a compact industry metric.

Example:

EFFICIENCY
108%

Do not label Efficiency as:
- guaranteed profit;
- guaranteed payout;
- guaranteed production increase.

Efficiency is a market-related industry modifier.

16. VISUAL STRUCTURE

Use the approved Corporator visual system:

- Bright Blue / Sky / Corporate Game UI;
- approved blue palette;
- approved typography;
- approved spacing;
- approved radii;
- approved cards;
- approved buttons;
- approved StatusChip;
- approved thumbnails.

Do not create a special visual style for Industry Detail.

17. INDUSTRY ARTWORK

Use the existing canonical beacon/building artwork.

Canonical mapping:

NVDA → AI Research Center
TSLA → Energy Plant
AMZN → Logistics Hub
AAPL → Flagship Store
MSFT → Cloud Campus
COIN → Finance Tower

Do not redesign, regenerate, or reinterpret the canonical artwork.

18. DATA HIERARCHY

Priority inside Industry Detail:

1. Industry identity
2. Access state
3. Tier
4. Stake
5. Main function
6. Resources / dependencies
7. Synergies
8. Activity

Do not give every metric equal visual weight.

19. WHAT DOES NOT BELONG HERE

Do not include:

- full progression tree;
- exclusive node selection;
- Merge planner;
- detailed stake transaction workflow;
- full transaction history;
- unverified token addresses;
- unsupported live market charts;
- physical building construction UI.

These are separate flows/workspaces.

20. COMPONENT COMPOSITION

Use:

Workspace
├── PanelHeader
├── BuildingThumbnail / BeaconThumbnail
├── StatusChip
├── Section
├── Metric / MetricRow
├── IndustryCard where appropriate
├── Progress where useful
├── Button
└── ListItem

Do not create one-off industry UI components.

21. INTERACTION

Industry Overview:

IndustryCard
→ View Industry
→ Industry Detail

Industry Detail:

→ Stake / Unstake
→ Progression
→ Synergy information
→ Activity

Detailed transaction flows and progression decisions remain separate screens.

22. DATA ACCURACY

Display only fields supported by the canonical content/rules.

Where runtime implementation is incomplete:
- use explicit unavailable state;
- do not present fixture/demo values as confirmed live state;
- do not invent missing values.

23. APPROVAL STATUS

INDUSTRY DETAIL v1.0
APPROVED

CORPORATOR — HUD DESIGN SYSTEM
UPDATE v1.6
STAKE / UNSTAKE FLOW

1. PURPOSE

Stake / Unstake is a transaction flow inside Industry Detail.

Flow:

INDUSTRY DETAIL
→ STAKE / UNSTAKE
→ REVIEW
→ CONFIRM
→ TRANSACTION STATE

Do not make Stake / Unstake part of the permanent HUD.

2. STAKE FLOW

The Stake interface is a compact transaction workspace.

Show:

- verified asset / token identity;
- ticker;
- wallet availability;
- current stake;
- amount to stake;
- resulting stake;
- required stake;
- tier threshold preview;
- allowance / approval only when supplied by the integration;
- actual external transaction steps.

3. STAKE LAYOUT

Header:

STAKE — [TICKER]

Main content:

TOKEN IMAGE
TOKEN NAME / TICKER

WALLET AVAILABLE
[value]

CURRENT STAKE
[value]

AMOUNT TO STAKE
[input]

AFTER STAKE
[value]

TIER PREVIEW
[current / next tier]
requirement

Primary action:

[ REVIEW STAKE ]

4. STAKE INPUT

Amount input must clearly specify the token unit.

Optional shortcuts:

25%
50%
75%
MAX

Only show shortcuts when they are valid for the actual wallet balance.

5. STAKE REVIEW

Review screen must show:

- asset;
- amount;
- current stake;
- resulting stake;
- tier preview;
- required quantity.

Actions:

[ CANCEL ]
[ CONFIRM STAKE ]

Never automatically stake after buying a Stock Token.

Buying a Stock Token does not automatically open its industry.

6. STAKE TRANSACTION STATES

Do not pretend the transaction is instantaneous.

Represent actual adapter/integration states.

Supported conceptual stages include:

- Preparing;
- Awaiting wallet;
- Submitted;
- Confirmed;
- Failed.

If the adapter exposes more precise stages, display those actual stages instead.

Do not fabricate blockchain/network states.

7. UNSTAKE FLOW

Unstake is a separate flow from Stake.

Show:

CURRENT STAKE
[value]

AMOUNT TO UNSTAKE
[input]

REMAINING STAKE
[value]

RESULTING TIER / REQUIREMENT STATE

GRACE PERIOD CONSEQUENCE
only if a threshold is lost.

Primary action:

[ REVIEW UNSTAKE ]

8. UNSTAKE WARNING

Before confirmation, clearly explain any gameplay consequence caused by losing the required stake.

Example:

⚠ TIER 2 REQUIREMENT LOST

Remaining stake:
1.4 × S_min

The industry enters a 24-city-hour grace period.

After grace:
industry freezes.

Do not hide this consequence behind a tooltip.

9. UNSTAKE REVIEW

Review must show:

- asset;
- amount;
- current stake;
- remaining stake;
- affected tier;
- whether the threshold is retained or lost;
- grace-period consequence when applicable;
- settlement warning when applicable.

Actions:

[ CANCEL ]
[ CONFIRM UNSTAKE ]

10. STAKE UNITS

Stake is always a token quantity.

Do not treat Stake as a dollar amount.

Compact displays may use:

1.8 × S_min

or:

[exact token quantity] [ticker]

S_min is the frozen threshold defined by the current content snapshot.

Do not derive a supposedly authoritative live requirement from stale fixture pricing.

11. GRACE PERIOD

Canonical gameplay grace period:

24 city hours.

Grace is shown using personal city time.

Important distinction:

ON-CHAIN UNSTAKE
≠
SERVER-SIDE GAMEPLAY GRACE / FREEZE

Do not imply that gameplay grace makes the withdrawn tokens count as live stake at settlement.

12. TRANSACTION UX

The UI must distinguish:

- user action;
- wallet approval;
- transaction submission;
- network confirmation;
- final application state.

Do not combine these into one fake “Loading…” step.

Disable duplicate submission during an active mutation.

Do not automatically retry financial mutations without an explicit idempotent protocol.

13. ERROR STATES

Financial failures must remain visible in the relevant workspace.

Examples:

- insufficient wallet balance;
- allowance/approval failure;
- wallet rejection;
- network failure;
- transaction failure;
- invalid amount;
- requirement violation.

Use clear human-readable explanations.

14. VISUAL DESIGN

Stake / Unstake uses the approved Corporator HUD system:

- Bright Blue / Sky / Corporate Game UI;
- approved blue palette;
- approved typography;
- approved spacing;
- approved radii;
- approved input fields;
- approved buttons;
- approved StatusChip.

Transaction screens must remain visually quieter than Industry Detail.

Primary hierarchy:

ASSET
→ AMOUNT
→ CONSEQUENCE
→ CONFIRMATION

15. COMPONENT COMPOSITION

Use existing primitives:

Workspace
├── PanelHeader
├── Thumbnail
├── Metric / MetricRow
├── Input
├── StatusChip
├── RequirementRow
├── Section
├── Button
└── TransactionStatus

Do not create a special transaction visual language.

16. ACCESSIBILITY

Never use color alone for:

- requirement met/lost;
- transaction success/failure;
- warning states.

Use:

icon + text + color.

Financial confirmation dialogs must have clear focus handling and must not silently disappear while a pending mutation is unresolved.

17. DATA ACCURACY

Only show fields supplied by the real integration/content state.

Where data is unavailable:

show an explicit unavailable state.

Do not replace missing balances, quotes, requirements, or transaction states with fake zeroes.

18. APPROVAL STATUS

STAKE / UNSTAKE FLOW v1.0
APPROVED

CORPORATOR — HUD DESIGN SYSTEM
UPDATE v1.7
INDUSTRY PROGRESSION

1. PURPOSE

Industry Progression is the dedicated progression interface for one selected industry.

Flow:

INDUSTRY DETAIL
→ PROGRESSION
→ TIER / NODE DECISION

Do not combine this screen with Merge management.

2. PROGRESSION MODEL

The progression system contains:

- 6 industries;
- 3 tiers per industry;
- 2 exclusive node choices per tier.

This creates:

36 progression nodes total.

Axes:

- Scale
- Thrift
- Depth
- Breadth
- Capital
- Paper

3. WORKSPACE

Use the established data-dense Workspace system.

Desktop:
approximately 760–960 px.

The 3D island remains visible on the left whenever viewport space allows.

4. HEADER

Header:

INDUSTRY PROGRESSION

Secondary identity:

COMPUTE · NVDA

Show:

- industry artwork;
- industry name;
- ticker;
- current tier.

Example:

COMPUTE
NVDA

CURRENT TIER
1

5. PRIMARY LAYOUT

Do NOT use a traditional node graph with many floating circles and connecting lines.

Use:

3 large vertical Tier blocks.

Structure:

TIER 1
→
TIER 2
→
TIER 3

Each Tier block contains:

- City Level gate;
- Stake requirement;
- Capital cost;
- Automatic Tier Dividend;
- exclusive node choices where applicable.

6. TIER GATES

Canonical gates:

Tier 1:
City Level 1
1 × S_min

Tier 2:
City Level 3
2 × S_min

Tier 3:
City Level 5
3 × S_min

Current generated Capital costs:

Tier 1:
0 Capital

Tier 2:
34,217,877 Capital

Tier 3:
128,317,038 Capital

Display exact internal accounting values when the current content provides them.

7. TIER STATE

Support:

- Current
- Unlocked
- Available
- Locked

Use clear state combinations.

Example:

TIER 1
CURRENT

TIER 2
LOCKED
Requires City Level 3
Requires 2 × S_min

TIER 3
LOCKED
Requires City Level 5
Requires 3 × S_min

8. AUTOMATIC TIER DIVIDEND

Every tier may provide its automatic Tier Dividend.

Show this in a clearly separate section:

AUTOMATIC DIVIDEND

[effect]

Important:

Automatic Tier Dividend is NOT the same thing as the exclusive node choice.

Never visually merge these into one reward block.

9. EXCLUSIVE NODE CHOICES

For the currently actionable Tier, show exactly two alternatives.

Example:

CHOOSE YOUR PATH

┌────────────────┐    ┌────────────────┐
│ SCALE          │    │ THRIFT         │
│ [effect]       │    │ [effect]       │
│                │    │                │
│ [ SELECT ]     │    │ [ SELECT ]     │
└────────────────┘    └────────────────┘

The two choices are mutually exclusive.

10. NODE STATES

Each node supports:

- Available
- Selected
- Locked
- Excluded

Selected:

✓ SELECTED

Unselected alternative after commitment:

LOCKED / EXCLUDED

Do not allow the interface to imply that both alternatives can be active simultaneously.

11. IRREVERSIBILITY

Before choosing an exclusive node, clearly show:

“This choice cannot be respecced under the current rules.”

This warning must appear near the decision action.

Do not hide irreversibility inside a tooltip.

12. SELECTED NODE

After commitment:

Show:

SELECTED

and the actual effect.

The alternative node must clearly appear unavailable/excluded.

Do not provide a Change / Respec button.

13. TIER SUMMARY

Provide a compact summary area showing:

TIER GATES

Tier 1
City Level 1
1 × S_min

Tier 2
City Level 3
2 × S_min

Tier 3
City Level 5
3 × S_min

14. CAPITAL COST SUMMARY

Provide a compact cost section:

CAPITAL COST

Tier 1      0
Tier 2      34,217,877
Tier 3      128,317,038

Do not convert these internal units into an invented USD value.

15. KEY RULES

Show a compact rules summary:

- 3 tiers per industry;
- 2 exclusive node choices per tier;
- Automatic Tier Dividend is separate from node choice;
- No respec;
- Merge effects are separate from progression node choices.

16. MERGE SEPARATION

Do NOT place Merge pairing controls on the Progression screen.

Merge is a separate system.

Merge rules belong to the dedicated Merge workspace.

17. VISUAL HIERARCHY

Priority:

1. Current Tier
2. Tier gate
3. Automatic Dividend
4. Exclusive node choices
5. Capital cost
6. Supporting rules

The currently actionable Tier must receive the strongest visual emphasis.

Locked future tiers must remain readable but visually secondary.

18. CURRENT-TIER EMPHASIS

For the currently active Tier:

- stronger panel emphasis;
- clearer selected/current badge;
- stronger border/highlight;
- full node-choice interaction.

Future tiers:

- muted state;
- lock indicator;
- readable requirements;
- no misleading active controls.

19. VISUAL SYSTEM

Use the approved Corporator HUD system:

- bright blue / sky / corporate game palette;
- approved typography;
- approved spacing;
- approved radii;
- approved cards;
- approved status chips;
- approved progress indicators;
- approved buttons.

Do not create a new visual language for Progression.

20. ARTWORK

Use existing canonical industry/beacon artwork.

Do not redesign buildings or create new physical structures to represent progression.

Progression is economic/function progression, not physical construction.

21. COMPONENT ARCHITECTURE

Use:

Workspace
├── PanelHeader
├── IndustryIdentity
├── TierCard
│   ├── Gate
│   ├── StakeRequirement
│   ├── CapitalCost
│   ├── AutomaticDividend
│   └── NodeChoiceGroup
│       ├── NodeChoice
│       └── NodeChoice
├── RuleSummary
└── Button

22. DATA RULE

Use only values from current canonical content / generated pack.

Do not invent:

- node effects;
- node costs;
- additional tiers;
- extra choices;
- respec;
- construction mechanics;
- guaranteed profit.

23. RUNTIME QUALIFICATION

The progression system is authored/generated in content, but the current API does not implement:

- tier unlock;
- node selection.

Therefore:

- design the canonical UI completely;
- use fixture/demo values only when explicitly labeled;
- do not present fixture-backed progression as live server state;
- unavailable live state must be represented as unavailable rather than silently converted to zero.

24. APPROVED VISUAL COMPOSITION

The approved visual pattern is:

Industry identity
↓
Three Tier blocks
↓
Current Tier emphasized
↓
Automatic Dividend separated from node choice
↓
Two exclusive node choices
↓
Tier gates / costs / rules summary

25. FINAL DESIGN PRINCIPLE

Progression should feel like:

A CLEAR STRATEGIC CHOICE

not:

A COMPLEX SKILL TREE.

The player must understand immediately:

WHAT TIER AM I ON?
→
WHAT DO I GET AUTOMATICALLY?
→
WHICH OF TWO PATHS DO I CHOOSE?
→
WHAT AM I GIVING UP?

26. APPROVAL STATUS

INDUSTRY PROGRESSION v1.0
APPROVED

CORPORATOR — HUD DESIGN SYSTEM
DOCUMENTATION UPDATE
SECTIONS 8.5 + 8.6

==================================================
8.5 INDUSTRY MERGES
==================================================

1. PURPOSE

Industry Merges are a dedicated management workspace for combining two
eligible industries.

Merge is a separate system from:
- Industry Overview;
- Industry Detail;
- Industry Progression;
- Synergies.

Do not combine Merge controls with the Progression tree.

2. MERGE MODEL

Canonical rules:

- There are 9 valid merge pairs.
- Both industries must be Tier 2+.
- Each industry may belong to only one active merge.
- Maximum 3 active merges.
- respec_allowed = 0.
- Merge effect uses the full Tier-1 dividend of each participating industry.
- Automation merge may add +1 offline_cap_hours.
- Total offline cap can never exceed 18 hours.

The current content/generator is authoritative for merge magnitude.
The older statement in DESIGN.md describing half of the Tier-1 dividend is stale.

3. VALID MERGE PAIRS

The nine current valid pairs are:

- Automation + Consumer
- Automation + Energy
- Automation + Logistics
- Compute + Consumer
- Compute + Finance
- Consumer + Energy
- Consumer + Finance
- Energy + Finance
- Finance + Logistics

Do not invent additional merge pairs.

4. WORKSPACE HEADER

Header:

MERGES

Right-side summary:

ACTIVE MERGES
X / 3

Optional:

[ VIEW INDUSTRIES ]

5. ACTIVE MERGES

Show up to three active merge slots.

Structure:

ACTIVE MERGES

[ INDUSTRY A ] + [ INDUSTRY B ]

INDUSTRY A
Tier 2+
[ Tier-1 dividend / effect ]

INDUSTRY B
Tier 2+
[ Tier-1 dividend / effect ]

MERGE EFFECT
[ combined effect ]

[ MANAGE ]

Unused slot:

+ EMPTY MERGE SLOT

Choose two Tier 2+ industries.

6. AVAILABLE MERGE PAIRS

Use one shared component:

MergePairCard

Each valid pair uses the same visual structure.

Show:

- Industry A;
- Industry B;
- Tier of each;
- relevant individual effects;
- resulting merge effect;
- Capital cost;
- action state.

Primary action:

[ MERGE ]

7. CURRENT MERGE COST

Current generated merge cost:

42,772,346 Capital

Use the current generated content value.

Do not convert this internal Capital amount into an invented USD value.

8. UNAVAILABLE PAIRS

Unavailable pairs must remain understandable.

Do not simply gray them out.

Show:

LOCKED

Reason:
[ actual reason ]

Possible reasons include:

- one industry is below Tier 2;
- one industry is already in an active merge;
- maximum 3 active merges reached;
- another current eligibility restriction.

Do not invent a reason when the real state does not provide one.

9. MERGE REVIEW

Selecting a valid merge opens a confirmation state.

Show:

REVIEW MERGE

INDUSTRY A
Tier
Effect / Tier-1 dividend

+

INDUSTRY B
Tier
Effect / Tier-1 dividend

----------------

COMBINED EFFECT
[ resulting effect ]

COST
42,772,346 Capital

ACTIVE MERGES
X / 3

Warning:

This merge cannot be reversed.

Actions:

[ CANCEL ]
[ CONFIRM MERGE ]

10. MERGE EFFECT

Merge effect must be displayed separately from:

- Tier automatic dividend;
- progression node choice;
- synergy.

Do not visually merge these systems.

11. AUTOMATION MERGE

When Automation participates in a merge, show:

+1 OFFLINE HOUR

Also show:

OFFLINE CAP
18 HOURS MAX

Never imply a resulting 19-hour cap.

12. MERGE RULES BLOCK

Compact rules summary:

- Both industries must be Tier 2+
- One active merge per industry
- Maximum 3 active merges
- No respec
- Full Tier-1 dividends
- Merge effect is separate from progression node choices
- Automation merge +1 hour remains subject to the 18-hour hard cap

13. VISUAL DESIGN

Use the existing approved Corporator HUD system.

Do not create a separate visual language for Merges.

Use:

Workspace
MergeSlot
MergePairCard
StatusChip
Metric
Section
Button
Warning

14. INTERACTION MODEL

INDUSTRY
→ PROGRESSION / DETAIL
→ MERGES
→ SELECT VALID PAIR
→ REVIEW
→ CONFIRM

Do not create physical construction behavior or new buildings as a visual result of merging.

15. RUNTIME QUALIFICATION

Merge is authored/generated in content. API `commit:merge` is live: the client
posts `merge_id` from `generated.progression.progression_merges`. Matching,
min-tier, pack magnitude (`C-20`) and `merge_cost` are enforced on the server.

Therefore:

- design the canonical UI fully;
- fixture/demo states may be used explicitly;
- do not present fixture data as live state;
- a matching block is `MERGE_MATCHING_BLOCKED`, not a silent grey button.


==================================================
8.6 RESEARCH WORKSPACE
==================================================

1. PURPOSE

Research is a dedicated functional-progression workspace.

It is separate from:

- Industry Progression;
- Industry Merges;
- physical building construction.

Research improves defined city functions/effects.

2. RESEARCH ITEMS

Exactly five research items:

- Grid
- Tools
- Handbook
- Circuits
- Lathe

Do not add additional research items.

3. WORKSPACE SIZE

Use the established data-dense workspace.

Desktop:

760–960 px

Keep the island visible on the left whenever the viewport allows.

4. HEADER

Header:

RESEARCH

Right side:

5 RESEARCH ITEMS

Do not add unsupported statistics.

5. PRIMARY LAYOUT

Do not use a skill-tree layout.

Use a simple research grid:

3 cards on the first row
2 cards on the second row

All research items use the same:

ResearchCard

component.

6. RESEARCH CARD

Each card contains only supported fields:

- Research name;
- Artwork;
- Effect;
- Capital cost;
- Duration in city ticks;
- Requirements;
- State.

Basic structure:

[ ARTWORK ]

GRID

-15% Energy Cost

CAPITAL COST
10,265,363

DURATION
36 city ticks

REQUIREMENTS
[ actual requirements ]

[ START RESEARCH ]

7. CURRENT GENERATED VALUES

Current generated values used for the approved visual concept:

GRID
-15% Energy Cost
10,265,363 Capital
36 city ticks

TOOLS
+10% Output
6,843,575 Capital
24 city ticks

HANDBOOK
+10% XP Rate
6,843,575 Capital
24 city ticks

CIRCUITS
-10% Compute Cost
6,843,575 Capital
24 city ticks

LATHE
+10% Upgrade Speed
6,843,575 Capital
24 city ticks

These are current generated/content values and must not be replaced by
invented alternatives.

8. RESEARCH STATES

ResearchCard supports:

AVAILABLE

[ START RESEARCH ]

RESEARCHING

[ progress / city ticks ]

COMPLETE

✓ COMPLETE

UNAVAILABLE

LOCKED
Reason: [ actual requirement/state ]

Supported state model:

- available;
- researching;
- complete;
- unavailable.

9. RESEARCH DETAIL

Clicking a ResearchCard opens a compact Research Detail / Confirmation view.

Do not open another large management dashboard.

Show:

RESEARCH: [NAME]

EFFECT
[ exact effect ]

CAPITAL COST
[ value ]

DURATION
[ city ticks ]

REQUIREMENTS
[ actual requirements ]

Actions:

[ CANCEL ]
[ START RESEARCH ]

10. EFFECT LANGUAGE

Show the exact functional effect.

Do not translate the effect into:
- guaranteed profit;
- guaranteed payout;
- guaranteed production revenue.

Research explains a defined modifier/effect.

11. DURATION

Primary unit:

CITY TICKS

An equivalent real-time duration may be shown secondarily as explanatory help.

Do not replace city ticks with an invented timer.

12. REQUIREMENTS

Show actual requirements supplied by content.

Typical requirement information may include:

- City Level;
- industry/tier requirement;
- Capital requirement.

Do not invent requirements for a specific research item.

13. RESEARCHING STATE

When active:

Show current progress using city ticks.

Example:

23 / 24 TICKS

Do not invent queue capacity or simultaneous-research rules.

14. COMPLETED STATE

Completed research remains visually recognizable:

✓ COMPLETE

Do not show START RESEARCH again unless the actual rules support repeatability.

15. UNAVAILABLE STATE

Locked research must show the reason.

Example:

LOCKED

Requires:
[ missing requirement ]

Do not silently display zero values.

16. VISUAL DESIGN

Use the approved Corporator HUD system:

- Bright Blue / Sky / Corporate Game UI;
- approved typography;
- approved spacing;
- approved radii;
- approved cards;
- approved status chips;
- approved buttons;
- existing artwork system.

All five cards must be visually identical in structure.

17. COMPONENT ARCHITECTURE

Use:

Workspace
├── PanelHeader
├── ResearchGrid
│   ├── ResearchCard
│   ├── ResearchCard
│   ├── ResearchCard
│   ├── ResearchCard
│   └── ResearchCard
└── ResearchDetail

ResearchCard variants:

- available;
- researching;
- complete;
- unavailable.

18. WHAT DOES NOT BELONG HERE

Do not add:

- research queue unless explicitly implemented;
- simultaneous research counters;
- fake progress;
- market charts;
- construction states;
- physical building replacement;
- unsupported research effects;
- unsupported research items.

19. RUNTIME QUALIFICATION

Research content and formulas are generated, but the current Research UI/runtime is
partial and the research start command is not implemented in the current API.

Therefore:

- canonical UI may be designed fully;
- fixture/demo values may be used explicitly;
- live unavailable states must remain honest;
- do not present prototype research execution as live functionality.

20. FINAL VISUAL PRINCIPLE

Research should feel like:

A CLEAN TECHNOLOGY UPGRADE CATALOG

not:

A COMPLEX RPG SKILL TREE.

The player should immediately understand:

WHAT DOES THIS RESEARCH DO?
→
HOW MUCH DOES IT COST?
→
HOW LONG DOES IT TAKE?
→
WHAT DOES IT REQUIRE?
→
CAN I START IT?


==================================================
APPROVAL STATUS
==================================================

INDUSTRY MERGES v1.0
APPROVED

RESEARCH WORKSPACE v1.0
APPROVED

CORPORATOR — HUD DESIGN SYSTEM
UPDATE v1.8
UI ICON SYSTEM

1. PURPOSE

All interface icons must belong to one unified icon system.

UI icons are NOT game artwork and must NOT be generated as PNG/JPG assets.

Examples:

- lock;
- currency;
- energy;
- compute;
- agent;
- research;
- merge;
- success;
- warning;
- time;
- close;
- navigation;
- filters;
- search.

2. ICON LIBRARY

Use ONE approved SVG icon library throughout the HUD.

Preferred implementation:

Lucide Icons

Use the library's native React/SVG components.

Do not mix multiple icon libraries unless explicitly approved.

Do not use emoji as interface icons.

Do not generate custom AI icons for standard UI concepts.

3. ICON RENDERING

All icons must be rendered as vector SVG.

Default:

- outline / stroke icon style;
- consistent visual weight;
- rounded stroke treatment where supported;
- transparent background;
- no rasterization.

Never use:

- emoji;
- arbitrary Unicode symbols;
- random PNG icons;
- screenshots of icons;
- AI-generated decorative symbols for functional UI.

4. STANDARD ICON SIZE SCALE

Use a controlled size scale:

12 px
16 px
20 px
24 px
32 px
40 px
48 px

Default UI icon:
16 px

Primary section icon:
20 px

Large feature / workspace icon:
24–32 px

Do not invent random sizes.

5. STROKE

Default icon stroke:

1.75 px

Use the same stroke weight across the HUD whenever the selected icon library supports configurable stroke width.

Do not mix extremely thin and extremely heavy icons.

6. ICON COLOR

Icons inherit semantic UI color.

Default:
secondary text color

Active:
cyan / approved interaction color

Success:
approved green

Warning:
approved amber

Error:
approved red

Locked:
muted secondary color

Important:

Color must never be the only indicator of state.

Always combine:
ICON + TEXT / LABEL / STATE.

7. SEMANTIC ICON MAP

Use the following canonical mapping.

GENERAL

Close
→ X

Search
→ Search

Filter
→ SlidersHorizontal / Filter

Help
→ CircleHelp

Back
→ ArrowLeft

Forward / Open
→ ArrowRight

Expand
→ Maximize2 / Chevron

Collapse
→ ChevronUp / ChevronDown

INFORMATION / STATE

Info
→ Info

Success / Complete
→ Check / CircleCheck

Warning
→ TriangleAlert

Error
→ CircleX

Locked
→ Lock

Unlocked
→ LockOpen

Loading
→ LoaderCircle

Time
→ Clock

INDUSTRIES / PROGRESSION

Industry
→ Building2

Tier / progression
→ Layers3

Merge
→ GitMerge / Link

Node choice
→ GitBranch

Industry efficiency
→ Gauge

STAKE / ECONOMY

Capital
→ Coins

Wallet
→ Wallet

Stake
→ Landmark / Coins where appropriate

Transaction
→ ArrowLeftRight

Cost
→ Coins

Requirement
→ BadgeCheck / ClipboardCheck where appropriate

ENERGY / COMPUTE

Energy
→ Zap

Compute
→ Cpu

Capacity
→ Gauge / HardDrive depending on context

AGENTS

Agent / workforce
→ Users

Single agent
→ User

Role
→ BriefcaseBusiness

Assignment
→ UserRoundCheck

Task
→ ClipboardList

XP
→ TrendingUp / Sparkles depending on context

Training
→ GraduationCap

Research
→ FlaskConical

BUILDINGS / FUNCTIONS

Building
→ Building2

Workshop / production
→ Factory

Bank
→ Landmark

Exchange
→ ArrowLeftRight

Power
→ Zap

Logistics
→ Truck / Package

Retail
→ Store

Research center
→ FlaskConical

ACTIVITY / EVENTS

Activity
→ Activity

Event log
→ ScrollText / List

Timestamp
→ Clock

Notification
→ Bell

Message
→ Mail

7. ICON + ARTWORK RULE

Use UI icons for interface meaning.

Use real game artwork for:

- buildings;
- agents;
- industry beacons;
- logos;
- research artwork;
- other canonical visual assets.

Never substitute a UI icon for a real building or agent thumbnail when the canonical asset exists.

Example:

CORRECT:
[real NVDA building thumbnail] + Lock icon

INCORRECT:
[generic building icon] instead of the NVDA building artwork.

8. ICON PLACEMENT

Icons are supporting visual anchors.

They should not dominate text.

Typical structure:

[icon] SECTION TITLE

[icon] Metric
value

[icon] Status
text

Avoid placing icons next to every single line of copy when they add no meaning.

9. ICON CONTAINER

Do not automatically place every icon inside a circle.

Use icon-only presentation when appropriate.

Use a small container only when the icon needs:
- emphasis;
- touch target;
- state background;
- grouping.

10. ICON-ONLY BUTTONS

Every icon-only control must have:

- accessible name;
- tooltip or equivalent discovery;
- visible hover state;
- visible focus state.

Examples:

[ X ]
[ ⚙ ]
[ 🔔 ]

The actual implementation must use approved SVG icons, not emoji.

11. STATUS ICONS

Status must always communicate through:

ICON + TEXT

Examples:

✓ COMPLETE

🔒 LOCKED

⚠ GRACE PERIOD

● RUNNING

The symbol and text must use the same semantic state.

12. UI ICON COMPONENT

Create ONE reusable component:

Icon

Recommended API:

Icon
├── name
├── size
├── color / semantic
├── strokeWidth
└── accessibility metadata

Do not directly style individual icons throughout the application.

13. ICON TOKENS

Define centralized tokens:

icon.size.xs = 12
icon.size.sm = 16
icon.size.md = 20
icon.size.lg = 24
icon.size.xl = 32
icon.size.display = 48

icon.stroke.default = 1.75

Additional icon variants must be added to the token system rather than hardcoded.

14. FORBIDDEN

Do not use:

- emoji icons;
- random Unicode symbols;
- Font Awesome mixed with Lucide;
- generated raster icon packs;
- arbitrary SVGs copied from unrelated visual systems;
- AI-generated functional icons;
- different icon families for different workspaces.

15. VISUAL CONSISTENCY

An icon must look like it belongs to the same product regardless of where it appears.

Therefore:

Building Workspace
Agents Workspace
Industry Workspace
Research Workspace
Bank
Exchange
Journal

all use the same icon library and icon rules.

16. CURSOR / AI IMPLEMENTATION RULE

When asking an AI coding agent to add an icon:

DO NOT WRITE:

“add a nice gear icon”

WRITE:

“Use the approved Icon component with the appropriate icon from the central Lucide registry, 16px,
strokeWidth 1.75.”

For example:

“Use `Lock` from the approved icon registry, size 16, semantic=muted.”

17. NO ONE-OFF ICONS

If a missing concept requires a new icon:

1. check Lucide first;
2. select the closest semantically accurate icon;
3. add it to the central icon registry;
4. document the mapping;
5. reuse it everywhere.

Do not create a custom SVG for one screen.

18. RESPONSIVE

Icon sizes may scale between desktop/tablet/mobile only through approved tokens.

Do not manually resize individual icons per screen.

19. ACCESSIBILITY

Never communicate a critical state through icon shape alone.

Use:

icon + text

for:
- locked;
- unavailable;
- success;
- failure;
- warning;
- working;
- idle;
- selected.

Icon-only controls require accessible names and keyboard focus.

20. FINAL RULE

UI ICONS = ONE SYSTEM

GAME ARTWORK = REAL CANONICAL ASSETS

These two systems must never be mixed.

The HUD should be assembled from:

TOKENS
+
PRIMITIVES
+
ICON SYSTEM
+
CANONICAL ARTWORK
+
DATA

not from individually invented visual elements.

21. APPROVAL STATUS

UI ICON SYSTEM v1.0
APPROVED

==================================================
8.8 SEASONS / FARM / CLAIMS — UI SPEC
==================================================

Create one unified "Seasons & Rewards" workspace with three tabs:

[ Season ] [ Farm ] [ Claims ]

The workspace is opened from the global-period chip in the Top Bar and from Overview.

Use the same data-dense workspace pattern as Industry / Research / Merges.
The island remains visible on the left.

--------------------------------------------------
1. SEASON
--------------------------------------------------

Purpose:
Show the player's participation in the global season and current prize period.

Canonical information:

- Global season identifier.
- Current 30-day prize period.
- Explicit global countdown.
- Influence.
- Positive days: X / 6.
- Stake qualification at settlement.
- Rank only when real ranking data exists.
- One-slot-per-wallet explanation.

Season structure:

- One season = 90 protocol days.
- One season contains 3 prize periods of 30 protocol days.
- All cities share the same global boundaries.
- Settlement occurs at the designated global 06:00 boundary.
- New cities do not receive backfilled global days before creation.
- Personal city time controls local work; GDP and Influence are assigned to global protocol days.

Season Summary UI:

- Season name / identifier.
- ACTIVE state when applicable.
- Current Period X / 3.
- Global countdown.
- Influence.
- Positive Days X / 6.
- Stake Qualification state.

Qualification wording:

Positive day = GDP_day > 0.

A prize-period entry requires:
- At least 6 positive global days in the 30-day period.
- At least one live playable stake at period settlement.

Do not present 6/6 as a guaranteed prize.
Show only the actual qualification progress and qualification state.

Stake qualification must be described as:
"Stake qualification checked at settlement."

Rank:

- Show rank only when actual ranking data is supplied.
- Never show placeholder rank as live data.
- Never invent leaderboard position or winners.

One-slot-per-wallet explanation:

"One leaderboard slot per wallet.
If multiple cities belong to this wallet, only the highest qualifying city result is used.
Scores are not combined."

--------------------------------------------------
2. FARM
--------------------------------------------------

Purpose:
Show participation in the global Farm reward window and the six internal fragment ledgers.

Farm is separate from Monthly leaderboard rewards.

Canonical reward assets:

- NVDA — Compute
- TSLA — Energy
- AMZN — Logistics
- AAPL — Consumer
- MSFT — Automation
- COIN — Finance

Do NOT use ETH, BTC, SOL or other non-canonical assets in Farm UI.

Fragments:

- Fragments are internal accounting units.
- Fragments are NOT Stock Tokens.
- Fragments are NOT ERC-20 assets.
- Fragments are used for reward allocation and settlement.

Farm window:

- 7 global protocol days.
- 175 real hours per window.
- All cities share the same Farm windows.
- Personal city calendars do not create separate Farm pools.
- Settlement occurs at the start of the next global window at its designated boundary.

Farm Overview must show:

- Current global Farm window.
- Settlement countdown.
- Six token-specific fragment ledgers.
- Current fragment quantity.
- Relevant fragment accrual information.
- Eligibility explanation.
- Fragment-rate cap where relevant.

Fragment ledger card structure:

- Asset ticker.
- Industry name.
- Current fragments.
- Relevant rate/modifier information.
- Eligibility state.
- Progress visualization only where it represents real fragment data.

Do NOT convert fragments into a guaranteed token amount before settlement.

Valid wording:

"Fragments participate in Farm settlement.
Final token allocation is determined at settlement."

Eligibility:

A tick accrues fragments only when it:
- Has paid status.
- Is not idle.
- Belongs to an industry beacon.
- Has an associated playable district.

These do NOT accrue fragments:
- Base functions.
- Synergy functions.
- Filler.
- Idle ticks.
- Unpaid ticks.

Fragment gross base:

Each playable beacon and level has an authored fragment_gross_base.
It is a Capital-equivalent accounting measure used for fragment calculation.
It does not mean that the beacon pays that amount of Capital.

Fragment modifiers apply before Payroll trimming.
Paid status determines eligibility.
The post-Payroll payment amount does not replace the authored gross basis.

Fragment rate:

- Neutral rate = 10,000 basis points = 1.00×.
- Maximum composed rate = 18,000 basis points = 1.80×.

Do not present the cap as a guaranteed reward multiplier.

--------------------------------------------------
3. CLAIMS
--------------------------------------------------

Claims are a separate tab in the same workspace.

Separate two claim categories:

A. FARM OWED CLAIMS
B. MONTHLY PRIZE CLAIMS

Never merge them into one reward type.

--------------------------------------------------
4. FARM OWED CLAIMS
--------------------------------------------------

A Farm settlement:

- Calculates the allocation.
- Records the amount owed.
- Clears the completed fragment ledger.

Clearing the ledger does NOT erase the owed claim.

UI must therefore distinguish:

Farm Ledger:
"0 fragments"
"Window settled"

from:

Owed Claim:
"1,240 NVDA"
"Ready to claim"

Never imply that clearing the ledger means the reward disappeared.

For each Farm owed claim show:

- Asset.
- Amount.
- Farm window / settlement period.
- Claim state.
- Coverage/refusal reason where relevant.
- Transaction progress where applicable.

--------------------------------------------------
5. MONTHLY PRIZE CLAIMS
--------------------------------------------------

Monthly rewards are tied to the 30-day prize period leaderboard.

Reward basket:

- NVDA
- TSLA
- AMZN
- AAPL
- MSFT
- COIN

Capital and $CORP are NOT prize basket assets.

Show only actual qualifying data.

A recorded allocation / entitlement is NOT the same thing as a completed wallet transfer.

Never present an entitlement as paid until the actual reward transfer is confirmed.

--------------------------------------------------
6. CLAIM DETAIL DRAWER
--------------------------------------------------

When a claim is selected, open a right-side Claim Details drawer.

Do not replace the main workspace.

Drawer content:

Header:
- Claim Details
- Close

Asset:
- Ticker / canonical asset identity.
- Claim type: Farm Reward or Monthly Prize.

Amount:
- Exact asset amount.
- Exact unit.

Source:
- Farm window or Monthly prize period.

Settlement:
- Settlement period / state.

Claim State:
Examples:
- Pending
- Ready
- Submitted
- Confirmed
- Failed
- Unavailable

Coverage / refusal reason:
Show when relevant.

Transaction Progress:

Use real adapter / integration transaction states.
Do not simulate instant success.

Possible lifecycle:

Preparing
→ Awaiting wallet
→ Submitted
→ Confirmed

or:

Failed

Use the actual available integration state rather than inventing unsupported intermediate states.

Disable duplicate submission.
Do not auto-retry money mutations without an explicit idempotent protocol.

--------------------------------------------------
7. FARM ALLOCATION RULES — UI EXPLANATION
--------------------------------------------------

For each asset:

raw allocation_i =
floor(fragments_i × asset pool / total fragments)

With two or more claimants:

city cap =
floor(asset pool × 0.50)

allocation_i =
min(raw allocation_i, city cap)

The cap does not apply with a single claimant.

Rounding dust and unallocated balances remain in the corresponding pool.

UI must NOT attempt to invent final reward amounts before settlement.

--------------------------------------------------
8. DUST
--------------------------------------------------

Do not put detailed Dust explanation on every main card.

Explain it in Claim Details / secondary information:

"Rounding or capped amounts remain in the corresponding pool and are not automatically distributed."

--------------------------------------------------
9. IMPORTANT UX RESTRICTIONS
--------------------------------------------------

Do NOT:

- Use fake leaderboard ranks.
- Use fake winners.
- Use invented prize pool totals.
- Use fake token prices.
- Use fake reward conversions.
- Show fragments as if they are transferable tokens.
- Mix Farm and Monthly claims.
- Treat cleared fragment ledgers as deleted owed claims.
- Add "Claim All" unless batch claim behavior is actually supported.
- Use ETH / BTC / SOL as Farm assets.
- Present an entitlement as completed payout before actual transfer confirmation.
- Create decorative financial charts that imply live market data.
- Invent unsupported claim lifecycle stages.

--------------------------------------------------
10. VISUAL COMPONENT SYSTEM
--------------------------------------------------

Use existing shared HUD primitives:

- Workspace
- PanelHeader
- Tabs
- Section
- Metric / MetricRow
- Progress
- StatusChip
- AssetCard / RewardCard
- ClaimCard
- InfoRow
- Button
- Drawer

Use the approved UI Icon System v1.0.

Standard UI icons must use Lucide Icons through the centralized Icon component.

Do not replace canonical asset / industry artwork with generic UI icons.

Use canonical asset identity and ticker mapping rather than identifying an asset only by logo.

--------------------------------------------------
11. RESPONSIVE / LAYOUT RULE
--------------------------------------------------

Desktop-first workspace.

Target width:
760–960px for the main Seasons & Rewards workspace.

When Claim Details is open:
- Keep the main workspace visible.
- Open the Claim Details drawer on the right.
- Do not cover the core workspace with a full-screen modal unless the viewport requires it.

The central island remains visible whenever possible.

--------------------------------------------------
12. RUNTIME STATUS
--------------------------------------------------

Treat the design above as canonical UI specification.

Current implementation is partial:
- fragment settlement logic exists,
- fragment accrual still has synthetic dependencies,
- fragment claim pays settled `fragment_owed` into `tokens_held` via live `commit:claim_fragment`; it does not hop to ERC-20 custody,
- full client reward state is incomplete.

Therefore fixture/demo values must never be presented as live values.

UI must derive live state from actual adapters / API data once available.

Do not invent missing data merely to fill the interface.

==================================================
END 8.8
==================================================

==================================================
8.9 JOURNAL / NOTIFICATIONS — CANONICAL UI SPEC
==================================================

Create Journal / Notifications as one reusable event system with three presentation layers:

1. Recent Activity
2. Journal
3. Notifications

Settings is intentionally omitted from 8.9. Section 8.10 is intentionally omitted and remains intentionally absent; there is no Settings / Assistance workspace.

The system must be implemented as a reusable constructor:
one shared event data model, one EventRow primitive, one notification state model, one filtering system, and shared presentation wrappers.

--------------------------------------------------
1. RECENT ACTIVITY
--------------------------------------------------

Persistent compact HUD element in the lower-right area.

Target size:
~270 × 160 px.

Show approximately 3–5 latest events.

Each event uses the shared EventRow/compact-event primitive.

Structure:

Recent Activity

[category icon] Event title
                  short consequence
                  timestamp

[category icon] Event title
                  short consequence
                  timestamp

[category icon] Event title
                  short consequence
                  timestamp

Behavior:

- Collapsible.
- No continuous auto-scroll.
- New events must not forcibly move the user's reading position.
- Event rows are clickable.
- Clicking an event opens the affected entity/workspace when a valid entity link exists.
- Recent Activity must be a presentation of the canonical event stream, not a second event system.

--------------------------------------------------
2. JOURNAL WORKSPACE
--------------------------------------------------

Full data-dense workspace opened from primary navigation.

Header:

JOURNAL
[Unread count when real]
[Mark as read when applicable]
[Close]

Do not show fake unread counts.

Journal is a full event history, not a dashboard of decorative cards.

--------------------------------------------------
3. JOURNAL FILTERS
--------------------------------------------------

Canonical filter categories:

- All
- Production
- Agents
- Functions
- Industries
- Economy
- Rewards
- System

Filters are implemented through one reusable Filter primitive.

Do not create custom filter components per category.

The selected filter must be represented by shared UI state.

--------------------------------------------------
4. SHARED EVENT ROW
--------------------------------------------------

EventRow is the core reusable component for the entire event system.

Do NOT create separate components such as:

- FarmEventCard
- BankEventCard
- AgentEventCard
- ResearchEventCard

Use one EventRow with typed data.

Canonical EventRow fields:

- category
- event type
- timestamp
- clock context
- title
- consequence
- reason, when applicable
- affected entity, when applicable
- transaction/proof link, when applicable
- read/unread state
- relevant state/status

Example structure:

[ICON]  CATEGORY
        Human-readable title
        Short consequence

        Entity: Workshop #04
        Reason: Insufficient Energy

        2h ago                         >

Optional:
[View transaction / proof]

--------------------------------------------------
5. EVENT TIMESTAMP
--------------------------------------------------

Every event has timestamp + clock context.

Primary display may use compact relative time:

- 2m ago
- 1h ago
- 1d ago

Detail/tooltip must be able to expose the full timestamp and relevant clock context.

Personal city time and global protocol time are separate systems.
Do not silently mix them.

--------------------------------------------------
6. EVENT CATEGORIES
--------------------------------------------------

Canonical categories:

Production
Agents
Functions
Industries
Economy
Rewards
System

Category icons must come from the approved centralized Lucide Icon System.

Do not use random SVGs, emoji, arbitrary Unicode, generated AI icons, or mixed icon libraries.

The event model determines the category; the centralized icon registry determines its visual representation.

--------------------------------------------------
7. EVENT CONSEQUENCE
--------------------------------------------------

Each event should communicate both:

1. What happened.
2. What consequence it caused.

Examples:

"Workshop — Work stopped"
"Production paused due to insufficient Energy."

"Agent assigned"
"Agent #07 assigned to Power Node."

"Farm settlement completed"
"Fragment allocation recorded for NVDA."

Use concise human-readable copy.

Do not expose raw internal state codes as the primary user-facing message when a canonical localized description exists.

--------------------------------------------------
8. REASON
--------------------------------------------------

Reason is a separate field.

Examples:

Status: Idle
Reason: Insufficient Energy

or:

Command refused
Reason: Incompatible assignment

Do NOT collapse every failure into one generic "error" field.

The system must distinguish:

- Economic idle reason
- Command refusal
- Network failure
- Chain transaction failure
- Verification status

A transport/network error must not be stored or displayed as an economic DecisionRecord reason.

--------------------------------------------------
9. ENTITY LINKS
--------------------------------------------------

When an event affects a real entity, provide an entity link.

Possible destinations:

- Building / Function
- Agent
- Industry
- Research item
- Bank
- Season / reward period
- Other supported canonical entity

Example:

Event:
"Workshop — Work stopped"

Entity:
"Workshop #04"

Clicking the entity link opens the appropriate existing workspace/detail surface.

Never invent an entity mapping.

--------------------------------------------------
10. TRANSACTION / PROOF LINKS
--------------------------------------------------

When a real transaction or proof exists, allow navigation to it.

Examples:

- View transaction
- View proof
- Transaction hash / reference in technical detail

Only render transaction/proof controls when actual data exists.

Never generate fake transaction hashes, proof IDs, or blockchain references for live UI.

--------------------------------------------------
11. NOTIFICATIONS
--------------------------------------------------

Notifications are NOT a second event database.

Notifications are a presentation/state layer over the canonical event stream.

Architecture:

Canonical Event
    ↓
read / unread state
    ↓
Notification presentation

The Top Bar notification icon uses the same canonical unread state.

Unread badge:

- Show actual unread count only.
- Show "99+" only when required.
- Never use placeholder/fake unread counts.

--------------------------------------------------
12. MARK AS READ
--------------------------------------------------

Provide a "Mark as read" interaction.

Only show it when unread events actually exist.

Read/unread state must come from the actual event state or authoritative adapter.

Do not maintain an isolated fake local unread counter that can diverge from the underlying event stream.

--------------------------------------------------
13. DEDUPLICATION
--------------------------------------------------

Repeated identical warnings must be deduplicated according to the canonical event identity/deduplication rules.

Do not blindly merge different events merely because their visible text is similar.

Deduplication belongs to event data/state logic, not visual components.

--------------------------------------------------
14. TOASTS
--------------------------------------------------

Toasts are temporary feedback only.

Use them for short confirmations.

Examples:

"Stake confirmed."
"Agent assigned."
"Research started."

Important failures must also remain visible in the relevant workspace or Journal.

Never rely on a disappearing toast as the only record of a failure.

Architecture:

Persistent event
    ├── Recent Activity
    ├── Journal
    └── Notification state

Temporary UI feedback
    └── Toast

--------------------------------------------------
15. EVENT STATES
--------------------------------------------------

Do not overload one "status" field.

Represent dimensions independently where appropriate.

Example:

category = economy
eventType = transaction
transactionState = failed
readState = unread

Supported presentation states may include:

- read
- unread
- success
- warning
- error
- pending
- unavailable

State semantics must remain data-driven.

Never use color alone to communicate state.

--------------------------------------------------
16. EMPTY / LOADING / ERROR STATES
--------------------------------------------------

Required explicit states:

No events:
"No recent activity"

Filter empty:
"No events match this filter"

Loading:
"Loading journal…"

Unavailable:
"Journal unavailable"

Error:
"Unable to load journal"

Do not convert missing event data into zero.

Loading, stale, unavailable, and error remain distinct states.

--------------------------------------------------
17. REUSABLE COMPONENT CONSTRUCTOR
--------------------------------------------------

Required shared primitives:

- Workspace
- PanelHeader
- Tabs
- Filter
- Search, only where actually supported
- EventRow
- RecentActivityPanel
- NotificationBadge
- NotificationItem
- Toast
- StatusChip
- Icon

Recommended data flow:

Server / canonical event state
        ↓
Typed JournalEvent
        ↓
Selectors / filtering / unread state
        ↓
┌─────────────────┬──────────────────┬──────────────────┐
│ Recent Activity │ Journal Workspace│ Notifications    │
└─────────────────┴──────────────────┴──────────────────┘

Do not duplicate event formatting, icon mapping, category mapping, or state logic across screens.

--------------------------------------------------
18. DATA MODEL
--------------------------------------------------

Use a typed event model rather than component-specific object shapes.

Suggested conceptual fields:

JournalEvent {
  id
  timestamp
  clockContext
  category
  eventType
  title
  consequence
  reason?
  entityRef?
  transactionRef?
  proofRef?
  state
  readState
}

Exact field names must follow the repository's canonical data model and adapters.

Do not hardcode canonical strings, categories, icons, or state IDs in individual TSX components.

Use localization/content mechanisms for player-facing copy.

--------------------------------------------------
19. ACCESSIBILITY
--------------------------------------------------

Follow the approved global HUD accessibility rules.

Every icon-only control requires:

- accessible name
- tooltip/equivalent discoverability
- visible focus state

Provide:

- keyboard navigation
- Escape handling
- focus return
- reduced-motion support
- semantic tabs/dialogs where appropriate
- readable error associations

Do not make the 3D scene the only route to an essential event destination.

--------------------------------------------------
20. VISUAL SYSTEM
--------------------------------------------------

Use the approved Corporator HUD visual system:

- approved bright blue / sky / corporate foundation
- approved primary blue interaction
- green success/working
- amber warning/selection
- red error
- consistent panel treatment
- shared spacing scale
- shared typography
- shared corner radii
- approved Lucide icon system

Do not invent a new visual language for Journal.

Journal, Notifications, Recent Activity and all other workspaces must look like one product.

--------------------------------------------------
21. IMPORTANT RESTRICTIONS
--------------------------------------------------

Do NOT:

- Add Settings inside Journal.
- Add an email/inbox system.
- Add unsupported notification channels.
- Invent fake events to make the UI look populated.
- Invent fake unread counts.
- Invent fake transaction/proof data.
- Mix economic failures with transport failures.
- Create separate event components for each subsystem.
- Create independent event data stores.
- Auto-scroll the Journal continuously.
- Make Toasts the only error record.
- Use color alone for state.
- Replace canonical assets with generic event artwork.
- Add unsupported event categories.

--------------------------------------------------
22. RUNTIME STATUS
--------------------------------------------------

The current API/client event stream is partial.

Full per-agent idle/task/building event streaming is not yet implemented.
API log projection is currently limited and the client also has local event entries.

Therefore:

- Fixture/demo events may be used only in explicit fixture/prototype mode.
- Fixtures must be coherent and clearly identifiable.
- Missing live event data must be shown as unavailable/loading/error as appropriate.
- Do not present fixture rows as actual live player history.

--------------------------------------------------
23. FINAL UX PRINCIPLE
--------------------------------------------------

Journal / Notifications must answer:

"What happened?"
"What changed?"
"Why?"
"What entity was affected?"
"Can I inspect the transaction/proof?"
"Have I already read it?"

All three presentation layers must come from the same canonical event model.

ONE DATA MODEL.
ONE EVENT ROW.
ONE ICON SYSTEM.
ONE FILTER SYSTEM.
MULTIPLE REUSABLE PRESENTATIONS.

==================================================
END 8.9
==================================================


Используй существующую документацию как источник истины и внеси только утверждённые решения ниже. Не придумывай новые механики, значения, API или UI-элементы. Bank и Exchange — разные системы: Bank работает с конвертацией Capital → $CORP.

# 8.11 BANK — CANONICAL SPEC v1.0

## Назначение
Bank — UI для операций Capital → $CORP и связанных с ними банковских ограничений, резервирования мощности и voucher flow.

## Workspace
Bank открывается как отдельный right-side workspace.

Структура:
- Header: Bank + close
- Tabs: Deposit | Withdraw
- Summary / current state
- Основной контент выбранной вкладки
- TransactionStepper и ReviewPanel как shared-компоненты, повторно используемые также в Exchange / Stake и других transaction flows.

Bank не должен превращаться в отдельную глобальную панель на острове.

## Summary
Показывать:
- Wallet $CORP
- City Capital
- Bank Level
- Bank Status
- Pending reservation / transaction, только если реально существует

Не показывать fixture/mock values как реальные live-данные.

Если значение отсутствует или runtime его не предоставляет:
- показывать explicit unavailable/loading/error state;
- не подменять отсутствующее значение нулём.

## Deposit

Deposit = $CORP → Capital.

Deposit:
- не ограничен Bank hours;
- использует entry fee 2%;
- показывает quote;
- при необходимости показывает allowance;
- требует Review → Confirm transaction flow.

UI должен показывать:
- asset
- available wallet balance
- input amount
- fee
- resulting Capital
- quote
- allowance state, только если нужен
- transaction state

Важно:
API `commit:deposit` is live: the client posts `amount`. Capital is minted only through `mintFromBacking` after `corp_held` is debited. Review → Confirm remains. Do not treat a review screen as confirmed custody.

## Withdraw

Withdraw = Capital → $CORP.

### Statuses
Поддерживаемые состояния:
- Open
- Closed
- Depth-limited
- Daily-limit-exhausted
- Uncovered

Причина закрытия/ограничения должна быть явно показана пользователю.

### Bank hours
Withdraw открыт:
08:00–20:00 personal city time.

City Sunday:
- Withdraw closed.

Не скрывать ограничения — отображать актуальный статус и причину.

### Global limit
Global limit:
live pool ETH × 0.05

Лимит сбрасывается на каждом global protocol day.

Не превращать лимит в фиксированное число в документации или UI.

### Personal Bank Level share
Personal share of global capacity:

- L0 = 0%
- L1 = 25%
- L2 = 43.75%
- L3 = 57.82%
- L4 = 68.36%

Personal capability никогда не может превышать remaining global limit.

### Authorization / Reservation
Перед withdrawal presentation авторизация резервирует:
- capacity
- backing

И записывает:
- current pool depth
- personal availability
- global availability
- voucher fields

Reservation переживает global day boundary.

### Voucher
Voucher TTL:
3,750 real seconds = 62m 30s.

Voucher lifecycle:
- reservation open
- settled
- expired

Успешная presentation:
- consumes reservation
- completes withdrawal
- reduces backing
- updates Capital capacity

Expired voucher:
- cannot be presented
- unused reservation is released

UI должен явно различать:
- reservation recorded
- voucher issued
- presentation pending
- settled
- expired

Не считать создание reservation равным wallet transfer.

## Withdraw quote / markup

Bank markup:
- base = 10%
- Trader effects can reduce it
- floor = 6.5%

Точный conversion result зависит от существующего scaling / rounding logic.

Не придумывать дополнительные discount mechanics.

## Withdraw transaction flow
Использовать shared TransactionStepper.

Концептуальные transaction states:
- Preparing
- Awaiting wallet
- Submitted
- Confirmed
- Failed

Показывать только те states, которые реально предоставляет adapter/runtime.

ReviewPanel перед подтверждением должен показывать:
- asset
- amount
- current Capital
- resulting $CORP / quote
- bank markup
- reservation / capacity impact, если применимо
- relevant expiration information, если voucher уже создан
- final confirmation action

## Critical runtime limitation
Текущий runtime поддерживает Bank только частично.

Из authoritative implementation state:
- engine reservation path существует;
- API `commit:withdraw` is live: authorize then present; Capital burns, vault $CORP credits `corp_held`;
- tick `withdraw_intent` / `bankWithdraw` still fills immediately (`C-22`, left in place).

Поэтому документация и UI должны описывать canonical intended flow, но НЕ выдавать его за полностью работающий production flow.

При отсутствии backend capability:
- не симулировать подтверждение;
- не показывать fabricated transaction hash;
- не показывать fabricated wallet transfer;
- не показывать fake success state;
- использовать explicit partial/unavailable state.

## Actions

Deposit:
- Enter amount
- Review
- Confirm

Withdraw:
- Enter amount
- Authorize / Reserve
- Present voucher, только если capability реально доступна
- Review / Confirm transaction на соответствующем этапе

Не добавлять Claim All, Settings, AI/Companion/Advisor или другие несогласованные actions.

## Shared constructor rules

Bank должен собираться из существующих canonical HUD primitives:
- Workspace
- PanelHeader
- Tabs
- Section
- Metric / MetricRow
- StatusChip
- Progress, только когда реально нужен
- TransactionStepper
- ReviewPanel
- Button
- Icon

Использовать централизованную систему Lucide Icons и существующие HUD spacing / typography / token rules.

Не создавать one-off UI patterns специально для Bank.

## States
Для всех Bank screens предусмотреть:
- Loading
- Available
- Unavailable
- Closed
- Limited
- Empty, только когда это действительно допустимое состояние
- Error
- Pending
- Confirmed
- Failed
- Expired

Никогда не трактовать missing data как 0.

## Terminology
Использовать последовательно:
- Capital
- $CORP
- Bank Level
- Global Limit
- Personal Capability
- Reservation
- Backing
- Voucher
- Voucher TTL
- Markup
- Deposit
- Withdraw
- Settlement

Не заменять эти термины произвольными синонимами.

## Visual / UX intent
Bank должен выглядеть как premium financial workspace внутри существующего Corporator HUD:
- чистая bright blue / sky / corporate visual system;
- высокий контраст;
- data-dense, но без перегруза;
- остров остаётся видимым слева;
- один основной workspace одновременно;
- City Status и Recent Activity подавляются при открытом workspace согласно общему HUD rule;
- Top Bar и Economy остаются;
- Building Popover закрывается.

Главный принцип:
Bank UI показывает реальное состояние системы, ограничения и transaction lifecycle. Никаких выдуманных live values, успешных транзакций или backend capabilities.



Используй существующую документацию как источник истины и внеси только утверждённые решения ниже. Не придумывай новые механики, значения, API, market data или transaction states.

# 8.12 EXCHANGE — CANONICAL SPEC v1.0

## Назначение

Exchange — workspace для покупки реальных Stock Tokens за `$CORP`.

Canonical purchase route:

$CORP → ETH → USDG → Stock Token

Exchange и Bank — разные системы:
- Bank = Capital → `$CORP`
- Exchange = `$CORP` → Stock Token

Покупка Stock Token не делает automatic stake и не открывает Industry.

## Workspace

Exchange открывается как отдельный right-side workspace.

Структура:
- Header: Exchange + Close
- Select Stock Token
- Buy Amount
- Quote
- Fees / Execution Conditions
- Review
- Transaction status

Использовать общий HUD workspace layout.

При открытом Exchange:
- City Status скрывается;
- Recent Activity скрывается;
- Building Popover закрывается;
- Top Bar и Economy остаются;
- остров остаётся видимым слева.

Не создавать отдельный постоянный Exchange panel поверх острова.

## Availability

Exchange относится к `market` schedule:
- 08:00–20:00
- Sunday closed

Если Exchange закрыт:
- показывать explicit Closed state;
- показывать актуальное объяснение;
- не разрешать execution.

Exchange также требует City Level 2.

Не превращать `city level requirement` в market price или transaction fee.

## 1. Select Stock Token

Canonical assets:
- NVDA
- TSLA
- AMZN
- AAPL
- MSFT
- COIN

Выбор target asset должен основываться на verified ticker/address mapping.

Нельзя идентифицировать asset только по логотипу.

Для каждого asset использовать реальную интеграцию, если она существует.

Не показывать invented token addresses.

## 2. Buy Amount

Основной input:
- `$CORP` amount

Показывать:
- available `$CORP` wallet balance;
- selected Stock Token;
- input amount;
- receive estimate, только если существует актуальный quote.

Не рассчитывать live market quote на клиенте из fixture/stale values.

Если quote отсутствует:
- `Quote unavailable`
или
- `Quote stale`

а не fake executable value.

## 3. Quote

Quote block показывает только реальные данные integration:

- estimated receive amount;
- quote freshness / age;
- route;
- fees;
- price impact;
- minimum received, если реально предоставляется;
- slippage condition, только если integration это поддерживает;
- approval requirement, если существует.

Route:

$CORP → ETH → USDG → Stock Token

Funding acquisition routes могут различаться по asset:
- COIN использует WETH route;
- остальные reward tickers используют USDG.

Не скрывать asset-specific route.

## 4. Fees / Execution Conditions

Отдельный компактный section.

Показывать:
- route;
- actual fees;
- price impact;
- minimum received;
- slippage condition;
- token approval;
- quote timestamp / freshness.

Reference funding parameter:
3 basis points hop haircut.

Важно:
3 bps — это reference parameter funding model, а не универсальная замена реальным execution terms.

Не придумывать дополнительные комиссии, spread или discount mechanics.

## 5. Review

Перед подтверждением использовать общий `ReviewPanel`.

Review обязан показывать точно:
- input asset: `$CORP`;
- input amount;
- target Stock Token;
- route;
- estimated received;
- fees;
- price impact;
- minimum received / slippage condition, если поддерживается;
- approval state;
- quote freshness.

Не скрывать существенные execution conditions.

## 6. Approval

Если token approval требуется:
- показать его отдельным понятным шагом;
- не считать approval покупкой;
- не считать approval confirmation final trade confirmation.

Использовать shared transaction flow.

## 7. Transaction

Использовать общий `TransactionStepper`.

Canonical conceptual stages:
- Preparing
- Awaiting approval / wallet
- Submitted
- Confirmed
- Failed

Использовать только состояния, реально поддерживаемые adapter/runtime.

Не делать fake instant confirmation.

Не auto-retry финансовую mutation без explicit idempotent protocol.

После submit заблокировать duplicate submission.

## 8. After Purchase

После подтверждённой покупки разрешена навигация:
`Go to Industry / Stake`

Но эти действия всегда отдельные:

Buy Stock Token
≠
Stake Stock Token
≠
Open Industry

Никакого automatic staking.

Никакого automatic industry activation.

Это должно быть явно объяснено в UI там, где пользователь принимает решение о покупке.

Canonical copy concept:
“Buying a Stock Token does not automatically open its industry.”

## 9. Market Charts

Charts — optional.

Добавлять chart только при наличии реальных historical market data.

Запрещены:
- fake price charts;
- decorative candlestick charts;
- fabricated historical values;
- static demo graphs presented as live market data.

Quote freshness важнее декоративной визуализации.

## 10. Market / Game Data Separation

Stock Token market data и in-game industry effects — разные сущности.

Exchange отвечает за:
- market quote;
- route;
- execution;
- asset purchase.

Industry UI отвечает за:
- stake;
- industry access;
- efficiency;
- progression;
- game effects.

Не смешивать market price с in-game efficiency modifier.

## 11. States

Exchange должен явно поддерживать состояния:

- Loading
- Available
- Quote Available
- Quote Stale
- Quote Unavailable
- Market Closed
- City Level Locked
- Insufficient `$CORP`
- Approval Required
- Awaiting Wallet
- Submitted
- Confirmed
- Failed
- Service Degraded
- Integration Unavailable

Missing data никогда не превращать в zero.

Stale quote никогда не отображать как executable live quote.

## 12. Runtime limitation

Current production/runtime limitation должна быть сохранена в документации.

Production DEX:
- quote;
- buy;
- stock-hop execution

не подключены полностью к default service.

Следовательно:
- simulated quote ≠ completed purchase;
- mock result ≠ real execution;
- client fixture ≠ live market data.

Не показывать fabricated:
- live price;
- executable quote;
- transaction hash;
- confirmed purchase;
- received token balance;
- chain receipt.

UI должен отражать partial / unavailable integration state, если capability отсутствует. HUD does not open Review → Confirm until the hop is priced; otherwise `EXCHANGE_HOP_UNAVAILABLE` before the wizard.

## 13. Shared Constructor

Exchange строится только из canonical HUD primitives:

- Workspace
- PanelHeader
- Section
- Tabs, только если реально нужны
- Metric / MetricRow
- StatusChip
- TransactionStepper
- ReviewPanel
- Button
- Icon

Не создавать уникальные одноразовые компоненты без необходимости.

Использовать централизованную Lucide Icon system и существующие spacing / typography / color / state tokens.

## 14. Visual Direction

Exchange должен соответствовать общей Corporator HUD системе:

- bright blue / sky / corporate;
- premium financial interface;
- чистый data-dense layout;
- высокая читаемость;
- минимум декоративного шума;
- остров остаётся видимым;
- transaction state визуально очевиден;
- реальные финансовые условия важнее декоративных элементов.

Не добавлять:
- Settings;
- Companion;
- Advisor;
- AI assistant;
- Construction UI;
- глобальную bottom action bar.

## 15. Terminology

Использовать последовательно:

- Exchange
- `$CORP`
- Stock Token
- Ticker
- Quote
- Route
- Price Impact
- Fee
- Minimum Received
- Slippage
- Approval
- Transaction
- Confirmed
- Failed
- Quote Freshness
- Industry
- Stake

Не называть Stock Token “shares”, если это не термин конкретной external integration.

## Главный принцип

Exchange показывает реальную процедуру покупки Stock Token и реальные execution conditions.

Он НЕ является:
- внутренним обменником с фиксированным курсом;
- автоматическим Industry unlock;
- автоматическим staking flow;
- генератором фейковых market values.

Canonical flow:

Select Token
→ Enter `$CORP`
→ Get real quote
→ Review route / fees / execution conditions
→ Approval if required
→ Confirm purchase
→ Transaction result
→ Optional navigation to Stake / Industry





Responsive — это не отдельный дизайн для desktop/tablet/mobile, а единый adaptive layer поверх уже существующего HUD. Все экраны должны собираться в Cursor как конструктор из общих primitives, tokens и view-models.


1. Responsive не масштабирует весь HUD целиком. Меняются только layout, density, visibility secondary information, ширина workspace, presentation mode и способ selection. Не уменьшать весь интерфейс до нечитаемого размера.

2. Использовать единый responsive layer с централизованными tokens:
- breakpoints
- safe-area
- rail-width
- workspace-width
- bottom-sheet-height
- panel-density
- visible-event-count
- navigation-mode
- selection-mode

Не писать хаотичные отдельные media-query решения внутри каждого экрана.

3. LARGE DESKTOP:
- обе summary rails видимы;
- Recent Activity может быть expanded;
- стандартная desktop HUD composition.

4. STANDARD DESKTOP:
- та же HUD composition;
- summary rails немного компактнее;
- secondary metrics компактнее;
- Recent Activity ограничивается по количеству;
- Building Popover не должен перекрывать основной visual focus острова.

5. 1280×720:
- Recent Activity collapsed by default;
- Capital/resource summary → compact strip;
- меньше постоянно видимых secondary city metrics;
- без global UI scaling.

6. TABLET LANDSCAPE:
- одновременно только один summary rail;
- management workspace → wider bottom sheet или single side workspace;
- touch targets минимум 44×44 px.

7. PORTRAIT MOBILE:
- compact Top Bar;
- Capital/resource summary strip;
- personal clock доступен без отдельного меню;
- management workspace → full-screen или near-full-screen;
- не сжимать desktop side panels;
- маленький floating Building Popover не использовать;
- Function List использовать как альтернативу точному 3D picking;
- учитывать safe-area;
- не требовать forced rotation.

8. Workspace:
- обычный desktop workspace примерно 420–520 px;
- data-dense workspace примерно 760–960 px;
- tablet/mobile → bottom sheet или full-screen;
- всё должно использовать один общий Workspace primitive.

Не создавать отдельные DesktopExchange/MobileExchange/DesktopBank/MobileBank и аналогичные дубликаты.

Canonical архитектура:
Canonical data
→ Shared View Model
→ Shared HUD Components
→ Responsive Layout Tokens
→ Desktop / Tablet / Mobile presentation.

9. Building Selection:
- источник selection всегда существующий Three.js picking + authored metadata;
- desktop → contextual Building Popover;
- small widths → Bottom Sheet;
- mobile → Function List fallback;
- не использовать guessed coordinates;
- не создавать отдельный mobile data model.

10. Bottom Navigation:
Permanent Bottom Navigation is removed and must not be implemented on any responsive mode.

Do not restore:
Overview / Agents / Exchange / Bank / Industries / Journal
as a permanent bottom-navigation bar.

Responsive adaptation must use existing contextual UI, workspace entry points, and approved non-permanent interaction paths.
Active state rules still apply to any controls that actually exist.

11. Safe Area:
все fixed HUD elements учитывают:
env(safe-area-inset-top)
env(safe-area-inset-right)
env(safe-area-inset-bottom)
env(safe-area-inset-left)

12. Touch / Pointer:
- minimum 44×44 px;
- scroll HUD panel не вращает camera;
- HUD pointer events не проходят в scene;
- camera drag не считается building click;
- keyboard focus не ломается blanket event suppression.

13. Overflow:
- нет horizontal page overflow;
- primary actions не выходят за viewport;
- safe-area не ломается;
- не уменьшать весь UI ради размещения контента.

Порядок адаптации:
reduce secondary information
→ change layout mode
→ local scrolling.

14. Responsive не меняет canonical data или meaning fields. Меняется только presentation.

15. Все canonical states сохраняются во всех режимах:
Loading / Available / Empty / Unavailable / Error / Pending / Confirmed / Failed.

Missing data никогда не превращать в zero.

16. Visual system единая для всех устройств:
- same colors
- same typography
- same spacing
- same borders
- same radii
- same shadows
- same Lucide icon system
- same semantic states
- same component hierarchy.

Не делать отдельный mobile visual style.

17. Accessibility rules уже утверждённого HUD должны работать во всех responsive modes:
- keyboard navigation;
- visible focus;
- Escape;
- focus return;
- semantic dialogs/tabs;
- accessible names;
- tooltips;
- WCAG AA;
- color not sole state indicator;
- reduced motion.

18. Responsive должен использовать только существующие HUD primitives:
Panel
PanelHeader
IconButton
StatusChip
ValueRow
ExactAmount
ProgressMeter
RequirementRow
Tabs
Tooltip
Drawer
ConfirmationDialog
EmptyState
ErrorState
TransactionStepper
Workspace
и другие уже зафиксированные canonical components.

Не создавать одноразовые responsive компоненты без необходимости.

19. Performance:
- не переинициализировать Three.js scene при смене responsive layout;
- сохранять один renderer instance;
- стабильный scene lifecycle;
- memoized selectors;
- localized clock updates;
- optimized thumbnails;
- lazy-load detail panels where appropriate.

20. Responsive testing:
проверить:
- Large Desktop;
- Standard Desktop;
- 1280×720;
- Tablet Landscape;
- Portrait Mobile;
- long names;
- large balances;
- dense roster;
- empty roster;
- errors;
- open workspace;
- building near screen edge;
- mobile keyboard on amount input;
- overflow;
- touch;
- reduced motion.

21. Explicit non-goals:
не добавлять:
- новые gameplay mechanics;
- новые screens;
- новые navigation destinations;
- construction UI;
- physical building placement;
- mobile-only game systems;
- Settings;
- Companion;
- Advisor;
- AI assistant.

22. Финальная canonical формулировка:

“One HUD system, one component library, one data model, multiple presentation modes.”

Responsive должен быть реализуем в Cursor как единая система переиспользуемых primitives + tokens, а не как набор независимых desktop/tablet/mobile экранов.





Accessibility должна быть частью общей HUD architecture и реализовываться на уровне shared primitives, чтобы все существующие screens/workspaces автоматически использовали одни и те же accessibility rules.

# 8.14 ACCESSIBILITY — CANONICAL SPEC v1.0

## 1. Core principle

Accessibility — не отдельная версия интерфейса.

Один shared component должен иметь один accessibility contract, который используется всеми workspace и responsive modes.

Не создавать отдельные accessibility-версии Bank, Exchange, Agents, Industries, Journal или других экранов.

## 2. Contrast

Использовать WCAG AA contrast там, где это применимо.

Accessibility не должна создавать отдельную visual style system.

Использовать существующие Corporator colors, typography, spacing, borders, shadows и semantic states.

## 3. Icon-only controls

Каждая icon-only button обязана иметь:
- accessible name;
- tooltip или другой discoverability mechanism;
- visible focus state.

Использовать существующий централизованный Lucide Icon component.

Не использовать icon-only controls без accessible label.

## 4. Color is not enough

Никогда не передавать состояние только через цвет.

Это относится как минимум к:
- working / idle;
- locked / open;
- paid / trimmed / unpaid;
- selected node;
- transaction success / failure.

Состояние должно дополнительно передаваться через text, icon, shape или другой уже существующий semantic indicator.

Не создавать новый status system.

## 5. Keyboard navigation

Все essential HUD actions должны быть доступны с keyboard.

Сохранить существующий `Escape` behavior:
Escape закрывает верхний dismissible overlay.

Не добавлять новые shortcuts, конфликтующие с существующими camera controls.

## 6. Focus

Для настоящих modal dialogs:
- использовать focus trap;
- после закрытия возвращать focus к triggering control.

Обычные non-modal workspaces не должны превращаться в modal focus trap без необходимости.

Все интерактивные controls должны иметь заметный visible focus state.

## 7. Semantic controls

Использовать semantic:
- tabs;
- dialogs;
- form controls.

Использовать существующие shared primitives:
- Tabs;
- ConfirmationDialog;
- ErrorState;
- EmptyState;
- TransactionStepper;
и другие уже утверждённые HUD components.

Не создавать параллельные accessibility-specific primitives без необходимости.

## 8. Tooltips

Tooltip должен:
- работать с keyboard;
- не быть единственным местом, где находится критическая информация;
- не закрывать triggering control.

Использовать tooltip прежде всего для:
- icon-only controls;
- compact metrics;
- сокращённых labels;
- secondary context.

## 9. Status updates

Использовать restrained `aria-live` для действительно важных изменений.

Не объявлять каждую секунду:
- personal clock;
- market sample;
- другие постоянно меняющиеся значения.

Важные:
- transaction result;
- error;
- confirmation;
- существенный state change

должны иметь доступное уведомление.

## 10. Non-3D access

Все essential management actions должны иметь доступный non-3D способ управления.

Это относится к:
- building selection;
- building management;
- workspace navigation;
- transaction flows.

На мобильных устройствах использовать уже утверждённый Function List как альтернативу точному 3D picking.

Это только альтернативный UI access path, не новая gameplay mechanic.

## 11. Pointer / Camera interaction

Сохранить существующие interaction rules:
- HUD clicks не должны проходить в Three.js scene;
- scroll внутри HUD panel не должен вращать camera;
- camera drag не должен считаться building click;
- keyboard focus не должен отключаться blanket event suppression.

Accessibility не должна ломать существующую Three.js interaction.

## 12. Responsive accessibility

Accessibility rules одинаковы во всех responsive modes:

- Large Desktop;
- Standard Desktop;
- 1280×720;
- Tablet Landscape;
- Portrait Mobile.

Меняется presentation, но не accessibility contract.

На tablet/mobile touch targets минимум `44 × 44 px`.

## 13. Reduced motion

Поддерживать существующий reduced-motion requirement.

При `prefers-reduced-motion`:
- отключать или сокращать non-essential transitions;
- не использовать decorative perpetual motion;
- сохранять понятные functional state changes.

Не создавать отдельную animation system.

## 14. Data accessibility

Accessibility не меняет canonical data.

Сохраняются:
- exact values;
- exact units;
- actual states;
- unavailable states.

Missing data не превращается в `0`.

Особенно это обязательно для:
- Capital;
- `$CORP`;
- Stock Tokens;
- transaction values;
- economic metrics.

## 15. Shared component architecture

Accessibility должна быть реализована внутри shared HUD primitives:

- Panel
- PanelHeader
- IconButton
- StatusChip
- ValueRow
- ExactAmount
- ProgressMeter
- RequirementRow
- Tabs
- Tooltip
- Drawer
- ConfirmationDialog
- EmptyState
- ErrorState
- TransactionStepper
- Workspace

Конкретные screens не должны повторно реализовывать базовую accessibility behavior, если её уже предоставляет primitive.

## 16. Accessibility + Responsive architecture

Сохранить единую архитектуру:

Canonical data
→ Shared View Model
→ Shared HUD Primitive
→ Accessibility behavior
→ Responsive presentation

Не создавать:
Desktop accessibility components
Tablet accessibility components
Mobile accessibility components.

## 17. Testing

Проверять минимум:

- keyboard-only navigation;
- correct Tab order;
- visible focus;
- Escape behavior;
- focus return;
- modal focus trap;
- keyboard tooltip access;
- accessible names для icon-only buttons;
- state recognition без цвета;
- form error associations;
- touch target size;
- reduced-motion mode;
- important status announcements;
- non-3D access к essential actions.

## 18. Explicit non-goals

Не добавлять:
- новые gameplay mechanics;
- новые screens;
- новые navigation destinations;
- Settings;
- Companion;
- Advisor;
- AI assistant;
- новые accessibility-only workflows.

## 19. Constructor rule

Accessibility должна работать как свойство shared constructor system:

Canonical data
→ shared primitives
→ shared accessibility contract
→ responsive presentation.

Cursor должен иметь возможность реализовать accessibility один раз на уровне primitives и автоматически получить её во всех существующих HUD screens.

## 20. Final rule

Один HUD.
Одна component library.
Один data model.
Один accessibility contract.
Несколько presentation modes.

Не дублировать accessibility logic между screens и responsive variants.






Motion и Performance должны быть частью одной общей HUD architecture и реализовываться через shared primitives / tokens, сохраняя стабильный Three.js scene lifecycle.

# 8.15 MOTION / PERFORMANCE — CANONICAL SPEC v1.0

## 1. Motion scope

Motion разрешён только для:
- panel entry / exit;
- selected-state changes;
- brief confirmation feedback;
- XP progress after a confirmed update.

## 2. Motion timing

Стандартная длительность UI transitions:
`120–180 ms`.

Использовать общий motion token, а не отдельные значения внутри каждого screen/component.

## 3. No perpetual motion

Запрещены:
- perpetual floating panels;
- постоянный pulsing positive states;
- бесконечные декоративные connectors;
- непрерывная анимация каждого number/value;
- high-frequency React clock updates across the entire HUD;
- heavy blur на большом количестве крупных panels.

Motion должен объяснять изменение состояния, а не постоянно двигать интерфейс.

## 4. Reduced Motion

Использовать существующий `prefers-reduced-motion`.

При reduced-motion:
- отключать или сокращать non-essential transitions;
- сохранять функциональные state changes;
- не ломать hierarchy и feedback.

Не создавать отдельную animation system.

## 5. Three.js renderer lifecycle

HUD не должен переинициализировать Three.js scene при:
- открытии workspace;
- закрытии workspace;
- изменении responsive mode;
- изменении HUD state.

Сохранять:
- один renderer instance;
- стабильный scene lifecycle;
- существующий OrbitControls;
- существующий resize handling;
- корректный cleanup.

## 6. React / HUD performance

Использовать уже утверждённые performance rules:
- memoized selectors;
- localized clock updates;
- optimized thumbnails;
- lazy-loaded detail panels where useful;
- SVG/simple CSS charts where appropriate;
- sensible device-pixel-ratio cap.

Не делать high-frequency rerender всего HUD из-за локального изменения clock или другого небольшого state update.

## 7. Clock

Сохранять существующую модель времени:
- personal и global clocks хранятся отдельно;
- client extrapolates from server timestamp + synchronized offset;
- resync после tab visibility changes и reconnects;
- browser timer не выдаёт игровые ticks.

Clock updates должны быть локализованы и не вызывать unnecessary rerender всего HUD.

## 8. Asset loading

Не загружать весь source art в полной resolution одновременно.

Использовать:
- optimized thumbnails;
- lazy-loaded detail imagery where appropriate.

Открытие отдельного workspace не должно приводить к переинициализации scene или повторной загрузке всей 3D сцены.

## 9. Renderer / selection boundary

Selection pipeline остаётся:

Three.js scene
→ stable building/function identifier
→ HUD selection state
→ renderer highlight request.

Projection обновлять только когда это необходимо.

Не выполнять economic calculations внутри render callbacks.

## 10. Performance measurement

Не фиксировать конкретный FPS target без измерения.

Performance acceptance проверяется на существующей supplied island scene и существующем renderer path.

Отчёт должен содержать только реально выполненные измерения и тесты.

## 11. Shared constructor

Motion и performance должны реализовываться на уровне shared HUD primitives / systems.

Не создавать отдельные animation systems для:
- Bank;
- Exchange;
- Agents;
- Industries;
- Journal;
- Overview;
- других workspace.

Один shared motion system должен применяться ко всем canonical HUD components.

## 12. Responsive integration

Motion / Performance должны сохраняться во всех responsive modes:

- Large Desktop;
- Standard Desktop;
- 1280×720;
- Tablet Landscape;
- Portrait Mobile.

Responsive layout changes не должны создавать новый renderer lifecycle и не должны дублировать business logic.

## 13. Performance architecture

Использовать принцип:

Canonical state
→ Shared selector/view-model
→ Shared HUD primitive
→ Shared motion token
→ Responsive presentation

Не реализовывать performance optimization отдельно внутри каждого screen без необходимости.

## 14. Explicit non-goals

Не добавлять:
- новые gameplay mechanics;
- новые animation mechanics;
- decorative 3D effects;
- perpetual background motion;
- Settings;
- Companion;
- Advisor;
- AI assistant;
- новые screens;
- новые renderer systems;
- новый Three.js framework.

Сохранять существующий Three.js renderer.

## 15. Final rule

**Motion communicates state changes. Performance protects the scene.**

Один HUD.
Одна motion system.
Один renderer lifecycle.
Общие performance rules для всех workspace.


Если правило уже существует в документации — считать его canonical и не создавать противоречащую версию.




весь HUD должен работать через единый data/state/adapter architecture и собираться в Cursor как конструктор из shared view models, primitives и typed adapter.

# 8.16 DATA / STATE / ADAPTER — CANONICAL SPEC v1.0

## 1. Core architecture

HUD не является источником игровой логики.

Canonical flow:

Canonical Content
→ Server / Runtime State
→ Typed View Models
→ Shared HUD Components
→ Responsive Presentation

Action flow:

User Intent
→ Typed Command Adapter
→ Existing Command / Endpoint
→ Authoritative Response
→ State Reconciliation
→ HUD Update

Не выполнять economic calculations внутри HUD.

## 2. State boundaries

Разделять четыре категории:

### A. Canonical Content
- names;
- icons;
- roles;
- thresholds;
- costs;
- schedules;
- modifier definitions.

### B. Server State
- balances;
- assignments;
- levels;
- ledgers;
- requests;
- payouts;
- reservations;
- quotes;
- events.

### C. Local UI State
- selected building;
- active panel;
- filters;
- draft inputs;
- collapsed sections;
- local presentation state.

### D. External Transaction State
- wallet approval;
- submission;
- receipt;
- rejection;
- expiry.

Не смешивать эти уровни без необходимости.

## 3. Typed View Models

HUD должен работать через typed view models, а не через raw generic state.

Использовать существующие canonical domains:

- SessionView
- CityIdentityView
- PersonalClockView
- ProtocolClockView
- CapitalSummaryView
- PayrollSummaryView
- ResourceSummaryView
- CityMetricsView
- FunctionView
- AgentView
- IndustryView
- ResearchView
- RewardWindowView
- ClaimView
- BankReservationView
- JournalEventView

Не создавать отдельный data architecture для каждого workspace, если данные относятся к существующему domain.

## 4. Value states

Missing data всегда представлять явно.

Canonical states:

- Loading
- Ready
- Stale
- Unavailable
- Error

`not supplied` никогда не преобразовывать в `0`.

Это правило распространяется на весь HUD, включая:
- economic values;
- agents;
- stocks;
- population;
- transactions;
- events;
- market data.

## 5. Money representation

Большие accounting values хранить как:
- bigint;
- или decimal strings.

Никогда не переводить большие accounting integers в JavaScript `Number` для удобства.

Compact values форматировать только через safe formatter.

Exact values должны быть доступны в detail/tooltip.

Exact amounts сохранять в transaction confirmations.

Не угадывать Capital display scale.

## 6. Rates

Basis-point values сохранять в data layer.

Проценты форматировать только на UI boundary.

Не хранить canonical rate как уже отформатированный presentation string.

## 7. XP

Сохранять исходный fixed-point scale и remainder.

UI только форматирует значение.

Не уничтожать fractional remainder.

## 8. Time

Personal и global clocks хранятся отдельно.

Client:
- extrapolates from server timestamp + synchronized offset;
- resync после tab visibility changes;
- resync после reconnect.

Browser timer никогда не выдаёт игровые ticks.

Clock updates должны быть локальными и не вызывать unnecessary rerender всего HUD.

## 9. Typed Command Adapter

Все actions проходят через typed adapter.

UI intent и transport command — разные уровни.

Canonical UI intents:

- Activate function
- Deactivate function
- Hire agent
- Assign agent
- Set objective
- Select training target
- Upgrade function
- Start research
- Stake
- Unstake
- Open industry
- Unlock tier
- Pick node
- Merge industries
- Deposit
- Authorize withdrawal
- Present voucher
- Buy Stock Token
- Claim Farm
- Claim prize

Эти названия обозначают UI intent и НЕ означают, что соответствующий API route уже существует.

## 10. Action map

Для каждого action фиксировать:

UI intent
→ existing command / endpoint
→ payload
→ response
→ error codes

Перед подключением action Cursor должен проверить реальные generated routes и handlers.

Не создавать API route только потому, что action присутствует в UI specification.

## 11. Missing command / integration gap

Если action не имеет реального endpoint:

- использовать Fixture Adapter в prototype mode;
- записать missing live capability в integration checklist;
- не repurpose `noop`;
- не создавать fake transport;
- не hand-edit generated route files.

Canonical intended behavior и current runtime capability должны быть явно разделены.

## 12. Authoritative state

Economic state нельзя менять optimistically.

Не оптимистично увеличивать:
- Capital;
- Stock Tokens;
- Claims;
- backing;
- другие authoritative financial values.

UI ждёт authoritative response и после этого выполняет state reconciliation.

## 13. Transaction safeguards

Для transaction/action flows:

- disable duplicate confirmation while pending;
- preserve draft after recoverable error;
- show exact rejection reason;
- reconcile after reconnect;
- использовать idempotency только согласно реальному backend contract.

Один shared pattern должен использоваться Bank, Exchange, Stake, Claims и другими transaction surfaces.

## 14. Renderer boundary

Three.js остаётся отдельным runtime subsystem.

Canonical selection flow:

Three.js
→ stable building/function identifier
→ HUD selection state
→ renderer highlight request

Projection обновлять только когда это необходимо.

Не выполнять economic calculations внутри renderer callbacks.

Не переинициализировать Three.js scene из HUD.

## 15. Events

Events также должны проходить через state boundary.

Использовать только события, реально доступные текущему runtime.

Текущая реализация имеет ограниченный event stream:
- API log projection в основном содержит attestation rows;
- client может добавлять local events;
- полный per-agent / per-task / per-building event stream ещё не реализован.

Не создавать fake event history и не заполнять отсутствующие события вымышленными данными.

## 16. Shared HUD constructor

Все screens должны собираться из общих primitives и typed view models.

Canonical pipeline:

Canonical Content
+
Authoritative Runtime State
+
External Transaction State
↓
Typed View Models
↓
Shared HUD Primitives
↓
Workspace Components
↓
Responsive Layout

Не создавать отдельные state/data architectures для:
- Bank;
- Exchange;
- Agents;
- Industries;
- Research;
- Journal;
- Overview.

Они являются композициями одной HUD system.

## 17. Action pipeline

Canonical action architecture:

Shared Control
→ UI Intent
→ Typed Adapter
→ Existing Endpoint / Command
→ Response / Error
→ State Reconciliation
→ View Model
→ HUD

Не связывать UI напрямую с raw transport payload.

## 18. Runtime reality

Сохранять существующие implementation gaps.

Текущая система остаётся partial:
- complete client snapshot отсутствует;
- full agents/traits/tasks/affinity partial;
- agents/stocks/population могут быть dropped/hardcoded;
- большинство declared commands не исполняются текущим API;
- WebSocket отсутствует;
- persistent city restoration incomplete.

Не маскировать эти ограничения в HUD.

## 19. Explicit non-goals

Не добавлять:

- новые gameplay mechanics;
- новые data sources;
- новые API routes;
- fake live integrations;
- fake market data;
- fake financial confirmations;
- Settings;
- Companion;
- Advisor;
- AI assistant.

Не менять существующий Three.js renderer.

## 20. Constructor rule

Главное архитектурное правило:

ONE DATA CONTRACT
→ ONE VIEW-MODEL LAYER
→ ONE SHARED COMPONENT LIBRARY
→ ONE TYPED ADAPTER BOUNDARY
→ MANY WORKSPACES

Bank, Exchange, Industries, Agents, Research, Journal и Overview должны использовать одни и те же:
- state boundaries;
- value states;
- formatters;
- transaction states;
- shared primitives;
- adapter patterns.

## 21. Final rule

HUD является presentation layer над canonical/runtime state.

Он:
- показывает данные;
- принимает user intent;
- отправляет intent через typed adapter;
- отображает authoritative result;
- явно показывает missing/unavailable/error/pending states.

HUD НЕ:
- рассчитывает экономику;
- придумывает данные;
- создаёт отсутствующие API;
- оптимистично изменяет финансовое состояние;
- маскирует runtime gaps.



Сделай этот раздел основой для реализации всех существующих HUD screens в Cursor как единой системы переиспользуемых primitives, typed view models и adapter boundaries.

