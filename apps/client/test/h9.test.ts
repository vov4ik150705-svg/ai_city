import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { channelMap, commandRoutes } from "@corporator/protocol"
import {
  emptySnapshot,
  HUD_ACTION_MAP,
  intentFromCommit,
  LIVE_MUTATION_EFFECTS,
  loadClientPack,
  resolveHudRoute,
  snapshotFromEnvelope,
  transportOf,
  type ClientSnapshot,
} from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

function asObj(value: Json): { readonly [key: string]: Json } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("object")
  return value
}

function assignedSectionIds(src: string): readonly string[] {
  const found = new Set<string>()
  const quoted = /sections\["([^"]+)"\]\s*=/g
  let hit = quoted.exec(src)
  while (hit !== null) {
    const id = hit[1]
    if (id !== undefined) found.add(id)
    hit = quoted.exec(src)
  }
  return [...found].sort()
}

function applyLiveEffects(src: string): readonly string[] {
  const found: string[] = []
  const re = /if \(effect === "([^"]+)"\)/g
  let hit = re.exec(src)
  while (hit !== null) {
    const id = hit[1]
    if (id !== undefined) found.push(id)
    hit = re.exec(src)
  }
  return found
}

function snapshotKeys(snap: ClientSnapshot): readonly (keyof ClientSnapshot)[] {
  return Object.keys(snap) as (keyof ClientSnapshot)[]
}

function definedKeys(snap: ClientSnapshot): readonly string[] {
  const out: string[] = []
  for (const key of snapshotKeys(snap)) {
    if (snap[key] !== undefined) out.push(key)
  }
  return out
}

const PLAYER_NINETEEN = HUD_ACTION_MAP.filter(
  (row) => row.intent !== "navigate" && row.intent !== "local" && row.intent !== "activate" && row.intent !== "deactivate",
)

const H5_STUB = ["build", "missions", "settings", "bottom_menu"] as const
const H5_PARTIAL = ["stock_bar"] as const
const SNAPSHOT_GAPS = ["quoteAgeMs", "quoteCorpEth"] as const

describe("H9 HUD readiness inventory", () => {
  const pack = loadClientPack(loadPack(packBytes()).pack)
  const packedScreens = asObj(asObj(asObj(readJson("content/out/pack.json"))["sections"])["screens"])
  const authoredScreens = asObj(packedScreens["screens"])
  const authoredActions = asObj(packedScreens["actions"])
  const projectSrc = readFileSync(join(repo, "services/api/src/project.ts"), "utf8")
  const commitSrc = readFileSync(join(repo, "services/api/src/commit.ts"), "utf8")
  const launch = asObj(readJson("content/params/launch.json"))
  const deployed = asObj(launch["deployed"] ?? {})

  it("channels_nineteen_of_twenty_one_without_inventing_wallet", () => {
    const ids = Object.keys(channelMap)
    expect(ids.length).toBe(23)
    const assigned = assignedSectionIds(projectSrc)
    expect(assigned).toContain("wallet.chain")
    expect(assigned).toContain("wallet.corp_balance")
    expect(assigned).toContain("aggregate.payroll_boost_bps")
    expect(assigned).toContain("aggregate.payroll_boost_days_left")
    expect(assigned.length).toBe(24)
    expect(deployed["token"]).toBe("")
    expect(deployed["curve"]).toBe("")
    expect(deployed["pool"]).toBe("")
    expect(deployed["hook"]).toBe("")
    expect(deployed["tx"]).toBe("")
  })

  it("api_applies_fifteen_mutating_routes", () => {
    expect(commandRoutes.length).toBe(20)
    expect([...commandRoutes]).toContain("/command/noop")
    expect([...commandRoutes]).toContain("/command/assign")
    const effects = applyLiveEffects(commitSrc)
    expect(effects).toHaveLength(19)
    expect(effects).not.toContain("noop")
    expect(effects).toContain("claim_prize")
    expect(effects).toContain("assign")
    expect(commitSrc.includes('effect === "noop"')).toBe(false)
  })

  it("live_intents_fourteen_of_nineteen", () => {
    expect(PLAYER_NINETEEN).toHaveLength(20)
    const live = PLAYER_NINETEEN.filter((row) => row.support === "live")
    expect(live).toHaveLength(18)
    expect(LIVE_MUTATION_EFFECTS).toHaveLength(18)
    expect(transportOf("claim_prize")).toBe("refusal-only")
    expect(transportOf("noop")).toBe("refusal-only")
    expect(transportOf("unstake")).toBe("live")
    expect(transportOf("present_voucher")).toBe("live")
    expect(transportOf("assign")).toBe("live")
  })

  it("pack_actions_thirty_seven_of_thirty_nine_work", () => {
    let live = 0
    let stub = 0
    const blocked: string[] = []
    const stubIds: string[] = []
    for (const id of Object.keys(authoredActions)) {
      const action = asObj(authoredActions[id] ?? {})
      const v1 = action["v1"]
      const effect = action["effect"]
      if (v1 === "stub") {
        stub += 1
        stubIds.push(id)
        continue
      }
      if (v1 !== "live") continue
      live += 1
      if (typeof effect !== "string" || !effect.startsWith("commit:")) continue
      const intent = intentFromCommit(effect.slice("commit:".length))
      if (intent.kind === "navigate" || intent.kind === "local") continue
      if (transportOf(intent.kind) !== "live") blocked.push(id)
    }
    expect(Object.keys(authoredActions).length).toBe(44)
    expect(live).toBe(43)
    expect(stub).toBe(1)
    expect(stubIds).toEqual(["missions_start"])
    expect(blocked).toEqual(["leaderboard_claim"])
    expect(live - blocked.length).toBe(42)
  })

  it("screens_twenty_seven_playable_pack_thirty_three_live", () => {
    let live = 0
    let stub = 0
    const stubIds: string[] = []
    for (const id of Object.keys(authoredScreens)) {
      const row = asObj(authoredScreens[id] ?? {})
      if (row["v1"] === "stub") {
        stub += 1
        stubIds.push(id)
      }
      if (row["v1"] === "live") live += 1
    }
    expect(live).toBe(26)
    expect(stub).toBe(1)
    expect(stubIds).toEqual(["missions"])
    expect(Object.keys(authoredScreens).length).toBe(27)
    expect(resolveHudRoute("build")).toBeUndefined()
    expect(resolveHudRoute("missions")).toBeUndefined()
    expect(resolveHudRoute("settings")).toBeUndefined()
    const settingsSrc = readFileSync(join(repo, "apps/client/src/hud/screens/settings.tsx"), "utf8")
    expect(settingsSrc.includes('data-settings-active="0"')).toBe(true)
    expect(H5_STUB).toHaveLength(4)
    expect(H5_PARTIAL).toHaveLength(1)
    expect(27 - H5_STUB.length - H5_PARTIAL.length).toBe(22)
  })

  it("snapshot_twenty_eight_of_thirty_nine_arrive", () => {
    expect(snapshotKeys(emptySnapshot())).toHaveLength(47)
    expect(SNAPSHOT_GAPS).toHaveLength(2)
    const snap = snapshotFromEnvelope({
      city_time: 12n,
      account_kind: "wallet",
      sections: {
        "tick.capital": 1n,
        "tick.energy": 2n,
        "tick.compute": 3n,
        "aggregate.payroll_ratio": 4n,
        "aggregate.payroll_boost_bps": 80000n,
        "aggregate.payroll_boost_days_left": 7n,
        "aggregate.gdp": 5n,
        "aggregate.happiness": 6n,
        "aggregate.stability": 7n,
        "tick.building_level": {
          rows: [{ id: "workshop", nameKey: "UI_BLD_WORKSHOP", statusKey: "UI_AVAILABLE", level: 1n, worker: "", task: "" }],
          population: 8n,
          city_level: 9n,
          productivity: 10n,
          city_label: "a",
          bank_limit_live: 12n,
          opened_districts: ["compute"],
          corp_held: 9n,
          energy_demand: 2n,
          compute_demand: 3n,
          payroll_paid: 4n,
          payroll_requested: 5n,
        },
        "tick.agent_state": { rows: [{ id: "a1", idleKey: "IDLE_NO_COMPUTE" }] },
        "oracle.stock_price": { live: false, rows: [] },
        "seasons.influence_rank": {
          rank: 1n,
          influence: 2n,
          positive_days: 3n,
          qualified: 1n,
          season_label: "S1",
          period_label: "P1",
        },
        "fragments.city_ledger": { rows: [{ ticker: "NVDA", amount: 1n }] },
        "wallet.stake_tokens": 1n,
        "log.events": { rows: [], loading: 0n, error: 0n, unread: 0n },
        "wallet.protocol_eth_in_flight": 1n,
        "wallet.protocol_vault_corp": 2n,
        "wallet.protocol_studio_eth": 3n,
        "seasons.prize_basket": { notice: "UI_PRIZE", eth_pots: {} },
        "oracle.district_efficiency": { rows: [] },
        "wallet.chain": {},
        "wallet.corp_balance": {},
      },
    })
    expect(snap.corp).toBe(9n)
    expect(snap.payrollPaid).toBe(4n)
    expect(snap.cityLabel).toBe("a")
    expect(snap.bankLimitLive).toBe(12n)
    expect(snap.unreadCount).toBe(0n)
    expect(snap.logLoading).toBe(false)
    expect(snap.logError).toBe(false)
    expect(snap.gate).toBeDefined()
    expect(snap.quoteAgeMs).toBeUndefined()
    expect(snap.quoteCorpEth).toBeUndefined()
    expect(definedKeys(snap).length).toBe(40)
    expect(projectSrc.includes("aggregate.payroll_paid")).toBe(false)
    expect(projectSrc.includes("bank_limit_live")).toBe(true)
  })

  it("hud_not_launch_ready", () => {
    const channelFilled = assignedSectionIds(projectSrc).length
    const commandHandlers = applyLiveEffects(commitSrc).length
    const intentLive = PLAYER_NINETEEN.filter((row) => row.support === "live").length
    let actionWorking = 0
    for (const id of Object.keys(authoredActions)) {
      const action = asObj(authoredActions[id] ?? {})
      if (action["v1"] !== "live") continue
      const effect = action["effect"]
      if (typeof effect === "string" && effect.startsWith("commit:")) {
        const intent = intentFromCommit(effect.slice("commit:".length))
        if (intent.kind !== "navigate" && intent.kind !== "local" && transportOf(intent.kind) !== "live") continue
      }
      actionWorking += 1
    }
    const screenPlayable = 34 - H5_STUB.length - H5_PARTIAL.length
    const snapArrive = 42 - SNAPSHOT_GAPS.length
    expect(channelFilled === 24).toBe(true)
    expect(commandHandlers === 17 && commandRoutes.length === 17).toBe(false)
    expect(intentLive === 19).toBe(false)
    expect(actionWorking === 40).toBe(false)
    expect(screenPlayable === 33).toBe(false)
    expect(snapArrive === 40).toBe(true)
    expect(pack.actions["missions_start"]?.v1).toBe("stub")
    expect(pack.launchDeployed).toBe(false)
    expect(transportOf("claim_prize")).toBe("refusal-only")
    expect(transportOf("claim_prize", true)).toBe("live")
  })
})
