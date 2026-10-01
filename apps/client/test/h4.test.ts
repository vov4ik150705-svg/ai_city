import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import {
  buildHud,
  emptySnapshot,
  evaluateActionGate,
  loadClientPack,
  loadStringTable,
  type ClientSnapshot,
  type SnapshotGate,
} from "../src/index.ts"
import { ActionButton } from "../src/hud/parts/ActionButton.tsx"
import type { ScreenProps } from "../src/hud/parts/ScreenFrame.tsx"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

function nAgents(n: number): ClientSnapshot["agents"] {
  const out: { id: string; idleKey: string }[] = []
  for (let i = 0; i < n; i += 1) out.push({ id: `a${i}`, idleKey: "IDLE_NO_ENERGY" })
  return out
}

function nFunctions(n: number): NonNullable<ClientSnapshot["functions"]> {
  const out: { id: string; nameKey: string; statusKey: string }[] = []
  for (let i = 0; i < n; i += 1) out.push({ id: `f${i}`, nameKey: "UI_BLD_WORKSHOP", statusKey: "UI_AVAILABLE" })
  return out
}

describe("H4 evaluateActionGate", () => {
  const pack = loadClientPack(loadPack(packBytes()).pack)
  const strings = loadStringTable(readJson("content/strings/en.json"))

  function readyGate(over: Partial<SnapshotGate> = {}): SnapshotGate {
    return {
      openedDistricts: ["automation", "logistics", "finance"],
      chainWrong: false,
      stakeThresholdMet: true,
      tierUnlocked: true,
      stakeMultMet: true,
      nodeSideOpen: true,
      mergeFree: true,
      ...over,
    }
  }

  function ready(over: Partial<ClientSnapshot> = {}): ClientSnapshot {
    return {
      ...emptySnapshot(),
      accountKind: "wallet",
      capital: 10n,
      corp: 10n,
      cityLevel: 1n,
      cityTime: 12n,
      bankLimitLive: 12n,
      quoteLive: true,
      agents: [],
      functions: [],
      stake: 1n,
      influenceRank: { rank: 1n, influence: 1n, positiveDays: 1n, qualified: true },
      gate: readyGate(),
      ...over,
    }
  }

  function viewOf(snap: ClientSnapshot, demo = false) {
    return buildHud({ pack, strings, snapshot: snap, nowMs: 0n, firstLoginMs: 0n, demo })
  }

  function gateOf(
    actionId: string,
    snap: ClientSnapshot,
    extra: { readonly demo?: boolean; readonly failed?: ReadonlySet<string>; readonly lookId?: string } = {},
  ) {
    const action = pack.actions[actionId]
    expect(action).toBeDefined()
    if (action === undefined) throw new Error(actionId)
    return evaluateActionGate({
      pack,
      action,
      view: viewOf(snap, extra.demo === true),
      demo: extra.demo === true,
      extraFailed: extra.failed,
      ...(extra.lookId === undefined ? {} : { lookId: extra.lookId }),
    })
  }

  function propsOf(snap: ClientSnapshot, extra: { readonly demo?: boolean; readonly failed?: ReadonlySet<string> } = {}): ScreenProps {
    return {
      view: viewOf(snap, extra.demo === true),
      pack,
      strings,
      demo: extra.demo === true,
      failed: extra.failed ?? new Set(),
      loading: false,
      onClose: () => {},
      onNavigate: () => {},
      pendingCell: ".",
      pendingTileX: 1n,
      pendingTileY: 1n,
      onIntent: async () => {},
      onCommit: async () => {},
      moneyTxn: undefined,
      onMoneyTxn: () => {},
      onLocal: () => {},
    }
  }

  it("wallet", () => {
    const hit = gateOf("bank_deposit", ready({ accountKind: "demo" }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.WALLET_NOT_CONNECTED)
  })

  it("wallet_chain", () => {
    const hit = gateOf("wallet_confirm", ready({ gate: readyGate({ chainWrong: true }) }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.WALLET_WRONG_CHAIN)
  })

  it("not_demo_withdraw", () => {
    const hit = gateOf("bank_withdraw", ready(), { demo: true })
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.DEMO_NO_WITHDRAW)
  })

  it("not_demo_claim", () => {
    const hit = gateOf("district_claim_fragment", ready(), { demo: true })
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.DEMO_NO_CLAIM)
  })

  it("not_demo_prize", () => {
    const hit = gateOf("leaderboard_claim", ready(), { demo: true })
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.DEMO_NO_PRIZE)
  })

  it("v1_feature", () => {
    const hit = gateOf("menu_missions", ready())
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.FEATURE_NOT_IN_V1)
  })

  it("city_level", () => {
    const hit = gateOf("build_place", ready({ cityLevel: 0n }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.CITY_LEVEL_TOO_LOW)
  })

  it("build_tile", () => {
    const hit = gateOf("build_place", ready(), { failed: new Set(["build_tile"]) })
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.BUILD_TILE_ILLEGAL)
  })

  it("district_open", () => {
    const hit = gateOf("districts_select_finance", ready({ gate: readyGate({ openedDistricts: [] }) }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.DISTRICT_LOCKED)
  })

  it("stake_threshold", () => {
    const hit = gateOf("districts_open", ready({ gate: readyGate({ stakeThresholdMet: false }) }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.STAKE_BELOW_THRESHOLD)
    const rowHit = gateOf(
      "districts_open",
      ready({
        gate: readyGate({
          stakeThresholdMet: true,
          districts: [
            {
              id: "finance",
              ticker: "COIN",
              stake: 0n,
              tier: 0n,
              frozen: false,
              grace: false,
              stakeThresholdMet: false,
              stakeMultMet: true,
              tierUnlocked: true,
              nodeSideOpen: true,
              mergeFree: true,
            },
          ],
        }),
      }),
      { lookId: "finance" },
    )
    expect(rowHit.kind).toBe("blocked")
    if (rowHit.kind === "blocked") expect(rowHit.refusal.code).toBe(codes.STAKE_BELOW_THRESHOLD)
  })

  it("tier_unlocked", () => {
    const hit = gateOf("district_unlock_tier", ready({ gate: readyGate({ tierUnlocked: false }) }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.TIER_NOT_UNLOCKED)
  })

  it("stake_mult", () => {
    const hit = gateOf("district_stake_more", ready({ gate: readyGate({ stakeMultMet: false }) }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.STAKE_MULT_SHORT)
  })

  it("node_side", () => {
    const hit = gateOf("district_pick_node", ready({ gate: readyGate({ nodeSideOpen: false }) }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.NODE_SIDE_LOCKED)
  })

  it("merge_free", () => {
    const hit = gateOf("district_merge", ready({ gate: readyGate({ mergeFree: false }) }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.MERGE_MATCHING_BLOCKED)
  })

  it("season_qualified", () => {
    const hit = gateOf(
      "leaderboard_inspect",
      ready({ influenceRank: { rank: 1n, influence: 1n, positiveDays: 0n, qualified: false } }),
    )
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.PRIZE_NOT_QUALIFIED)
  })

  it("season_stake", () => {
    const hit = gateOf("leaderboard_stake_gate", ready({ stake: 0n }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.PRIZE_STAKE_REQUIRED)
  })

  it("build_slot", () => {
    const cap = pack.buildSlotsByLevel["1"]
    expect(cap).toBeDefined()
    if (cap === undefined || cap < 1n) return
    const hit = gateOf("build_place", ready({ functions: nFunctions(Number(cap)) }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.NO_FREE_BUILD_SLOT)
    const open = gateOf("build_place", ready({ functions: nFunctions(Number(cap) - 1) }))
    expect(open.kind).toBe("ok")
  })

  it("agent_slot", () => {
    const slots = pack.slotsAtCityLevel["1"]
    expect(slots).toBeDefined()
    if (slots === undefined) return
    const hit = gateOf("agents_hire", ready({ agents: nAgents(Number(slots)) }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.NO_FREE_AGENT_SLOT)
  })

  it("capital", () => {
    const hit = gateOf("building_upgrade", ready({ capital: 0n }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.NOT_ENOUGH_CAPITAL)
  })

  it("corp", () => {
    const hit = gateOf("bank_deposit", ready({ corp: 0n }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.NOT_ENOUGH_CORP)
  })

  it("bank_open", () => {
    const hit = gateOf("bank_withdraw", ready({ cityTime: 3n }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.BANK_CLOSED)
  })

  it("bank_weekday", () => {
    const sunday = 6n * pack.ticksDay + 12n
    const hit = gateOf("bank_withdraw", ready({ cityTime: sunday }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.BANK_SUNDAY)
    expect(hit.kind === "blocked" && hit.refusal.code === codes.BANK_CLOSED).toBe(false)
  })

  it("bank_limit", () => {
    const hit = gateOf("bank_withdraw", ready({ bankLimitLive: 0n }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.BANK_DAILY_LIMIT_REACHED)
  })

  it("hop_priced", () => {
    const hit = gateOf("exchange_buy", ready({ quoteLive: false }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") expect(hit.refusal.code).toBe(codes.EXCHANGE_HOP_UNAVAILABLE)
    const agedOut = gateOf("exchange_buy", ready({ quoteLive: true, quoteAgeMs: 0n }))
    expect(agedOut.kind).toBe("blocked")
    if (agedOut.kind === "blocked") expect(agedOut.refusal.code).toBe(codes.EXCHANGE_HOP_UNAVAILABLE)
  })

  it("building_hours_does_not_block", () => {
    expect(gateOf("agent_set_objective", ready()).kind).toBe("ok")
  })

  it("missing_corp_is_unavailable_not_cannot", () => {
    const hit = gateOf("exchange_buy", ready({ corp: undefined, quoteLive: false }))
    expect(hit.kind).toBe("missing")
    if (hit.kind === "missing") {
      expect(hit.token).toBe("corp")
      expect(hit.code).toBe("UI_UNAVAILABLE")
    }
  })

  it("missing_capital_is_unavailable_not_cannot", () => {
    const hit = gateOf("building_upgrade", ready({ capital: undefined }))
    expect(hit.kind).toBe("missing")
    if (hit.kind === "missing") expect(hit.token).toBe("capital")
  })

  it("missing_bank_limit_is_unavailable_not_cannot", () => {
    const hit = gateOf("bank_withdraw", ready({ bankLimitLive: undefined }))
    expect(hit.kind).toBe("missing")
    if (hit.kind === "missing") expect(hit.token).toBe("bank_limit")
  })

  it("missing_hop_is_unavailable_not_cannot", () => {
    const hit = gateOf("exchange_buy", ready({ quoteLive: undefined }))
    expect(hit.kind).toBe("missing")
    if (hit.kind === "missing") expect(hit.token).toBe("hop_priced")
  })

  it("missing_city_level_is_unavailable_not_cannot", () => {
    const hit = gateOf("build_place", ready({ cityLevel: undefined }))
    expect(hit.kind).toBe("missing")
    if (hit.kind === "missing") expect(hit.token).toBe("city_level")
  })

  it("missing_district_open_is_unavailable_not_cannot", () => {
    const hit = gateOf("districts_select_finance", ready({ gate: readyGate({ openedDistricts: undefined }) }))
    expect(hit.kind).toBe("missing")
    if (hit.kind === "missing") expect(hit.token).toBe("district_open")
  })

  it("pack_order_wallet_before_capital", () => {
    const hit = gateOf("bank_withdraw", ready({ accountKind: "demo", capital: 0n }))
    expect(hit.kind).toBe("blocked")
    if (hit.kind === "blocked") {
      expect(hit.refusal.code).toBe(codes.WALLET_NOT_CONNECTED)
      expect(hit.refusal.rest.includes(codes.NOT_ENOUGH_CAPITAL)).toBe(true)
    }
  })

  it("action_button_wires_gate_attrs", () => {
    const ok = renderToStaticMarkup(createElement(ActionButton, { ...propsOf(ready()), actionId: "bank_deposit" }))
    expect(ok.includes('data-gate="ok"')).toBe(true)
    expect(ok.includes('data-blocked="0"')).toBe(true)
    const miss = renderToStaticMarkup(
      createElement(ActionButton, { ...propsOf(ready({ corp: undefined })), actionId: "bank_deposit" }),
    )
    expect(miss.includes('data-gate="missing"')).toBe(true)
    expect(miss.includes('data-blocked="1"')).toBe(true)
    expect(miss.includes('data-blocked-code="UI_UNAVAILABLE"')).toBe(true)
    expect(miss.includes(codes.NOT_ENOUGH_CORP)).toBe(false)
    const blocked = renderToStaticMarkup(
      createElement(ActionButton, { ...propsOf(ready({ corp: 0n })), actionId: "bank_deposit" }),
    )
    expect(blocked.includes('data-gate="blocked"')).toBe(true)
    expect(blocked.includes(codes.NOT_ENOUGH_CORP)).toBe(true)
  })
})
