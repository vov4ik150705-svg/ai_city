import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

const LIVE_STAGE_IDS = [
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
] as const

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

function loadArch(): ArchFile {
  return JSON.parse(readFileSync(join(repo, "content/params/arch.json"), "utf8")) as ArchFile
}

function missingLiveKeys(arch: ArchFile): readonly string[] {
  const order = new Set(arch.roadmap_order)
  const missing: string[] = []
  for (const id of LIVE_STAGE_IDS) {
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

describe.sequential("L0 construction", () => {
  it("live_stage_keys_exist", () => {
    const arch = loadArch()
    expect(missingLiveKeys(arch)).toEqual([])
    expect(roadmapOrderGaps(arch)).toEqual([])
    for (const id of LIVE_STAGE_IDS) {
      const stage = arch.roadmap[id]
      expect(stage, id).toBeDefined()
      if (stage === undefined) continue
      expect(stageFieldGaps(stage), id).toEqual([])
    }
    expect(arch.roadmap["art_ground"]?.construction_tests ?? []).toEqual([])
    expect(arch.roadmap["live_form"]?.construction_tests ?? []).toEqual([
      "live_stage_keys_exist",
      "code_phase_rule_not_always",
    ])

    const broken: ArchFile = {
      roadmap_order: arch.roadmap_order.filter((id) => id !== "live_form"),
      roadmap: Object.fromEntries(
        Object.entries(arch.roadmap).filter(([id]) => id !== "live_form"),
      ),
    }
    expect(missingLiveKeys(broken)).toEqual(["live_form"])
    const brokenOrder: ArchFile = {
      roadmap_order: [...arch.roadmap_order, "live_form"],
      roadmap: arch.roadmap,
    }
    expect(roadmapOrderGaps(brokenOrder)).toEqual(["duplicate_order_id"])
    const live = arch.roadmap["live_form"]
    expect(live).toBeDefined()
    if (live === undefined) return
    const extraKey: ArchFile = {
      roadmap_order: arch.roadmap_order,
      roadmap: { ...arch.roadmap, ghost_stage: live },
    }
    expect(roadmapOrderGaps(extraKey)).toEqual(["extra:ghost_stage"])
  })

  it("code_phase_rule_not_always", () => {
    const dir = join(repo, ".cursor/rules")
    expect(existsSync(join(dir, "live-phase.mdc"))).toBe(false)
    const rules = loadRules(dir)
    expect(phaseAlwaysNames(rules)).toEqual(["code-phase.mdc"])
    const phase = rules.find((meta) => meta.name === "code-phase.mdc")
    expect(phase).toBeDefined()
    if (phase === undefined) return
    expect(phase.body.includes("L0")).toBe(true)
    expect(phase.body.includes("L9")).toBe(true)

    const ghost: MdcMeta = {
      name: "live-phase.mdc",
      alwaysApply: true,
      description: "Живая фаза L0–L9",
      body: "",
    }
    expect(isPhaseRule(ghost)).toBe(true)
    expect(phaseAlwaysNames([...rules, ghost])).not.toEqual(["code-phase.mdc"])
  })
})
