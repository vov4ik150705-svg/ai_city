import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

const ISLAND_STAGE_IDS = [
  "island_form",
  "island_terrain",
  "island_ground",
  "island_decor",
  "island_light",
  "island_compose",
  "island_anchors",
  "island_client",
  "island_close",
] as const

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
  "visual3_form",
  "visual3_engine",
  "visual3_assets",
  "visual3_light",
  "visual3_input",
  "visual3_units",
  "visual3_world",
  "visual3_close",
])

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

function loadArch(): ArchFile {
  return JSON.parse(readFileSync(join(repo, "content/params/arch.json"), "utf8")) as ArchFile
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

function islandWindow(arch: ArchFile): readonly string[] | "visual3_close_missing" | "mainnet_launch_missing" {
  const i = arch.roadmap_order.indexOf("visual3_close")
  const j = arch.roadmap_order.indexOf("mainnet_launch")
  if (i < 0) return "visual3_close_missing"
  if (j < 0) return "mainnet_launch_missing"
  return arch.roadmap_order.slice(i + 1, j)
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

describe.sequential("I0 construction", () => {
  it("island_stage_keys_exist", () => {
    const arch = loadArch()
    expect(roadmapOrderGaps(arch)).toEqual([])
    expect(islandWindow(arch)).toEqual([...ISLAND_STAGE_IDS])
    for (const id of ISLAND_STAGE_IDS) {
      expect(PRIOR_PHASE.has(id)).toBe(false)
      const stage = arch.roadmap[id]
      expect(stage, id).toBeDefined()
      if (stage === undefined) continue
      expect(stageFieldGaps(stage), id).toEqual([])
      if (id === "island_form") {
        expect(stage.construction_tests ?? []).toEqual(["island_stage_keys_exist"])
      } else {
        expect(stage.construction_tests ?? [], id).toEqual([])
      }
    }

    const form = arch.roadmap["island_form"]
    expect(form).toBeDefined()
    if (form === undefined) return
    const dropped: ArchFile = {
      roadmap_order: arch.roadmap_order.filter((id) => id !== "island_form"),
      roadmap: Object.fromEntries(Object.entries(arch.roadmap).filter(([id]) => id !== "island_form")),
    }
    expect(islandWindow(dropped)).not.toEqual([...ISLAND_STAGE_IDS])
    const ghost: ArchFile = {
      roadmap_order: [
        ...arch.roadmap_order.slice(0, arch.roadmap_order.indexOf("visual3_close") + 1),
        "ghost_island",
        ...arch.roadmap_order.slice(arch.roadmap_order.indexOf("visual3_close") + 1),
      ],
      roadmap: { ...arch.roadmap, ghost_island: form },
    }
    expect(islandWindow(ghost)).not.toEqual([...ISLAND_STAGE_IDS])
  })
})
