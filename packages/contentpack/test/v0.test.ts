import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

const VISUAL_STAGE_IDS = [
  "visual_form",
  "art_atlas",
  "art_content",
  "render_ground",
  "render_sprites",
  "render_light",
  "render_camera",
  "render_motion",
  "hud_shell",
  "hud_screens",
  "companion_screen",
  "attest_live",
  "visual_close",
] as const

const VISUAL3_STAGE_IDS = [
  "visual3_form",
  "visual3_engine",
  "visual3_assets",
  "visual3_light",
  "visual3_input",
  "visual3_units",
  "visual3_world",
  "visual3_close",
] as const

const PICTURE_STAGE_IDS = [...VISUAL_STAGE_IDS, ...VISUAL3_STAGE_IDS] as const

const PRIOR_PHASE = new Set([
  "live_form",
  "prize_claim_live",
  "process_hosts",
  "client_on_host",
  "pg_compose",
  "art_ground",
  "art_sprites",
  "owner_freeze",
  "contracts",
  "rpc_live",
  "pons_launch",
  "money_form",
  "fee_split",
  "prize_period",
  "prize_basket",
  "basket_conveyor",
  "prize_treasury",
  "vault_safety",
  "prize_surface",
  "launch_freeze",
  "owner_drain",
  "v11_form",
  "districts_live",
  "archetypes_live",
  "research_tree",
  "synergy_buildings",
  "companion_live",
  "companion_revenue",
  "rebalance_close",
  "release_form",
  "player_identity",
  "ci_tracks",
  "contract_audit",
  "prod_image",
  "time_rehearsal",
  "ops_watch",
  "mainnet_launch",
  "season_one",
])

const SCENE_JSON_URL_RE = /scene\.json\?url|art\/out\/scene\.json/
const PACK_SCENE_NEEDLE = 'placement["scene"]'
const CLIENT_SKIP = new Set(["node_modules", "dist", "dist-web", ".git"])

type ArchStage = {
  readonly goal: string
  readonly gate_cmd: string
  readonly ts_gate_cmd: string
  readonly tests: readonly string[]
  readonly invariants: readonly string[]
  readonly src: string
  readonly why: string
  readonly construction_tests?: readonly string[]
}

type ArchFile = {
  readonly roadmap_order: readonly string[]
  readonly roadmap: Readonly<Record<string, ArchStage | undefined>>
}

type MdcMeta = {
  readonly name: string
  readonly alwaysApply: boolean
  readonly description: string
  readonly body: string
}

type ParamFile = {
  readonly params?: Readonly<Record<string, { readonly v?: number } | undefined>>
}

type ScreensFile = ParamFile & {
  readonly actions?: Readonly<Record<string, { readonly effect?: string; readonly requires?: readonly string[]; readonly spend?: string; readonly v1?: string } | undefined>>
}

type PackFile = {
  readonly generated?: {
    readonly placement?: {
      readonly layout_hash?: string
      readonly scene?: unknown
    }
  }
}

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(repo, rel), "utf8")) as T
}

function loadArch(): ArchFile {
  return loadJson<ArchFile>("content/params/arch.json")
}

function roadmapOrderGaps(arch: ArchFile): readonly string[] {
  const gaps: string[] = []
  if (new Set(arch.roadmap_order).size !== arch.roadmap_order.length) {
    gaps.push("duplicate_order_id")
  }
  const keys = new Set(Object.keys(arch.roadmap))
  const order = new Set(arch.roadmap_order)
  for (const id of keys) {
    if (!order.has(id)) gaps.push(`extra:${id}`)
  }
  for (const id of order) {
    if (!keys.has(id)) gaps.push(`orphan:${id}`)
  }
  return gaps
}

function visualWindow(arch: ArchFile): readonly string[] | "ops_watch_missing" | "visual3_close_missing" {
  const i = arch.roadmap_order.indexOf("ops_watch")
  const j = arch.roadmap_order.indexOf("visual3_close")
  if (i < 0) return "ops_watch_missing"
  if (j < 0) return "visual3_close_missing"
  return arch.roadmap_order.slice(i + 1, j + 1)
}

function stageFieldGaps(stage: ArchStage): readonly string[] {
  const gaps: string[] = []
  if (stage.goal.length < 8) gaps.push("goal")
  if (stage.gate_cmd.length < 8) gaps.push("gate_cmd")
  if (stage.ts_gate_cmd.length < 8) gaps.push("ts_gate_cmd")
  if (stage.src.length < 8) gaps.push("src")
  if (stage.why.length < 24) gaps.push("why")
  if (stage.tests.length < 1) gaps.push("tests")
  if (stage.invariants.length < 1) gaps.push("invariants")
  return gaps
}

function parseMdc(name: string, text: string): MdcMeta {
  if (!text.startsWith("---")) {
    return { name, alwaysApply: false, description: "", body: text }
  }
  const end = text.indexOf("\n---", 3)
  if (end < 0) {
    return { name, alwaysApply: false, description: "", body: text }
  }
  const fm = text.slice(3, end)
  const body = text.slice(end + 4)
  const desc = /(?:^|\n)description:\s*(.+)/.exec(fm)
  return {
    name,
    alwaysApply: /^alwaysApply:\s*true\s*$/m.test(fm),
    description: (desc?.[1] ?? "").trim(),
    body,
  }
}

function isPhaseRule(meta: MdcMeta): boolean {
  if (
    meta.name === "code-phase.mdc" ||
    meta.name === "live-phase.mdc" ||
    meta.name === "money-phase.mdc" ||
    meta.name === "v11-phase.mdc" ||
    meta.name === "release-phase.mdc" ||
    meta.name === "visual-phase.mdc"
  ) {
    return true
  }
  return /L0|C0|M0|G0|P0|V0/.test(meta.description) && /фаза/i.test(meta.description)
}

function loadRules(dir: string): readonly MdcMeta[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".mdc"))
    .map((name) => parseMdc(name, readFileSync(join(dir, name), "utf8")))
}

function phaseAlwaysNames(rules: readonly MdcMeta[]): readonly string[] {
  return rules.filter((meta) => isPhaseRule(meta) && meta.alwaysApply).map((meta) => meta.name)
}

function walkClientSrc(): readonly { readonly rel: string; readonly text: string }[] {
  const root = join(repo, "apps/client/src")
  if (!existsSync(root)) return []
  const out: { rel: string; text: string }[] = []
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    if (dir === undefined) continue
    let entries: readonly string[]
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const name of entries) {
      if (CLIENT_SKIP.has(name)) continue
      const path = join(dir, name)
      try {
        const st = statSync(path)
        if (st.isDirectory()) {
          stack.push(path)
          continue
        }
        if (!st.isFile() || !(name.endsWith(".ts") || name.endsWith(".tsx"))) continue
        out.push({ rel: path.slice(root.length + 1).replaceAll("\\", "/"), text: readFileSync(path, "utf8") })
      } catch {
        continue
      }
    }
  }
  return out
}

describe.sequential("V0 construction", () => {
  it("visual_stage_keys_exist", () => {
    const arch = loadArch()
    expect(roadmapOrderGaps(arch)).toEqual([])
    expect(visualWindow(arch)).toEqual([...PICTURE_STAGE_IDS])
    for (const id of VISUAL_STAGE_IDS) {
      expect(PRIOR_PHASE.has(id)).toBe(false)
      const stage = arch.roadmap[id]
      expect(stage, id).toBeDefined()
      if (stage === undefined) continue
      expect(stageFieldGaps(stage), id).toEqual([])
      if (id === "visual_form") {
        expect(stage.construction_tests ?? []).toEqual([
          "visual_stage_keys_exist",
          "scene_comes_from_pack",
          "code_phase_rule_still_single",
          "missions_stay_stubbed",
          "visual_flag_inventory_holds",
        ])
      } else if (id === "art_atlas") {
        expect(stage.construction_tests ?? []).toEqual([
          "atlas_pack_is_deterministic",
          "atlas_key_fully_removed",
          "atlas_bytes_under_cap",
          "sprite_fits_footprint_width",
        ])
      } else if (id === "art_content") {
        expect(stage.construction_tests ?? []).toEqual([
          "new_ground_kinds_registered",
          "decor_share_within_band",
          "beacon_has_logo_and_ticker",
          "district_fabric_not_glued",
          "decor_follows_tile_tag",
        ])
      } else if (id === "render_ground") {
        expect(stage.construction_tests ?? []).toEqual([
          "ground_matches_python_scene",
          "water_phase_from_city_time",
          "chunk_seam_has_no_gap",
          "water_plane_not_tiled_cubes",
        ])
      } else if (id === "render_sprites") {
        expect(stage.construction_tests ?? []).toEqual([
          "sprite_sits_on_foot_anchor",
          "painter_order_matches_python",
          "level_overlay_from_pack",
          "shortage_badge_on_scene",
        ])
      } else if (id === "render_light") {
        expect(stage.construction_tests ?? []).toEqual([
          "frame_has_no_magenta_leak",
          "lights_off_at_day",
          "phase_blend_is_monotonic",
        ])
      } else if (id === "render_camera") {
        expect(stage.construction_tests ?? []).toEqual([
          "zoom_levels_from_pack",
          "camera_clamped_to_bounds",
          "click_maps_to_tile",
        ])
      } else if (id === "render_motion") {
        expect(stage.construction_tests ?? []).toEqual([
          "motion_is_pure_of_city_time",
          "no_wall_clock_in_render",
          "background_units_hold_no_lot",
        ])
      } else if (id === "hud_shell") {
        expect(stage.construction_tests ?? []).toEqual([
          "hud_geometry_from_fixture",
          "bank_plaque_always_present",
          "payroll_row_appears_when_trimmed",
          "stock_bar_shows_two_numbers",
          "building_select_opens_popover_not_route",
          "keeps FunctionStrip as keyboard non-3D access at narrow widths",
          "keeps compact chrome copy unclipped without hiding primary state",
          "announces loading and error distinctly from empty/unavailable/stale",
          "uses shared 120-180ms motion token and reduced-motion without perpetual HUD animation",
          "localizes clock updates without remounting the Three scene",
          "centralizes presentation thresholds without contradicting pack geometry",
          "returns focus after workspace close without focusing a detached trigger",
          "treats only ready FieldView as an exact numeric value",
          "value renderers do not use exact zero for non-ready fields",
          "keeps StatusChip loading/stale/error distinct from unavailable",
          "does not treat a missing payroll request as PAYROLL_TRIMMED",
          "keeps EventsView rows on the snapshot log shape",
          "keeps live adapter intent contracts without new routes",
          "function strip does not substitute zero for unavailable functions",
          "recent activity default presents at most three event rows",
          "expands BANK_CLOSED journal copy instead of leaving {opens_in}",
          "keeps Desktop v1.1 bright-blue tokens in palette and CSS",
          "resolves local building thumbs and excludes the decorative 19th plus sheets",
          "resolves role portraits and keeps sheets/brand as non-agent fallbacks",
          "documents Lucide registry names and accessible labels without a Settings destination",
          "loads verified local IBM Plex Sans and JetBrains Mono without a CDN",
          "refuses decorative and unknown IDs as a functional BuildingCard thumbnail",
          "keeps ResearchCard artwork explicit unavailable without invented assets",
        ])
      } else if (id === "hud_screens") {
        expect(stage.construction_tests ?? []).toEqual([
          "every_screen_has_empty_and_loading",
          "refusal_shows_one_blocking_code",
          "no_cyrillic_in_components",
          "keeps unsupported action unavailable without posting",
          "does not treat claim_prize as confirmed custody",
          "does not present a stale or missing quote as executable live quote",
          "disables bank withdraw when live daily limit is unavailable or zero",
          "labels bank and exchange amounts with Capital, $CORP, and selected Stock Token",
          "blocks duplicate money submit and does not confirm without applied live result",
          "maps only existing routes and tabs without new destination IDs",
          "opens existing overlays for manage and keeps decorative buildings out of the functional catalog",
          "shows unavailable live industry fields and keeps progression/merge off the overview cards",
          "renders five research items with pack cost/duration and unavailable artwork/start/detail",
          "keeps journal timestamp/entity/unread unavailable and seasons/farm/claims on existing overlays",
        ])
      } else if (id === "companion_screen") {
        expect(stage.construction_tests ?? []).toEqual([
          "autopilot_toggle_is_live",
          "companion_journal_filters_codes",
          "nft_crane_still_zero",
        ])
      } else if (id === "attest_live") {
        expect(stage.construction_tests ?? []).toEqual([
          "verified_badge_needs_root_and_cid",
          "attest_failure_keeps_payout",
        ])
      } else if (id === "visual_close") {
        expect(stage.construction_tests ?? []).toEqual([
          "visual_budgets_measured",
          "golden_frames_match",
        ])
      } else {
        expect(stage.construction_tests ?? [], id).toEqual([])
      }
    }

    const form = arch.roadmap["visual_form"]
    expect(form).toBeDefined()
    if (form === undefined) return
    const dropped: ArchFile = {
      roadmap_order: arch.roadmap_order.filter((id) => id !== "visual_form"),
      roadmap: Object.fromEntries(Object.entries(arch.roadmap).filter(([id]) => id !== "visual_form")),
    }
    expect(visualWindow(dropped)).not.toEqual([...PICTURE_STAGE_IDS])
    const fourteenth: ArchFile = {
      roadmap_order: [
        ...arch.roadmap_order.slice(0, arch.roadmap_order.indexOf("ops_watch") + 1),
        "ghost_v",
        ...arch.roadmap_order.slice(arch.roadmap_order.indexOf("ops_watch") + 1),
      ],
      roadmap: { ...arch.roadmap, ghost_v: form },
    }
    expect(visualWindow(fourteenth)).not.toEqual([...PICTURE_STAGE_IDS])
  })

  it("visual3_stage_keys_exist", () => {
    const arch = loadArch()
    expect(roadmapOrderGaps(arch)).toEqual([])
    expect(visualWindow(arch)).toEqual([...PICTURE_STAGE_IDS])
    const close = arch.roadmap_order.indexOf("visual_close")
    const v3close = arch.roadmap_order.indexOf("visual3_close")
    expect(arch.roadmap_order.slice(close + 1, v3close + 1)).toEqual([...VISUAL3_STAGE_IDS])
    for (const id of VISUAL3_STAGE_IDS) {
      expect(PRIOR_PHASE.has(id)).toBe(false)
      expect((VISUAL_STAGE_IDS as readonly string[]).includes(id)).toBe(false)
      const stage = arch.roadmap[id]
      expect(stage, id).toBeDefined()
      if (stage === undefined) continue
      expect(stageFieldGaps(stage), id).toEqual([])
      if (id === "visual3_form") {
        expect(stage.construction_tests ?? []).toEqual(["visual3_stage_keys_exist"])
      } else if (id === "visual3_engine") {
        expect(stage.construction_tests ?? []).toEqual([
          "visual3_island_from_legend",
          "visual3_orbit_from_pack",
          "visual3_no_gpu_stays",
        ])
      } else if (id === "visual3_assets") {
        expect(stage.construction_tests ?? []).toEqual([
          "visual3_heroes_by_building_id",
          "visual3_lod_lighter_than_high",
          "visual3_plant_on_lot",
        ])
      } else if (id === "visual3_light") {
        expect(stage.construction_tests ?? []).toEqual([
          "visual3_sun_from_city_time",
          "visual3_windows_emissive",
          "visual3_no_baked_sun",
        ])
      } else if (id === "visual3_input") {
        expect(stage.construction_tests ?? []).toEqual([
          "visual3_ray_hits_tile",
          "visual3_empty_opens_build",
          "visual3_hud_not_a_hole",
        ])
      } else if (id === "visual3_units") {
        expect(stage.construction_tests ?? []).toEqual([
          "visual3_walkers_from_pack",
          "visual3_units_billboard_or_mesh",
          "visual3_units_not_lootable",
        ])
      } else if (id === "visual3_world") {
        expect(stage.construction_tests ?? []).toEqual([
          "visual3_water_one_plane",
          "visual3_decor_instanced",
          "visual3_fill_light_no_physics",
        ])
      } else if (id === "visual3_close") {
        expect(stage.construction_tests ?? []).toEqual([
          "visual3_budgets_measured",
          "visual3_golden_frames_match",
        ])
      } else {
        expect(stage.construction_tests ?? [], id).toEqual([])
      }
    }
    const form = arch.roadmap["visual3_form"]
    expect(form).toBeDefined()
    if (form === undefined) return
    const dropped: ArchFile = {
      roadmap_order: arch.roadmap_order.filter((id) => id !== "visual3_form"),
      roadmap: Object.fromEntries(Object.entries(arch.roadmap).filter(([id]) => id !== "visual3_form")),
    }
    expect(visualWindow(dropped)).not.toEqual([...PICTURE_STAGE_IDS])
    const ghost: ArchFile = {
      roadmap_order: [
        ...arch.roadmap_order.slice(0, arch.roadmap_order.indexOf("visual_close") + 1),
        "ghost_v3",
        ...arch.roadmap_order.slice(arch.roadmap_order.indexOf("visual_close") + 1),
      ],
      roadmap: { ...arch.roadmap, ghost_v3: form },
    }
    expect(visualWindow(ghost)).not.toEqual([...PICTURE_STAGE_IDS])
  })

  it("scene_comes_from_pack", () => {
    const files = walkClientSrc()
    expect(files.length).toBeGreaterThan(0)
    let foundNeedle = false
    for (const file of files) {
      expect(SCENE_JSON_URL_RE.test(file.text), file.rel).toBe(false)
      if (file.text.includes(PACK_SCENE_NEEDLE)) foundNeedle = true
    }
    expect(foundNeedle).toBe(true)
    const ghost = 'import sceneUrl from "./scene.json?url"\n'
    expect(SCENE_JSON_URL_RE.test(ghost)).toBe(true)
    const packPath = join(repo, "content/out/pack.json")
    expect(existsSync(packPath)).toBe(true)
    const pack = JSON.parse(readFileSync(packPath, "utf8")) as PackFile
    const scene = pack.generated?.placement?.scene
    const stored = pack.generated?.placement?.layout_hash ?? ""
    expect(scene).toBeDefined()
    expect(typeof scene).toBe("object")
    expect(stored.length).toBe(64)
  })

  it("code_phase_rule_still_single", () => {
    const dir = join(repo, ".cursor/rules")
    expect(existsSync(join(dir, "visual-phase.mdc"))).toBe(false)
    const rules = loadRules(dir)
    expect(phaseAlwaysNames(rules)).toEqual(["code-phase.mdc"])
    const phase = rules.find((meta) => meta.name === "code-phase.mdc")
    expect(phase).toBeDefined()
    if (phase === undefined) return
    expect(phase.description.includes("V0")).toBe(true)
    expect(phase.description.includes("V12")).toBe(true)
    expect(phase.body.includes("V0")).toBe(true)
    expect(phase.body.includes("V12")).toBe(true)
    expect(phase.body.includes("V3-0")).toBe(true)
    expect(phase.body.includes("V3-7")).toBe(true)
    const ghost: MdcMeta = {
      name: "visual-phase.mdc",
      alwaysApply: true,
      description: "Фаза картинки V0–V12",
      body: "",
    }
    expect(isPhaseRule(ghost)).toBe(true)
    expect(phaseAlwaysNames([...rules, ghost])).not.toEqual(["code-phase.mdc"])
  })

  it("missions_stay_stubbed", () => {
    const screens = loadJson<ScreensFile>("content/params/screens.json")
    expect(screens.params?.["missions_live"]?.v).toBe(0)
    const start = screens.actions?.["missions_start"]
    expect(start?.effect).toBe("commit:noop")
    expect(start?.requires ?? []).toContain("v1_feature")
    expect(start?.spend).toBe("none")
    expect(start?.v1).toBe("stub")
    const live = { v: 1 }
    expect(live.v === 0).toBe(false)
  })

  it("visual_flag_inventory_holds", () => {
    expect(existsSync(join(repo, "content/params/companion.json"))).toBe(false)
    const screens = loadJson<ParamFile>("content/params/screens.json")
    expect(screens.params?.["missions_live"]?.v).toBe(0)
    const meta = loadJson<ParamFile>("content/params/meta.json")
    expect(meta.params?.["window_a_ratified"]?.v).toBe(1)
    const seasons = loadJson<ParamFile>("content/params/seasons.json")
    expect(seasons.params?.["season_prizes_live"]?.v).toBe(1)
    expect(seasons.params?.["prize_nft_share_bps"]?.v).toBe(0)
    const fragments = loadJson<ParamFile>("content/params/fragments.json")
    expect(fragments.params?.["fragment_nft_share_bps"]?.v).toBe(0)
    const render = loadJson<ParamFile>("content/params/render.json")
    expect(render.params?.["visual3_frame_live"]?.v).toBe(1)
    const flipped = { v: 0 }
    expect(flipped.v === 1).toBe(false)
  })
})
