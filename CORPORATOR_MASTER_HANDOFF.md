# CORPORATOR MASTER HANDOFF

## 0. Document Status

### Purpose

This document is a repository-grounded handoff for a new AI agent that has no
access to the Corporator repository. It reconstructs the intended product,
the current content pack, the actual implementation, the visual pipeline, the
deployment shape, and the known drift between them.

This is an audit document, not a redesign proposal. It does not silently
resolve contradictions and does not promote a UI placeholder to an implemented
game system.

### Audit basis

- Repository: `C:\Users\sk640\ai_city`
- Audit date: 2026-09-13
- Prior audit in this file: 2026-09-09/10/11
- Current pack hash:
  `9e4a5ca1132872e8856ad0764126f63ec0bc16b7a971f59108c9724495cb83ed`
- Current vectors hash:
  `db4d97d59d94ebabd2fd53e06c2726c42bb6b1085413f0fc8549da64e0a9fd4e`
- Current `rules_version`: `0.24.0`
- Current `pack_version`: `138`
- Current `layout_version`: `1`
- Current canonical bytes: `676950` (`content/out/pack.json` size equals
  `content/build.py` “canonical bytes”)
- Primary current-canon index: `docs/CANON.md`
- These are current local generator outputs. No mainnet publication, launch
  signature, or deployment was performed.

### Evidence labels

- **CANONICAL FACT** — explicitly stated by the current canon or owned content
  data.
- **IMPLEMENTATION** — behavior present in executable source code.
- **INFERENCE** — conclusion derived from multiple repository facts; not an
  explicitly authored rule.
- **UNKNOWN** — the repository does not contain enough evidence to decide.
- **CONFLICT** — two repository sources state or implement incompatible
  behavior.
- **OPEN QUESTION** — an unresolved decision that matters to future work.

### Source precedence

When sources disagree, preserve both versions and use this order only to
identify the current intended owner; do not use it to erase the disagreement:

1. `docs/CANON.md` and active documents listed there;
2. `content/params/*.json`, `content/{aggregates,xp,bank,fragments,seasons,tick}.py`
   and the generated pack (`content/out/pack.json`);
3. current executable implementation
   (`packages/engine`, `services/api`, `contracts`, `packages/chainport`);
4. tests and fixtures
   (`packages/engine/test/economy_rules.test.ts`, contract tests);
5. `docs/archive/` and historical visual reviews.

**CANONICAL FACT:** Content/design rules are the current intended owner over
older engine/API behavior. A Python/content formula that later landed in
TypeScript does not make a stale DESIGN.md sentence current. Archive files are
history, not active technical instructions (`docs/archive/README.md`).

### Verification status (2026-09-13)

This status records the approved stock-kettle split and the rebuilt pack
against live files. This documentation pass adds no content parameters. It
does **not** claim production deployment, DEX execution, or mainnet
publication. It does **not** silently resolve C-20.

**CANONICAL FACT — current local generated pack (not a mainnet publication):**

- `content/out/pack.sha256` =
  `9e4a5ca1132872e8856ad0764126f63ec0bc16b7a971f59108c9724495cb83ed`
- `content/out/vectors.sha256` =
  `db4d97d59d94ebabd2fd53e06c2726c42bb6b1085413f0fc8549da64e0a9fd4e`
- `packages/protocol/src/versions.ts` banner matches that pack hash;
  `rulesVersion = "0.24.0"`; `packVersion = 138n`; `layoutVersion = 1n`
- `content/out/GENERATED.md` header: rules `0.24.0`, pack `138`, hash
  `9e4a5ca1132872…`

**LATEST SUCCESSFUL IMPLEMENTATION EVIDENCE:**

- `python content/codegen.py --check`: `23 artifacts match pack 9e4a5ca1132872`
- `python content/build.py`: succeeded; fee split `100/30/50/20`, spend split `40/60/0`
- `python content/builds.py`: completed in 1182 seconds; `131777` evaluated,
  `92622` justified, `uncovered=0`, `dominating=0`, `dead=0`, `mandatory=0`
- `python content/lint.py`: 384 rules, `ERRORS: none`; L174 warning and 5 pending owner/T3 items remain
- `python content/attack.py --only L42,L63,L64,L65,L69,L313`: 14 targeted probes caught
- Direct source mutations: `spend_protocol` does not change farm sizing; active-work `0` zeros it
- `construction_island_stage_keys_exist`: held
- `@corporator/contentpack` gate: `tsc` + Vitest **61/61** (was 60/61)
- I0 source-of-truth: `content/params/arch.json` `roadmap.*.construction_tests`
  plus lint `L268` (Vitest `it()` names 1:1) are canonical. The stale I0
  assertion that every island stage except `island_form` has
  `construction_tests == []` was inventory drift, not an intentional
  documented conflict. `island_client` now expects the exact 10 LOOK names
  already listed in `arch.json`. Other island stages remain `[]`.
  `island_form` remains `["island_stage_keys_exist"]`.

**DOCUMENTATION-PASS RECHECK:**

- `python content/lint.py`: 384 rules, `ERRORS: none`; one L174 warning and
  five explicit pending owner/T3 items.
- `python content/build.py` was attempted, but Windows could not overwrite
  the already mapped `content/out/pack.json`; this pass therefore claims no
  new build result. The documented pack values are the existing local pack
  `138` / hash above.

**DOCUMENTATION STATUS — current local pack:**

- `L174` is a warning, not an error: realized decor share is `1087 bps`
  inside the authored `1200 ± 400` tolerance. It describes the archival
  placement grid, not the live authored island; the generator must not paint
  extra lots to force the target.
- `PENDING` is explicit owner/T3 work, not a failed gate:
  `attest_testnet`, `bank_withdraw_rate_ceiling_only`,
  `exit_uncovered_at_band_floor`, and
  `island_studio_diorama`.
- `attest_testnet` waits for real testnet deployment data. The bank item needs
  a decision about deriving withdrawal from the working mint rate. The LLM
  a current `409 bps` uncovered band and cannot be deleted without a matching
  economic decision. The island item closes only on owner `ACCEPT LOOK-11`.

**IMPLEMENTATION from the official pack-publish close (not re-run in this
follow-up; still the current published evidence):**

- Serial attack: 384 rules covered + 307 construction held, including
  day-15 06:00 (`тик на границе 06:00` / 14-day fragment settlement)
- Engine C1 + economy_rules + M5: 26/26
- Chainport: 16/16
- Foundry: 19/19 (M5 4, L7 4, P3 11)
- Visual gates I4 (`art/island_v3/gate_light.py`), I5
  (`gate_compose.py`), I6 (`gate_anchors.py`), LOOK-02
  (`art/island_v3/reviews/LOOK-02/gate_look02.py`) pass
- LOOK-02 report `art/island_v3/reviews/LOOK-02/tree_report.json`
  `recorded_at_utc`: `2026-09-11T23:38:37.890786+00:00`
- Budget measurements re-read from live runtime GLBs on 2026-09-12:
  mass `389308` / `1572864`; worst building `city_hall.glb` `216164` /
  `358400`; first load `2916776` / `12582912`; tris `248494` / `250000`
- Corrected City Hall origin: `runtime/buildings/city_hall.glb` root is
  identity translation `(0,0,0)`, rotation `(0,0,0,1)`, scale `1`;
  local floor Y `0`; height `1800`. LOOK-02 `attacks.export_hall_world_translation`
  / `double_yaw_source_and_anchor` strings are injected-failure probes, not
  the live root.
- Vault/PrizeTreasury have no `pause` / `unpause` / `paused` /
  `pauseReadyAt` / `unpauseDelay` (`contracts/src/Vault.sol`,
  `PrizeTreasury.sol`; `docs/AUDIT.md`).
- Merge uses full Tier-1 dividend in content/generator; `DESIGN.md` §4.8
  still says half — keep C-20.

**Windows attack note (IMPLEMENTATION):** `attack.py` defaults `jobs` to
`os.cpu_count()` when `--jobs` is omitted. Nightly pack text uses
`--jobs 8`. On Windows, parallel L374 probes can race `os.replace` on
`content/out/heroes/*.glb` (`PermissionError`). Use `--jobs 1` for local
full construction. Targeted `--only L268,L385` in this follow-up completed
without that race.

**Remaining genuine partiality (do not erase):**

- No API `unstake` command; `packages/protocol/src/routes.ts` has no
  `/command/unstake`.
- Production voucher host/chain presentation path is not wired through API
  (`services/api` has no `issueVoucher`/`presentVoucher` command).
- `AssetPort` now exposes PrizeTreasury deposit/slice/return/claim custody
  methods. DEX quote/buy and stock-hop execution remain an external conveyor
  boundary (`packages/chainport/src/port.ts`).
- Engine tick `bankWithdraw` can still fill `withdraw_intent` immediately
  without the reservation voucher path (`packages/engine/src/economy.ts`).
- Client `build.tsx` still posts `tile_x`/`tile_y`; the API ignores those
  fields.
- LOOK-11 owner acceptance is absent. LOOK-02 identity/pose is implemented.
- No API `deposit` / `withdraw` / `stake` command routes.

### Deployment-only data gaps

Do not invent values. The repository does not contain:

- production `$CORP` token address, Vault, StakeRegistry, MerkleRoots,
  PrizeTreasury addresses;
- deployment transactions (`content/params/launch.json` `deployed.*` are
  empty strings);
- role owners/management (guardian, signer, voucherSigner, minter, depositor);
- Stock Token → `StakeRegistry.setToken` mappings;
- final deployed ABI (local selectors live in
  `packages/chainport/src/rpc/abi.ts`; they are not a mainnet ABI dump);
- external audit results beyond the internal `docs/AUDIT.md` / pack findings
  table;
- production DEX quote/buy and stock-hop executor;
- voucher presentation host in production.

### Working-tree condition

The repository was already dirty before this audit. The initial Git snapshot
contained modified generated/configuration files, `dist-web` changes, deleted
and added GLBs, and nested `node_modules` changes. This document describes the
current files; it does not claim that the current working tree equals a clean
commit.

---

## 1. Executive Summary

### Product in one paragraph

**CANONICAL FACT:** Corporator is a browser-based 3D city-management game on
Robinhood Chain. The player owns the economy of one city, deposits `$CORP` to
obtain internal Capital, activates the functions of an already existing
author-authored city, hires and assigns workers, manages production and
resource bottlenecks, stakes real Stock Tokens to open industries, and exits
through a time-gated Bank. The city pays work shifts from a finite payroll
fund. The protocol is designed so Capital cannot exceed the backing invariant
in the Vault.

**CANONICAL FACT:** The intended product is not a conventional city builder.
The island and physical buildings already exist. The authored map is
immutable. The player activates and deactivates logical functions of
prebuilt buildings. The player does not physically construct, place, create
meshes, allocate anchors, mutate tiles, or enter a construction state.

This principle is stated in `DESIGN.md`, `docs/CANON.md` R-V-98,
`docs/WORLD.md`, `docs/reports/PLAN_ISLAND.md`, and implemented for the API
`build` effect in `services/api/src/commit.ts`.

### Intended core loop

```
onboard
  → obtain $CORP
  → deposit $CORP for Capital
  → activate a building function
  → hire an agent
  → assign role/task/seat
  → produce during a valid city tick
  → solve Energy/Compute/logistics bottlenecks
  → stake a real Stock Token
  → open an industry
  → unlock progression and synergies
  → manage payroll and offline behavior
  → withdraw through the Bank
  → reinvest or exit
  → participate in fragment windows / Influence seasons
```

**IMPLEMENTATION:** The current runtime executes a synthetic city-hour payroll
model plus the newer content-owned economy helpers. The TypeScript engine can
calculate a generic city request, payroll, mint rate, bank reservations,
unstake/freeze, XP, housing/city-level stickiness, fragment settlement and
records. The API currently implements `hire`, `build` (logical function
activate/deactivate), `claim_prize`, and `set_objective`
(`services/api/src/commit.ts`). The client does not receive the complete live
state. There is still no API `unstake`, `deposit`, `withdraw`, or voucher
presentation host.

**INFERENCE:** The repository is currently a deterministic simulation and
architecture prototype with a partial browser vertical slice, not a complete
production game.

### Most important handoff warning

Do not infer implementation from the presence of a pack entry, generated
formula, screen, Solidity interface, or button. For every feature, inspect:

- the authoritative content section;
- the generated value;
- the engine path;
- the API command path;
- the persistence path;
- the client state projection;
- the visual/runtime path.

Many systems are fully authored in content but only partially executed in
runtime.

---

## 2. Project Inventory

### Repository roots

#### `packages/engine`

- **FILE:** `packages/engine/src/index.ts` plus `tick.ts`, `economy.ts`,
  `bank.ts`, `xp.ts`, `aggregates.ts`, `fragments.ts`, `seasons.ts`,
  `treasury.ts`, `config.ts`
- **SYSTEM:** deterministic simulation, economy, tick, records, Merkle,
  verification, aggregates.
- **PURPOSE:** pure integer engine consumed by API and tests.
- **IMPORTANT FUNCTIONS:** `tick`, `catchUp`, `newState`, `spawnCity`,
  `loadConfig`, `applySpend`, `mintFromBacking`, `applyStack`,
  `publicVerify`, `seasonSettle`, `unstake`, `authorize`/`present`/`expire`,
  `awardPaidTick`/`awardTrain`, `housingCapacityOf`, `stickyCityLevel`,
  `clipOfflineHours`, `fragmentGrossBase`, `settleCities`.
- **IMPORTANT LIMITATION:** state is untyped `Dict`; the engine's city row is
  not a full Agent/Building graph. Production still uses a synthetic
  `agent_id="shift"` record.

#### `packages/protocol`

- **FILE:** `packages/protocol/src/*.ts`
- **SYSTEM:** generated IDs and wire constants.
- **PURPOSE:** one generated source for codes, routes, buildings, districts,
  screens, channels, units, versions and listen settings.
- **GENERATED FROM:** `content/params/*.json` through `content/codegen.py`.
- **DO NOT HAND-EDIT:** generated headers say
  `GENERATED from pack <hash>; do not edit`.

#### `packages/contentpack`

- **FILE:** `packages/contentpack/src/load.ts`,
  `parse.ts`, `canonical.ts`, `registry.ts`
- **SYSTEM:** pack parsing, BigInt-safe JSON, canonical bytes, SHA-256 pack
  hash and in-memory pack registry.
- **PURPOSE:** ensure every consumer uses the exact pack bytes.
- **I0 TEST:** `packages/contentpack/test/i0.test.ts` `island_stage_keys_exist`
  asserts the nine island keys, `island_form.construction_tests ==
  ["island_stage_keys_exist"]`, `island_client.construction_tests` equal the
  10 LOOK Vitest names in `arch.json`, and every other island stage `[]`.
  Canonical inventory owner is `arch.json` + lint `L268`, not an empty-CT
  freeze from I0 close.

#### `packages/chainport`

- **FILE:** `packages/chainport/src/port.ts`,
  `mock.ts`, `rpc/*.ts`
- **SYSTEM:** fail-open boundary to token, Vault, staking and Merkle roots.
- **PURPOSE:** keep engine free of RPC while allowing mock and RPC adapters.
- **IMPLEMENTATION:** `AssetPort` now includes Vault `issueVoucher` /
  `presentVoucher` and StakeRegistry `unstake` (`packages/chainport/src/port.ts`,
  `mock.ts`, `rpc/live.ts`). Mock `issueVoucher` reserves backing; present
  consumes it.
- **IMPLEMENTED:** PrizeTreasury custody methods are represented in
  `AssetPort` and implemented by mock/live RPC adapters.
- **ABSENT:** DEX buying and stock-hop execution are not represented as an
  Uniswap executor; production voucher presentation is not hosted by
  `services/api`.

#### `packages/render`

- **FILE:** `packages/render/src/three.ts`
- **SYSTEM:** current Three.js island renderer.
- **PURPOSE:** load island mass and building GLBs, apply anchors/materials,
  render orbit camera, lighting, bloom, and building picking.
- **ARCHIVE:** Pixi/cell renderer remains in `packages/render/src/pixi.ts` and
  related files. Current canon treats it as an archive path.

#### `services/api`

- **FILE:** `services/api/src/main.ts`, `host.ts`, `tick_host.ts`,
  `commands.ts`, `commit.ts`, `http.ts`, `session.ts`, `boot.ts`
- **SYSTEM:** HTTP API, sessions, command routing, in-memory host state,
  database writes, tick scheduling and attestation handoff.
- **PURPOSE:** sole intended player-money writer.
- **LIVE EFFECTS:** `hire`, `build` (activate/deactivate authored functions),
  `claim_prize`, `set_objective`.
- **IMPORTANT LIMITATION:** boot does not reconstruct live city state from the
  database; runtime gameplay remains synthetic/partial. Genesis/session cities
  get `functions: []` and `created_day`. There is no unstake/withdraw/deposit
  command handler.

#### `services/sampler`

- **FILE:** `services/sampler/src/step.ts`, `pack.ts`
- **SYSTEM:** price sample/TWAP pure functions.
- **PURPOSE:** produce recorded `$CORP/ETH` and ETH/USD inputs.
- **IMPLEMENTATION STATUS:** main process currently exposes readiness; a
  production polling loop/provider integration is not present.

#### `services/buyback`

- **FILE:** `services/buyback/src/conveyor.ts`, `worker.ts`, `source.ts`
- **SYSTEM:** buyback policy and stock-basket arithmetic.
- **PURPOSE:** external ETH → CORP → Vault/fund and stock basket conveyor.
- **IMPLEMENTATION STATUS:** fund/leaderboard/farm legs, slice and
  return-unsettled custody calls are wired through the conveyor. The default
  pull source is still a fail-open mock; a production DEX batch provider is
  not wired.

#### `services/attestor`

- **FILE:** `services/attestor/src/step.ts`, `tree.ts`, `publish.ts`,
  `live.ts`
- **SYSTEM:** minute Merkle root, city-day CID, IPFS/RPC fail-open logic.
- **PURPOSE:** asynchronously attest already paid ticks.
- **IMPLEMENTATION STATUS:** `services/attestor/src/live.ts` currently creates
  `createMockPort()` and `memoryRootStore()` for root submission/storage.
  Optional HTTP IPFS pinning exists, but live chain root submission and
  persistent attestor storage are not wired. Deployment values are absent.
  Because the mock port/store can still return a successful root path, the
  service can produce a `verified` badge in a mock environment; that badge
  does not prove an on-chain root was submitted.

#### `services/llm`

- **FILE:** `services/llm/src/step.ts`, `pack.ts`
- **SYSTEM:** queue capacity and provider-failure template arithmetic.
- **PURPOSE:** keep LLM outside the economic tick.
- **ABSENT:** provider adapter, daily summary execution,
  and persistent generated agent personality.

#### `apps/client`

- **FILE:** `apps/client/src/main.tsx`
- **SYSTEM:** React HUD over Three.js island.
- **PURPOSE:** login, pack/state boot, local clock, command POSTs, HUD
  overlays and island interaction.
- **IMPORTANT LIMITATION:** snapshot mapping drops most live state; only a
  subset of command effects reaches `services/api/src/commit.ts`.

#### `contracts`

- **FILE:** `contracts/src/*.sol`
- **SYSTEM:** local Solidity doubles and safety contracts.
- **CONTRACTS:** `CorpToken`, `Vault`, `StakeRegistry`, `PrizeTreasury`,
  `MerkleRoots`.
- **IMPORTANT LIMITATION:** `CorpToken.sol` explicitly says production `$CORP`
  is the pons factory token; these are local doubles/interfaces for testing.
- **CURRENT CONTRACT FACT:** pause/unpause/`paused`/`pauseReadyAt`/
  `unpauseDelay` are removed from Vault and PrizeTreasury. Refunds, recovery,
  vouchers and roles remain. StakeRegistry `unstake` is holder-owned.

#### `content`

- **FILE:** `content/params/*.json`
- **SYSTEM:** canonical content source and generators.
- **GENERATORS:** `build.py`, `lint.py`, `codegen.py`, `vectors.py`,
  `attack.py`, `sim.py`, `builds.py`, `world.py`, `screens.py`,
  `seasons.py`, `aggregates.py`, `xp.py`, `bank.py`,
  `fragments.py`, `tick.py`.
- **OUTPUT:** `content/out/pack.json`, generated tables, vectors and summaries.

#### `art/island_v3`

- **SYSTEM:** authored island source, runtime GLB export, review captures,
  Blender tooling and LOOK process.
- **CURRENT LIVE ASSETS:** `runtime/island_mass.glb`,
  `runtime/buildings/*.glb`.
- **NOT RUNTIME:** fat `art/island_v3/island.glb`.

#### `visual`

- **SYSTEM:** reference/mockup image library.
- **CONTENTS:** `visual/mockups`, `visual/buildings`, `visual/units`,
  `visual/out`.
- **STATUS:** reference/concept evidence; no independent canonical-status
  manifest was found.

#### `docs`

- **ACTIVE:** files listed by `docs/CANON.md`.
- **HISTORICAL:** `docs/archive/`.
- **IMPORTANT:** archive documents preserve why prior decisions changed and
  must not be treated as current implementation instructions.

### Build/deployment files

- `package.json`: root commands `gate`, `ci`, `vectors`.
- `pnpm-workspace.yaml`: `packages/*`, `services/*`, `apps/*`.
- `tsconfig.base.json`: strict BigInt-safe TypeScript baseline.
- `tsconfig.json`: generated project references.
- `vitest.workspace.ts`: workspace tests, but currently omits render.
- `.dependency-cruiser.cjs`: generated layer restrictions.
- `.github/workflows/ci.yml`: generated push/nightly CI.
- `deploy/Dockerfile`: generated Node service image.
- `deploy/compose.yaml`: dev/staging with source mount.
- `deploy/compose.prod.yaml`: production image and Postgres.
- `deploy/.env.example`: variable names without live values.
- `services/api/migrations/001_from_pack.sql`: generated canonical-byte
  tables.

### Production/readiness classification

- **CONTENT FORMULAS:** largely authored and generated.
- **DETERMINISTIC ENGINE:** implemented for the synthetic city model and
  vector-tested.
- **CONTRACT SAFETY DOUBLES:** implemented/tested locally.
- **API/SESSION SCAFFOLD:** implemented.
- **FULL PLAYER GAMEPLAY:** incomplete.
- **FULL LIVE CHAIN:** absent.
- **FULL PERSISTENT CITY STATE:** incomplete.
- **CURRENT 3D RENDERER:** implemented as a static/runtime island path.
- **FINAL VISUAL ACCEPTANCE:** incomplete; LOOK-11 acceptance absent.
- **MARKETING/BRAND REFERENCES:** present as visual files; no integrated
  marketing pipeline.

---

## 3. Product Overview

### Name

**CANONICAL FACT:** `Corporator`. Token name: `$CORP`.

Sources: `DESIGN.md`, `docs/CANON.md`, `packages/protocol/src/versions.ts`,
`content/params/meta.json`.

### Genre and format

**CANONICAL FACT:** browser 3D city-management/economy game with an orbital
camera, HUD panels, deterministic ticks, Stock Token industry gates and a
crypto-backed internal currency.

**PLATFORM:** browser client. The repository contains React/Vite client code,
but the production deployment files ship Node services and do not ship
`apps/client/dist-web`. Static client hosting is **UNKNOWN**.

### Core fantasy

The player operates a living corporate city. Real companies are represented by
real Stock Tokens used as industry keys. Agents execute work shifts. The
player makes the management decisions; the simulation resolves economic
consequences deterministically.

### What the player owns

The intended player-owned state is one persistent city economy:

- Capital balance;
- city treasury;
- payroll participation;
- agents, roles, levels, tasks and traits;
- building functions and levels;
- district stakes and progression;
- fragment ledgers;
- Influence/season history;
- bank/withdrawal history;
- personal city clock.

The physical island is shared and author-authored, not generated per player.

### What the player does

- connect a wallet or enter the isolated demo;
- deposit `$CORP`;
- activate/upgrade building functions;
- hire, seat and task agents;
- maintain Energy/Compute and production chains;
- buy/stake real Stock Tokens;
- open districts;
- choose progression nodes and merges;
- manage payroll and bank windows;
- use the Exchange and Bank;
- inspect logs, efficiency, stability and seasonal rank;

### What the player does not do

**CANONICAL FACT:** The player does not mint a game version of NVDA, build a
procedural per-wallet map, use an LLM to calculate economic ticks, receive
Capital merely for placing a building, or obtain guaranteed profit. The player
does not physically construct buildings, allocate anchors, mutate tiles, or
create meshes.

Sources: `DESIGN.md` §§1, 2.8, 4, 5.1, 11; `docs/CANON.md`;
`docs/WORLD.md`; `services/api/src/commit.ts`.

### Economic model

The economic model is a closed-backed internal Capital system with external
DEX fee revenue and a finite payroll fund. It is explicitly not a promise
that all players profit.

### Current runtime qualification

**IMPLEMENTATION:** The current API/client can demonstrate login, pack boot,
local clock, a synthetic tick, and a few command routes. It cannot yet expose
the full intended player loop end-to-end.

---

## 4. Lore

### Status of lore

**UNKNOWN:** No formal narrative bible, named protagonist, chronology, faction
history, or authored story campaign was found in the active repository.

The project has product-lore vocabulary and visual motifs, but not a complete
fictional canon.

### WORLD

**CANONICAL FACT:** The world is a corporate city economy on an authored
island. The island is one shared map; account-specific state is economic.

Sources: `DESIGN.md` §1; `docs/CANON.md`; `docs/WORLD.md`.

### CITY

The city is an existing corporate infrastructure whose functions can be
activated and operated by the player. It contains civic, production, research,
finance, logistics, consumer and automation functions.

### ISLAND

The island is an authored low-poly diorama. It is not generated from
`city_id`, wallet address or layout seed. Runtime mass and building GLBs are
exported from Blender-authored assets.

Source: `docs/reports/ISLAND_STUDIO.md`, `docs/reports/PLAN_ISLAND.md`.

### PLAYER

The player is a city operator/owner. The exact in-world identity, biography
and canonical name are **UNKNOWN**. The visual `corporator` character is a
brand/player avatar reference, not an explicitly defined lore character.

### PROTOCOL

The protocol controls backing, minting, payroll funding, bank withdrawal,
staking registry, prize custody and Merkle attestations.

Sources: `DESIGN.md` §10; `contracts/src/*.sol`; `packages/chainport/src/port.ts`.

### `$CORP`

`$CORP` is the external protocol token. It is not the same as Capital and is
not a per-player internal score.

### CAPITAL

Capital is an internal city unit backed by `$CORP` in the Vault. It is used for
building, hiring, upgrades and other internal actions.

### AGENTS

Agents are workers, not autonomous city governors. The intended agent is a
role/level/trait/seat/task combination. The current engine record uses the
synthetic agent id `"shift"` rather than a full agent roster.

### INDUSTRIES

Industries are mechanically represented by six district roles keyed by Stock
Tokens. A ticker may change if the chain asset changes; the industry role is
the stable design axis.

### BUILDINGS

Buildings already exist physically in the authored city. Their game meaning is
the function they provide: production, energy, finance, research, logistics,
retail, automation or synergies.

### MARKET

The market is external price/weather input. Stock price affects district
efficiency; it is not directly shown as player profit.

### SEASONS

Seasons are 90 city days. Influence integrates daily city performance.
Prize periods are derived as three 30-city-day periods.

### TIME

The city has personal city time: a 25-real-hour city day, anchored to Monday,
day 1, 12:00. Real markets have their own schedule; the intentional mismatch
between personal city Sunday and global market weekends is documented.

### POPULATION AND ECONOMY

Population, Happiness, Productivity and Stability are intended derived city
metrics. In the current client/API projection, most are not populated.

---

## 5. World

### Shared authored world

**CANONICAL FACT:** One authored island is shared by players. The economy is
per-account; the physical map is not.

Sources: `docs/CANON.md` R-V-98, `docs/WORLD.md` Part A,
`docs/reports/ISLAND_STUDIO.md`.

### Economic grid versus live island

`content/world.py` generates a pack placement grid with roads, lots, zones,
filler and counters. Current canon explicitly says this is an economic layer,
not the live visual map.

The bridges are:

- `park_slots`;
- `plaza_slots`;
- `filler_occupied_total`.

Source: `content/params/placement.json`, `docs/WORLD.md`,
`content/world.py`.

### Units

**CANONICAL FACT:** Current live island canon contains no cars, drones,
walkers, robots or mobs.

**IMPLEMENTATION:** Legacy grid/Pixi code and `content/world.py` still know how
to generate vehicles, drones and walkers. This is archive/deprecated behavior,
not a current live-world guarantee.

### Day phases

The pack derives dawn, day, dusk and night from:

- `time.params.efficiency_recalc_hour`;
- `time.params.bank_open_hour`;
- `time.params.bank_close_hour`;
- the derived remaining night interval.

Source: `content/world.py`, `content/params/placement.json`,
`packages/render/src/light.ts`, `packages/render/src/sun.ts`.

### World generation status

The procedural grid generator is implemented and heavily linted. The current
Three.js island path is separate. The transition between these two world
representations is not complete in player actions.

---

## 6. Core Game Loop

The following is the intended loop. Each step distinguishes canon from current
runtime.

### 6.1 Onboarding

**PLAYER ACTION:** enter demo or connect wallet.

**SYSTEM RESPONSE:** create a session; demo gets an isolated city, wallet gets
an address-bound city.

**UI:** `apps/client/src/hud/LoginRoot.tsx`.

**IMPLEMENTATION:** session creation and wallet signature verification are
present. `LoginRoot` is always shown before the live HUD. The separate
six-step `onboarding_demo` screen exists, but it is not automatically shown
and does not advance a persistent onboarding step.

**FAILURE:** `API_UNAUTHORIZED`, `WALLET_NOT_CONNECTED`,
`API_MALFORMED`. `WALLET_WRONG_CHAIN` exists in the pack but the current
LoginRoot/session flow does not call `eth_chainId`; wrong-chain rejection is
therefore a declared capability, not a verified current login behavior.

Sources: `apps/client/src/session.ts`, `services/api/src/session.ts`,
`services/api/src/recover.ts`, `content/params/codes.json`.

### 6.2 Capital entry

**PLAYER ACTION:** deposit `$CORP`.

**CANONICAL FACT:** `$CORP` enters the Vault and mints Capital at the current
backed rate, less the Vault fee.

**IMPLEMENTATION:** Vault Solidity and chainport interfaces support the
operation. API command `deposit` is listed in protocol but is not handled by
`services/api/src/commit.ts`.

**FAILURE:** `WALLET_NOT_CONNECTED`, `NOT_ENOUGH_CORP`, `STALE_PRICE` or
transport failure.

### 6.3 Building activation

**PLAYER ACTION:** choose an authored building function and activate or
deactivate it.

**CANONICAL FACT:** The physical island already exists and is immutable.
Activation is a logical function, not procedural mesh generation, tile
mutation, anchor allocation, or construction state.

**IMPLEMENTATION:** `services/api/src/commit.ts::applyBuild` writes
`city.functions[]` with `{id, level}` and can set `deactivated`. It refuses
prebuilt/autonomous ids, checks `buildings_playable_v1` and city-level
requirement, and caps ordinary active functions at `agent_slots + 3`. Frozen
or deactivated functions do not count. It does not create a runtime 3D mesh,
construction timer, tile occupancy, or authored-anchor placement. Client
`apps/client/src/hud/screens/build.tsx` still posts unused `tile_x`/`tile_y`.

**FAILURE:** `CITY_LEVEL_TOO_LOW`, `NO_FREE_BUILD_SLOT`,
`NOT_ENOUGH_CAPITAL`, `API_MALFORMED`. Protocol still defines
`BUILD_TILE_ILLEGAL` (`packages/protocol/src/codes.ts`); the current API
handler does not emit it. Prebuilt/autonomous/non-playable ids currently
reuse `CITY_LEVEL_TOO_LOW` rather than a dedicated code
(`services/api/src/commit.ts`).

**CONFLICT:** `content/params/screens.json` `build_place` still describes
lot-tile placement and `BUILD_TILE_ILLEGAL`. See C-01.

### 6.4 Agent hiring

**PLAYER ACTION:** hire an agent.

**CANONICAL FACT:** Hiring costs Capital and consumes an agent slot.

**IMPLEMENTATION:** API adds an engineer object only. It does not use the
content hire pool, create traits, assign a seat, or update the client roster.

**FAILURE:** `NO_FREE_AGENT_SLOT`, `NOT_ENOUGH_CAPITAL`.

### 6.5 Assignment and tasks

**CANONICAL FACT:** The player should choose seat, role and task; agents
execute the tick.

**IMPLEMENTATION:** `services/api/src/commit.ts` has no live seat/objective
implementation. Engine city rows do not contain a full seat graph.

### 6.6 Production

**SYSTEM RESPONSE:** On each tick the engine checks output base, offline
window, schedule, energy, compute, then calculates request and pays it from
the payroll budget.

**IMPLEMENTATION:** This generic city-level production is implemented in
`packages/engine/src/economy.ts`; it is not a complete building/agent
simulation.

### 6.7 Resource bottlenecks

Energy and Compute are the two consumables. `IDLE_NO_ENERGY`,
`IDLE_NO_COMPUTE`, `IDLE_OUT_OF_HOURS` and `IDLE_OFFLINE_CAP_REACHED` are
defined and recordable. Actual API-created cities have only the simplified
`energy_ok` path and no complete resource warehouse setup.

### 6.8 Industry unlock

**PLAYER ACTION:** buy/stake a Stock Token and open a district.

**CANONICAL FACT:** Stake is measured in token quantity, frozen at an authored
snapshot threshold; it opens industry functions.

**IMPLEMENTATION:** `StakeRegistry.sol` and chainport support `stake` and
holder-owned `unstake`. Engine `packages/engine/src/bank.ts::unstake` deducts
settled tokens, returns them to `tokens_held`, queues `unstake_pending` with
`ready_at = cityTime + graceHours`, and writes `DISTRICT_FREEZING` when
settled amount falls below `S_min`. Grace is 24 city hours
(`economy.params.unstake_grace_city_hours`). API district/unstake commands
are not live. Freeze is server-side, not an on-chain delay.

### 6.9 Progression

Progression nodes, tier gates, merge matching and research formulas are
generated in content. Merge uses the **full** Tier-1 dividend of each side
(`content/build.py` `magnitude = unit * sign`,
`docs/PROGRESSION.md` §6). Automation merge may add +1 `offline_cap_hours`,
clipped at 18 (`clipOfflineHours`). Runtime node selection and merge commands
are not implemented in API.

**CONFLICT:** `DESIGN.md` §4.8 still says merge is half of the Tier-1
dividend. Current content/progression/generator is full Tier-1. See C-20.

### 6.10 Bank and exit

**PLAYER ACTION:** withdraw Capital during bank hours.

**CANONICAL FACT:** Bank checks personal/global live-depth limits and returns
`$CORP` through a server-authorized voucher route.

**IMPLEMENTATION:** Engine arithmetic exists in two layers:

1. Reservation path: `authorize` / `present` / `expire` in
   `packages/engine/src/bank.ts` (and `content/bank.py`). Reservations
   immediately consume capacity against a 1% live-depth cap; the
   authorization-day depth is snapshotted on the row; prior-day open
   reservations stay excluded; expiry releases into the current day and does
   not rewrite a closed day.
2. Tick path: `packages/engine/src/economy.ts::bankWithdraw` still fills
   `withdraw_intent` immediately when the bank is open. This is **PARTIAL**
   relative to the voucher reservation design.

Vault has `issueVoucher`/`presentVoucher`/`releaseExpiredVoucher`. API
withdraw command is not implemented.

### 6.11 Seasons and fragments

**CANONICAL FACT:** A global epoch at hour 0 closes the previous protocol day
for `GDP_day` and Influence. Farm/season windows settle at hour 6. New cities
do not backfill days before `created_day`
(`content/seasons.py::accumulate_day`, `packages/engine/src/seasons.ts`,
`content/tick.py`, `packages/engine/src/tick.ts`).

**IMPLEMENTATION:** Fragment `fragment_gross_base` is authored or derived in
Capital-equivalent units; modifiers apply before Payroll; settlement is the
global 14-day window (`payroll_daily_divisor`); city cap applies when
N≥2; ledger is cleared; owed is written
(`content/fragments.py`, `packages/engine/src/fragments.ts`). DEX buy/hop
remains outside the tick. Zipf uses actual eligible N capped by `prize_top_n`;
dust remains. API claim reports local rows and does not complete custody.

**PARTIAL:** Engine fragment accrual still keys off a synthetic
`city.building` object, not the full `functions[]` roster.

---

## 7. Player

### Intended player role

City operator, owner and manager of one economic city. The player chooses
allocation and timing; the protocol/engine resolves mechanical outcomes.

### Ownership boundaries

- **Player:** city economic state, decisions, wallet/stakes.
- **Agent:** executes a shift according to assigned state.
- **Building:** defines output/input/schedule/slots.
- **District:** defines industry modifier and unlock conditions.
- **Protocol:** backs Capital, collects fees, funds payroll and enforces custody.
- **LLM:** narrative layer outside the economic tick.

Source: `DESIGN.md` ?5.6.

### Player identity

Wallet session identity is implemented through a nonce and personal signature.
Demo identity is intentionally addressless and isolated.

Sources: `services/api/src/session.ts`, `apps/client/src/session.ts`,
`services/api/migrations/001_from_pack.sql`.

### Player identity unknowns

Formal account profile, display name, avatar ownership and lore identity are
**UNKNOWN**.

---

## 8. Economy

### Economic entities

#### Capital

- **WHAT:** internal city currency.
- **OWNER:** player city/account.
- **WHERE:** engine city state and Vault-linked accounting; not an ERC-20.
- **CREATED:** backed deposit or buyback/reserve pathways.
- **DESTROYED:** spend burn, bank exit, protocol split, refunds/clipping.
- **MOVES:** between city treasury, payroll fund and protocol accounting.
- **LIMIT:** Capital outstanding cannot exceed Vault backing times `2000`.
- **UI:** topbar Capital, Treasury, building/hire/research costs.
- **ZERO:** actions requiring funds refuse; production may still run if already
  configured.
- **MAX:** no general city-wallet max is defined; backing invariant is the
  relevant ceiling.
- **OFFLINE:** engine catch-up may produce/pay Capital up to offline cap.

Sources: `DESIGN.md` §§2.2–2.4, `packages/engine/src/economy.ts`,
`contracts/src/Vault.sol`.

#### `$CORP`

- **WHAT:** external protocol token.
- **OWNER:** wallet/market participants.
- **WHERE:** pons production token; local `CorpToken.sol` is a test double.
- **CREATED:** production launch/market infrastructure, not engine ticks.
- **DESTROYED/MOVED:** DEX/bank/vault/custody transfers.
- **LIMIT:** production supply and pons curve; current deployed addresses are
  missing.
- **UI:** wallet balance, Bank, Exchange/district gates.
- **OFFLINE:** not simulated by the engine; wallet/chain sampler is external.

#### Vault

- **WHAT:** custody/backing contract.
- **CREATED:** `contracts/src/Vault.sol`, chainport `VaultPort`.
- **OPERATIONS:** deposit, mint by minter, voucherSigner-authorized
  `issueVoucher` (reserves `reservedOf`), public `presentVoucher` (consumes
  reservation and backing), `releaseExpiredVoucher`, refunds, Merkle refund
  claim, wrong-token recovery, signer rotation.
- **BANK HOURS:** server-side, not Solidity.
- **PAUSE:** removed from Vault/PrizeTreasury. Engine
  `packages/engine/src/treasury.ts::claimPrize` still has a leftover
  `paused`/`honorPause` argument; API passes `paused: false`.
- **UNKNOWN:** production address, signer, guardian, voucherSigner, minter.

#### Payroll

- **WHAT:** finite Capital fund that pays valid shift requests.
- **CREATED:** deposit/spend/external buyback/reserve pathways depending on
  channel.
- **CALC:** daily fund budget `fund / 14`, tick budget `day_budget / 24`,
  proportional request trimming.
- **ZERO:** valid requests may receive zero when fund is empty; `I4_ZERO_PAY`
  protects some nonzero-fund dust cases.
- **UI:** `PAYROLL_TRIMMED` in overview/agents.
- **IMPLEMENTATION:** engine-level fund exists; actual API genesis arms a
  synthetic fund but does not implement the complete city payroll lifecycle.

#### Treasury

The engine tracks ETH treasury buckets:

- `treasury_eth`;
- `treasury_fund_eth`;
- `treasury_basket_eth`;
- `treasury_spec_eth`;
- `treasury_city_eth`.

Source: `packages/engine/src/state.ts`, `economy.ts`.

#### GDP

**CANONICAL FACT:** GDP/day is Capital paid during a city day. The aggregate
function is `gdpDay(payouts) = sum(payouts)`. A positive prize day means
`GDP_day > 0`. Influence is accumulated on the **global** closed day, not a
per-city private calendar. Cities with `closed_day < created_day` get 0 and
do not backfill.

Sources: `packages/engine/src/aggregates.ts`, `packages/engine/src/seasons.ts`,
`content/seasons.py`, `packages/engine/src/tick.ts`.

**IMPLEMENTATION:** the engine stores `city.day_gdp` during `pay()` and
closes it at hour 0 via `accumulateDay`. The TypeScript API state projection
does not populate `aggregate.gdp`.

#### Population

```
population = occupied_jobs × population_per_job + housing_capacity
```

**CANONICAL FACT:** Housing is additive Consumer capacity, not
`population_conversion_bps`. Flagship Store L1/L2/L3 = 400/900/2025.
Retail Complex L1/L2/L3 = 600/1350/3037. Capacities add. Frozen or
deactivated functions do not contribute. `housing_capacity_add` is a separate
additive remainder.

Sources: `content/aggregates.py`, `packages/engine/src/aggregates.ts`,
`packages/engine/test/economy_rules.test.ts`.

City Level is sticky: `stickyCityLevel` never downgrades. Attained level,
slots, agents and functions remain.

Current spawned cities lack housing/jobs state unless `functions[]` is
present; client hardcodes population to zero in `snapshotFromEnvelope`.

#### Productivity

```
productivity = realized × 10000 / max(1, nominal)
```

It is a measurement, not a second output multiplier.

#### Happiness

Four equal-weight terms in current pack:

- housing;
- parks;
- energy;
- payroll.

Each term is clamped to `[0,10000]`; weights must sum to `10000`.
`happiness_penalty_live=0`, so current v1 does not apply Happiness as an
output penalty.

#### Stability

Intended as valid ticks / ticks per city day. Python and engine helper code
use a single formula, but full city valid-tick aggregation is not wired into
the client/API projection.

#### Influence

Intended seasonal score is the integral of four daily intensities:

- GDP/capex;
- Stability;
- district efficiency against neutral `10000`;
- coverage of opened playable districts.

Source: `content/seasons.py`, `docs/PRIZES.md`.

#### Fragments

**CANONICAL FACT:** Fragments are internal claim chips, not ERC-20. Gross
base is authored or derived `fragment_gross_base` in Capital-equivalent
units. Rate modifiers apply before Payroll. Settlement is a global 14-day
window (`payroll_daily_divisor`) at hour 6. City cap applies when N≥2
(`fragment_city_cap_bps = 5000`). Ledger is cleared; owed is written. Dust
stays. DEX buy/hop is outside the tick.

**IMPLEMENTATION:** `content/fragments.py`, `packages/engine/src/fragments.ts`,
`packages/engine/src/tick.ts::hourSix`. Engine accrual still reads a
synthetic `city.building`. `AssetPort` has no buy/hop. API has no
`claim_fragment`.

**UNKNOWN:** production fragment pool buy/hop executor.

#### Staking

Staking is token quantity, not dollar quantity. `S_min` is frozen from the
2026-08-29 price snapshot. Bonus uses integer hyperbola:

```
stake_bonus =
  stake_bonus_max × (stake - S_min)
  / (stake - S_min + S_ref)
```

`S_ref = S_min`. Unstake grace is 24 city hours in content.

**IMPLEMENTATION:** engine/content `unstake()` is present
(`packages/engine/src/bank.ts`, `content/bank.py`). Chainport mock/RPC
`stakeRegistry.unstake` is present. StakeRegistry Solidity is holder-owned
and returns tokens immediately. The 24-hour grace/freeze is **server-side**
only. API has no unstake command.

#### Trading fees

**CANONICAL FACT:**

- Creator tax: 200 bps (`economy.params.creator_tax_bps`).
- Curve fee: 100 bps (pons, not protocol treasury).
- UI-visible combined fee: 300 bps.
- 50% of creator tax is the prize DEX leg
  (`seasons.params.prize_creator_tax_share_bps = 5000`).
- Of that prize leg, 20% is studio ETH
  (`economy.params.studio_eth_share_bps = 2000`); the remaining stock leg is
  split into `0.3%` for the monthly leaderboard and `0.5%` for the active-work
  farm. The generated split is fund 100 / leaderboard 30 / farm 50 / studio
  20 bps of turnover.
- Farm and leaderboard are separate DEX legs. Capital spending is
  `40%` burn / `60%` payroll / `0%` protocol, so it does not buy stocks.
- Canonical generated round-trip: **1445 bps**
  (`generated.economy.round_trip_cost_bps`;
  `packages/engine/test/economy_rules.test.ts`).

Sources: `content/params/economy.json`, `content/params/seasons.json`,
`content/params/fragments.json`, `content/out/pack.json`.

#### Burns

40% of Capital spending is burned; its backing remains in Vault as reserve
accounting. This is not a token burn transaction in current engine; it is
Capital/accounting behavior.

#### Deposits and withdrawals

Deposit is intended `$CORP → Vault → Capital`. Withdrawal is intended
Capital → server-authorized voucher → `$CORP`, subject to bank hours and
depth. `Vault.sol` stores the voucher fields by nonce and reserves
`reservedOf` at issue; it does not verify an ECDSA signature on-chain. Both
arithmetic paths exist in engine/contracts, but API commands are not live.

---

## 9. Capital

### Canonical rules

- Capital is internal, not ERC-20.
- Capital is minted only against `$CORP` backing or explicitly released
  reserve.
- Vault entry fee is 200 bps.
- Mint rate is floating but never above `capital_anchor=2000`.
- Lower rate movement is immediate; upward movement is ratcheted by 200 bps
  per city day.
- Stale price decays down; it never grants an upward advantage.

### Actual engine path

`packages/engine/src/economy.ts`:

1. calculate `gross = backing × mint_rate / wei`;
2. subtract vault fee if `paysFee`;
3. credit fund if destination is `"fund"`;
4. increment `capital_outstanding` and `capital_minted_total`;
5. update Vault/Reserve accounting;
6. assert I1.

### Important implementation limitation

There is no typed Capital ledger or command-specific Capital service. Capital
is stored inside generic dictionaries and mutated by engine/API helper paths.

---

## 10. `$CORP`

### Production design

**CANONICAL FACT:** `$CORP` is intended to launch through pons against ETH,
with no launch buy (`launch_buy_share_bps=0`) and creator tax 200 bps.

Source: `content/params/launch.json`, `docs/LAUNCH.md`,
`packages/chainport/src/rpc/launch.ts`.

### External chain facts recorded by the repository

`docs/LAUNCH.md` records Robinhood Chain RPC
`https://rpc.mainnet.chain.robinhood.com`, chain id `4663`, the pons V2
factory `0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e`, USDG
`0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`, and hook
`0xe5e702641ea86f4ae6cc3cdaed2b886f976be044`.

The same document records Chainlink proxies:

- ETH/USD: `0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9`;
- NVDA: `0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15`;
- TSLA: `0x4A1166a659A55625345e9515b32adECea5547C38`;
- AMZN: `0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C`;
- AAPL: `0x6B22A786bAa607d76728168703a39Ea9C99f2cD0`;
- MSFT: `0x45C3C877C15E6BA2EBB19eA114Ea508d14C1Af2E`;
- COIN: `0xA3a468A452940B7D6b69991207B508c609a98Ef2`.

These are external observed chain inputs, not proof that Corporator's own
contracts are deployed. The observed pons curve records 100 bps creator tax,
100 bps curve fee, `snipeTaxStartBps=9900` and `snipeTaxSeconds=3`; this
differs from the current Corporator content tax/fee assumptions and must not
be silently substituted.

### Current repository state

- `launch.deployed.token`, `curve`, `pool`, `hook`, `tx` are empty.
- No project launch transaction is present.
- `contracts/src/CorpToken.sol` is explicitly a local double.
- Live project addresses are expected through environment variables.

**CANONICAL FACT:** `docs/LAUNCH.md` does contain external chain facts such as
the Robinhood Chain RPC/chain id, the pons factory, Chainlink feed proxies and
Stock Token addresses. What is absent is this project's final launch/deploy
fact set (`launch.deployed.*`, Vault/StakeRegistry/MerkleRoots/PrizeTreasury
addresses and secrets), not all chain knowledge.

### Market role

`$CORP` is both:

- a market token used by external trading;
- the backing token entering the Vault.

It is not the same as Capital, fragments or a Stock Token.

### Known safety rules

- transfer tax is not implemented in local `CorpToken`; creator tax lives in
  pool/hook design;
- the pack enforces launch tax and launch-buy constraints;
- chainport uses fail-open RPC semantics for reads/submit boundaries.

---

## 11. Vault

### Solidity implementation

`contracts/src/Vault.sol` contains:

- immutable CORP address;
- minter;
- voucher signer;
- guardian;
- signer rotation (`proposeSigner` / `acceptSigner`);
- `capitalAnchor`;
- voucher TTL;
- `capitalOf`;
- `pending`;
- `backingOf`;
- `reservedOf`;
- `totalBacking`;
- `refundRoot`;
- `issued` / `used` nonce maps.

**CANONICAL FACT / IMPLEMENTATION:** There is no `pause`, `unpause`,
`paused`, `pauseReadyAt`, or `unpauseDelay` on Vault or PrizeTreasury
(`docs/AUDIT.md`; `contracts/src/*.sol`). Historical documents that describe
contract pause are stale unless marked archive.

### Deposit

`deposit(account, corpAmount)` measures actual received balance delta, so
fee-on-transfer tokens do not over-credit pending.

### Mint

`mintCapital` is restricted to `minter` and checks:

```
capitalAmount <= pending[account] × capitalAnchor
```

### Withdraw

`presentVoucher` checks signer-issued nonce, expiry, coverage, replay,
reserved backing consumption, backing release and token transfer. It does
**not** check a pause flag.

In the current Solidity double, `issueVoucher` is callable only by
`voucherSigner`. It requires `corpAmount <= availableOf(account)` where
`availableOf = backingOf - reservedOf`, then increments `reservedOf` and
stores `{account, corpAmount, issuedAtS}` under a nonce.
`presentVoucher` is externally callable by anyone, but the supplied values must
exactly match that stored record; it then consumes the reservation and
releases backing. `releaseExpiredVoucher` marks used and consumes the
reservation without paying CORP. `issuedAtS` is supplied by the caller of
`issueVoucher`; the contract does not itself write the current block time.
`DOMAIN_SEPARATOR` is constructed in the constructor but is not used for
signature verification. Signer rotation is guardian-proposed and
new-signer-accepted. Refund authority belongs to `signer` and is capped by
unreserved backing (`availableOf`).

**PARTIAL:** `packages/chainport/src/port.ts` VaultPort exposes
`issueVoucher`/`presentVoucher` but not `releaseExpiredVoucher`. Mock present
consumes reservation; there is no mock expiry-release method.

### Refund

`refundPlayer` can only refund up to `backingOf[player]`, reduces backing and
clips Capital to the new backing cap.

### Unknown production values

Guardian, signer, voucher signer, minter and deployed address are not
supplied in the repository. Pause delay is not a current contract parameter.

---

## 12. Payroll

### Intended fund sources

- player spending fund share;
- external creator-tax buyback;
- reserve drip when payroll is short;
- cork return as deferred payroll capacity.

### Daily budget

```
day_budget = fund / payroll_daily_divisor
tick_budget = day_budget / ticks_per_city_day
```

Current values: divisor `14`, ticks/day `24`.

### Proportional trimming

```
pay_i = request_i × tick_budget / Σrequest
payroll_ratio = min(10000, tick_budget × 10000 / Σrequest)
```

Remainder stays in the fund. Requests are sorted by city id before the
allocation path.

### Fund cap

After a full 30-day payroll history window, excess fund is moved to
`reserve_cork`. An incomplete window does not cap the fund.

### Current limitation

API genesis arms a synthetic fund for tests/demo. No complete production
pipeline connects actual player spend, buyback completion, city roster and
persistent payroll history.

---

## 13. Time System

### City clock

- first city time: Monday, day 1, 12:00;
- city day: 25 real hours;
- tick: 1 city hour;
- 24 ticks per city day;
- no player timezone or device timezone input;
- client locally extrapolates time from last server snapshot.

Sources: `content/params/time.json`, `packages/engine/src/state.ts`,
`apps/client/src/clock.ts`.

### Schedules

#### Always

- 00:00–24:00;
- night Energy premium is configured.

#### Market

- 08:00–20:00;
- Sunday closed;
- Bank and Exchange.

#### Retail

- 09:00–21:00;
- Sunday open.

#### Office

- 08:00–20:00;
- Sunday closed.

Source: `content/params/time.json`.

### Boundaries

- midnight/hour 0: payroll budget freeze, EMA/rate boundary and weekly
  boundary logic;
- hour 6: district efficiency, fragment settlement boundary and season
  settlement boundary.

### Current implementation caveat

`cityClock` uses `anchor_hour + tick_index` as absolute hours and assumes
`tick_length_city_hours=1`. If that parameter changes, current clock behavior
is not generalized.

---

## 14. Offline System

### Intended offline rule

Offline catch-up starts from the last recorded city time and credits no more
than the configured offline cap.

```
elapsed = (now_city_time - last_city_time) / tick_length_city_hours
credited = min(elapsed, offline_cap_city_hours / tick_length_city_hours)
skipped = elapsed - credited
```

Skipped time produces one `gap` DecisionRecord with
`IDLE_OFFLINE_CAP_REACHED`; credited ticks are replayed sequentially.

`catchUp` clips with `clipOfflineHours(base, added, hardCap=18)`
(`packages/engine/src/tick.ts`, `packages/engine/src/aggregates.ts`,
`content/tick.py`). The hard cap is 18 city hours; 19 is refused.

**IMPLEMENTATION caveat:** `catchUp` reads `state.offline_cap_hours`, while
the per-city online gate `inOfflineWindow` reads `city.offline_cap_hours`
(`packages/engine/src/economy.ts`). Those two fields are not automatically
kept in sync by spawn/API.

Source: `packages/engine/src/tick.ts` (`catchUp`), `docs/TICK.md` §6,
`docs/SCREENS.md` §5.

### Automation progression

**CANONICAL FACT:** The Automation district dividends add `1+2+3 = 6` city
hours, extending the base cap from 12 to 18. An Automation merge may add +1
`offline_cap_hours`, but the hard offline cap remains 18
(`content/aggregates.py::clip_offline_hours`, L58/L67/L80, economy_rules
test `"offline clip reaches 18 and never 19"`).

This is a progression/content rule, not a general client purchase.

Sources: `content/params/progression.json`,
`content/params/modifier_keys.json`, `docs/PROGRESSION.md`,
`content/build.py`.

### Actual host behavior

**IMPLEMENTATION:** `services/api/src/scheduler.ts` advances one tick at a
time. It does not call `packages/engine/src/tick.ts::catchUp`. The city row's
`login_period` gate exists in `packages/engine/src/economy.ts`; API genesis
sets `login_period=1`, which makes that gate effectively always online for the
demo genesis city.

### Client behavior

`apps/client/src/hud/screens/offline_return.tsx` exists, but:

- it is not automatically opened on login;
- it does not receive a caught-up tick count;
- it contains only a navigation button;
- there is no client-side offline simulation;
- no command can purchase extra offline time.

### Offline unknowns

- **OPEN QUESTION:** how the production host will persist `last_login` per
  wallet/city;
- **OPEN QUESTION:** how multi-city catch-up will be scheduled and recorded;
- **UNKNOWN:** whether the client will use WebSocket, polling fallback, or both
  for an offline-return notification.

---

## 15. Industries

### Industry distinction

Do not conflate these terms:

- **Stock Token/security:** external token such as NVDA or COIN.
- **Industry/district:** game role unlocked by staking a token.
- **District:** one of the six named mechanical areas.
- **Building/beacon:** physical/function asset associated with a district.
- **Resource:** consumable such as Energy or Compute.
- **Player profit:** not the same as stock price or district efficiency.

Sources: `DESIGN.md` §4, `content/params/districts.json`.

### Districts

#### Compute / NVDA

- ticker: `NVDA`;
- role: `AI / Compute`;
- beacon: `ai_research_center`;
- provides: `compute`;
- type: consumable resource;
- source: `content/params/districts.json`.

Intended effects: unlock Compute, AI research and data-center-related
functions.

#### Energy / TSLA

- ticker: `TSLA`;
- role: `Energy`;
- beacon: `energy_plant`;
- provides: `energy`;
- type: consumable resource.

Intended effects: scalable/cheaper Energy.

#### Logistics / AMZN

- ticker: `AMZN`;
- role: `Logistics`;
- beacon: `logistics_hub`;
- provides: `idle_reduction_bps`;
- type: modifier, not warehouse inventory.

Intended effect: reduce chain/input idle.

#### Consumer / AAPL

- ticker: `AAPL`;
- role: `Consumer`;
- beacon: `flagship_store`;
- provides: `population_conversion_bps`;
- type: modifier.

Intended effect: population/housing/retail Capital conversion.

#### Automation / MSFT

- ticker: `MSFT`;
- role: `Automation`;
- beacon: `cloud_campus`;
- provides: `offline_cap_hours`;
- type: modifier.

Intended effects: more agent slots and longer offline cap.

#### Finance / COIN

- ticker: `COIN`;
- role: `Finance`;
- beacon: `finance_tower`;
- provides: `fund_share_bps`;
- type: modifier.

Intended effects: stronger Bank, withdrawal limits and payroll share.

### Efficiency

The intended district-weather formula is:

```
E = clamp(
      1 + k × (EMA_24h / EMA_30d - 1),
      0.85,
      1.15
    )
k = 2.5
```

Implementation uses integer bps:

```
ratio_bps = ema24 × 10000 / max(1, ema30)
boost_bps = 25000 × (ratio_bps - 10000) / 10000
efficiency = clamp(10000 + boost_bps, 8500, 11500)
```

Source: `packages/engine/src/economy.ts`, `packages/engine/src/tick.ts`,
`content/params/economy.json`.

The TypeScript request path does not automatically multiply district
efficiency unless the city state is pre-seeded with the corresponding stack.

### Stake thresholds

`S_min` is frozen in token atoms from the 2026-08-29 price snapshot. The
threshold is intended to remain fixed after launch so a price crash does not
remove a player's district.

Sources: `content/params/districts.json`, `docs/LAUNCH.md` §9.

Frozen current values from `content/out/GENERATED.md` T2:

- AAPL: `312780788601878113` token atoms;
- AMZN: `375819756844617321`;
- COIN: `562692845388605526`;
- MSFT: `194946974422956955`;
- NVDA: `458388731521490753`;
- TSLA: `287058333841665799`.

These values are evidence of the current pack snapshot, not a live price
calculation.

### Unstake

Intended: 24 city-hour grace period, then district freezes while buildings
remain physically present.

Source: `content/params/economy.json`, `DESIGN.md` §4.5.

**IMPLEMENTATION:**

- Solidity: `StakeRegistry.unstake(string ticker, uint256 amount)` is
  `msg.sender`-owned, requires listed token and `amountOf >= amount`, then
  `transfer`s the token back. No owner approval. No on-chain grace delay
  (`contracts/src/StakeRegistry.sol`).
- Engine/content: `unstake(city, ticker, amount, cityTime, graceHours, sMin)`
  returns tokens to `tokens_held`, records `unstake_pending.ready_at`, and
  if remaining settled < `S_min` writes `district_freeze_until` and
  `DISTRICT_FREEZING` (`packages/engine/src/bank.ts`, `content/bank.py`).
- Chainport: mock and live RPC encode `unstake`
  (`packages/chainport/src/mock.ts`, `rpc/live.ts`, `rpc/abi.ts` selector
  `d37c92dc`). Live RPC sends the tx `from` the holder.
- API: **absent**. `packages/protocol/src/routes.ts` has no unstake route.
  Freeze is not applied by a live command.

### Synergies

- `robotics_lab`: compute + energy; autonomous slot; consumes Energy and
  Compute.
- `drone_depot`: compute + logistics; near-zero logistics idle.
- `data_center`: compute + automation; scalable/cheaper Compute.
- `fleet_yard`: energy + logistics; lower logistics Energy burden.
- `retail_complex`: consumer + logistics; population-to-Capital scale.
- `clearing_house`: automation + finance; fund share and withdrawal
  improvement.

Source: `content/params/districts.json`.

All six districts are `playable_v1=true`, so generated scope makes all six
synergies playable by rule. This is content scope, not proof that API commands
or 3D placement are implemented.

---

## 16. Buildings

### Building layers

#### Base buildings

1. `city_hall`
2. `workshop`
3. `agent_hub`
4. `power_node`
5. `bank`
6. `exchange`

Sources: `content/params/buildings.json`, `DESIGN.md` §7.1.

#### District beacons

1. `ai_research_center` — NVDA / Compute
2. `energy_plant` — TSLA / Energy
3. `logistics_hub` — AMZN / Logistics
4. `flagship_store` — AAPL / Consumer
5. `cloud_campus` — MSFT / Automation
6. `finance_tower` — COIN / Finance

#### Synergy buildings

1. `robotics_lab`
2. `drone_depot`
3. `data_center`
4. `fleet_yard`
5. `retail_complex`
6. `clearing_house`

### Building data fields

`content/params/buildings.json` owns, where applicable:

- tier;
- district;
- contour and secondary contour;
- schedule;
- sprite id;
- output kind;
- autonomous/prebuilt flags;
- city-level requirement;
- cost weight;
- source and rationale.

Generated balance data derives:

- level cost;
- level output;
- level energy;
- build time;
- building inputs;
- playable scope;
- footprints/render mappings.

### Operating schedules

- `always`: Workshop, Power Node, Energy Plant, Research, Logistics;
- `market`: Bank, Exchange;
- `retail`: Flagship Store, Retail Complex;
- `office`: City Hall, Agent Hub, Cloud Campus, Finance Tower,
  Clearing House.

Source: `content/params/time.json`.

### Starting state

- City Hall is prebuilt and autonomous in content.
- Workshop, Agent Hub, Power Node, Bank and Exchange are base functions.
- District beacons require the relevant industry.
- Synergies require their district pair.

### Current implementation

`spawnCity` does not instantiate the building table. It stores a synthetic
city-level `output_base` and a `building_id` only when a caller pre-seeds it.
`commit.ts::applyBuild` activates or deactivates a logical function id on
`city.functions`; it does not run construction, role acceptance, tile
mutation or anchor placement. Ordinary active count excludes autonomous/
prebuilt and frozen/deactivated functions. Capacity is `agent_slots + 3`.
City level is sticky on tick refresh (`refreshCityProgress` in
`packages/engine/src/tick.ts`).

### Generated T2 building values

The following are the current generated level values from
`content/out/GENERATED.md` (T2: level curves). Each tuple is:
`cost / output_per_tick / Energy / Compute / build_time_ticks`.
City Hall is prebuilt and has no cost/output/time curve.

- `agent_hub`: L1 `11405959/0/0/0/1`; L2
  `28514897/0/0/0/1`; L3 `71287243/0/0/0/2`.
- `ai_research_center`: L1 `57029795/0/250/0/3`; L2
  `142574487/0/400/0/4`; L3 `356436218/0/640/0/7`.
- `bank`: L1 `34217877/0/0/0/2`; L2
  `85544692/0/0/0/3`; L3 `213861731/0/0/0/4`.
- `city_hall`: prebuilt; level follows city level.
- `clearing_house`: L1 `91247672/0/0/0/4`; L2
  `228119180/0/0/0/7`; L3 `570297950/0/0/0/11`.
- `cloud_campus`: L1 `57029795/0/0/0/3`; L2
  `142574487/0/0/0/4`; L3 `356436218/0/0/0/7`.
- `data_center`: L1 `91247672/0/400/0/4`; L2
  `228119180/0/640/0/7`; L3 `570297950/0/1024/0/11`.
- `drone_depot`: L1 `91247672/0/0/0/4`; L2
  `228119180/0/0/0/7`; L3 `570297950/0/0/0/11`.
- `energy_plant`: L1 `57029795/0/1818/0/3`; L2
  `142574487/0/2908/0/4`; L3 `356436218/0/4654/0/7`.
- `exchange`: L1 `27374301/0/0/0/2`; L2
  `68435754/0/0/0/2`; L3 `171089385/0/0/0/4`.
- `finance_tower`: L1 `57029795/0/0/0/3`; L2
  `142574487/0/0/0/4`; L3 `356436218/0/0/0/7`.
- `flagship_store`: L1 `57029795/0/0/0/3`; L2
  `142574487/0/0/0/4`; L3 `356436218/0/0/0/7`.
- `fleet_yard`: L1 `91247672/0/0/0/4`; L2
  `228119180/0/0/0/7`; L3 `570297950/0/0/0/11`.
- `logistics_hub`: L1 `57029795/0/0/0/3`; L2
  `142574487/0/0/0/4`; L3 `356436218/0/0/0/7`.
- `power_node`: L1 `7527932/0/120/0/1`; L2
  `18819832/0/192/0/1`; L3 `47049580/0/307/0/1`.
- `retail_complex`: L1 `91247672/0/0/0/4`; L2
  `228119180/0/0/0/7`; L3 `570297950/0/0/0/11`.
- `robotics_lab`: L1 `91247672/228119/400/400/4`; L2
  `228119180/410614/640/640/7`; L3 `570297950/739105/1024/1024/11`.
- `workshop`: L1 `22811918/95049/100/0/1`; L2
  `57029795/171088/160/0/2`; L3 `142574487/307958/256/0/3`.

**CANONICAL FACT:** These are generated pack values, not a second authored
table. If source parameters change, regenerate and update the pack.

### Derived building inputs

From the same generated artifact:

- `workshop`: Energy;
- `ai_research_center`: Energy;
- `robotics_lab`: Energy + Compute;
- `data_center`: Energy;
- all other listed archetypes: no positive derived input in the generated
  T2 table.

This generated input table and the prose in `DESIGN.md` should be treated as
separate evidence; do not infer a missing input solely from the building's
fictional role.

### Building-by-building operational matrix

The following matrix combines the authored fields in
`content/params/buildings.json` with the generated affinity interpretation.
“Offline” means the schedule can be evaluated by the engine catch-up path; it
does not mean the current API persists a full building instance.

- `city_hall`: base; office; primary `work_admin`; autonomous/prebuilt; output
  none; level follows city; civic/admin anchor; accepts no agent requirement.
- `workshop`: base; always; primary `work_production`, secondary
  `work_logistics`; Engineer home and Logistician neighbour; Capital output;
  Energy input; non-autonomous; active from start.
- `agent_hub`: base; office; secondary `work_research`; autonomous/prebuilt;
  agent-capacity function; no production output; required hire infrastructure.
- `power_node`: base; always; primary `work_production`, secondary
  `work_logistics`; Engineer home; Energy output; non-autonomous.
- `bank`: base; market; primary `work_finance`, secondary `work_admin`;
  Trader home, Manager neighbour; spread/withdrawal function; non-autonomous.
- `exchange`: base; market; primary `work_finance`; Trader home; hop-quality
  function; city-level requirement 2; non-autonomous.
- `ai_research_center`: Compute beacon; always; primary `work_research`,
  secondary `work_production`; Scientist home, Engineer neighbour; Compute
  output; Energy input; requires Compute district.
- `energy_plant`: Energy beacon; always; primary `work_production`, secondary
  `work_logistics`; Engineer home; Energy output; requires Energy district.
- `logistics_hub`: Logistics beacon; always; primary `work_logistics`,
  secondary `work_production`; Logistician home, Engineer neighbour; idle
  reduction; requires Logistics district.
- `flagship_store`: Consumer beacon; retail; primary `work_retail`, secondary
  `work_logistics`; Trader home, Logistician neighbour; Population→Capital;
  requires Consumer district.
- `cloud_campus`: Automation beacon; office; primary `work_admin`, secondary
  `work_research`; Manager home, Scientist neighbour; slots/offline modifier;
  requires Automation district.
- `finance_tower`: Finance beacon; office; primary `work_finance`, secondary
  `work_admin`; Trader home, Manager neighbour; Bank-level function; requires
  Finance district.
- `robotics_lab`: Compute+Energy synergy; always; secondary
  `work_production`; autonomous; Capital output; Energy+Compute input; no
  home role; requires both districts.
- `drone_depot`: Compute+Logistics synergy; always; primary
  `work_logistics`; Logistician home; idle reduction; requires both districts.
- `data_center`: Compute+Automation synergy; always; primary
  `work_research`, secondary `work_production`; Scientist home, Engineer
  neighbour; Compute output and Energy input.
- `fleet_yard`: Energy+Logistics synergy; always; primary `work_logistics`,
  secondary `work_production`; Logistician home, Engineer neighbour; idle
  reduction; Energy burden modifier.
- `retail_complex`: Consumer+Logistics synergy; retail; primary `work_retail`,
  secondary `work_logistics`; Trader home, Logistician neighbour;
  Population→Capital.
- `clearing_house`: Automation+Finance synergy; office; primary `work_admin`,
  secondary `work_finance`; Manager home, Trader neighbour; fund-share/Bank
  function.

Sources: `content/params/buildings.json`,
`content/params/agents.json`, `content/build.py`,
`content/out/GENERATED.md` T2.

### Per-building fields that are not independently authored

- **Activation time:** generated `build_time_ticks` above; the current API
  does not create an under-construction timer.
- **Upgrades:** levels 1–3 are the generated T2 curves; the API `upgrade`
  command is absent.
- **Tasks:** tasks belong to role/objective and building contour; no separate
  per-building task list is stored.
- **Agent seats:** intended from contour affinity and slot limits; no runtime
  seat table exists.
- **Dependencies:** beacon → district; synergy → its two districts;
  `exchange` → city level 2; base infrastructure is content-defined.
- **Offline:** schedule/open-hours and catch-up rules are shared; there is no
  building-specific offline executor in the API.
- **Failure/log messages:** use shared idle/refusal codes such as
  `IDLE_WRONG_ROLE`, `IDLE_OUT_OF_HOURS`, `IDLE_NO_ENERGY`,
  `IDLE_DISTRICT_FROZEN`, `BUILD_TILE_ILLEGAL`; no unique per-building log
  table exists.
- **UI:** generic `building_card`, `build` and `building_detail` surfaces;
  no unique per-building React screen.
- **Visual reference path:** concept files are listed in §31; runtime mapping
  is `content/params/render.json`; absent mapping is explicitly noted for
  `retail_complex`.

**UNKNOWN:** a final production schema for per-building instance state,
construction progress, seat occupancy, level visual overlays and per-building
failure copy does not exist in the repository.

### Visual mapping

The live 3D pack mapping is in:

- `content/params/render.json` → `island_plants`;
- `apps/client/src/packview.ts`;
- `packages/render/src/islandOccupancy.ts`.

`amazon_warehouse` is a studio slug with an empty `pack_id`; it is not the
`retail_complex` pack id.

---

## 17. Agents

### Canonical roles

The current content canon has **five**, not six:

1. Engineer
2. Logistician
3. Trader
4. Scientist
5. Manager

Source: `content/params/agents.json`.

**CONFLICT / OPEN QUESTION:** legacy visual/banner material and the
user-requested terminology include `Operator`, but no `operator` role exists in
current pack, generated affinity, engine, API or `visual/units` source files.

### Intended agent model

```
Agent = { role, level, traits[], slot, objective }
```

Source: `DESIGN.md` §5.3.

### Engineer

- home contour: `work_production`;
- produces output;
- objectives: `produce`, `overclock`.

### Logistician

- home contour: `work_logistics`;
- reduces idle;
- objectives: `route`, `stockpile`.

### Trader

- home contours: `work_finance`, `work_retail`;
- objectives: `desk`, `quote`;
- intended effects: Bank spread, Exchange quote, retail Capital.

### Scientist

- home contour: `work_research`;
- objectives: `train`, `research`;
- consumes Compute.

### Manager

- home contour: `work_admin`;
- objective: `focus`;
- chooses a city contour focus.

### Primary building contours

The generated affinity matrix in `content/fixtures/design_5_8.json` and
`content/build.py` maps the five roles as follows:

- Engineer home: Workshop, Power Node, Energy Plant; neighbour:
  AI Research Center, Data Center, Logistics Hub, Fleet Yard.
- Logistician home: Logistics Hub, Drone Depot, Fleet Yard; neighbour:
  Workshop, Power Node, Energy Plant, Flagship Store, Retail Complex.
- Trader home: Bank, Exchange, Finance Tower, Flagship Store, Retail Complex;
  the role has two home contours (`work_finance`, `work_retail`).
- Scientist home: AI Research Center, Data Center; neighbour: Agent Hub,
  Cloud Campus and other `work_research`/secondary research surfaces.
- Manager home: City Hall, Cloud Campus, Clearing House; neighbour: Bank,
  Finance Tower and other `work_admin`/secondary admin surfaces.

These are contour-derived accepted affinities, not a runtime seat assignment.

### Actual engine/API

Engine records use `agent_id="shift"`. API `hire` always creates
`{role:"engineer"}`. No runtime role matrix, trait assignment, seat assignment
or role-specific building execution is present.

### Agent slots

- start: 8;
- +2 per city level;
- cap: 20;
- city level at cap: 7.

Source: `content/params/agents.json`.

Ordinary active logical functions are limited by `agent_slots + 3`.
Autonomous/prebuilt functions are excluded from that count. Frozen or
deactivated functions do not count. There is no automatic City Level
downgrade (`stickyCityLevel`).

### XP

**CANONICAL FACT / IMPLEMENTATION:**

- +1 XP per valid paid tick (`XP_BASE = 1`);
- successful Train gives +1 XP to an eligible same-city target
  (`TRAIN_XP = 1`); self-train is refused;
- normal XP and Train XP add;
- bps remainder persists (`xp_remainder`);
- trainer modifiers affect Compute cost only
  (`trainComputeCost` / `compute_cost_mags`);
- target and city modifiers affect XP remainder
  (`xp_rate_mags`);
- max level 5 (`balance.params.agent_level_max`).

Sources: `content/xp.py`, `packages/engine/src/xp.ts`,
`packages/engine/src/tick.ts::awardXp`,
`packages/engine/test/economy_rules.test.ts`.

API hire does not award XP. Tick XP runs only when the city has an `agents`
list.

### Numeric role/task/trait data

The pack stores role contour/behavior declarations in
`content/params/agents.json`; the generated modifier magnitudes are in
`content/out/GENERATED.md`, T5: modifier rows.

Current modifier rows:

- `overclock`: `output_bps +1000`, `energy_cost_bps +4500`;
- `route`: `idle_reduction_bps +1000`;
- `stockpile`: `idle_reduction_bps +2000`,
  `output_bps -500`;
- `train`: `xp_rate_bps +1000`, `compute_cost_bps +4500`;
- `research`: `compute_cost_bps +4500`;
- `frugal`: `output_bps -500`, Energy/Compute cost `-2000`;
- `night_owl`: Energy cost `-1000` at night;
- `specialist`: output `+1500` at home and `-1500` away;
- `steady`: jitter relief row `5000`.

`produce`, `desk`, `quote` and `focus` have empty modifier-key lists.

### Role/building affinity

Affinity is generated from role home contours and building primary/secondary
contours, then checked cell-by-cell against
`content/fixtures/design_5_8.json`. Intended multipliers from
`content/params/economy.json`:

- home: `10000` bps;
- neighbour: `6000` bps;
- accepted foreign role: `2500` bps;
- role not accepted: `IDLE_WRONG_ROLE`.

No current engine city executes this matrix.

---

## 18. Traits

### Night Owl

Reduces the night Energy penalty; key `energy_cost_bps`.

### Frugal

Reduces Energy/Compute cost and slightly reduces output; keys
`energy_cost_bps`, `compute_cost_bps`, `output_bps`.

### Specialist

Home building output gain and away penalty; key `output_bps`.

### Steady

Narrows jitter; key `jitter_bps`, intended range `[9750,10250]`.

Source: `content/params/agents.json`, `content/params/modifiers.json`,
`DESIGN.md` §5.10.

Traits are content-generated but no API hire path assigns them.

### Trait stacking details

- `Night Owl` affects only the night Energy cost row; the effective premium
  after composition is generated as `800` bps, not a simple subtraction from
  the raw 1000-bps row.
- `Frugal` uses floor-quantized input relief so it is not a free output
  multiplier.
- `Specialist` is a home/away affinity-conditioned output row.
- `Steady` changes jitter width from `[9500,10500]` to `[9750,10250]`.

The modifier stack has 13 keys and 8 stages:
`base → affinity → agent_level → district_efficiency → productivity →
objective → jitter → post`.

Source: `content/params/modifier_keys.json`,
`content/out/GENERATED.md` T5.

---

## 19. Tasks

- `produce`: default Engineer output, no modifier keys.
- `overclock`: output increase plus Energy cost.
- `route`: Logistician idle reduction.
- `stockpile`: more idle reduction, lower output.
- `desk`: Trader Bank/retail default.
- `quote`: Trader Exchange improvement.
- `train`: Scientist XP increase, Compute cost.
- `research`: Scientist research progress, Compute cost.
- `focus`: Manager contour focus.

Source: `content/params/agents.json`, `content/params/modifiers.json`.

The TypeScript runtime does not execute the full task matrix.

### Task costs and exact effects

- `produce`: no authored modifier row.
- `overclock`: +1000 output bps and +4500 Energy cost bps.
- `route`: +1000 idle reduction bps.
- `stockpile`: +2000 idle reduction bps and -500 output bps.
- `desk`: no authored modifier row.
- `quote`: no authored modifier row; intended Exchange-only behavior is
  documented, not engine-wired.
- `train`: +1000 XP rate bps and +4500 Compute cost bps.
- `research`: +4500 Compute cost bps.
- `focus`: no authored modifier row; contour selection is intended state.

Source: `content/out/GENERATED.md` T5: modifier rows.

---

## 20. Player Actions

### Declared routes

The content registry declares:

`build`, `buy_stock`, `claim_fragment`, `claim_prize`, `deposit`, `hire`,
`merge`, `noop`, `open_district`, `pick_node`, `set_objective`, `stake`,
`unlock_tier`, `upgrade`, `withdraw`.

Sources: `content/params/screens.json`,
`packages/protocol/src/routes.ts`.

### API-live routes

`services/api/src/commit.ts::applyLive` handles:

- `hire`;
- `build`;
- `claim_prize`;
- `set_objective`.

There is no `unstake` route in `packages/protocol/src/routes.ts`.

### Intended but currently refused/stubbed

- deposit;
- withdraw;
- stake / unstake;
- open district;
- buy stock;
- upgrade;
- research;
- claim fragment;
- tier unlock;
- node pick;
- merge.

These routes are not necessarily marked `v1: stub` in the pack, which is a
content/API status conflict.

### Action matrix from `content/params/screens.json`

- `agents_hire`: requires agent slot + Capital; spends Capital; API partially
  live and always creates Engineer.
- `build_place`: pack/screens still require city level + legal build tile +
  build slot + Capital and mention `BUILD_TILE_ILLEGAL`; API live path is
  logical function activate/deactivate and ignores `tile_x`/`tile_y`.
- `districts_open`: requires wallet + stake threshold + `$CORP`; spends
  `$CORP`; API absent.
- `exchange_buy`: requires wallet + `$CORP` + priced hop; spends `$CORP`; API
  absent.
- `bank_deposit`: requires wallet + `$CORP`; spends `$CORP`; API absent.
- `bank_withdraw`: requires non-demo + wallet + Capital + bank open + weekday +
  bank limit; spends Capital; API absent.
- `leaderboard_claim`: requires non-demo prize + wallet; no Capital spend;
  API returns local claim arithmetic but does not perform custody.
- `district_claim_fragment`: requires non-demo claim + wallet; API absent.
- `district_unlock_tier`: requires tier gate; API absent.
- `district_stake_more`: requires stake multiple; API absent.
- `district_pick_node`: requires exclusive node-side gate; API absent.
- `district_merge`: requires free merge matching; API absent.
- `building_upgrade`: requires Capital; API absent.
- `agent_set_objective`: requires building-hours warning; API
  `set_objective` now writes `city.objective` and optional `train_target`
  without the warning gate.
- generated research unlock actions: require city level + Capital and use
  `commit: research_start`, synthesized by
  `content/screens.py::synthesize_research_actions` from
  `content/params/research.json`; this is a generated screen action, not one
  of the 15 authored `commandRoutes` in `packages/protocol/src/routes.ts`, and
  no `research_start` API handler was found. `content/params/screens.json`
  explicitly authors the research screen/navigation but not the generated
  unlock ids.
- `missions_start`: `commit:noop`, spend none, `FEATURE_NOT_IN_V1`.
- wallet connect/confirm: external browser-wallet actions; current
  `WalletConnectScreen` does not execute them.

Source: `content/params/screens.json`, generated
`content/out/GENERATED.md`, `services/api/src/commit.ts`,
`apps/client/src/hud/screens/*.tsx`.

---

## 21. Bank

### Intended function

The Bank is the only Capital → `$CORP` exit. It operates on personal city
time; Bank hours are not encoded on-chain.

### Schedule

- open `08:00`;
- close `20:00`;
- Sunday city-time closed.

### Limits

- global live-depth cap: 1% of pool quote depth
  (`bank_daily_limit_pool_share_bps = 100`);
- personal Bank-level share from the generated ladder;
- reservations immediately consume remaining capacity;
- authorization stores `depth_snapshot` for that day;
- prior-day open reservations remain excluded from today's remaining;
- expiry releases into the **current** day and does not rewrite a closed day.

**IMPLEMENTATION:** `packages/engine/src/bank.ts` and `content/bank.py`
implement `resetDayCounters`, `remainingGlobal`, `authorize`, `present`,
`expire`. `packages/engine/src/economy.ts::bankWithdraw` uses
`bankShareBps(cfg.bank_levels, city.bank_level)` and falls back to
`bank_l1_share_bps` only if the ladder row is zero. The same tick function
still fills `withdraw_intent` immediately when open. That immediate-fill
path is **PARTIAL** relative to the voucher reservation design.

Witness: `packages/engine/test/economy_rules.test.ts`
`"bank reservations exclude prior days and expire into the current day"`.

### Generated Bank ladder

The current generated content derives Bank-level shares:

- L0: `0` bps, `0` wei at the seed;
- L1: `2500` bps, `10500000000000000` wei at the seed;
- L2: `4375` bps, `18375000000000000` wei at the seed;
- L3: `5782` bps, `24284400000000000` wei at the seed;
- L4: `6836` bps, `28711200000000000` wei at the seed.

Source: `content/out/GENERATED.md` T2: Bank ladder,
`content/params/balance.json`.

### Formula

```
global_eth_limit = live_pool_eth × 100 / 10000
corp_ask =
  Capital × wei × 10000
  / (mint_rate × (10000 + bank_markup))
```

Source: `packages/engine/src/economy.ts`.

### Voucher route

Server checks hours/limits and registers/authorizes a voucher. Vault
`issueVoucher` reserves `reservedOf`; `presentVoucher` consumes reservation
and backing; `releaseExpiredVoucher` releases reservation without paying.
The current contract does not verify signature bytes.

Sources: `DESIGN.md` §10.1, `contracts/src/Vault.sol`,
`content/bank.py`.

### Current status

Engine reservation arithmetic and the Bank ladder exist. API withdraw does
not. The tick `withdraw_intent` path can still fill immediately. Client
displays pack-derived values, not a live depth response. Closed days are not
rewritten on expiry.

---

## 22. Exchange

The Exchange is intended to buy real Stock Tokens for `$CORP`, with route:

```
$CORP → ETH → USDG → Stock Token
```

The pack computes a Capital haircut interval from Vault fee, creator tax and
hop haircut. The client displays the interval. The API and AssetPort do not
implement a live stock swap.

Sources: `content/screens.py`, `content/params/fragments.json`,
`apps/client/src/hud/screens/exchange.tsx`,
`packages/chainport/src/port.ts`.

---

## 23. Market

### Stock Token price

Prices are intended as recorded external inputs. Price is not player profit;
it drives district efficiency.

### Sampler

`services/sampler/src/step.ts`:

- stores sample rows;
- computes integer TWAP;
- retains the last value on silence;
- sets `feed_live=0`;
- tracks sample age.

The running process currently only exposes readiness; provider polling and
database persistence are not complete.

### Market/Bank mismatch

City Sunday and external market weekends are intentionally separate concepts.
This is a canon design choice, not a bug.

---

## 24. Progression

### District tree

Generated from six axes × six districts × three tiers × two exclusive sides:
36 nodes, plus 9 merge pairs.

Axes:

- scale;
- thrift;
- depth;
- breadth;
- capital;
- paper.

Tier city gates are derived as 1/3/5; stake gates are 1x/2x/3x `S_min`.

### Merge

Merge is the complement of the six synergy pairs. Active merges must form a
matching; maximum active merge count is 3. `respec_allowed=0`.

**CANONICAL FACT:** Merge effect is the **full** Tier-1 dividend of each
side (`own_key` magnitude `unit * sign`; countable unit 1, bps unit 500).
Source: `docs/PROGRESSION.md` §6, `content/build.py` merge generation,
modifier rows with `magnitude_from: "merge tier-1 dividend"`.

Automation merge may add +1 `offline_cap_hours`, clipped by the hard 18-hour
cap.

**CONFLICT:** `DESIGN.md` §4.8 still says “по половине тир-1 дивиденда”.
That sentence is stale relative to current content. See C-20.

### Research

The five research axes are generated from `content/params/research.json`:
Grid, Tools, Handbook, Circuits, Lathe.

Current generated values from `content/out/GENERATED.md` T2: research:

- `circuits`: `compute_cost_bps -1000`, `6843575` Capital, `24` ticks;
- `grid`: `energy_cost_bps -1500`, `10265363` Capital, `36` ticks;
- `handbook`: `xp_rate_bps +1000`, `6843575` Capital, `24` ticks;
- `lathe`: `upgrade_speed_bps +1000`, `6843575` Capital, `24` ticks;
- `tools`: `output_bps +1000`, `6843575` Capital, `24` ticks.

### Analysis

`content/builds.py` evaluates legal build families against day/mid/season
scenarios and goals. Current generated summary reports no dominating, dead or
mandatory nodes, but this is analysis of the content model, not proof of
runtime execution.

### Generated progression costs

Current T4 generated costs:

- tier 1: `0` Capital;
- tier 2: `34217877` Capital;
- tier 3: `128317038` Capital;
- merge: `42772346` Capital.

Tier gates are city levels 1/3/5 and stake multiples 1x/2x/3x `S_min`.
These values are generated from `content/params/progression.json`,
`content/params/balance.json` and `content/build.py`.

---

## 25. Seasons

### Calendar

- season: 90 city days;
- 3 periods;
- period: 30 city days;
- qualification: 6 positive days, where a positive day means `GDP_day > 0`;
- live stake is checked at settlement (`prize_require_live_stake=1`);
- eligible N is the actual qualifying set after demo/qualify/stake filters;
- Zipf ranks use that actual N, capped by `prize_top_n=10`
  (`zipfPayout(pool, nPay)` with `nPay = min(nEligible, topN)`);
- dust remains (floor leftover is not redistributed);
- settlement: hour 6;

### Influence

Daily product of GDP/capex, Stability, efficiency and coverage. Score is not
spendable.

### Prize basket

Assets are NVDA, TSLA, AMZN, AAPL, MSFT, COIN. `$CORP` and Capital are not
prize assets.

### Current status

Pure settlement works, including city cap, ledger clear, owed claim, Zipf on
actual N, and dust remainder
(`packages/engine/src/fragments.ts`, `packages/engine/src/seasons.ts`).
API claim reports local rows but does not complete custody/pool mutation;
`claimEveryAsset` is called with `paused: false`. Live deployed prize
addresses are missing. DEX fragment buy/hop is outside the tick and not in
`AssetPort`.

---

## 28. UI/UX

### Layout

HUD fixture:

- 16:9;
- 260 px side columns;
- 56 px topbar;
- 40 px stock strip;
- 48 px bottom menu.

Source: `content/fixtures/hud_layout.json`.

### Actual shell

`apps/client/src/hud/App.tsx` uses absolute-positioned panels, not the full
CSS Grid contract described by some visual documents.

### Main UI data gaps

- no XP/level in the client snapshot (engine XP exists);
- no Productivity row;
- population fixed at zero;
- stocks empty;
- agents empty;
- events empty;
- research placeholder;
- offline screen unused;
- live error bodies ignored;
- no WebSocket updates;
- BUILD still posts `tile_x`/`tile_y` that the API ignores.

### UI errors

Codes are pack/localization driven, but actual current feedback is incomplete:
boot errors are mostly empty code-only elements and command errors are silent.

---

## 29. Visual Direction

Current target is a stylized low-poly cyber-corporate diorama:

- faceted rock island;
- navy/steel buildings;
- brand-coded emissive accents;
- separate hardscape terraces;
- chunky volumetric clouds;
- bright blue day;
- controlled dusk/night emissive;
- no surrounding ocean;
- no live units.

The current root `visual/` directory mixes blue/transparent UI and character
renders with pink/red building studio renders and blue/dark mockups. All are
concept/reference assets; the client does not load root `visual/` directly.

### Visual asset classification

- `visual/mockups/*.png`, `visual/mockups/*.jpg`: reference/mockup material;
  not runtime assets.
- `visual/buildings/*`: concept renders for the 18 building concepts; no
  machine-readable approved/master flag was found.
- `visual/units/*`: role/player character reference set; full-body,
  portrait/anfas and icon variants.
- `visual/out/Agent Hub.png`: processed transparent building cutout; status
  is not explicitly canonical.
- `art/island_v3/reviews/LOOK-00/refs/*`: owner-locked visual references for
  island structure/brands and density/light; current docs mark sea/people as
  out-of-scope and waterfalls as an amendment.
- `models/*.glb`: source building models named by `ISLAND_STUDIO.md`; these
  are source assets for the live island pipeline, but final runtime acceptance
  is still gated by LOOK review.
- `art/island_v3/runtime/*.glb`: assets actually loaded by the current
  Three.js client path.
- `art/pipeline/assets.json` plus `assets/**`: canonical legacy V12 sprite
  registry/source for the pack/cell renderer, not the live Three island.
- `decoration/*`: candidate local decoration library; files do not enter the
  scene automatically.

**IMPLEMENTATION:** LOOK-02 (`art/island_v3/reviews/LOOK-02/gate_look02.py`)
passes on the current runtime GLBs. Building roots are identity TRS; City Hall
local origin is baked (`art/island_v3/bake_building_origin.py`): translation
`(0,0,0)`, rotation `(0,0,0,1)`, scale `1`, floor Y `0`, height `1800` m,
`216164` bytes / `8000` tris. Live measured budgets vs
`content/params/render.json`:

| metric | measured | cap |
|---|---|---|
| `island_mass.glb` | `389308` | `island_mass_bytes_max` `1572864` |
| worst building (`city_hall.glb`) | `216164` | `island_building_bytes_max` `358400` |
| first load (mass + 18 buildings) | `2916776` | `island_first_load_bytes_max` `12582912` |
| authored tris (mass + 18 buildings) | `248494` | `island_tris_max` `250000` |

**IMPLEMENTATION / CONFLICT:** LOOK-03 runtime captures are accepted for the
shared renderer/pose, but the current visual plan still reports bright-day
sign lighting/composition as unfinished. LOOK-11 owner acceptance is still
absent. The render pack has a per-building GLB ceiling in
`content/params/render.json`; review reports note that some all-18/runtime
review exports exceed that ceiling. Do not treat the presence of GLBs as
final visual acceptance.

---

## 30. Canonical Characters

### Current content characters

The only current role assets with full/anfas/icon variants are:

- Engineer;
- Logistician;
- Scientist;
- Trader;
- Manager.

Exact current paths:

- `visual/units/Engineer.png`,
  `visual/units/Engineer_anfas.png`, `visual/units/Engineer_icon.png`;
- `visual/units/Logistician.png`,
  `visual/units/Logistician_anfas.png`, `visual/units/Logistician_icon.png`;
- `visual/units/scientist.png`,
  `visual/units/scientist_anfas.png`, `visual/units/scientist_icon.png`;
- `visual/units/trader.png`,
  `visual/units/trader_anfas.png`, `visual/units/trader_icon.png`;
- `visual/units/manager.png`,
  `visual/units/manager_anfas.png`, `visual/units/manager_icon.png`.

These are canonical visual references only in the sense that they are the
available role-art set; no approved/master manifest was found.

### Corporator

`visual/units/corporator.png` and `corporator_icon.png` are player/brand
references, not a declared agent role.

### Operator

No current asset or content role. See C-03 and §45.

---

## 31. Canonical Buildings

### Content canon

The 18 building ids are generated in `packages/protocol/src/buildings.ts` and
defined by `content/params/buildings.json`.

### Concept reference files

The concept images are under `visual/buildings/`. They are useful for brand
language, silhouette and role recognition, but the live browser loads runtime
GLBs under `art/island_v3/runtime`.

The 18 direct concept files are:

- `visual/buildings/City Hall.jpg`;
- `visual/buildings/Workshop.png`;
- `visual/buildings/Agent Hub.png`;
- `visual/buildings/Power Node.jpg`;
- `visual/buildings/Bank.png`;
- `visual/buildings/Exchange.png`;
- `visual/buildings/AI Research Center.png`;
- `visual/buildings/Energy Plant.jpg`;
- `visual/buildings/Logistics Hub.jpg`;
- `visual/buildings/Flagship Store.jpg`;
- `visual/buildings/Cloud Campus.jpg`;
- `visual/buildings/Finance Tower.jpg`;
- `visual/buildings/Robotics Lab.png`;
- `visual/buildings/Drone Depot.jpg`;
- `visual/buildings/Data Center.png`;
- `visual/buildings/Fleet Yard.jpg`;
- `visual/buildings/Retail Complex.jpg`;
- `visual/buildings/Clearing House.png`.

`visual/buildings/clearing_house_refs/*` is a separate reference subfolder
with hero/isometric/style/court/temple/hub/pit/seam alternatives. Its
approved variant is **UNKNOWN**.

### Runtime canon

The active runtime source is the authored island/runtime pipeline:

- `art/island_v3/runtime/island_mass.glb`;
- `art/island_v3/runtime/buildings/*.glb`;
- `content/params/render.json`;
- `packages/render/src/three.ts`.

The fat `art/island_v3/island.glb` is explicitly rejected as runtime in
current island documentation.

### `render.json` studio-to-pack mapping

Current non-empty mappings include:

- `city_hall → city_hall`;
- `tesla → energy_plant`;
- `apple → flagship_store`;
- `coinbase → finance_tower`;
- `microsoft → cloud_campus`;
- `bank → bank`;
- `amazon → logistics_hub`;
- `fleet_yard → fleet_yard`;
- `nvidia_depot → drone_depot`;
- `workshop → workshop`;
- `power_node → power_node`;
- `agent_hub → agent_hub`;
- `clearinghouse → clearing_house`;
- `data_center → data_center`;
- `exchange → exchange`;
- `nvidia_tower → ai_research_center`;
- `robotic_lab → robotics_lab`.

`amazon_warehouse` has an empty `pack_id`, and no current
`retail_complex` pack mapping is present in `content/params/render.json`.
Therefore the 18 conceptual building ids do not equal 18 currently wired
studio/runtime plants.

---

## 32. Island

### Physical canon

One authored island, immutable base mass, separate hardscape, anchor-based
building placement, no procedural per-player map.

### Review status

LOOK-02 post-export identity/pose gate **passes** on
`art/island_v3/runtime/*.glb` (report
`art/island_v3/reviews/LOOK-02/tree_report.json`,
`recorded_at_utc` `2026-09-11T23:38:37.890786+00:00`). LOOK-03 is
owner-accepted for shared runtime/hero pose. LOOK-04 has candidate blockouts
but no current owner GO was found. LOOK-11 acceptance is absent.

### `island.blend` mismatch

**CONFLICT:** live working `art/island_v3/island.blend` is not the frozen
LOOK-02 snapshot.

| file | sha256 | bytes |
|---|---|---|
| live `art/island_v3/island.blend` | `4403e073028c4631e49bed22e174b96d80c921d6e97cdf1ef0012716351f3340` | `322358322` |
| snapshot `art/island_v3/snapshots/canon_2026-09-06_island/island.blend` | `9ef06d651001f6832d1bf40ca12def903ba9a9ceef18ded85d224daf9f296f9c` | `210675347` |

LOOK-02 pins the snapshot hash (`SNAP_BLEND_SHA` in `gate_look02.py`) and
does not re-export from the live blend. **CANONICAL FACT for runtime:**
passing source is `runtime/island_mass.glb` plus
`runtime/buildings/*.glb`. Do not re-export `island.blend` to “fix” the
mismatch unless a new owner export decision is recorded.

### Current live technical behavior

- Three.js loads the mass and building GLBs;
- building mesh raycast works;
- land-plane tile pick does not;
- camera tile target setter is a no-op;
- occupancy is static pack/studio data;
- 3D scene does not react to player build commands.

---

## 33. Logo / Brand

Brand evidence:

- `CORPORATOR`;
- `$CORP`;
- `REAL COMPANIES. REAL CITIES.`;
- `OWN. OPERATE. GROW.`.

The logo/marketing renders show corporate characters and a floating island, but
their sea/people/Operator elements are not all current live-island canon.

---

## 34. Marketing Media

Existing assets:

- `visual/mockups/logo.png`;
- `visual/mockups/banner.png`;
- `visual/mockups/island.png`;
- `visual/mockups/hud_mockup.png`;
- character and building renders under `visual/`.

No separate final marketing plan, target audience, launch campaign or
approved copy guide was found.

---

## 35. Technical Architecture

### Frontend

React/Vite client:

- `apps/client/src/main.tsx`;
- `apps/client/src/hud/LiveRoot.tsx`;
- `apps/client/src/hud/App.tsx`;
- `apps/client/src/hud/SceneHost.tsx`.

### Backend

Node API:

- `services/api/src/main.ts`;
- HTTP routes/session/commands;
- `services/api/src/tick_host.ts`;
- Postgres/PGlite stores.

### Database

Generated canonical-byte tables in
`services/api/migrations/001_from_pack.sql`.

### Blockchain

Chain boundary:

- `packages/chainport/src/port.ts`;
- `packages/chainport/src/mock.ts`;
- `packages/chainport/src/rpc/*.ts`.

Contracts:

- `contracts/src/CorpToken.sol`;
- `Vault.sol`;
- `StakeRegistry.sol`;
- `PrizeTreasury.sol`;
- `MerkleRoots.sol`.

Contract semantics:

- `CorpToken`: local ERC-20-like test double with immutable tax metadata and
  minter; no transfer tax implementation.
- `Vault`: measured balance-delta deposit, pending mint, backing ledger,
  `reservedOf` voucher coverage, `issueVoucher` / `presentVoucher` /
  `releaseExpiredVoucher`, refunds, Merkle refund claim, wrong-token recovery.
  No pause controls.
- `StakeRegistry`: owner-managed ticker-to-token mapping, measured
  `transferFrom` delta, holder-owned `unstake(ticker, amount)` returning the
  token, sorted ticker snapshot. No owner approval on unstake.
- `PrizeTreasury`: six prize stocks, two kettles (`farm`, `month`), depositor
  deposit, signer slicing, unsettled return, claim, signer rotation, wrong-token
  recovery. No pause controls.
- `MerkleRoots`: attestor-only `(city_id, city_day) → root` registry.

`AssetPort` exposes Vault vouchers, StakeRegistry `unstake`, and the
PrizeTreasury custody port (`deposit`, `slice`, `returnUnsettled`,
`claimPrize`). DEX quote/buy and stock-hop remain an external conveyor
boundary. Solidity behavior and chainport mock behavior are not identical: the mock `mintCapital` does not enforce the Vault's
`capitalAmount <= pending * capitalAnchor` bound; mock `unstake` does not
`transfer` an ERC-20.

**IMPLEMENTATION:** live RPC `unstake` sends `from` the holder
(`packages/chainport/src/rpc/live.ts`). Local ABI selectors are in
`packages/chainport/src/rpc/abi.ts`; they are not a production ABI dump.

### Authentication

Nonce + personal-sign flow:

- `services/api/src/session.ts`;
- `services/api/src/recover.ts`;
- `apps/client/src/session.ts`.

### State management

Engine state is mutable generic `Dict`; API host holds it in memory. Client
holds a `ClientSnapshot` React state and locally extrapolated clock.

### Persistence

Tick inputs, records, snapshots and sessions are stored, but boot-time
reconstruction of the full live city is incomplete.

### Events/logging

Pack codes, attestor badges and host log rows. Full gameplay event stream is
not wired into client.

### Jobs

API interval tick exists. Sampler/buyback/LLM/attestor process loops are not
complete production integrations.

`services/api/src/scheduler.ts::nextTickInputs` currently supplies:

- `corp_eth_wei_per_whole = cfg.seed_corp_wei`;
- `eth_usd_8dec = cfg.eth_usd_8dec`;
- `feed_live = 1`;
- `dex_turnover_usd_8dec = 0`;
- current pack hash and city id.

Therefore the normal API scheduler does not consume sampler output, live DEX
turnover or an external price feed. `tickOnce`/`tickIfWriter` selects
`firstCityId(host.state)`, so it advances only the first city in the host
state. It does not provide a `stake_snapshot`; the engine input path therefore
falls back to its zero/default stake snapshot. Price-sample time also falls
back to the locally derived current city time rather than a sampler timestamp.

### Deployment

Generated Docker/compose pipeline targets five Node services plus Postgres.
Client hosting is outside repository deployment and **UNKNOWN**.

---

## 36. Data Model

### Content entities

- Player/account;
- City;
- Building;
- Agent;
- Trait;
- Objective/task;
- District/Industry;
- Stake;
- Resource;
- Vault;
- Payroll;
- Treasury;
- Fragment ledger;
- Season;
- Influence row;
- Prize pool/payout;
- DecisionRecord;
- TickInputHeader;
- Log event.

### Runtime representation

**IMPLEMENTATION:** No TypeScript domain interfaces exist for these entities.
The engine uses generic `Dict`. Content JSON is the strongest typed-ish
definition; DB stores canonical bytes.

### Relationships intended

- account owns city;
- city has buildings/agents;
- agent occupies building slot;
- agent has role/objective/traits;
- district maps to ticker and beacon;
- stake unlocks district;
- valid beacon production accrues fragments;
- city daily metrics feed Influence;
- season settlement maps wallet to prize rows.

### Relationships implemented

- session maps to city;
- city dictionaries can contain ad-hoc fields including `functions[]`,
  `agents[]`, `created_day`, `fragment_ledger` / `fragment_owed`,
  `unstake_pending`, `xp` / `xp_remainder`;
- Vault Solidity holds `backingOf` / `reservedOf` / issued vouchers;
- StakeRegistry holds `amountOf` and holder `unstake`;
- tick records and headers are persisted.

Full runtime relationships are **PARTIAL**.

### Generated SQL table inventory

`services/api/migrations/001_from_pack.sql` creates:

- `accounts`;
- `cities`;
- `tick_inputs`;
- `records`;
- `state_snapshots`;
- `outbox`;
- `attest_roots`;
- `price_samples`;
- `buyback_batches`;
- `vouchers`;
- `intents`;
- `fragments_ledger`;
- `seasons`;
- `prize_pools`;
- `prize_payouts`;
- `basket_batches`;
- `prize_returns`;
- `schema_migrations`;
- `sessions`;
- `city_owners`;
- `command_rates`;
- `tick_locks`;
- `demo_wallet_transfers`.

Most tables use canonical `payload` bytes plus `payload_hash`; money/account
tables also carry `account_kind`. This is a canonical-byte storage schema, not
a typed relational Agent/Building gameplay schema.

**UNKNOWN:** whether this payload shape is intended as the final production
domain model or remains an implementation scaffold.

---

## 37. Game Formulas

This repeats the most important formulas in a compact source-indexed form.

### Core monetary

- `capital_capacity = vault_corp × 2000`
  — `packages/engine/src/economy.ts`.
- `gross = backing × mint_rate / wei`
  — `packages/engine/src/economy.ts`.
- `minted = paysFee ? gross × (10000 - vault_fee_bps) / 10000 : gross`
  — same source; the `paysFee` branch is part of the actual function.
- `burn/fund/payroll/protocol = 4000/6000/0`
  — `content/params/economy.json`; Capital spending does not fund stock pools.
- `day_budget = fund / 14`
  — `packages/engine/src/economy.ts`.
- `tick_budget = day_budget / 24`
  — same source.

### Time

- `tick_length_real_seconds = 25×3600/24 = 3750`
  — generated balance/time, `packages/protocol/src/listen.ts`.
- `city_time_rate_bps = 24×10000/25 = 9600`
  — generated time and `apps/client/src/clock.ts`.

### Industry

- `efficiency = clamp(10000 + 25000×(ratio-10000)/10000, 8500,11500)`
  — `packages/engine/src/tick.ts`.
- stake bonus integer hyperbola
  — `content/params/districts.json`.

### Production

- output chain including affinity, level, jitter, fused modifiers and residual
  idle haircut
  — `packages/engine/src/economy.ts`.

Exact current TypeScript request path, with `bps=10000`, is:

```
request = output_base * affinity_bps / bps
request = request * level_mult_bps / bps
request = request * jitter_bps / bps
request = request * fused_modifier_stack / bps
request = request * (bps - residual_idle_bps) / bps
if happiness_penalty_live > 0 and happiness < happiness_penalty_threshold_bps:
    request = request * happiness / bps
```

Then the city request is multiplied by `city.weight` for proportional payroll
allocation. Source: `packages/engine/src/economy.ts::collectRequests`.

### Progression

- tier cost and research node costs use fused integer multiplication/division
  — `content/build.py`, `docs/PROGRESSION.md`.
- Automation offline cap: base 12 + tier dividends 1+2+3 = 18 hard cap;
  merge +1 is clipped, never 19
  — `content/aggregates.py`, `packages/engine/src/aggregates.ts`.
- Housing Flagship Store 400/900/2025; Retail Complex 600/1350/3037;
  `housing_capacity_add` additive; `population_conversion_bps` is not housing
  — same sources.
- Ordinary functions: `build_slots = agent_slots + 3`
  — `buildSlotsOf`.
- XP: `grant = 1 + floor((remainder + bonus_bps) / 10000)`; Train +1 additive
  — `content/xp.py`, `packages/engine/src/xp.ts`.
- Bank global cap: `depth * 100 / 10000`
  — `content/bank.py`, `packages/engine/src/bank.ts`.
- Fragment settle: `raw = f * pool / total`; cap `pool * 5000 / 10000` if
  N≥2; dust = pool - paid
  — `content/fragments.py`, `packages/engine/src/fragments.ts`.
- Fee split of DEX turnover: fund 100 bps, leaderboard 30 bps, farm 50 bps,
  studio 20 bps; round-trip 1445 bps
  — `content/out/pack.json` `generated.economy`.
- Merge magnitude: full Tier-1 `unit * sign`
  — `content/build.py`.

### Season

- Influence daily product and Zipf payouts
  — `content/seasons.py`, `packages/engine/src/seasons.ts`.

### Known missing formulas

- no production formula for full per-agent/building affinity in TypeScript;
- no API unstake command / voucher presentation host;
- no full wallet prize custody formula path;
- no client-side economic formula is allowed by design;
- `mint_rate_limit_bps` is in content, not engine.

---

## 38. State Machines

### Building

Intended: locked → available → active logical function → upgraded /
frozen / deactivated / idle. Construction is a DecisionRecord status string
still present in engine records (`status_construction`) but API `build` does
not create an under-construction timer or mutate tiles. Current API writes
`city.functions[]`.

### Agent

Intended: hired → seated → working/idle/payroll-trimmed/offline → fired.
Current API creates an engineer row; engine uses synthetic shift. XP/Train
helpers exist when `agents[]` is present.

### District

Intended: locked → stake threshold → open → freezing → frozen.
Contracts accumulate/return stake. Engine `unstake` can write freeze-until.
API does not open districts or call unstake.

### Bank

Intended: open/closed/depth-limited/daily-limit-exhausted/uncovered;
reservation open → settled / expired.
Engine reservation + ladder exist; tick `withdraw_intent` may still fill
immediately; command/API integration absent.

### Stake

Intended: below threshold/open/tier multiple/unstake grace/frozen.
On-chain: stake/unstake/snapshot. Server freeze: engine `unstake`. API:
absent.

### Season

Intended: open → period settlement → season settlement → claim.
Pure settlement exists; complete custody/lifecycle integration is partial.

---

## 39. Logs and Errors

### Source of truth

- definitions: `content/params/codes.json`;
- text: `content/strings/ru.json`;
- generated TS: `packages/protocol/src/codes.ts`.

### Important user-facing codes

- `NOT_ENOUGH_CAPITAL`;
- `NOT_ENOUGH_CORP`;
- `BANK_CLOSED`;
- `BANK_SUNDAY`;
- `BANK_DAILY_LIMIT_REACHED`;
- `STAKE_BELOW_THRESHOLD`;
- `DISTRICT_LOCKED`;
- `IDLE_NO_ENERGY`;
- `IDLE_NO_COMPUTE`;
- `IDLE_WRONG_ROLE`;
- `IDLE_OFFLINE_CAP_REACHED`;
- `PAYROLL_TRIMMED`;
- `STALE_PRICE`;
- `ORACLE_STALE`;
- `DISTRICT_FREEZING`;
- `DISTRICT_FROZEN`;
- `FRAGMENT_POOL_EMPTY`;
- `FRAGMENT_CITY_CAPPED`;
- `FRAGMENT_WINDOW_SETTLED`;
- `FRAGMENT_NO_CLAIMS`;
- `PRIZE_POOL_EMPTY`;
- `PRIZE_CLAIM_UNCOVERED`;
- `SERVICE_DEGRADED`;
- `RENDER_NO_GPU`.

### Logging rule

An idle result should carry a reason. A state code should be shown on the
appropriate HUD surface. A transport code should not be placed in a
DecisionRecord reason.

### Current log limitations

The API log projection mostly contains attestation rows. The client also adds
local event entries. Full per-agent idle/task/building event stream is not
implemented.

---

## 40. Implemented Features

- pack parsing, canonicalization and hash verification;
- generated protocol IDs and routes;
- deterministic integer engine core;
- price-rate, payroll, spend, bank and reserve arithmetic;
- record/header encoding and Merkle/public verification;
- pure season and prize arithmetic;
- session authentication;
- API HTTP/command scaffolding;
- database schema and replay helpers;
- chainport mock/RPC codecs;
- local Solidity contracts and safety tests;
- Three.js island runtime mount;
- React HUD shell;
- pack-driven content generation/lint/attack infrastructure;
- CI/Docker/compose generation;
- Vault voucher reservation / present / expiry-release Solidity;
- StakeRegistry holder-owned unstake;
- engine XP, housing, sticky city level, bank reservations, fragment
  settlement, unstake/freeze helpers;
- API logical function activate/deactivate;
- LOOK-02 identity/pose gate on origin-baked runtime building GLBs;
- contentpack I0 island-stage inventory aligned to `arch.json` + L268
  (`island_form` + 10 LOOK `island_client` construction names).

---

## 41. Partial Features

- full agents/traits/tasks/affinity;
- actual buildings and building lifecycle (API functions exist; no
  construction/tile/mesh);
- district staking/open; API unstake command still missing;
- research UI and commit;
- fragment claim / DEX buy-hop / prize custody;
- live sampler/buyback;
- live Merkle submit;
- persistent city restoration;
- complete client snapshot;
- WebSocket updates;
- live 3D placement (map is immutable; client still posts tiles);
- visual acceptance after LOOK-02 (LOOK-04 GO, LOOK-05–11, composition);
- engine `bankWithdraw` immediate-fill vs reservation voucher path;
- production voucher presentation host.

---

## 42. Planned Features

As represented by `content/params/arch.json` roadmap and current reports:

- live form/player identity;
- production chain/RPC;
- live prize/attestation paths;
- v1.1 districts/archetypes/research/synergy completion;
- rebalance close;
- release/CI/contract audit/production operations;
- visual atlas/render/HUD completion;
- visual3 and island rescue completion;
- mainnet launch;
- first season.

Exact phase ownership and gate commands are pack data, not to be reauthored
in this document.

---

## 43. Known Bugs

1. API state is not fully restored from DB on restart.
2. Scheduler does not use `catchUp`.
3. API hire always creates Engineer.
4. Agents/stocks/population are dropped or hardcoded in client snapshot.
5. Most declared commands are refused despite `v1: live`.
6. Claim prize does not complete external custody mutation.
7. Fragment Python/TypeScript settlement is now ported (city cap, ledger
   clear, owed). Accrual still depends on a synthetic `city.building`, not
   the full function roster. Treat remaining gaps as partial, not “broken
   cap”.
8. Tools research effect is injected only by spawn/Python simulation
   (`spawn.ts` reads `cfg.tools_effect_bps`, which `loadConfig` does not
   populate).
9. Night Energy premium is loaded but unused in engine.
10. Mint daily rate limit is in content but not engine.
11. Client has no WebSocket consumer.
12. Client command errors are ignored.
13. Empty ground does not open BUILD in current 3D picker.
14. Three camera tile target setter is a no-op.
15. Client always passes empty opened-district map to scene.
16. Research screen is a placeholder.
17. Offline return overlay is not automatically driven.
18. Production client hosting is absent from Docker/deploy configuration.
19. Root Vitest workspace omits render.
20. Cached test results include failures and stale/missing vector/atlas inputs.
21. `.gitignore` does not ignore common generated dependency/build trees.
22. Active documents contain stale version statements.
23. `DESIGN.md` §4.8 still says merge is half a Tier-1 dividend.
24. `content/params/screens.json` `build_place` still describes lot-tile
    placement.
25. Engine `treasury.ts` still honors a `paused` flag that Vault/PrizeTreasury
    no longer have.
26. Tick `bankWithdraw` can fill immediately while the reservation/voucher
    path is the intended Bank exit.

---

## 44. Contradictions

Each item below preserves both sources. No item is resolved here.

### C-01 — authored immutable map versus tile UI / pack copy

- **SOURCE A:** `docs/CANON.md` R-V-98/R-V-100, `docs/WORLD.md`,
  `docs/reports/PLAN_ISLAND.md`, `services/api/src/commit.ts::applyBuild`:
  authored map is immutable; `build` activates/deactivates logical functions;
  no tile mutation.
- **SOURCE B:** `content/params/screens.json` `build_place` still describes
  lot-tile placement and `BUILD_TILE_ILLEGAL`;
  `apps/client/src/hud/screens/build.tsx` still posts `tile_x`/`tile_y`.
- **CONFLICT:** current API/canon owner is A. B is stale pack/UI copy that
  still talks as if construction/placement existed.
- **POSSIBLE INTERPRETATION:** B is leftover grid-era HUD until screens are
  regenerated. Do not treat B as current command semantics.

Historical note: a 2026-09-09/10 audit recorded `commit.ts` placing a building
on a generated grid tile. That implementation is no longer present.

### C-02 — no live units versus archive unit generator

- **SOURCE A:** `docs/CANON.md` R-V-101 and current island plan: no people,
  vehicles, drones, robots or mobs in the live scene.
- **SOURCE B:** `content/world.py`, `packages/render/src/units.ts`,
  `packages/render/src/motion.ts`, legacy generated placement data.
- **CONFLICT:** old cell/Pixi pipeline still has unit generation.
- **POSSIBLE INTERPRETATION:** B is archive code awaiting removal.

### C-03 — five roles versus Operator

- **SOURCE A:** `content/params/agents.json`,
  `packages/protocol/src`, `DESIGN.md` §5.7: Engineer, Logistician, Trader,
  Scientist, Manager.
- **SOURCE B:** `visual/mockups/banner.png`, `art/units/view.html`: Operator.
- **CONFLICT:** visual terminology contains a sixth role not in content/runtime.
- **OPEN QUESTION:** remove Operator references or add a formal sixth-role
  content decision.

### C-04 — prize liveness/phase

- **SOURCE A:** `DESIGN.md` §11 describes prize payout as v1.1.
- **SOURCE B:** `DESIGN.md` §12, `docs/PRIZES.md`,
  `content/params/seasons.json` (`season_prizes_live=1`) and
  `content/params/screens.json` (`leaderboard_claim_live=1`) describe live
  prize behavior.
- **STATUS:** the current pack flag is `season_prizes_live=1`; the remaining
  gap is runtime custody: production buyback and wallet claim transport are
  not fully wired. Older v1.1 wording is historical phase language, not a
  second current economy.

### C-05 — HUD gate versus current mount

- **SOURCE A:** `docs/CANON.md`, `docs/reports/ISLAND_STUDIO.md`: HUD/P7 begins
  only after LOOK-11 acceptance.
- **SOURCE B:** `apps/client/src/main.tsx`: live client/HUD mounts after login.
- **CONFLICT:** client mount is not gated by LOOK-11.
- **POSSIBLE INTERPRETATION:** current mount is preview/dev behavior.

### C-06 — `island.glb` canon artifact versus runtime rejection

- **SOURCE A:** `art/island_v3/CANON.txt`: `island.glb` is described as the
  working copy and may contain buildings.
- **SOURCE B:** `docs/CANON.md`, `docs/WORLD.md`,
  `docs/reports/ISLAND_STUDIO.md`: fat `island.glb` is not runtime; use
  `runtime/island_mass.glb` plus separate buildings.
- **CONFLICT:** file-local canon text and current pipeline docs disagree.
- **POSSIBLE INTERPRETATION:** `CANON.txt` is an earlier studio snapshot.

### C-07 — roadmap/live status versus scaffold implementation

- **SOURCE A:** `docs/ROADMAP.md` and generated phase documents use live/root
  language.
- **SOURCE B:** `services/attestor/src/live.ts` uses mock port/memory store,
  `services/llm/src/main.ts` has no provider, `launch.deployed.*` is empty.
- **CONFLICT:** roadmap status overstates deployed behavior.
- **POSSIBLE INTERPRETATION:** “live” means pack/contract design live, not
  deployed production.

### C-08 — version drift

- **SOURCE A:** `content/params/meta.json` and
  `packages/protocol/src/versions.ts`: rules `0.24.0`, pack `138`.
- **SOURCE B:** dated phase reports and archive snapshots retain their
  historical version labels.
- **STATUS:** current economy, tick, prize, and public guide text is aligned
  to pack `138`; dated reports retain history and are not current
  instructions.

### C-09 — fragment/prize split

- **SOURCE A:** archived launch passages describe pre-rebalance creator-tax/
  cork routing differently.
- **SOURCE B:** `docs/PRIZES.md`, `content/params/fragments.json` and
  `content/params/seasons.json` set relevant creator-tax shares to zero or
  use the current split.
- **STATUS:** current active docs use the post-rebalance split: 100 bps fund,
  30 bps month, 50 bps farm, 20 bps studio. Older wording is pre-rebalance
  history and remains confined to archive material.

### C-10 — declared live actions versus API

- **SOURCE A:** `content/params/screens.json` declares deposit/withdraw/stake,
  research and district actions as live-capable.
- **SOURCE B:** `services/api/src/commit.ts` applies hire/build/claim_prize/
  set_objective. There is still no unstake/withdraw/deposit/stake command.
- **CONFLICT:** generated UI/route registry is ahead of API execution.
- **POSSIBLE INTERPRETATION:** pack marks target scope, not current server
  availability.

### C-11 — full agent model versus synthetic shift

- **SOURCE A:** `DESIGN.md`, `content/params/agents.json`: role/trait/seat/task
  graph.
- **SOURCE B:** `packages/engine/src/tick.ts` emits `agent_id="shift"` and
  uses city-level production.
- **CONFLICT:** authored model is not executed by current tick.

### C-12 — Python reference versus TypeScript port

- **SOURCE A:** `content/tick.py` and `content/sim.py` include simulation-only
  injections.
- **SOURCE B:** `packages/engine/src` now ports XP, housing, sticky level,
  bank reservations, fragments (cap/ledger/owed), seasons, unstake, and
  `clipOfflineHours`. `loadConfig` still omits `tools_effect_bps`.
- **CONFLICT:** remaining parity gaps are narrower than the 2026-09-09/10
  note that TypeScript omitted fragment cap/settlement. That older gap is
  historical. Current remaining gap: tools effect, night premium, mint-rate
  cap, synthetic `city.building` fragment accrual, and API command coverage.
- **POSSIBLE INTERPRETATION:** content/design remains owner; engine is a
  growing port, not a second ruleset.

### C-13 — declared state sources versus snapshot

- **SOURCE A:** `content/params/screens.json`, `HUD.md`: GDP, stocks, agents,
  stability, happiness and wallet/chain sources.
- **SOURCE B:** `apps/client/src/hud/model.ts`,
  `services/api/src/http.ts`: agents/stocks empty and population zero.
- **CONFLICT:** UI contract exceeds transport projection.

### C-14 — engine versus contentpack null policy

- **SOURCE A:** `packages/engine/src/canonical.ts` rejects null.
- **SOURCE B:** `packages/contentpack/src/canonical.ts` allows null.
- **CONFLICT:** canonical serialization domains have different null policies.

### C-15 — mock visual references versus current island canon

- **SOURCE A:** `docs/CANON.md`, island reports: no sea/people/units in live
  scene and separate runtime GLBs.
- **SOURCE B:** `visual/mockups/*.png`: floating island, sea, people and
  Operator strip.
- **CONFLICT:** marketing/reference visuals depict out-of-scope elements.
- **POSSIBLE INTERPRETATION:** B is mood/brand exploration, not product
  acceptance.

### C-16 — signed voucher wording versus contract mechanism

- **SOURCE A:** `DESIGN.md` calls the exit object a signed voucher.
- **SOURCE B:** `contracts/src/Vault.sol` uses `issueVoucher` to store
  signer-authorized fields and `presentVoucher` checks the stored fields; no
  signature bytes/ECDSA verification exists.
- **CONFLICT:** protocol prose and current Solidity mechanism differ.

### C-17 — bank-level ladder versus engine (historical vs current)

- **SOURCE A:** `content/out/GENERATED.md` gives Bank L1–L4 shares.
- **SOURCE B (current):** `packages/engine/src/economy.ts::bankWithdraw`
  calls `bankShareBps(cfg.bank_levels, city.bank_level)` and falls back to
  `bank_l1_share_bps` only if the ladder row is 0.
- **SOURCE C (historical, 2026-09-09/10 handoff):** claimed the engine always
  used L1 for `bank_level > 0`.
- **CONFLICT:** C is stale relative to current B. A vs B is no longer a
  ladder-execution conflict. Remaining Bank conflict is reservation/voucher
  versus immediate `withdraw_intent` fill (C-22).

### C-18 — canonical visual acceptance versus runtime output

- **SOURCE A:** `docs/reports/PLAN_ISLAND.md` requires LOOK acceptance and
  runtime capture/budget checks.
- **SOURCE B:** current GLBs/captures exist; LOOK-02 identity/pose gate
  passes; LOOK-03 is accepted; LOOK-11 is absent and some runtime review
  files exceed the render-size ceiling.
- **CONFLICT:** assets exist before final product acceptance. Do not treat
  LOOK-02 passing as LOOK-11 acceptance.

### C-19 — observed pons tax versus Corporator launch content

- **SOURCE A:** `docs/LAUNCH.md`: observed external pons curve has 100 bps
  creator tax and 100 bps curve fee.
- **SOURCE B:** `content/params/launch.json`,
  `content/params/economy.json`: Corporator launch/content assumptions use
  200 bps creator tax and the authored fee split.
- **CONFLICT:** external observed curve facts are not the same as the
  project's intended launch parameters.
- **POSSIBLE INTERPRETATION:** A is a current external venue snapshot; B is
  the intended project configuration.

**DO NOT RESOLVE SILENTLY.** Any future implementation change must name the
conflicting sources and record the selected owner.

### C-20 — merge dividend half versus full Tier-1

- **SOURCE A:** `DESIGN.md` §4.8: merge effect is half of each side's Tier-1
  dividend.
- **SOURCE B:** `docs/PROGRESSION.md` §6, `content/build.py` merge generation,
  modifier `magnitude_from: "merge tier-1 dividend"`: full Tier-1
  (`unit * sign`).
- **CONFLICT:** current content/design owner is B (full Tier-1). A is a stale
  DESIGN sentence.
- **DO NOT RESOLVE SILENTLY** by editing DESIGN in this pass.

### C-21 — leftover engine pause versus contracts without pause

- **SOURCE A:** `docs/AUDIT.md`, `contracts/src/Vault.sol`,
  `PrizeTreasury.sol`: production contracts do not hold `paused`.
- **SOURCE B:** `packages/engine/src/treasury.ts::claimPrize` still has
  `paused`/`honorPause`; `packages/engine/test/m5.test.ts` asserts paused
  claims pay 0; API hardcodes `paused: false`.
- **CONFLICT:** engine helper can still honor a pause the contracts no longer
  implement.
- **POSSIBLE INTERPRETATION:** leftover test/API argument, not a live
  contract control.

### C-22 — Bank reservation/voucher versus immediate withdraw-intent

- **SOURCE A:** `content/bank.py`, `packages/engine/src/bank.ts`,
  `contracts/src/Vault.sol`: authorize/reserve, present, expire; voucher
  coverage reservation.
- **SOURCE B:** `packages/engine/src/economy.ts::bankWithdraw` fills
  `withdraw_intent` immediately during an open tick.
- **CONFLICT:** two exit paths. Owner design is A. B is still executable.
- **STATUS:** PARTIAL.

### C-23 — contract pause wording in older handoff/docs versus current Solidity

- **SOURCE A:** this file's 2026-09-09/10 Vault section, and any archive
  money plans that still mention pause/unpauseDelay on Vault/PrizeTreasury.
- **SOURCE B:** current `Vault.sol` / `PrizeTreasury.sol` / `docs/AUDIT.md`.
- **CONFLICT:** A is historical. B is current. Keep A only as history.

### C-24 — screens.json housing/population_conversion versus housing capacity

- **SOURCE A:** district Consumer `provides: population_conversion_bps`.
- **SOURCE B:** `content/aggregates.py`: housing is direct persons from
  Flagship Store / Retail Complex; `population_conversion_bps` is not
  housing.
- **CONFLICT:** do not treat the Consumer modifier key as the housing
  capacity table.

### C-25 — positive-day prose versus GDP_day > 0

- **SOURCE A:** `content/params/seasons.json` qualify why-text: period days
  with `I_day > 0`.
- **SOURCE B:** `packages/engine/src/seasons.ts::positiveDay` and
  `content/seasons.py` increment `positive_days` when `GDP_day > 0`.
- **CONFLICT:** owner decision and executable code use GDP_day. A is stale
  parameter prose.
- **CURRENT OWNER:** B.

### C-26 — live `island.blend` versus frozen LOOK-02 snapshot

- **SOURCE A:** live `art/island_v3/island.blend`
  sha256 `4403e073028c4631e49bed22e174b96d80c921d6e97cdf1ef0012716351f3340`,
  `322358322` bytes.
- **SOURCE B:** snapshot
  `art/island_v3/snapshots/canon_2026-09-06_island/island.blend`
  sha256 `9ef06d651001f6832d1bf40ca12def903ba9a9ceef18ded85d224daf9f296f9c`,
  `210675347` bytes; pinned by `gate_look02.py` `SNAP_BLEND_SHA`.
- **CONFLICT:** working blend and frozen snapshot are different files.
- **CURRENT RUNTIME OWNER:** `art/island_v3/runtime/island_mass.glb` plus
  `runtime/buildings/*.glb`. Do not re-export A to overwrite B or runtime
  without a new owner export decision.
- **DO NOT RESOLVE SILENTLY.**

---

## 45. Open Questions

1. Is building activation authored-function only, with tile UI retired?
   Current owner: authored map immutable; API already ignores tiles.
2. Will live state use WebSocket, polling, or both?
3. Who persists/restores full city state?
4. Will the engine become a full agent/building simulation?
5. Is Operator removed permanently?
6. Which LOOK-04 layout is approved?
7. Has LOOK-11 been accepted?
8. What are production token/curve/pool/hook/Vault/StakeRegistry/
   MerkleRoots/PrizeTreasury addresses and deployment transactions?
9. What are guardian/signer/voucherSigner/minter/depositor role owners?
10. Which RPC/IPFS providers are production?
11. Which LLM provider and price snapshot are canonical?
12. Is `mint_rate_limit_bps` missing from engine by design?
13. Where is the production voucher presentation host?
14. Where is the client statically hosted?
15. Should `dist`, `dist-web`, `node_modules` be ignored?
16. What is `_h1.txt`?
17. Which cached test failures are current?
18. Which active documents must be refreshed to pack 138/rules 0.24.0,
    especially `DESIGN.md` §4.8 merge-half wording?
19. When will `screens.json` `build_place` stop requiring `build_tile`?
20. Should tick `bankWithdraw` be removed once voucher reservations are the
    only exit?
21. What are Stock Token → StakeRegistry mappings and the final deployed ABI?
22. Are there external audit results beyond internal `docs/AUDIT.md`?
23. Should live `art/island_v3/island.blend` be discarded, snapshotted, or
    re-exported? Current evidence: LOOK-02 pins the 2026-09-06 snapshot;
    runtime GLBs are the passing source. Do not re-export in this pass.

---

## 46. Design Principles

1. City physically exists; player activates functions. Authored map is
   immutable. No physical construction, placement, mesh creation, anchor
   allocation, tile mutation, or construction state.
2. Placement alone does not pay. Ordinary active logical functions are
   limited by `agent_slots + 3`; autonomous/prebuilt excluded; frozen/
   deactivated do not count. City Level does not auto-downgrade.
3. Valid work requires building/agent/resource/time conditions.
4. Player decides; agent executes.
5. LLM is outside the economic tick.
6. Tick is integer-only and deterministic.
7. Prices/stakes are recorded inputs, not RPC inside tick. DEX buy/hop is
   outside the tick.
8. Vault backing constrains Capital. Voucher issue reserves backing; present
   consumes it; expiry releases it; no double coverage.
9. Payroll is finite and visibly trimmed.
10. Bank operates on personal city time. Global day reset; 1% live depth;
    reservations consume capacity immediately.
11. Market price is industry weather, not direct player PnL.
12. Stale external data cannot silently grant an advantage.
13. Demo and wallet progress cannot cross.
14. Published packs are immutable by hash. Content/design rules own older
    engine behavior.
15. Visual island is authored and shared.
16. Live island currently has no units.
17. HUD must expose causes rather than silent zeroes.
18. Visual acceptance requires runtime evidence.
19. Merge uses full Tier-1 dividend. Automation merge +1 hour cannot exceed
    the 18-hour offline hard cap.
20. Unstake is holder-owned on-chain; 24-hour grace/freeze is server-side.

---

## 47. Terminology / Glossary

- **Capital:** internal backed currency.
- **`$CORP`:** external protocol token.
- **Vault:** `$CORP` backing/mint/withdraw custody.
- **Payroll:** shift payment fund.
- **Treasury:** qualify whether city Capital or protocol ETH/token pots.
- **Bank:** Capital exit.
- **Exchange:** Stock Token purchase/stake surface.
- **Stock Token:** external security used as district key.
- **District:** one of six game industry branches.
- **Industry:** district function/role.
- **Beacon:** district building.
- **Synergy:** two-district building.
- **Agent:** worker entity.
- **Role:** Engineer, Logistician, Trader, Scientist, Manager.
- **Trait:** hire-time modifier.
- **Task/objective:** current agent instruction.
- **Shift:** work execution unit.
- **Efficiency:** district market/weather multiplier.
- **Productivity:** realized/nominal measurement.
- **Happiness:** city quality metric.
- **Stability:** valid-tick ratio.
- **Population:** jobs plus housing derived metric.
- **Influence:** seasonal score.
- **Fragment:** internal Stock Token claim requirement.
- **Stake:** quantity of real Stock Token recorded for industry access.
  On-chain unstake returns the token; server freeze is separate.
- **City time:** logical personal city clock.
- **Offline cap:** maximum absence catch-up. Base 12, hard cap 18.
- **Housing:** additive Consumer capacity (Flagship Store / Retail Complex),
  not `population_conversion_bps`.
- **GDP_day:** Capital paid on valid ticks of one global city day.
- **Fragment:** internal Stock Token claim chip; `fragment_gross_base` is
  Capital-equivalent; pool buy/hop is outside the tick.
- **Pack:** immutable content/config artifact.
- **DecisionRecord:** canonical per-tick output record.
- **TickInputHeader:** canonical input/header record.

Do not use “AI agent” to imply that an LLM computes economic output. In this
project the economic agent is a deterministic worker model; LLM is an
external narrative layer.

---

## 48. Agent Handoff Instructions

### How another agent should understand Corporator

1. **What the game is:** a browser 3D city-management economy on Robinhood
   Chain. The player operates one city's economy; the island is shared.
2. **What the player owns:** Capital, functions, agents, stakes, fragments,
   Influence, bank/withdrawal history. Not the physical map.
3. **What the player does:** deposit `$CORP`, activate/deactivate authored
   functions, hire/assign agents, stake Stock Tokens, manage payroll, exit
   through the Bank.
4. **What the city is:** already-built infrastructure. Player turns functions
   on and off. No construction, placement, mesh creation, or tile mutation.
5. **What the economy is:** Vault-backed Capital, finite payroll fund, 2%
   creator tax split into 1.0% fund, 0.3% leaderboard stocks, 0.5%
   active-work stocks and 0.2% studio; Capital spending is 40% burn / 60%
   payroll / 0% protocol; round-trip 1445 bps.
6. **What agents are:** five roles executing shifts. XP +1/tick, Train +1 to
   a same-city target, max level 5.
7. **What buildings are:** 18 authored archetypes. Ordinary active functions
   capped at `agent_slots + 3`. Housing is Flagship Store 400/900/2025 and
   Retail Complex 600/1350/3037.
8. **What industries are:** six districts keyed by real Stock Tokens.
9. **How money works:** `$CORP` → Vault → Capital; exit is voucher-gated
   Bank. Issue reserves backing; present consumes; expiry releases.
10. **How time works:** 25-real-hour city day, 24 ticks, personal clock.
    Global epoch closes GDP/Influence; new cities do not backfill.
11. **How offline works:** base 12 hours, Automation 1+2+3, merge +1,
    hard cap 18.
12. **How visuals work:** one authored island, runtime mass + building GLBs,
    no live units, LOOK-11 not accepted.
13. **What MUST NOT be changed:** published pack hash
    `9e4a5ca1132872e8856ad0764126f63ec0bc16b7a971f59108c9724495cb83ed`
    except by official generators; I1/I3/I11; integer-only tick; immutable
    authored map; no Vault/PrizeTreasury pause; holder-owned unstake with
    server-side freeze; content/design as owner over old engine behavior;
    `island.blend` / snapshot re-export without an owner decision;
    C-20 (`DESIGN.md` §4.8 half-dividend vs current full-dividend).
14. **What is currently incomplete:** real production DEX quote/buy source
    (the default conveyor source is fail-open mock); API-to-chain
    PrizeTreasury claim transport (the current API path is a local projection);
    API unstake/withdraw/deposit/stake; voucher presentation host;
    full agent/building tick; production addresses and role owners; client
    snapshot; LOOK-11.

### Operating rules for the next agent

1. Start with `docs/CANON.md`.
2. Read `content/params/*.json` and `content/{aggregates,xp,bank,fragments,seasons,tick}.py`
   before changing formulas. Content/design owns older engine behavior.
3. Do not hand-edit generated protocol, Docker, CI, migration or tsconfig
   files. Do not regenerate pack or change pack hash unless asked. Never
   hand-edit generated hashes.
4. Compare `content/tick.py` and `packages/engine/src` before modifying tick.
5. Treat `Dict` state as an implementation limitation, not a complete domain
   model.
6. A declared screen/action is not proof of a live API effect.
7. A generated building/district/agent row is not proof of runtime execution.
8. Preserve I1/I3/I11, integer-only math, pack hash and layout v1.
9. Preserve demo-wallet barrier.
10. Do not add Operator without resolving C-03.
11. Do not treat generated placement grid as the live island. Do not add
    physical construction, tile mutation, mesh creation, or construction
    state.
12. Before visual edits, read `PLAN_ISLAND.md` and current LOOK GO/acceptance.
13. Do not use the fat `art/island_v3/island.glb` as runtime.
14. Keep preview/client renderer parity.
15. Do not reintroduce Vault/PrizeTreasury pause.
16. Unstake on-chain is holder-owned; grace/freeze stays server-side. Do not
    invent an API unstake command that is not there.
17. Before release, resolve production addresses, role owners, Stock Token
    mappings, deployed ABI, audit, voucher host, fragment buy/hop, client
    hosting, persistence, live commands, state projection, tests and visual
    acceptance.

### Highest-priority engineering gaps

1. Full persistent city/agent/building state.
2. Command/API implementation parity (unstake, withdraw/voucher host,
   deposit, stake, districts).
3. State projection and live client updates; retire tile `build_place`.
4. Full agent/building/district tick wiring.
5. Sampler/buyback/chain execution.
6. Fragment/season custody integration and DEX buy/hop host.
7. Client deployment.
8. Visual LOOK-11 acceptance and runtime budgets.
9. Production token/contract/stake addresses and role owners.

---

## 49. Machine-Readable Summary

```yaml
project:
  name: Corporator
  token: "$CORP"
  genre: browser 3D city-management economy
  platform: browser client plus Node services
  pack_hash: 9e4a5ca1132872e8856ad0764126f63ec0bc16b7a971f59108c9724495cb83ed
  vectors_sha256: db4d97d59d94ebabd2fd53e06c2726c42bb6b1085413f0fc8549da64e0a9fd4e
  rules_version: "0.24.0"
  pack_version: 138
  layout_version: 1
  canonical_bytes: 676950

world:
  map_model: one shared authored island
  live_source: art/island_v3/runtime/island_mass.glb
  building_source: art/island_v3/runtime/buildings/*.glb
  per_player_geometry: false
  economic_grid_is_live_map: false
  live_units: false
  sea_around_island: false
  waterfalls_allowed: true
  visual_acceptance:
    look02: gate_pass
    look03: accepted
    look04: recommended_variant_A_without_owner_go
    look11: unknown
  island_blend_live_sha256: 4403e073028c4631e49bed22e174b96d80c921d6e97cdf1ef0012716351f3340
  island_blend_snapshot_sha256: 9ef06d651001f6832d1bf40ca12def903ba9a9ceef18ded85d224daf9f296f9c

economy:
  internal_currency: Capital
  external_currency: "$CORP"
  capital_anchor: 2000
  vault_fee_bps: 200
  creator_tax_bps: 200
  bank_markup_bps: 1000
  trader_markup_floor_bps: 650
  spend_split_bps:
    burn: 4000
    payroll: 6000
    protocol: 0
  creator_tax_prize_share_bps: 5000
  studio_eth_share_bps: 2000
  fee_split_turnover_bps:
    fund: 100
    leaderboard: 30
    farm: 50
    studio: 20
  month_kettle_turnover_bps: 30
  farm_active_work_turnover_bps: 50
  round_trip_cost_bps: 1445
  payroll_daily_divisor: 14
  payroll_fund_cap_days: 30
  reserve_weekly_drain_bps: 500
  backing_invariant: "capital_outstanding <= vault_corp * 2000"
  housing:
    flagship_store: [400, 900, 2025]
    retail_complex: [600, 1350, 3037]
    population_conversion_bps_is_housing: false
    housing_capacity_add: separate_additive
  merge_dividend: full_tier1
  city_level_sticky: true
  ordinary_function_cap: "agent_slots + 3"
  xp:
    paid_tick: 1
    train: 1
    additive: true
    remainder_bps: true
    trainer_mags_affect: compute_cost_only
    level_max: 5

time:
  city_day_real_hours: 25
  tick_city_hours: 1
  ticks_per_city_day: 24
  anchor:
    weekday: monday
    day: 1
    hour: 12
  bank:
    open_hour: 8
    close_hour: 20
    closed_weekday: sunday
  efficiency_recalc_hour: 6
  offline_cap_base_city_hours: 12
  offline_hard_cap_city_hours: 18
  automation_merge_offline_add: 1
  unstake_grace_city_hours: 24
  season_city_days: 90
  fragment_window_city_days: 14
  bank_global_day_reset: true
  bank_live_depth_share_bps: 100

industries:
  - id: compute
    ticker: NVDA
    resource: compute
    beacon: ai_research_center
  - id: energy
    ticker: TSLA
    resource: energy
    beacon: energy_plant
  - id: logistics
    ticker: AMZN
    modifier: idle_reduction_bps
    beacon: logistics_hub
  - id: consumer
    ticker: AAPL
    modifier: population_conversion_bps
    beacon: flagship_store
  - id: automation
    ticker: MSFT
    modifier: offline_cap_hours
    beacon: cloud_campus
  - id: finance
    ticker: COIN
    modifier: fund_share_bps
    beacon: finance_tower

buildings:
  base:
    - city_hall
    - workshop
    - agent_hub
    - power_node
    - bank
    - exchange
  beacons:
    - ai_research_center
    - energy_plant
    - logistics_hub
    - flagship_store
    - cloud_campus
    - finance_tower
  synergies:
    - robotics_lab
    - drone_depot
    - data_center
    - fleet_yard
    - retail_complex
    - clearing_house
  count: 18

agents:
  roles:
    - engineer
    - logistician
    - trader
    - scientist
    - manager
  operator_role: unknown
  slots_start: 8
  slots_cap: 20
  traits:
    - night_owl
    - frugal
    - specialist
    - steady
  objectives:
    - produce
    - overclock
    - route
    - stockpile
    - desk
    - quote
    - train
    - research
    - focus

resources:
  consumable:
    - energy
    - compute
  materials:
    present_in_record: true
    runtime_stock: false
    value_in_v1: 0

ui:
  framework: React
  shell: CSS HUD over canvas
  screens_declared: 16
  panels_declared: 11
  live_websocket_client: false
  actual_api_commands:
    - hire
    - build
    - claim_prize
    - set_objective
  declared_stub_commands:
    - noop
  missing_api_commands:
    - unstake
    - deposit
    - withdraw
    - stake
    - voucher_present
  declared_screen_commit_without_command_route:
    - research_start
  placeholder_or_refused:
    - deposit
    - withdraw
    - stake
    - open_district
    - buy_stock
    - upgrade
    - claim_fragment
    - unlock_tier
    - pick_node
    - merge
  missing_screen_commit:
    - research_start

visual:
  live_renderer: Three.js
  archive_renderer: Pixi/cell path
  live_mass: art/island_v3/runtime/island_mass.glb
  live_buildings: art/island_v3/runtime/buildings/*.glb
  references: visual/
  palette: art/palette/corporator.hex
  fonts:
    - Press Start 2P
    - IBM Plex Sans
  owner_acceptance:
    look02: gate_pass
    look03: true
    look04: false_or_unknown
    look11: false_or_unknown
  city_hall_origin: identity
  city_hall_translation: [0.0, 0.0, 0.0]
  city_hall_rotation: [0.0, 0.0, 0.0, 1.0]
  city_hall_scale: [1.0, 1.0, 1.0]
  city_hall_floor_y: 0.0
  city_hall_height_m: 1800.0
  city_hall_bytes: 216164
  city_hall_tris: 8000
  mass_bytes: 389308
  mass_bytes_max: 1572864
  worst_building: city_hall.glb
  worst_building_bytes: 216164
  building_bytes_max: 358400
  first_load_bytes: 2916776
  first_load_bytes_max: 12582912
  authored_tris: 248494
  authored_tris_max: 250000
  island_blend_live_sha256: 4403e073028c4631e49bed22e174b96d80c921d6e97cdf1ef0012716351f3340
  island_blend_live_bytes: 322358322
  island_blend_snapshot_sha256: 9ef06d651001f6832d1bf40ca12def903ba9a9ceef18ded85d224daf9f296f9c
  island_blend_snapshot_bytes: 210675347

technical:
  monorepo: pnpm
  package_manager: pnpm@11.24.0
  node: ">=24.0.0"
  python_ci: "3.12"
  services:
    - api
    - sampler
    - buyback
    - attestor
    - llm
  database: PostgreSQL production, PGlite harness
  contracts:
    - CorpToken
    - Vault
    - StakeRegistry
    - PrizeTreasury
    - MerkleRoots
  vault_pause: removed
  prize_treasury_pause: removed
  stake_registry_unstake: holder_owned
  unstake_grace: server_side_24h
  voucher_reservation: issue_reserves_present_consumes_expiry_releases
  asset_port_has_unstake: true
  asset_port_has_prize_treasury: false
  asset_port_has_dex_hop: false
  known_external_chain_facts: docs/LAUNCH.md
  project_deployed_addresses: unknown
  deployment_transactions: unknown
  role_owners: unknown
  stock_token_mappings: unknown
  final_deployed_abi: unknown
  external_audit_results: unknown
  fragment_pool_buy_hop_host: unknown
  voucher_presentation_host: unknown
  client_hosting: unknown
  codegen_check: 23_of_23
  lint_rules: 384
  lint_errors: 0
  contentpack_i0: 61_of_61
  attack_publish: 384_covered_plus_307_construction
  attack_followup_L268_L385: 12_probes_caught
  construction_island_stage_keys_exist: held

implemented:
  - deterministic_integer_tick
  - pack_hash_validation
  - canonical_record_header
  - payroll_and_backing_arithmetic
  - bank_reservation_arithmetic
  - bank_ladder_share_bps
  - merkle_and_public_verify
  - session_authentication
  - local_contract_safety_tests
  - vault_voucher_reservation
  - stake_registry_holder_unstake
  - engine_unstake_freeze
  - xp_and_train
  - housing_and_sticky_city_level
  - fragment_settlement_with_city_cap
  - api_logical_function_activate
  - look02_identity_pose_gate
  - city_hall_origin_identity
  - contentpack_i0_island_client_look_ct

partial:
  - three_island_renderer
  - agent_building_runtime
  - district_staking
  - research
  - fragment_accrual_on_synthetic_building
  - fragment_claim_and_dex_hop
  - season_claims_custody
  - offline_catchup_host_wiring
  - sampler
  - buyback
  - client_live_state
  - visual_acceptance
  - bank_withdraw_intent_immediate_fill
  - api_unstake_command
  - voucher_presentation_host

planned:
  - full_player_identity_state
  - complete_live_commands
  - real_chain_deployment
  - live_attestation
  - complete_v1_1_systems
  - LOOK_05_to_LOOK_11
  - mainnet_launch
  - season_one

unknown:
  - operator_role_decision
  - production_contract_addresses
  - production_rpc_and_ipfs
  - llm_provider_and_price
  - client_static_hosting
  - final_visual_owner_acceptance
  - persistent_state_recovery_policy
  - production_role_owners
  - stock_token_registry_mappings
  - final_deployed_abi
  - external_audit_results
  - fragment_pool_buy_hop_executor
  - voucher_presentation_host

conflicts:
  - authored_immutable_map_vs_tile_ui_copy
  - no_live_units_vs_legacy_unit_pipeline
  - five_roles_vs_operator_visual_terminology
  - prize_liveness_vs_phase_label
  - hud_look11_gate_vs_current_mount
  - island_glb_canon_text_vs_runtime_rejection
  - live_roadmap_claims_vs_mock_v1_1_services
  - dated_report_pack_snapshots
  - fragment_prize_split_history
  - live_pack_actions_vs_api_command_implementation
  - full_agent_model_vs_synthetic_shift
  - remaining_python_tick_vs_typescript_gaps
  - declared_state_sources_vs_actual_snapshot
  - engine_vs_contentpack_null_policy
  - mock_visuals_vs_live_island_canon
  - signed_voucher_prose_vs_vault_mechanism
  - historical_bank_ladder_vs_current_engine
  - visual_acceptance_vs_runtime_assets
  - observed_pons_tax_vs_project_launch_content
  - design_md_half_merge_vs_full_tier1
  - engine_pause_arg_vs_contracts_without_pause
  - bank_reservation_vs_immediate_withdraw_intent
  - historical_contract_pause_vs_current_solidity
  - population_conversion_bps_vs_housing_capacity
  - positive_day_I_day_prose_vs_gdp_day
  - live_island_blend_vs_look02_snapshot
```

