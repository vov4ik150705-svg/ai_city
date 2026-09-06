import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

const MONEY_STAGE_IDS = [
  "money_form",
  "fee_split",
  "prize_period",
  "prize_basket",
  "basket_conveyor",
  "prize_treasury",
  "vault_safety",
  "prize_surface",
  "launch_freeze",
] as const

const DEPLOYED_KEYS = ["token", "curve", "pool", "hook", "tx"] as const

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

type LaunchFile = {
  readonly deployed: Readonly<Record<string, string | undefined>>
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

function loadLaunch(): LaunchFile {
  return JSON.parse(readFileSync(join(repo, "content/params/launch.json"), "utf8")) as LaunchFile
}

function missingMoneyKeys(arch: ArchFile): readonly string[] {
  const order = new Set(arch.roadmap_order)
  const missing: string[] = []
  for (const id of MONEY_STAGE_IDS) {
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

function moneyOrderAfterLaunch(arch: ArchFile): readonly string[] | "pons_launch_missing" {
  const i = arch.roadmap_order.indexOf("pons_launch")
  if (i < 0) return "pons_launch_missing"
  return arch.roadmap_order.slice(i + 1)
}

function moneyPrefixAfterLaunch(arch: ArchFile): readonly string[] {
  const after = moneyOrderAfterLaunch(arch)
  if (after === "pons_launch_missing") return []
  return after.slice(0, MONEY_STAGE_IDS.length)
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

function filledDeployed(launch: LaunchFile): readonly string[] {
  const deployed = launch.deployed
  return DEPLOYED_KEYS.filter((k) => (deployed[k] ?? "") !== "")
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
    meta.name === "release-phase.mdc"
  ) {
    return true
  }
  return /L0|C0|M0|G0|P0/.test(meta.description) && /фаза/i.test(meta.description)
}

function loadRules(dir: string): readonly MdcMeta[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".mdc"))
    .map((name) => parseMdc(name, readFileSync(join(dir, name), "utf8")))
}

function phaseAlwaysNames(rules: readonly MdcMeta[]): readonly string[] {
  return rules.filter((meta) => isPhaseRule(meta) && meta.alwaysApply).map((meta) => meta.name)
}

describe.sequential("M0 construction", () => {
  it("money_stage_keys_exist", () => {
    const arch = loadArch()
    expect(missingMoneyKeys(arch)).toEqual([])
    expect(roadmapOrderGaps(arch)).toEqual([])
    expect(moneyPrefixAfterLaunch(arch)).toEqual([...MONEY_STAGE_IDS])
    expect(arch.roadmap_order.includes("owner_drain")).toBe(false)
    expect(arch.roadmap["owner_drain"]).toBeUndefined()
    for (const id of MONEY_STAGE_IDS) {
      const stage = arch.roadmap[id]
      expect(stage, id).toBeDefined()
      if (stage === undefined) continue
      expect(stageFieldGaps(stage), id).toEqual([])
      if (id === "money_form") {
        expect(stage.construction_tests ?? []).toEqual([
          "money_stage_keys_exist",
          "launch_precondition_not_launched",
        ])
      } else if (id === "fee_split") {
        expect(stage.construction_tests ?? []).toEqual([
          "round_trip_after_tax_two_percent",
          "fund_tax_floor_holds",
          "dex_visible_fee_under_ceiling",
        ])
      } else if (id === "prize_period") {
        expect(stage.construction_tests ?? []).toEqual([
          "prize_period_divides_season",
          "influence_integral_per_period",
          "qualify_days_from_period",
        ])
      } else if (id === "prize_basket") {
        expect(stage.construction_tests ?? []).toEqual([
          "basket_covers_all_district_tickers",
          "per_asset_payout_within_pool",
          "prize_share_cap_binds_farm",
          "demo_takes_no_basket_asset",
        ])
      } else if (id === "basket_conveyor") {
        expect(stage.construction_tests ?? []).toEqual([
          "basket_uniform_budget_per_ticker",
          "thin_pool_throttles_not_reallocates",
          "basket_failure_does_not_block_tick",
          "basket_leg_floor_favours_fund",
        ])
      } else if (id === "prize_treasury") {
        expect(stage.construction_tests ?? []).toEqual([
          "vault_and_fund_not_drainable",
          "return_unsettled_skips_settled",
          "pool_in_is_measured_not_accumulated",
          "settled_claim_uncovered_is_reported",
        ])
      } else if (id === "vault_safety") {
        expect(stage.construction_tests ?? []).toEqual([
          "refund_player_capped_by_backing",
          "bot_refund_not_whole_vault",
          "guardian_not_signer",
          "recover_wrong_token_skips_own",
          "no_burn_reserve_rescue",
        ])
      } else if (id === "prize_surface") {
        expect(stage.construction_tests ?? []).toEqual([
          "leaderboard_shows_basket_composition",
          "drain_notice_visible_on_leaderboard",
          "claim_returns_every_asset",
        ])
      } else if (id === "launch_freeze") {
        expect(stage.construction_tests ?? []).toEqual([
          "pack_tax_equals_deploy_rate",
          "vitrine_under_factory_ceiling",
        ])
      } else {
        expect(stage.construction_tests ?? [], id).toEqual([])
      }
    }

    const dir = join(repo, ".cursor/rules")
    expect(existsSync(join(dir, "money-phase.mdc"))).toBe(false)
    const rules = loadRules(dir)
    expect(phaseAlwaysNames(rules)).toEqual(["code-phase.mdc"])
    const phase = rules.find((meta) => meta.name === "code-phase.mdc")
    expect(phase).toBeDefined()
    if (phase === undefined) return
    expect(phase.body.includes("M0")).toBe(true)
    expect(phase.body.includes("M7")).toBe(true)

    const broken: ArchFile = {
      roadmap_order: arch.roadmap_order.filter((id) => id !== "money_form"),
      roadmap: Object.fromEntries(
        Object.entries(arch.roadmap).filter(([id]) => id !== "money_form"),
      ),
    }
    expect(missingMoneyKeys(broken)).toEqual(["money_form"])
    const brokenOrder: ArchFile = {
      roadmap_order: [...arch.roadmap_order, "money_form"],
      roadmap: arch.roadmap,
    }
    expect(roadmapOrderGaps(brokenOrder)).toEqual(["duplicate_order_id"])
    const form = arch.roadmap["money_form"]
    expect(form).toBeDefined()
    if (form === undefined) return
    const extraKey: ArchFile = {
      roadmap_order: arch.roadmap_order,
      roadmap: { ...arch.roadmap, ghost_stage: form },
    }
    expect(roadmapOrderGaps(extraKey)).toEqual(["extra:ghost_stage"])
    const drain: ArchFile = {
      roadmap_order: [...arch.roadmap_order, "owner_drain"],
      roadmap: { ...arch.roadmap, owner_drain: form },
    }
    expect(drain.roadmap_order.includes("owner_drain")).toBe(true)
    expect(moneyPrefixAfterLaunch(drain)).toEqual([...MONEY_STAGE_IDS])
    const inserted: ArchFile = {
      roadmap_order: [
        ...arch.roadmap_order.slice(0, arch.roadmap_order.indexOf("pons_launch") + 1),
        "ghost_money",
        ...arch.roadmap_order.slice(arch.roadmap_order.indexOf("pons_launch") + 1),
      ],
      roadmap: { ...arch.roadmap, ghost_money: form },
    }
    expect(moneyOrderAfterLaunch(inserted)).not.toEqual([...MONEY_STAGE_IDS])

    const ghost: MdcMeta = {
      name: "money-phase.mdc",
      alwaysApply: true,
      description: "Денежная фаза M0–M7",
      body: "",
    }
    expect(isPhaseRule(ghost)).toBe(true)
    expect(phaseAlwaysNames([...rules, ghost])).not.toEqual(["code-phase.mdc"])
  })

  it("launch_precondition_not_launched", () => {
    const launch = loadLaunch()
    expect(filledDeployed(launch)).toEqual([])
    for (const k of DEPLOYED_KEYS) {
      expect(k in launch.deployed, k).toBe(true)
      expect(launch.deployed[k]).toBe("")
    }

    const partial: LaunchFile = {
      deployed: { ...launch.deployed, token: `0x${"11".repeat(20)}` },
    }
    expect(filledDeployed(partial)).toEqual(["token"])
    const addr = `0x${"11".repeat(20)}`
    const full: LaunchFile = {
      deployed: {
        token: addr,
        curve: addr,
        pool: addr,
        hook: addr,
        tx: `0x${"22".repeat(32)}`,
      },
    }
    expect(filledDeployed(full)).toEqual([...DEPLOYED_KEYS])
  })
})
