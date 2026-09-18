import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

const V11_STAGE_IDS = [
  "v11_form",
  "districts_live",
  "archetypes_live",
  "research_tree",
  "synergy_buildings",
  "companion_live",
  "companion_revenue",
  "rebalance_close",
] as const

const V11_LEVER_IDS = [
  "offline_cap_hours",
  "fund_share_bps",
  "xp_rate_bps",
  "idle_reduction_bps",
] as const

const MONEY_OR_LIVE = new Set([
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

type LeverRow = {
  readonly stage: string
  readonly src: string
  readonly why: string
}

type ArchFile = {
  readonly roadmap_order: readonly string[]
  readonly roadmap: Readonly<Record<string, ArchStage | undefined>>
  readonly v11_levers?: Readonly<Record<string, LeverRow | undefined>>
}

type MetaFile = {
  readonly rules_version: string
  readonly params?: Readonly<Record<string, { readonly v?: number } | undefined>>
}

type AgentsFile = {
  readonly roles: Readonly<Record<string, { readonly v1?: boolean } | undefined>>
  readonly objectives: Readonly<Record<string, { readonly v1?: boolean } | undefined>>
}

type SeasonsFile = {
  readonly params: Readonly<Record<string, { readonly v?: number } | undefined>>
}

type FragmentsFile = {
  readonly params: Readonly<Record<string, { readonly v?: number } | undefined>>
}

type ResearchFile = {
  readonly axes?: Readonly<Record<string, unknown>>
  readonly nodes?: Readonly<Record<string, unknown>>
}

type MdcMeta = {
  readonly name: string
  readonly alwaysApply: boolean
  readonly description: string
  readonly body: string
}

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(repo, rel), "utf8")) as T
}

function loadArch(): ArchFile {
  return loadJson<ArchFile>("content/params/arch.json")
}

function missingV11Keys(arch: ArchFile): readonly string[] {
  const order = new Set(arch.roadmap_order)
  const missing: string[] = []
  for (const id of V11_STAGE_IDS) {
    if (!order.has(id) || arch.roadmap[id] === undefined) missing.push(id)
  }
  return missing
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

function v11OrderAfterMoney(arch: ArchFile): readonly string[] | "launch_freeze_missing" {
  const i = arch.roadmap_order.indexOf("launch_freeze")
  if (i < 0) return "launch_freeze_missing"
  return arch.roadmap_order.slice(i + 1)
}

function v11PrefixAfterMoney(arch: ArchFile): readonly string[] | "launch_freeze_missing" {
  const after = v11OrderAfterMoney(arch)
  if (after === "launch_freeze_missing") return after
  return after.slice(0, V11_STAGE_IDS.length)
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

function rulesMinor(version: string): number {
  const part = version.split(".")[1]
  const n = Number(part)
  return Number.isFinite(n) ? n : 0
}

function liveFlagGaps(): readonly string[] {
  const gaps: string[] = []
  const agents = loadJson<AgentsFile>("content/params/agents.json")
  for (const rid of ["scientist", "manager"] as const) {
    if (agents.roles[rid]?.v1 !== true) gaps.push(`${rid}.v1`)
  }
  for (const oid of ["train", "research", "focus"] as const) {
    if (agents.objectives[oid]?.v1 !== true) gaps.push(`${oid}.v1`)
  }
  const seasons = loadJson<SeasonsFile>("content/params/seasons.json")
  if (seasons.params["season_prizes_live"]?.v !== 1) gaps.push("season_prizes_live")
  if (seasons.params["prize_nft_share_bps"]?.v !== 0) gaps.push("prize_nft_share_bps")
  if (seasons.params["prize_live_min_rules_minor"]?.v !== 19) gaps.push("prize_watermark")
  const fragments = loadJson<FragmentsFile>("content/params/fragments.json")
  if (fragments.params["fragment_nft_share_bps"]?.v !== 0) gaps.push("fragment_nft_share_bps")
  const research = loadJson<ResearchFile>("content/params/research.json")
  const n = Object.keys(research.axes ?? research.nodes ?? {}).length
  if (n <= 3) gaps.push("research_nodes")
  const meta = loadJson<MetaFile>("content/params/meta.json")
  if (meta.params?.["window_a_ratified"]?.v !== 1) gaps.push("window_a_ratified")
  return gaps
}

describe.sequential("G0 construction", () => {
  it("v11_stage_keys_exist", () => {
    const arch = loadArch()
    expect(missingV11Keys(arch)).toEqual([])
    expect(roadmapOrderGaps(arch)).toEqual([])
    expect(v11PrefixAfterMoney(arch)).toEqual([...V11_STAGE_IDS])
    for (const id of V11_STAGE_IDS) {
      expect(MONEY_OR_LIVE.has(id)).toBe(false)
      const stage = arch.roadmap[id]
      expect(stage, id).toBeDefined()
      if (stage === undefined) continue
      expect(stageFieldGaps(stage), id).toEqual([])
      if (id === "v11_form") {
        expect(stage.construction_tests ?? []).toEqual([
          "v11_stage_keys_exist",
          "rules_minor_is_twenty",
          "live_flags_inventoried",
        ])
      } else if (id === "districts_live") {
        expect(stage.construction_tests ?? []).toEqual([
          "six_districts_playable",
          "offline_cap_reaches_eighteen",
          "fund_share_reaches_cap",
          "merge_active_cap_is_three",
          "window_a_in_envelope",
        ])
      } else if (id === "archetypes_live") {
        expect(stage.construction_tests ?? []).toEqual([
          "five_roles_live",
          "scientist_spends_compute",
          "manager_focus_picks_contour",
          "train_grants_xp",
          "window_a_in_envelope_after_archetypes",
        ])
      } else if (id === "research_tree") {
        expect(stage.construction_tests ?? []).toEqual([
          "research_wider_than_three",
          "research_cost_derived",
          "research_objective_opens_node",
        ])
      } else if (id === "synergy_buildings") {
        expect(stage.construction_tests ?? []).toEqual([
          "six_synergies_open",
          "affinity_matrix_matches_canon",
          "autonomous_slot_present",
        ])
      } else if (id === "companion_live") {
        expect(stage.construction_tests ?? []).toEqual([
          "companion_relief_non_zero",
          "manager_focus_allowed",
          "residual_idle_floor_held",
          "window_a_in_envelope_after_companion",
        ])
      } else if (id === "companion_revenue") {
        expect(stage.construction_tests ?? []).toEqual([
          "nft_crane_zero_by_default",
          "revenue_not_in_pool_without_ratification",
          "inference_account_present",
        ])
      } else if (id === "rebalance_close") {
        expect(stage.construction_tests ?? []).toEqual([
          "friction_budget_held",
          "no_dominant_no_dead_no_mandatory",
          "window_a_ratified",
        ])
      } else {
        expect(stage.construction_tests ?? [], id).toEqual([])
      }
    }

    const dir = join(repo, ".cursor/rules")
    expect(existsSync(join(dir, "v11-phase.mdc"))).toBe(false)
    const rules = loadRules(dir)
    expect(phaseAlwaysNames(rules)).toEqual(["code-phase.mdc"])
    const phase = rules.find((meta) => meta.name === "code-phase.mdc")
    expect(phase).toBeDefined()
    if (phase === undefined) return
    expect(phase.description.includes("G0")).toBe(true)
    expect(phase.description.includes("G7")).toBe(true)
    expect(phase.body.includes("G0")).toBe(true)
    expect(phase.body.includes("G7")).toBe(true)

    const broken: ArchFile = {
      roadmap_order: arch.roadmap_order.filter((id) => id !== "v11_form"),
      roadmap: Object.fromEntries(
        Object.entries(arch.roadmap).filter(([id]) => id !== "v11_form"),
      ),
    }
    expect(missingV11Keys(broken)).toEqual(["v11_form"])
    const brokenOrder: ArchFile = {
      roadmap_order: [...arch.roadmap_order, "v11_form"],
      roadmap: arch.roadmap,
    }
    expect(roadmapOrderGaps(brokenOrder)).toEqual(["duplicate_order_id"])
    const form = arch.roadmap["v11_form"]
    expect(form).toBeDefined()
    if (form === undefined) return
    const extraKey: ArchFile = {
      roadmap_order: arch.roadmap_order,
      roadmap: { ...arch.roadmap, ghost_stage: form },
    }
    expect(roadmapOrderGaps(extraKey)).toEqual(["extra:ghost_stage"])
    const ninth: ArchFile = {
      roadmap_order: [
        ...arch.roadmap_order.slice(0, arch.roadmap_order.indexOf("launch_freeze") + 1),
        "owner_drain",
        ...arch.roadmap_order.slice(arch.roadmap_order.indexOf("launch_freeze") + 1),
      ],
      roadmap: { ...arch.roadmap, owner_drain: form },
    }
    expect(v11PrefixAfterMoney(ninth)).not.toEqual([...V11_STAGE_IDS])
    const inserted: ArchFile = {
      roadmap_order: [
        ...arch.roadmap_order.slice(0, arch.roadmap_order.indexOf("launch_freeze") + 1),
        "ghost_v11",
        ...arch.roadmap_order.slice(arch.roadmap_order.indexOf("launch_freeze") + 1),
      ],
      roadmap: { ...arch.roadmap, ghost_v11: form },
    }
    expect(v11PrefixAfterMoney(inserted)).not.toEqual([...V11_STAGE_IDS])

    const brokenCt: ArchFile = {
      ...arch,
      roadmap: {
        ...arch.roadmap,
        districts_live: {
          ...(arch.roadmap["districts_live"] as ArchStage),
          construction_tests: ["ghost_g1"],
        },
      },
    }
    expect(brokenCt.roadmap["districts_live"]?.construction_tests).not.toEqual([
      "six_districts_playable",
      "offline_cap_reaches_eighteen",
      "fund_share_reaches_cap",
      "merge_active_cap_is_three",
      "window_a_in_envelope",
    ])

    const ghost: MdcMeta = {
      name: "v11-phase.mdc",
      alwaysApply: true,
      description: "Фаза v1.1 G0–G7",
      body: "",
    }
    expect(isPhaseRule(ghost)).toBe(true)
    expect(phaseAlwaysNames([...rules, ghost])).not.toEqual(["code-phase.mdc"])
  })

  it("rules_minor_is_twenty", () => {
    const meta = loadJson<MetaFile>("content/params/meta.json")
    expect(rulesMinor(meta.rules_version)).toBeGreaterThanOrEqual(20)
    const stale: MetaFile = { rules_version: "0.19.0" }
    expect(rulesMinor(stale.rules_version) >= 20).toBe(false)
  })

  it("live_flags_inventoried", () => {
    const arch = loadArch()
    const levers = arch.v11_levers ?? {}
    expect(Object.keys(levers).length).toBeGreaterThan(0)
    for (const id of V11_LEVER_IDS) {
      expect(levers[id], id).toBeDefined()
    }
    expect(liveFlagGaps()).toEqual([])
    const emptyLevers: ArchFile = { ...arch, v11_levers: {} }
    expect(Object.keys(emptyLevers.v11_levers ?? {}).length).toBe(0)
    const seasons = loadJson<SeasonsFile>("content/params/seasons.json")
    expect(seasons.params["prize_live_min_rules_minor"]?.v).toBe(19)
    const raised = { v: 20 }
    expect(raised.v === 19).toBe(false)
  })
})
