import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import {
  catchUp,
  encodeRecord,
  loadConfig,
  newState,
  spawnCity,
  tick,
} from "@corporator/engine"
import {
  buildHud,
  emptySnapshot,
  intentFromCommit,
  loadClientPack,
  loadStringTable,
  snapshotFromEnvelope,
  transportOf,
  type ClientSnapshot,
} from "../src/index.ts"
import { LeftRail } from "../src/hud/left/LeftRail.tsx"
import { Overview } from "../src/hud/left/Overview.tsx"
import { AgentsScreen } from "../src/hud/screens/agents.tsx"
import { BankScreen } from "../src/hud/screens/bank.tsx"
import { BuildingCardScreen } from "../src/hud/screens/building_card.tsx"
import { DistrictCardScreen } from "../src/hud/screens/district_card.tsx"
import { LeaderboardScreen } from "../src/hud/screens/leaderboard.tsx"
import { reviewTxn } from "../src/hud/uiState.ts"
import type { ScreenProps } from "../src/hud/parts/ScreenFrame.tsx"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

function asRec(value: unknown): { readonly [key: string]: unknown } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("object")
  return value as { readonly [key: string]: unknown }
}

describe("H8 playability fixtures", () => {
  const loaded = loadPack(packBytes())
  const pack = loadClientPack(loaded.pack)
  const strings = loadStringTable(readJson("content/strings/en.json"))

  function viewOf(snap: ClientSnapshot) {
    return buildHud({
      pack,
      strings,
      snapshot: snap,
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
  }

  function propsOf(snap: ClientSnapshot, extra?: Partial<ScreenProps>): ScreenProps {
    return {
      view: viewOf(snap),
      pack,
      strings,
      demo: false,
      failed: new Set(),
      loading: false,
      onClose: () => {},
      onNavigate: () => {},
      pendingCell: "",
      pendingTileX: 0n,
      pendingTileY: 0n,
      onIntent: async () => {},
      onCommit: async () => {},
      moneyTxn: undefined,
      onMoneyTxn: () => {},
      onLocal: () => {},
      ...extra,
    }
  }

  it("playthrough_shows_on_screens", () => {
    const after = {
      ...emptySnapshot(),
      accountKind: "wallet",
      capital: 777n,
      corp: 3n,
      gdp: 888n,
      happiness: 8000n,
      agents: [{ id: "hired-1", idleKey: "IDLE_NO_ENERGY" }],
      functions: [{ id: "workshop", nameKey: "UI_BLD_WORKSHOP", statusKey: "UI_AVAILABLE" }],
      bankLimitLive: 12n,
      cityTime: 40n,
      influenceRank: {
        rank: 2n,
        influence: 9n,
        positiveDays: 4n,
        qualified: true,
        board: [
          {
            rank: 2n,
            wallet: "w-self",
            influence: 9n,
            gdp: 888n,
            positiveDays: 4n,
            qualified: true,
            self: true,
          },
        ],
      },
      fragmentLedger: [{ ticker: "NVDA", amount: 5n }],
      stake: 1n,
      prizeBasket: [{ ticker: "NVDA", farm: 5n, month: 1n }],
      gate: {
        openedDistricts: ["automation"],
        chainWrong: false,
        stakeThresholdMet: true,
        tierUnlocked: true,
        stakeMultMet: true,
        nodeSideOpen: true,
        mergeFree: true,
      },
    }
    const view = viewOf(after)
    expect(view.overview.some((row) => row.id === "gdp" && row.exact === "888")).toBe(true)
    expect(view.overview.some((row) => row.exact === "8000")).toBe(true)
    const capitalHtml = renderToStaticMarkup(
      createElement(LeftRail, {
        view,
        strings,
        onManageFunds: () => {},
        onPayroll: () => {},
        onResource: () => {},
      }),
    )
    expect(capitalHtml.includes("777")).toBe(true)
    const overviewHtml = renderToStaticMarkup(
      createElement(Overview, {
        title: view.shell.cityStatusTitle,
        titleKey: view.shell.cityStatusTitleKey,
        rows: view.overview,
        payroll: view.payroll,
      }),
    )
    expect(overviewHtml.includes("888")).toBe(true)
    expect(overviewHtml.includes("8000")).toBe(true)
    const agentsHtml = renderToStaticMarkup(createElement(AgentsScreen, propsOf(after)))
    expect(agentsHtml.includes('data-agent="hired-1"')).toBe(true)
    expect(agentsHtml.includes("IDLE_NO_ENERGY")).toBe(true)
    const buildingHtml = renderToStaticMarkup(
      createElement(BuildingCardScreen, propsOf(after, { selectedObjectId: "workshop" })),
    )
    expect(buildingHtml.includes('data-empty="0"')).toBe(true)
    const districtHtml = renderToStaticMarkup(createElement(DistrictCardScreen, propsOf(after, { lookId: "automation" })))
    expect(districtHtml.includes("automation") || districtHtml.includes("MSFT")).toBe(true)
    const boardHtml = renderToStaticMarkup(createElement(LeaderboardScreen, propsOf(after)))
    expect(boardHtml.includes('data-empty="0"')).toBe(true)
    expect(boardHtml.includes('data-wallet="w-self"')).toBe(true)
    expect(view.basket.some((row) => row.ticker === "NVDA")).toBe(true)
    const bankHtml = renderToStaticMarkup(createElement(BankScreen, propsOf(after, { moneyTxn: reviewTxn() })))
    expect(bankHtml.includes('data-withdraw-open="1"')).toBe(true)
    expect(bankHtml.includes('data-action="bank_deposit"')).toBe(true)
    expect(bankHtml.includes('data-deposit="live"')).toBe(true)
  })

  it("same_city_time_same_frame", () => {
    const envelope = {
      city_time: 40n,
      account_kind: "wallet",
      sections: { "tick.capital": 7n, "aggregate.gdp": 11n, "aggregate.happiness": 8000n },
    }
    const a = snapshotFromEnvelope(envelope)
    const b = snapshotFromEnvelope(envelope)
    expect(a).toEqual(b)
    expect(a.cityTime).toBe(40n)
    const va = viewOf(a)
    const vb = viewOf(b)
    expect(va.overview).toEqual(vb.overview)
    expect(va.cityTime).toBe(vb.cityTime)
    expect(renderToStaticMarkup(createElement(Overview, { title: va.shell.cityStatusTitle, titleKey: va.shell.cityStatusTitleKey, rows: va.overview, payroll: va.payroll }))).toBe(
      renderToStaticMarkup(createElement(Overview, { title: vb.shell.cityStatusTitle, titleKey: vb.shell.cityStatusTitleKey, rows: vb.overview, payroll: vb.payroll })),
    )
  })

  it("hud_catchup_eq_replay", () => {
    const cfg = loadConfig(loaded.pack)
    const spec = asRec(asRec(asRec(asRec(loaded.pack)["sections"])["sim"])["archetypes"])["minimalist"]
    const cityA = spawnCity(cfg, "minimalist", asRec(spec), "a", 1n, 0n)
    const cityB = spawnCity(cfg, "minimalist", asRec(spec), "b", 1n, 0n)
    cityA["login_period"] = 1n
    cityB["login_period"] = 1n
    cityA["output_base"] = 100n
    cityB["output_base"] = 100n
    const stateCatch = newState(cfg, { a: cityA }, {})
    const stateReplay = newState(cfg, { a: cityB }, {})
    const ticksDay = cfg["ticks_day"]
    const div = cfg["payroll_daily_divisor"]
    if (typeof ticksDay !== "bigint" || typeof div !== "bigint") throw new Error("cfg")
    const fund = 2000n * div * ticksDay
    stateCatch["fund"] = fund
    stateReplay["fund"] = fund
    stateCatch["day_budget"] = div === 0n ? 0n : fund / div
    stateReplay["day_budget"] = stateCatch["day_budget"]
    const tickBudget = ticksDay === 0n ? 0n : (stateCatch["day_budget"] as bigint) / ticksDay
    stateCatch["tick_budget"] = tickBudget
    stateReplay["tick_budget"] = tickBudget
    stateCatch["day_budget_day"] = cfg["anchor_day"]
    stateReplay["day_budget_day"] = cfg["anchor_day"]
    const capitalAnchor = cfg["capital_anchor"]
    if (typeof capitalAnchor !== "bigint") throw new Error("anchor")
    const cover = capitalAnchor <= 0n ? fund : (fund + capitalAnchor - 1n) / capitalAnchor
    stateCatch["vault_corp"] = cover
    stateReplay["vault_corp"] = cover
    stateCatch["corp_deposited_total"] = cover
    stateReplay["corp_deposited_total"] = cover
    const length = cfg["tick_length_city_hours"]
    const anchor = cfg["anchor_hour"]
    if (typeof length !== "bigint" || typeof anchor !== "bigint") throw new Error("time")
    const n = 3n
    const now = anchor + n * length
    const packHash = cfg["pack_hash"]
    const eth = cfg["eth_usd_8dec"]
    const seed = cfg["seed_corp_wei"]
    function inputs(index: bigint, extra: { readonly [key: string]: unknown } = {}) {
      return {
        tick_index: index,
        city_time: anchor + index * length,
        eth_usd_8dec: eth,
        corp_eth_wei_per_whole: seed,
        feed_live: 1n,
        pack_hash: packHash,
        dex_turnover_usd_8dec: 0n,
        ...extra,
      }
    }
    const caught = catchUp(stateCatch, inputs(n, { city_time: now, tick_index: n }), anchor)
    let replay = stateReplay
    const replayRecs: ReturnType<typeof tick>[1] = []
    let i = 1n
    while (i <= n) {
      const stepped = tick(replay, inputs(i))
      replay = stepped[0]
      for (const row of stepped[1]) replayRecs.push(row)
      i += 1n
    }
    const recSpec = cfg["record_spec"]
    const aBytes = caught[1].map((row) => encodeRecord(row, recSpec))
    const bBytes = replayRecs.map((row) => encodeRecord(row, recSpec))
    expect(aBytes.length).toBe(bBytes.length)
    for (let k = 0; k < aBytes.length; k += 1) {
      expect(aBytes[k]).toEqual(bBytes[k])
    }
    expect(caught[0]["tick_index"]).toBe(replay["tick_index"])
    expect(caught[0]["mint_rate"]).toBe(replay["mint_rate"])
  })

  it("no_date_now_on_calc_path", () => {
    const tickSrc = readFileSync(join(repo, "packages/engine/src/tick.ts"), "utf8")
    const aggSrc = readFileSync(join(repo, "packages/engine/src/aggregates.ts"), "utf8")
    const modelSrc = readFileSync(join(repo, "apps/client/src/hud/model.ts"), "utf8")
    expect(tickSrc.includes("Date.now")).toBe(false)
    expect(tickSrc.includes("Math.random")).toBe(false)
    expect(aggSrc.includes("Date.now")).toBe(false)
    expect(modelSrc.includes("Date.now")).toBe(false)
    expect(modelSrc.includes("Math.random")).toBe(false)
  })

  it("live_pack_actions_not_feature_not_in_v1", () => {
    const blocked: string[] = []
    for (const id of Object.keys(pack.actions)) {
      const action = pack.actions[id]
      if (action === undefined || action.v1 !== "live") continue
      if (!action.effect.startsWith("commit:")) continue
      const intent = intentFromCommit(action.effect.slice("commit:".length))
      if (intent.kind === "navigate" || intent.kind === "local") continue
      if (transportOf(intent.kind) !== "live") blocked.push(id)
    }
    expect(blocked).toEqual(["leaderboard_claim"])
    expect(transportOf("claim_prize")).not.toBe("live")
    expect(transportOf("deposit")).toBe("live")
    expect(transportOf("hire")).toBe("live")
    expect(transportOf("withdraw")).toBe("live")
  })
})
