# Corporator HUD Design Spec

Status: owner prompt for the HUD redesign.

This document is the visual and interaction-design authority for the Corporator
HUD. It is a design contract, not an implementation checklist to be satisfied
by isolated CSS patches. The attached HUD reference image is the primary visual
target: a polished browser 3D game interface with a readable island, compact
glass panels, precise hierarchy, small contextual icons, and restrained
interaction chrome.

The latest explicit owner brief takes precedence over older HUD prompts and
legacy visual documents. The current typography decision is Source Serif 4 plus
JetBrains Mono. The current active shell is the six-destination HUD in
`apps/client/src/hud/App.tsx`; the older pack-panel shell is not the visual
target. Player-facing copy is supplied through `content/strings/`; the default
HUD fixture is English, but components never embed user-facing sentences.

## 1. Authority and non-negotiable constraints

Use this authority order for HUD work:

1. Latest explicit owner decisions and this prompt.
2. `docs/CANON.md`.
3. `DESIGN.md`, `docs/SCREENS.md`, `docs/API.md`, generated pack data, and
   protocol/command code for mechanics and state semantics.
4. The active implementation in `apps/client/src/hud/`.
5. The attached visual reference.
6. Legacy documents only for migration facts.

`docs/reports/TZ_HUD.md` is legacy migration material. Do not copy its
pixel-art treatment, fixed 260/56/40/48 shell, seven-item bottom menu, stock
strip, district-grid composition, or old typography.

`HUD.md` is superseded. Do not restore it as a design source.

The live scene remains the authored Terra runtime:

- `art/island_v3/runtime_terra19/` is the runtime source.
- `art/island_v3/maps/terra-look.json` is the accepted composition.
- The existing Three.js renderer and `SceneHost` lifecycle remain in place.
- The HUD is an HTML/CSS overlay over the scene.
- The 18 core building GLB files are read-only.
- No building is replaced, regenerated, deleted, or non-proportionally scaled.
- No grid placement, terrain editing, construction ghost, or physical building
  spawn is introduced by the HUD.
- No roaming workers, vehicles, drones, robots, crowds, or mobs are added.
- No nineteenth functional building is invented.
- `missions_live` remains `0`.
- The HUD never signs `launchToken` and never deploys to mainnet.

The client displays canonical state. It does not calculate economics, mint
Capital, promise profit, fabricate quotes, or turn missing state into zero.
Economic values remain server-owned. City time may be extrapolated only through
the existing server-anchored clock path.

## 2. Design goal

The finished HUD must feel like part of a modern browser 3D game:

- light and compact;
- translucent without becoming unreadable;
- dark navy glass with precise geometry;
- premium but quiet;
- structured around the island rather than around dashboards;
- typographically intentional;
- rich in small icons and contextual company marks;
- clear about state, scope, and action;
- free from overlapping text, dead-looking controls, and accidental scrollbars.

The island remains the visual priority. The HUD provides orientation, status,
selection, and management access without turning the scene into a web admin
panel.

The reference establishes atmosphere and composition. It does not establish
economic values, city mechanics, available commands, worker presence, or the
existence of a multi-city system.

## 3. Current architecture decision

The active HUD is generation B:

- `App.tsx` is the current composition root.
- `Topbar` is the persistent top region.
- `LeftRail` and `RightRail` are persistent summary regions.
- Mapped buildings open the six primary destinations; there is no live dock.
- `WorkspaceDrawer` hosts one primary management workspace.
- `BuildingPopover` is the contextual selection layer for unmapped picks.
- `SceneHost` remains the Three.js boundary.
- `FunctionStrip` and `BottomNav` remain in the tree as unused chrome.

The six primary destinations are:

1. Overview
2. Agents
3. Exchange
4. Bank
5. Industries
6. Journal

Use “Exchange”, not “Market”, unless a distinct Market feature is supplied by
the canonical state.

Generation A remains in the repository as migration debt. It includes the old
pack panel inventory, `StockBar`, `BottomMenu`, the old `CityCard`, old panel
helpers, and seven-item pack navigation. These files are not the visual
authority and must not silently become a second active shell. Any removal or
merging happens only after a call-site audit.

The pack remains authoritative for state identifiers, localization keys,
refusals, loading semantics, and action capabilities. It does not force the
legacy seven-item visual composition back into the live HUD.

## 4. Shell and layout contract

### 4.1 Named regions

`HudShell` owns the following named regions:

```text
scene-layer
  the full Terra canvas, below the HUD

hud-overlay
  top-bar
  left-rail
  scene-safe-center
  right-rail

workspace-layer
  one primary drawer or sheet

selection-layer
  one selected-building card or bottom sheet

feedback-layer
  tooltip, toast, confirmation, or transaction status
```

The normal desktop shell is a CSS Grid with named areas. The scene is not
implemented as an accidental empty grid cell and the drawer is not allowed to
compete with the rails through unrelated absolute coordinates.

Absolute positioning is reserved for:

- the scene canvas;
- a scene-anchored selection card;
- a controlled toast;
- a measured overlay anchor.

Absolute positioning is not a substitute for the shell grid.

### 4.2 Desktop composition

At the target desktop widths:

- the top bar is compact and horizontally stable;
- the left rail contains Capital, Payroll, Energy, and Compute;
- the right rail contains City Status and a compact Recent Events feed;
- the center retains a continuous readable view of Terra;
- the active-functions strip sits near the lower-left scene edge without
  covering the island's primary landmarks;
- the navigation dock is centered near the bottom safe area;
- a selected-building card is clamped away from the top bar, rails, and dock;
- a workspace opens as one stable side sheet and suppresses or relocates
  conflicting secondary panels beneath it.

The default composition must not show every possible panel at maximum size.
Secondary information moves into a workspace, drawer, tooltip, or detail card.

### 4.3 Safe areas and overflow

The root HUD occupies the viewport and uses safe-area insets. The root surface
must not create a horizontal scrollbar. The normal desktop surface must not
create an accidental vertical scrollbar.

Only an intentional content region may scroll:

- a long Journal feed;
- a dense Agents roster;
- a wide Industries or progression workspace;
- a narrow-screen bottom sheet.

Every shrinkable flex/grid child uses `min-width: 0`. Text regions have a
bounded width and a declared overflow policy. `overflow: hidden` may protect a
known visual boundary, but clipping is never used to conceal a broken layout.

### 4.4 Layer and pointer contract

The overlay root is `pointer-events: none`. Interactive regions explicitly
restore `pointer-events: auto`.

Pointer routing must guarantee:

- a click on a HUD control never selects the scene behind it;
- a camera drag is not treated as a building click;
- wheel events over a scrollable panel do not zoom the camera;
- keyboard focus is not disabled by blanket event suppression;
- selection projection is updated only when scene selection or viewport
  geometry changes.

The layer order is explicit and centralized:

```text
scene
hud-chrome
selection
workspace
confirmation
tooltip-and-toast
```

No component invents a new z-index.

## 5. Responsive contract

The layout is designed and verified at:

- 1920×1080;
- 1600×900;
- 1440×900;
- 1366×768.

It must also degrade deliberately at 1280×720, 1024×768, and portrait mobile
around 390×844.

### 5.1 Large desktop

- Both rails remain visible.
- Panel widths are bounded and consistent.
- Recent Events may show a few more rows, but never becomes a text wall.
- Bottom navigation labels remain visible.
- The central scene remains the dominant area.

### 5.2 Standard desktop

- Rails become more compact through tokenized density, not arbitrary offsets.
- Secondary metrics reduce before primary values do.
- Recent Events is limited to a small number of structured items.
- The selected-building card chooses the side with more room.

### 5.3 Compact landscape and tablet

- Rails collapse into a controlled drawer or one-at-a-time summary sheet.
- Capital and the personal clock remain reachable without navigating through
  unrelated screens.
- Touch targets remain at least 44×44 CSS pixels.
- Management workspaces use a readable side sheet or bottom sheet instead of
  squeezing desktop columns.

### 5.4 Portrait mobile

- No desktop rails are squeezed into a narrow viewport.
- The scene remains visible behind compact chrome.
- Capital, resource state, and City Time are available from a compact summary
  surface.
- Primary navigation uses readable labels and a deliberate “More” pattern only
  if the six destinations cannot fit.
- Selected buildings use a bottom sheet rather than a tiny tracking popover.
- Essential management actions are reachable without precise 3D picking.

The narrow threshold is derived from the existing measured layout/pack
boundary. It is not duplicated as a component-specific magic number.

## 6. Design tokens

Tokens are semantic and centralized. A component may consume a token; it may
not introduce a one-off visual value to repair its own layout.

### 6.1 Color roles

The semantic roles are:

- `background`: deep scene-safe HUD foundation;
- `panel`: dark translucent glass surface;
- `panel-hover`: raised surface on pointer hover;
- `panel-active`: selected or open surface;
- `border`: precise default border;
- `border-subtle`: low-contrast internal divider;
- `primary-text`: high-contrast headings and important values;
- `secondary-text`: readable supporting copy;
- `muted-text`: captions, disabled metadata, and helper copy;
- `cyan-accent`: active navigation, focus, and primary interaction;
- `blue-accent`: calm informational state;
- `green-success`: running, completed, and healthy;
- `yellow-warning`: attention, stale, and caution;
- `red-error`: failed, blocked, or invalid;
- `orange-economic`: Capital and economic attention, used sparingly;
- district accents: derived from canonical district color tokens, never from
  duplicated ticker-specific CSS when pack data can supply the role.

The initial visual direction is a dark navy surface around `#071522` /
`#0D2235`, raised surface around `#143149`, bright text around `#F2F7FC`,
secondary text around `#AEC2D4`, muted text around `#7F9AAE`, cyan around
`#43D7FF`, selection/economic orange around `#FFB54A`, positive green around
`#68DE8B`, warning amber around `#F1BD62`, and error red around `#F07A80`.

These values are semantic starting points. Where the Corporator palette already
provides a matching ramp, the implementation derives the CSS variable from
`art/palette/corporator.hex` instead of creating a second color source.

Color is never the only status signal. Status also has text, iconography, shape,
or a state marker.

### 6.2 Typography

The HUD has two intentional type families:

- Source Serif 4:
  - Corporator brand treatment;
  - city name;
  - selected-building names;
  - the Capital display figure only.
- JetBrains Mono:
  - numbers, labels, statuses, time, journal, and navigation;
  - compact labels and state identifiers;
  - proof, transaction, and reference values.

The whole interface is not monospace and it is not all serif.

The token set defines at least:

- `--hud-font-display`, `--hud-font-data`, and `--hud-font-ui`;
- `--hud-size-micro`, `--hud-size-caption`, `--hud-size-body`,
  `--hud-size-section`, `--hud-size-hero`, and `--hud-size-display`;
- `--hud-weight-regular`, `--hud-weight-medium`,
  `--hud-weight-semibold`, and `--hud-weight-bold`;
- `--hud-leading-tight`, `--hud-leading-body`, and `--hud-leading-data`;
- `--hud-tracking-neutral`, `--hud-tracking-eyebrow`,
  `--hud-tracking-navigation`, and `--hud-tracking-data`;
- display, hero, section, body, caption, and micro sizes;
- regular, medium, semibold, and bold weights;
- tight, body, and data line heights;
- neutral, eyebrow, navigation, and data letter spacing;
- tabular-figure behavior for numbers.

Essential copy does not become unreadable merely to fit a panel. Short
uppercase labels are reserved for headers, navigation, and status chips.
Paragraphs are not written in all caps.

### 6.3 Spacing

The base scale is:

```text
space-1: 4
space-2: 8
space-3: 12
space-4: 16
space-5: 20
space-6: 24
space-7: 32
```

All panel padding, card gaps, row gaps, and shell gutters use this scale or a
token derived from it.

### 6.4 Radius, borders, and shadows

The token set defines:

- `radius-small`: compact controls and icon buttons;
- `radius-medium`: stat cards and rows;
- `radius-large`: primary panels and drawers;
- `radius-pill`: badges and chips;
- `border-default`: one precise hairline;
- `border-subtle`: low-contrast divider;
- `border-active`: cyan or selection border;
- `shadow-panel`: soft depth behind glass;
- `shadow-hover`: restrained lift;
- `shadow-selected`: selection emphasis without a neon outline.

The target uses calm geometry. It does not use thick bright cyan frames around
every element.

### 6.5 Glass treatment

Every panel variant specifies:

- `--hud-glass-panel-opacity`;
- `--hud-glass-panel-blur`;
- `--hud-glass-panel-gradient`;
- `--hud-glass-panel-fallback`;
- fallback opaque surface;
- translucent surface color;
- subtle top-to-bottom gradient;
- border opacity;
- restrained outer shadow;
- optional inner highlight;
- backdrop blur only when supported and affordable.

Blur is not the only source of contrast. A readable fallback remains when blur
is disabled, expensive, or unavailable.

## 7. Panel hierarchy

The system has visual weight levels:

- `PrimaryCard`: one of the few important persistent surfaces, such as Capital
  or City Status;
- `SecondaryCard`: supporting event, resource, or grouped information;
- `CompactCard`: quick-access row, function item, or dense stat group;
- `FloatingCard`: selected building or contextual scene card;
- `Badge`: small company, status, or attention mark;
- `Pill`: compact state or category control;
- `Divider`: quiet separation inside a card;
- `StatRow`: one aligned label/value unit.

Every logical group has:

- a heading or section label;
- an icon or contextual mark where useful;
- a declared hierarchy;
- consistent internal spacing;
- a defined empty/loading/unavailable state where data can be absent.

Type pairing is fixed: Source Serif 4 for brand, city name, building name, and
the Capital display figure; JetBrains Mono for numbers, labels, statuses, time,
journal, and navigation. Cards are header / body / block grids, not loose text
on a panel fill.

Not all panels receive the same border, padding, shadow, or opacity.
A screen, route, or event feed is never rendered as an ungrouped sequence of
headings and paragraphs in open space. If content is visible, it belongs to a
card, row, timeline item, sheet, or another named container.

## 8. Component architecture

### 8.1 Shell components

`HudShell` owns composition, safe areas, layers, and workspace visibility. It
does not format economic values or decide business rules.

`TopBar` owns the corner brand wordmark, City Time, bank status, season
access, notifications, and settings. City level and demo/connection chips do
not sit in the brand corner.

`TimeWidget` owns a compact navy clock capsule:

```text
DAY 1                         12:00
8:00  ────────☀️────────────  20:00
```

Day is uppercase. The yellow sun sits on the bank-hours track at the current
hour. Bounds are `bank_open_hour` and `bank_close_hour` (8:00 and 20:00 in the
live pack), not midnight. City time is hour-precision; the face is `HH:00`.
Bank status is a compact plaque in the tools cluster, not under the clock.

`CapitalPanel` owns the primary Capital value and compact Payroll, Energy, and
Compute summaries. It must distinguish:

- spendable Capital;
- paid/requested/coverage values;
- Energy supply and demand;
- Compute supply and demand;
- unavailable or stale values.

It must not display ambiguous “+N / h” copy unless the supplied value is
explicitly an estimate and its time scope is stated.

`CityStatusPanel` owns aligned rows for Population, Productivity, Happiness,
and Stability, with the same row height, icon box, label column, and value
column. City Level may appear when supplied, but is not mixed into a row with a
different unit without a clear label.

`EventLog` owns a bounded list of `EventItem` components and a structured
`View All` action.

`NavigationDock` is not mounted. The six primary destinations open from
mapped building picks; Journal also opens from the notification bell.

`Drawer`, `Modal`, `Tooltip`, and toast layers own their own visibility,
focus, dismissal, and stacking behavior. There is one primary workspace at a
time.

### 8.2 Reusable primitives

The reusable inventory is:

- `SectionHeader`;
- `Panel`;
- `PanelHeader`;
- `StatRow`;
- `Value`;
- `ValueRow`;
- `ProgressMeter`;
- `StatusBadge`;
- `Pill`;
- `IconButton`;
- `ActionButton`;
- `CompanyBadge`;
- `BuildingIcon`;
- `BuildingCard`;
- `EventItem`;
- `EventLog`;
- `Tooltip`;
- `Drawer`;
- `Modal`;
- `EmptyState`;
- `LoadingState`;
- `ErrorState`;
- `TransactionStepper`.

Primitives receive data and callbacks. They do not discover layout through
hardcoded offsets or reach into game state.

### 8.3 CompanyBadge and BuildingIcon

`CompanyBadge` is a reusable contextual mark for the six canonical districts:

- NVDA → Compute;
- TSLA → Energy;
- AMZN → Logistics;
- AAPL → Consumer;
- MSFT → Automation;
- COIN → Finance.

These are the current pack assignments, not UI-owned constants. The displayed
ticker and its role/accent mapping come from canonical pack data so a future
approved ticker change does not require a CSS rewrite.

The ticker is not itself a full logo. If an approved local logo asset exists,
the badge may show the mark with an accessible ticker label. If it does not,
the fallback is a deliberate monogram/ticker badge with canonical accent color,
not a fake external image.

`BuildingIcon` uses the unified inline icon system and maps building archetypes
to stable glyphs. It does not crop logos from GLB files and does not load an
unbounded 3D scene into every card.

There is currently no local logo registry or building thumbnail registry in
the repository. The HUD must not create broken external URL references. A
future asset pass may add an approved local manifest and optimized thumbnails
without modifying the 18 core building GLBs.

## 9. Icon system

All utility icons use one visual family and one sizing/alignment system.

Required semantic glyphs include:

- Capital;
- Population;
- Energy;
- Compute;
- Productivity;
- Stability;
- Happiness;
- Agents;
- Exchange;
- Bank;
- Industries;
- Journal;
- Notifications;
- Settings;
- City;
- Building;
- Close;
- Loading/processing;
- Warning/error/success.

Inline SVG glyphs may remain the implementation mechanism. Random emoji and
mixed icon libraries are not used. Every icon-only button has an accessible
name and a visible focus state.

## 10. Persistent HUD composition

### 10.1 Top bar

The top bar is one coherent system made from role-specific blocks rather than
one heavy full-width rectangle.

Left:

- Corporator mark and wordmark;
- current city identity;
- City Level when supplied;
- live/demo connection state when useful.

Center:

- City Time label;
- day and weekday;
- current hour/minute;
- day/night progress;
- bank status badge in its own visual row.

Right:

- season/global-period access;
- version/build information only when supplied by actual runtime state;
- notification state from real unread data;
- settings;
- connection/account context where needed.

A city selector is shown only when the actual state supports multiple owned
cities. A fixture label must not imply an unsupported purchase or multi-city
mechanic.

### 10.2 Capital

The Capital card is compact and high value:

```text
[coin] CAPITAL
240k
PAID LAST TICK                 126
────────────────────────────────
PAYROLL                         68%
ENERGY                         800
COMPUTE                        400
```

The main balance is the strongest visual element. Labels are quieter, values
are tabular, progress meters are thin, and empty space is intentional rather
than accidental.

Payroll coverage is shown with its scope and explanation when trimmed. A full
coverage state may be compact, but it must not hide a meaningful trim.

### 10.3 City Status

The default panel uses aligned stat rows:

```text
CITY STATUS
[population] Population          284
[pulse]      Productivity        82%
[heart]      Happiness             71
[shield]     Stability             94
```

Every row has the same internal geometry. Values never compete with labels or
wrap over icons. A trend arrow is shown only when a comparison period exists.

### 10.4 Recent Events

Recent events show a small number of structured items. Each item has:

- category icon;
- timestamp with City Time context;
- title;
- short description;
- result/status value when supplied;
- optional link to the affected entity;
- optional verification/proof state.

Example shape:

```text
[gear] WORKSHOP                         14:31
       Engineer shift resumed
       Capital +24 / tick
```

The feed is bounded and does not auto-scroll while the player reads it. Full
history belongs to Journal.

### 10.5 Active Functions

The quick strip shows a bounded set of active or recently selected functions.
Each item has:

- BuildingIcon or approved thumbnail;
- CompanyBadge when the mapping exists;
- status dot plus readable status text;
- tooltip with full name and status;
- click behavior that selects the actual authored building.

Counters distinguish active functions, catalog size, logical capacity, and
agent slots. They are never collapsed into one unexplained fraction.

### 10.6 Selected building

Selection is a scene-linked `FloatingCard` or narrow-screen bottom sheet:

```text
[building icon/thumbnail] [company badge]
WORKSHOP
RUNNING

AGENT          Alex R.
TASK           Produce
OUTPUT         +24 / tick

[MANAGE]
```

The card may show only data actually supplied by the view model. Missing
thumbnail, agent name, task, or output uses a clear unavailable/unknown state;
it is not filled with invented fixture values in live mode.

The card is clamped away from the top bar, rails, workspace, and bottom dock.
The selected building remains visible where possible. If it is off-screen or
there is insufficient space, the card moves to a stable dock or bottom sheet.

## 11. Primary workspaces

All six primary workspaces share:

- a single page header;
- one close/back control;
- the same card hierarchy;
- common tabs, rows, badges, loading, empty, error, and refusal states;
- consistent width and internal gutters;
- one intentional scroll container.

Pack-backed refusals remain authoritative. A blocked action shows the first
blocking reason and keeps additional reasons discoverable without placing a
wall of codes in the primary layout.

### 11.1 Overview

Overview contains:

- Summary;
- Functions;
- Production;
- Research.

Summary groups City Status, Capital/Payroll context, and attention states.
Functions uses cards or a grid with explicit filters and no duplicate active
function strip hidden inside another card. Production separates Energy and
Compute with their actual time scope. Research uses functional progression
language, not construction language.

### 11.2 Agents

Agents is a roster of structured cards or rows:

```text
[avatar] Alex R.
        Engineer · Workshop
        RUNNING
        Task: Produce
        [VIEW]
```

When a name, role, workplace, task, level, or attention reason is not in live
state, the UI uses a stable identifier or explicit unavailable field. It does
not invent biography, personality, or persistent identity.

The roster supports a clear hire action only when the action and refusal state
are supplied by the adapter.

### 11.3 Exchange

Exchange groups:

- Stock Token selection;
- `$CORP` amount;
- quote and freshness;
- fees and execution conditions;
- review;
- confirmation/pending/failure state.

The submitted ticker and amount travel through a typed UI intent. A visually
working form must not drop those values before the command boundary.

No fake live quote, decorative market chart, or unsupported route is shown.
Market data and in-game industry effect remain separate and clearly labeled.

### 11.4 Bank

Bank has Deposit and Withdraw tabs.

Deposit shows the actual supplied quote, fee, amount, and review state. It is
not incorrectly blocked by Bank opening hours.

Withdraw shows:

- personal Bank hours;
- amount and units;
- quote freshness;
- daily/personal capacity when supplied;
- reservation state;
- explicit pending transaction stages.

Financial actions require review, explicit confirmation, duplicate-submit
protection, exact units, and authoritative reconciliation. The HUD does not
invent a successful chain result.

### 11.5 Industries

Industries uses separate cards/rows for each district. Each card groups:

- CompanyBadge/ticker;
- canonical industry role;
- market data;
- in-game effect;
- access/open/frozen/grace state;
- stake/tier fields only when supplied;
- relevant attention reason.

The six canonical roles remain:

```text
NVDA  Compute
TSLA  Energy
AMZN  Logistics
AAPL  Consumer
MSFT  Automation
COIN  Finance
```

The display must not imply that market performance is the same as city
efficiency. Unsupported Stake, Tier, Grace, Frozen, Progression, or Merge data
is grouped as an honest unavailable state, not scattered naked labels.

Progression and Merges use their own structured cards, requirements, and refusal
states. A raw identifier is never presented as the finished user-facing
explanation.

### 11.6 Journal

Journal is a timeline, not a paragraph dump:

```text
JOURNAL
TODAY

14:31  [WORKSHOP]
       Engineer shift resumed
       +24 / tick

14:27  [POWER]
       Shift stopped
       Reason: insufficient Energy
```

Each event has category, time, title, description, consequence/reason, and
optional entity/proof link. Filters are structured and expandable. Transport
failures, economic idle reasons, refusals, and verification state remain
visually distinguishable.

## 12. Interaction states and action contract

Every interactive control defines:

- default;
- hover;
- pressed;
- active/selected;
- disabled;
- loading/pending;
- focus-visible;
- error or refusal where applicable.

State is communicated through geometry, text, icon, and restrained color, not
color alone.

The following controls must either execute a real supported action or be
visibly and accessibly unavailable:

- `View All`;
- `Open` and `Manage`;
- `Clear Selection`;
- six navigation destinations;
- City selector;
- notifications;
- settings;
- season/global-period access;
- theme/day-night control if one is exposed;
- building/function selection;
- form review and confirmation;
- close/back and Escape behavior.

Known current dead or misleading surfaces are explicit migration targets:

- notification bell without an action;
- no-op FunctionStrip `View All` on its own tab;
- catalog rows that select a hidden card while showing perpetual unavailable
  text;
- Exchange and Bank forms whose draft values do not reach the commit intent;
- unsupported external wallet actions without a visible adapter state;
- `offline_continue` routing to a blocked destination;
- duplicate close chrome inside a workspace;
- raw settings labels with no control state;
- event rows without their structured verification presentation.

Pending financial work remains visible if a workspace closes. Escape closes the
topmost dismissible layer and does not silently discard an in-flight operation.
Focus returns to the triggering control after a drawer or dialog closes.

## 13. Data and UI boundary

The data flow is:

```text
ClientSnapshot + ClientPack + StringTable
                ↓
        pure HudView selector
                ↓
     presentational HUD components
                ↓
       typed UI intent adapter
                ↓
      authoritative server response
```

Separate these domains:

- canonical content: labels, icons, roles, costs, thresholds, schedules;
- server state: balances, assignments, levels, ledgers, payouts, quotes,
  reservations, events;
- local UI state: selection, active route, filters, draft inputs, collapsed
  groups;
- external transaction state: authorization, submission, receipt, rejection,
  expiry.

Suggested view-model boundaries include:

- `CityIdentityView`;
- `PersonalClockView`;
- `BankStatusView`;
- `CapitalSummaryView`;
- `PayrollSummaryView`;
- `ResourceSummaryView`;
- `CityStatusView`;
- `FunctionView`;
- `AgentView`;
- `IndustryView`;
- `JournalEventView`;
- `TransactionView`.

Each value-bearing view supports explicit states such as `loading`, `ready`,
`stale`, `unavailable`, `error`, `pending`, and `confirmed` where applicable.

Large accounting values remain `bigint` or exact decimal strings until the
display boundary. The UI uses the existing safe formatter and keeps exact
values available to detail views and confirmations.

No layout, CSS class, screen position, visual variant, or pixel coordinate is
stored in game data.

## 14. Asset contract

Current repository facts:

- Source Serif 4 and JetBrains Mono are vendored in `art/fonts/`.
- `FontFaces.tsx` loads local font assets without a CDN.
- `HudIcon.tsx` contains the current inline SVG glyph family.
- `CompanyBadge.tsx` currently renders a ticker text badge.
- There is no approved local logo registry.
- There is no approved per-building thumbnail registry.
- Runtime GLBs are scene assets, not a 2D thumbnail set.
- The existing fallback PNG is a whole-scene GPU fallback, not a building image.

The redesign may use current inline glyphs and deliberate ticker/monogram
fallbacks. It must not:

- reference broken external URLs;
- extract logos from core GLBs;
- add a second untracked icon library by accident;
- use an unrelated image as a building thumbnail;
- imply that a ticker text badge is an official corporate logo.

If a local asset registry is later added, it must define ownership, dimensions,
fallback behavior, licensing, and loading cost.

## 15. Performance and accessibility

The HUD must stay light on low-end browser WebGL devices:

- avoid many large blur surfaces;
- use an opaque fallback for glass;
- keep animation CSS-based and restrained;
- do not reinitialize the Three.js scene when a drawer opens;
- localize clock updates;
- lazy-load expensive detail content where useful;
- use simple SVG/CSS meters instead of a charting library;
- preserve reduced-motion behavior;
- measure before making frame-rate claims.

Accessibility requirements:

- WCAG AA contrast where applicable;
- semantic buttons, tabs, lists, dialogs, and headings;
- keyboard navigation for every essential action;
- visible focus-visible state;
- icon-only accessible names;
- status is not color-only;
- errors are associated with the relevant control;
- important changes use restrained `aria-live`;
- the HUD offers non-3D access to essential management actions;
- tooltips work by keyboard and do not contain the only copy of critical
  information.

## 16. Production cleanup contract

The production HUD must not expose:

- `HUD work — Terra not loaded`;
- preview-agent identifiers;
- recorded test labels;
- raw debug keys;
- temporary placeholder sentences;
- naked text blocks with no semantic container;
- an unsupported action that looks enabled;
- a second hidden or legacy shell.

Preview fixtures may keep clearly isolated fixture-only surfaces, but they must
not leak into the live production composition.

## 17. Current implementation inventory

### Reuse after normalization

- `apps/client/src/hud/HudShell.tsx`
- `apps/client/src/hud/parts/FontFaces.tsx`
- `apps/client/src/hud/parts/HudIcon.tsx`
- `apps/client/src/hud/parts/Value.tsx`
- `apps/client/src/hud/parts/ValueRow.tsx`
- `apps/client/src/hud/parts/ProgressMeter.tsx`
- `apps/client/src/hud/parts/StatusBadge.tsx`
- `apps/client/src/hud/parts/ActionButton.tsx`
- `apps/client/src/hud/parts/ScreenFrame.tsx`
- `apps/client/src/hud/parts/Drawer.tsx`
- `apps/client/src/hud/selection.ts`
- `apps/client/src/hud/sceneProjection.ts`
- `apps/client/src/hud/SceneHost.tsx`

These are useful boundaries, not proof that their current visual behavior is
accepted.

### Refactor as visual/layout owners

- `apps/client/src/hud/App.tsx`
- `apps/client/src/hud/hud.css`
- `apps/client/src/hud/topbar/Topbar.tsx`
- `apps/client/src/hud/topbar/TimeWidget.tsx`
- `apps/client/src/hud/topbar/BankPlaque.tsx`
- `apps/client/src/hud/left/LeftRail.tsx`
- `apps/client/src/hud/left/CapitalPanel.tsx`
- `apps/client/src/hud/right/RightRail.tsx`
- `apps/client/src/hud/right/CityStatusPanel.tsx`
- `apps/client/src/hud/center/FunctionStrip.tsx`
- `apps/client/src/hud/center/BottomNav.tsx`
- `apps/client/src/hud/BuildingPopover.tsx`
- `apps/client/src/hud/workspace/*`
- primary files in `apps/client/src/hud/screens/*`

### Merge or retire after call-site audit

- `apps/client/src/hud/parts/Panel.tsx`
- `apps/client/src/hud/parts/PanelHeader.tsx`
- `apps/client/src/hud/left/Overview.tsx` legacy exports
- `apps/client/src/hud/right/CityCard.tsx` legacy exports
- `apps/client/src/hud/center/StockBar.tsx`
- `apps/client/src/hud/topbar/CapitalSlot.tsx`
- `apps/client/src/hud/topbar/ClockSlot.tsx`
- duplicate CSS selectors and obsolete shell rules

`SceneStub.tsx` is preview-only. Its debug copy must never be part of the
production surface.

### Missing contracts

- semantic token layer;
- explicit panel variants;
- `SectionHeader`;
- structured `EventItem` and `EventLog`;
- real `BuildingIcon` contract;
- local company/thumbnail asset resolver;
- interaction-state matrix;
- viewport screenshot fixture and overflow assertions;
- rich agent/function fields where the live snapshot currently supplies only
  identifiers and idle keys.

## 18. Implementation sequence after owner approval

This specification is implemented in small verified stages. A later stage does
not begin because an earlier stage “should work”; it begins after the relevant
runtime, visual, and interaction checks pass.

### STEP 1 — Design tokens and global typography

Implement semantic colors, typography, spacing, radius, borders, shadows, glass,
focus, motion, and density tokens. Replace local literal styling with token
references. Keep Source Serif 4 and JetBrains Mono roles distinct.

### STEP 2 — HudShell and global layout

Implement named grid regions, safe areas, pointer boundaries, layer order,
drawer ownership, and responsive shell behavior. Remove layout-by-offset fixes.

### STEP 3 — TopBar and City Time

Implement role-specific top-bar blocks and the separated City Time widget,
progress bar, and bank status badge.

### STEP 4 — Capital and City Status

Implement compact Capital/Payroll/resource hierarchy and aligned City Status
rows with explicit missing-data states.

### STEP 5 — Bottom Navigation

Implement the six-destination game dock with active, focus, pressed, disabled,
and attention states.

### STEP 6 — Building and selection cards

Implement `BuildingCard`, `CompanyBadge`, `BuildingIcon`, measured clamping,
scene-safe placement, and the small-screen bottom sheet.

### STEP 7 — Event Log

Implement structured event items, category icons, timestamps, consequences,
verification state, bounded recent feed, and Journal entry.

### STEP 8 — Main workspaces

Bring Overview, Agents, Exchange, Bank, Industries, and Journal into the shared
screen/card/list system without inventing unsupported data.

### STEP 9 — Icons, company badges, and thumbnails

Complete the local icon registry and approved asset fallback. Do not alter core
GLBs or use external URLs.

### STEP 10 — Responsive pass

Verify all target viewport sizes, narrow rails, drawers, sheets, long labels,
large values, and intended scroll regions.

### STEP 11 — Interaction states and broken controls

Audit every visible control. Connect supported handlers, expose honest
unavailable states, pass form drafts through typed intents, and fix dead actions.

### STEP 12 — Visual polish

Tune panel hierarchy, glass depth, typography, spacing, icon alignment, active
states, and scene occlusion against the attached reference.

### STEP 13 — Performance cleanup

Measure blur and render cost, reduce rerenders and unnecessary assets, verify
reduced motion, and keep the Terra scene lifecycle stable.

## 19. Verification contract

Every implementation stage records actual evidence:

- screenshots at the required desktop widths;
- selected-building screenshots near viewport edges;
- workspace and transaction-state screenshots;
- no text overlap;
- no panel overlap;
- no accidental horizontal scrollbar;
- no accidental root vertical scrollbar;
- keyboard/focus behavior;
- scene pointer behavior;
- loading, empty, unavailable, stale, error, pending, and confirmed states;
- TypeScript and relevant tests actually run.

The visual review asks:

> Is this measurably closer to the attached reference while remaining honest
> about Corporator's real state and mechanics?

The final HUD is accepted only when:

- no text overlaps another text region;
- no panel breaks at the target viewports;
- no visible control is dead-looking;
- the island remains the dominant visual content;
- Capital, time, bank status, resource constraints, and attention states are
  understandable at a glance;
- missing data is explicit;
- no unsupported economic or world behavior has been invented;
- the code has one active HUD shell and one coherent design system.

## 20. Handoff boundary

This file defines the visual and interaction target. It does not authorize:

- launchToken signing;
- mainnet deployment;
- changes to economic formulas;
- changes to the accepted Terra composition;
- replacement of core building assets;
- adding units to the scene;
- activating missions;
- adding unsupported wallet or chain behavior.

After this spec is reviewed and approved by the owner, implementation proceeds
with STEP 1 only. Each subsequent step requires its own verification and
owner-controlled continuation.
