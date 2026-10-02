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

const ISLAND_FORM_CONSTRUCTION = ["island_stage_keys_exist"] as const

/** Exact L268 / arch.json island_client.construction_tests names (LOOK Vitest it()). */
const ISLAND_CLIENT_CONSTRUCTION = [
  "applies full translation including Y and forces scale 1",
  "collectAnchors reads world pose and ignores local parent offset",
  "fits island width into 72-86% at 1920x1080 and 1366x768",
  "pulls back when City Hall is raised so the spire stays in the frustum",
  "review occupancy is 18 studio assets and warehouse pack_id stays empty",
  "lookOrbitLimits max is the packed multiple of studio radius",
  "wheel zoom is multiplicative, not a 1 m step",
  "MeshoptDecoder missing is a visible error, not a silent ready",
  "parity check fails on a different exposure",
  "SkyDome and clouds classify as unlit categories",
  "projected width fill is the camera-fit number, not a copied ceiling",
  "hides the offset at the far zoom and shows it at the near zoom",
  "stays fully on the point at the home distance and fades only while pulling out",
  "keeps a partial offset between the stops",
  "stays centred past the far stop and fully slid inside the near stop",
  "returns 0 instead of NaN when the zoom band is empty or the distance is not finite",
  "pulls a point outside the island back onto the bound",
  "leaves an interior point where it is",
  "still clamps when the box corners are swapped",
  "moves the view with the drag along azimuth 0",
  "returns a zero move when the view has no size or no distance",
  "dollies in only when the slide is fully hidden",
  "does not invent a distance when the near stop is missing",
  "moves part of the gap instead of snapping",
  "holds on a zero frame so the first tick does not jump",
  "takes the short way around a wrapped azimuth",
  "snaps when the coast time is zero",
  "district look keeps the planted orbit",
  "opening a district does not republish the orbit",
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
        expect(stage.construction_tests ?? []).toEqual([...ISLAND_FORM_CONSTRUCTION])
      } else if (id === "island_client") {
        expect(stage.construction_tests ?? [], id).toEqual([...ISLAND_CLIENT_CONSTRUCTION])
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
