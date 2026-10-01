import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { canonical, loadPack, parseJson, type Json } from "@corporator/contentpack"
import { codes, commandRoutes, commandTemplate } from "@corporator/protocol"
import { commandRouteExists, createLiveAdapter, isLiveMutationEffect, transportOf } from "../src/hud/liveAdapter.ts"
import { loadClientPack, loadStringTable, buildHud, emptySnapshot } from "../src/index.ts"
import { ResearchScreen } from "../src/hud/screens/research.tsx"
import { DistrictsScreen } from "../src/hud/screens/districts.tsx"
import { DistrictCardScreen } from "../src/hud/screens/district_card.tsx"
import { BuildingCardScreen } from "../src/hud/screens/building_card.tsx"
import { BankScreen } from "../src/hud/screens/bank.tsx"
import { ExchangeScreen } from "../src/hud/screens/exchange.tsx"
import { ActionButton } from "../src/hud/parts/ActionButton.tsx"
import { reviewTxn } from "../src/hud/uiState.ts"
import type { ScreenProps } from "../src/hud/parts/ScreenFrame.tsx"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

describe("H2.1 research_start client", () => {
  it("posts_research_start_live_with_axis", () => {
    expect(transportOf("research_start")).toBe("live")
    expect(isLiveMutationEffect("research_start")).toBe(true)
    expect(commandRouteExists("research_start")).toBe(true)
    expect([...commandRoutes]).toContain("/command/research_start")
  })

  it("merges_synthetic_research_unlock_actions", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const row = pack.actions["research_unlock_grid"]
    expect(row?.effect).toBe("commit:research_start")
    expect(row?.v1).toBe("live")
    expect(row?.spend).toBe("capital")
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const view = buildHud({
      pack,
      strings,
      snapshot: emptySnapshot(),
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
    const props: ScreenProps = {
      view,
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
    }
    const html = renderToStaticMarkup(createElement(ResearchScreen, props))
    expect(html.includes('data-action="research_unlock_grid"')).toBe(true)
    expect(html.includes('data-intent="research_start"')).toBe(true)
    expect(html.includes('data-support="live"')).toBe(true)
    expect(html.includes('data-research-start="live"')).toBe(true)
  })
})

describe("H2.2 open_district client", () => {
  it("posts_open_district_live_with_district_id", async () => {
    expect(transportOf("open_district")).toBe("live")
    expect(isLiveMutationEffect("open_district")).toBe(true)
    expect(commandRouteExists("open_district")).toBe(true)
    expect([...commandRoutes]).toContain("/command/open_district")
    let posted: { readonly [key: string]: Json } | undefined
    const adapter = createLiveAdapter({
      origin: "http://adapter.test",
      cityId: "a",
      sessionId: "s",
      commandTemplate,
      post: async () => {
        throw new Error("post")
      },
      cityTime: () => 7n,
      nextSeq: () => 1n,
      fetchSnapshot: async () => emptySnapshot(),
      postCommand: async (args) => {
        posted = args.extra
        return { status: 200, body: canonical({ city_time: 7n }) }
      },
    })
    const result = await adapter.dispatch({ kind: "open_district", districtId: "compute" })
    expect(result.kind).toBe("applied")
    expect(posted).toEqual({ district_id: "compute" })
  })

  it("renders_open_district_button_per_row", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    expect(pack.districts.length).toBe(6)
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const view = buildHud({
      pack,
      strings,
      snapshot: emptySnapshot(),
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
    const props: ScreenProps = {
      view,
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
    }
    const html = renderToStaticMarkup(createElement(DistrictsScreen, props))
    expect(html.includes('data-open-district="live"')).toBe(true)
    expect(html.includes('data-action="districts_open"')).toBe(true)
    expect(html.includes('data-intent="open_district"')).toBe(true)
    expect(html.includes('data-support="live"')).toBe(true)
    expect(html.includes('data-unsupported="1"')).toBe(false)
    expect(html.split('data-action="districts_open"').length - 1).toBe(pack.districts.length)
    expect(html.includes('data-district="compute"')).toBe(true)
  })
})

describe("H2.3 stake client", () => {
  it("posts_stake_live_with_district_id", async () => {
    expect(transportOf("stake")).toBe("live")
    expect(isLiveMutationEffect("stake")).toBe(true)
    expect(commandRouteExists("stake")).toBe(true)
    expect([...commandRoutes]).toContain("/command/stake")
    let posted: { readonly [key: string]: Json } | undefined
    const adapter = createLiveAdapter({
      origin: "http://adapter.test",
      cityId: "a",
      sessionId: "s",
      commandTemplate,
      post: async () => {
        throw new Error("post")
      },
      cityTime: () => 7n,
      nextSeq: () => 1n,
      fetchSnapshot: async () => emptySnapshot(),
      postCommand: async (args) => {
        posted = args.extra
        return { status: 200, body: canonical({ city_time: 7n }) }
      },
    })
    const result = await adapter.dispatch({ kind: "stake", districtId: "compute", amount: "" })
    expect(result.kind).toBe("applied")
    expect(posted).toEqual({ district_id: "compute" })
  })

  it("renders_stake_more_with_district_id", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const view = buildHud({
      pack,
      strings,
      snapshot: emptySnapshot(),
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
    const props: ScreenProps = {
      view,
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
      lookId: "compute",
    }
    const html = renderToStaticMarkup(createElement(DistrictCardScreen, props))
    expect(html.includes('data-action="district_stake_more"')).toBe(true)
    expect(html.includes('data-intent="stake"')).toBe(true)
    expect(html.includes('data-support="live"')).toBe(true)
  })
})

describe("H2.4 unlock_tier client", () => {
  it("posts_unlock_tier_live_with_district_id", async () => {
    expect(transportOf("unlock_tier")).toBe("live")
    expect(isLiveMutationEffect("unlock_tier")).toBe(true)
    expect(commandRouteExists("unlock_tier")).toBe(true)
    expect([...commandRoutes]).toContain("/command/unlock_tier")
    let posted: { readonly [key: string]: Json } | undefined
    const adapter = createLiveAdapter({
      origin: "http://adapter.test",
      cityId: "a",
      sessionId: "s",
      commandTemplate,
      post: async () => {
        throw new Error("post")
      },
      cityTime: () => 7n,
      nextSeq: () => 1n,
      fetchSnapshot: async () => emptySnapshot(),
      postCommand: async (args) => {
        posted = args.extra
        return { status: 200, body: canonical({ city_time: 7n }) }
      },
    })
    const result = await adapter.dispatch({ kind: "unlock_tier", districtId: "compute" })
    expect(result.kind).toBe("applied")
    expect(posted).toEqual({ district_id: "compute" })
  })

  it("renders_unlock_tier_with_district_id", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const view = buildHud({
      pack,
      strings,
      snapshot: {
        ...emptySnapshot(),
        gate: {
          openedDistricts: ["compute"],
          districts: [
            {
              id: "compute",
              ticker: "NVDA",
              stake: 1n,
              tier: 1n,
              frozen: false,
              grace: false,
              stakeThresholdMet: true,
              stakeMultMet: true,
              tierUnlocked: false,
              nodeSideOpen: true,
              mergeFree: true,
            },
          ],
        },
      },
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
    const props: ScreenProps = {
      view,
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
      lookId: "compute",
    }
    const html = renderToStaticMarkup(createElement(DistrictCardScreen, props))
    expect(html.includes('data-action="district_unlock_tier"')).toBe(true)
    expect(html.includes('data-intent="unlock_tier"')).toBe(true)
    expect(html.includes('data-support="live"')).toBe(true)
  })
})

describe("H2.5 pick_node client", () => {
  it("posts_pick_node_live_with_node_id", async () => {
    expect(transportOf("pick_node")).toBe("live")
    expect(isLiveMutationEffect("pick_node")).toBe(true)
    expect(commandRouteExists("pick_node")).toBe(true)
    expect([...commandRoutes]).toContain("/command/pick_node")
    let posted: { readonly [key: string]: Json } | undefined
    const adapter = createLiveAdapter({
      origin: "http://adapter.test",
      cityId: "a",
      sessionId: "s",
      commandTemplate,
      post: async () => {
        throw new Error("post")
      },
      cityTime: () => 7n,
      nextSeq: () => 1n,
      fetchSnapshot: async () => emptySnapshot(),
      postCommand: async (args) => {
        posted = args.extra
        return { status: 200, body: canonical({ city_time: 7n }) }
      },
    })
    const result = await adapter.dispatch({
      kind: "pick_node",
      districtId: "compute",
      nodeId: "n_compute_scale",
    })
    expect(result.kind).toBe("applied")
    expect(posted).toEqual({ district_id: "compute", node_id: "n_compute_scale" })
  })

  it("renders_pick_node_with_no_respec_warning", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    expect(pack.progressionNodes.some((n) => n.id === "n_compute_scale")).toBe(true)
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const view = buildHud({
      pack,
      strings,
      snapshot: emptySnapshot(),
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
    const props: ScreenProps = {
      view,
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
      lookId: "compute",
    }
    const html = renderToStaticMarkup(createElement(DistrictCardScreen, props))
    expect(html.includes('data-action="district_pick_node"')).toBe(true)
    expect(html.includes('data-intent="pick_node"')).toBe(true)
    expect(html.includes('data-support="live"')).toBe(true)
    expect(html.includes('data-no-respec="1"')).toBe(true)
    expect(html.includes('data-node="n_compute_scale"')).toBe(true)
  })
})

describe("H2.6 merge client", () => {
  it("posts_merge_live_with_merge_id", async () => {
    expect(transportOf("merge")).toBe("live")
    expect(isLiveMutationEffect("merge")).toBe(true)
    expect(commandRouteExists("merge")).toBe(true)
    expect([...commandRoutes]).toContain("/command/merge")
    let posted: { readonly [key: string]: Json } | undefined
    const adapter = createLiveAdapter({
      origin: "http://adapter.test",
      cityId: "a",
      sessionId: "s",
      commandTemplate,
      post: async () => {
        throw new Error("post")
      },
      cityTime: () => 7n,
      nextSeq: () => 1n,
      fetchSnapshot: async () => emptySnapshot(),
      postCommand: async (args) => {
        posted = args.extra
        return { status: 200, body: canonical({ city_time: 7n }) }
      },
    })
    const result = await adapter.dispatch({ kind: "merge", mergeId: "m_compute_consumer" })
    expect(result.kind).toBe("applied")
    expect(posted).toEqual({ merge_id: "m_compute_consumer" })
  })

  it("renders_merge_with_no_respec_warning", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    expect(pack.mergePairs.length).toBe(pack.mergePairIds.length)
    expect(pack.mergePairs.length > 0).toBe(true)
    expect(pack.mergePairs.some((row) => row.districts.includes("compute"))).toBe(true)
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const view = buildHud({
      pack,
      strings,
      snapshot: emptySnapshot(),
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
    const props: ScreenProps = {
      view,
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
      lookId: "compute",
    }
    const html = renderToStaticMarkup(createElement(DistrictCardScreen, props))
    expect(html.includes('data-action="district_merge"')).toBe(true)
    expect(html.includes('data-intent="merge"')).toBe(true)
    expect(html.includes('data-support="live"')).toBe(true)
    expect(html.includes('data-no-respec="1"')).toBe(true)
    expect(html.includes('data-merge="live"')).toBe(true)
    expect(html.includes("data-merge=")).toBe(true)
  })
})

describe("H2.7 upgrade client", () => {
  it("posts_upgrade_live_with_building_id", async () => {
    expect(transportOf("upgrade")).toBe("live")
    expect(isLiveMutationEffect("upgrade")).toBe(true)
    expect(commandRouteExists("upgrade")).toBe(true)
    expect([...commandRoutes]).toContain("/command/upgrade")
    let posted: { readonly [key: string]: Json } | undefined
    const adapter = createLiveAdapter({
      origin: "http://adapter.test",
      cityId: "a",
      sessionId: "s",
      commandTemplate,
      post: async () => {
        throw new Error("post")
      },
      cityTime: () => 7n,
      nextSeq: () => 1n,
      fetchSnapshot: async () => emptySnapshot(),
      postCommand: async (args) => {
        posted = args.extra
        return { status: 200, body: canonical({ city_time: 7n }) }
      },
    })
    const result = await adapter.dispatch({ kind: "upgrade", buildingId: "workshop" })
    expect(result.kind).toBe("applied")
    expect(posted).toEqual({ building_id: "workshop" })
  })

  it("renders_upgrade_with_building_id", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const view = buildHud({
      pack,
      strings,
      snapshot: emptySnapshot(),
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
    const props: ScreenProps = {
      view,
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
      selectedObjectId: "workshop",
    }
    const html = renderToStaticMarkup(createElement(BuildingCardScreen, props))
    expect(html.includes('data-action="building_build"')).toBe(true)
    expect(html.includes('data-action="building_upgrade"')).toBe(false)
    expect(html.includes('data-intent="build"')).toBe(true)
    expect(html.includes('data-support="live"')).toBe(true)
    expect(html.includes('data-upgrades="ready"')).toBe(true)
    expect(html.includes('data-unsupported="1"')).toBe(false)
  })
})

describe("H2.8 claim_fragment client", () => {
  it("posts_claim_fragment_live", async () => {
    expect(transportOf("claim_fragment")).toBe("live")
    expect(isLiveMutationEffect("claim_fragment")).toBe(true)
    expect(commandRouteExists("claim_fragment")).toBe(true)
    expect([...commandRoutes]).toContain("/command/claim_fragment")
    let posted: { readonly [key: string]: Json } | undefined
    const adapter = createLiveAdapter({
      origin: "http://adapter.test",
      cityId: "a",
      sessionId: "s",
      commandTemplate,
      post: async () => {
        throw new Error("post")
      },
      cityTime: () => 7n,
      nextSeq: () => 1n,
      fetchSnapshot: async () => emptySnapshot(),
      postCommand: async (args) => {
        posted = args.extra
        return { status: 200, body: canonical({ city_time: 7n }) }
      },
    })
    const result = await adapter.dispatch({ kind: "claim_fragment" })
    expect(result.kind).toBe("applied")
    expect(posted).toBeUndefined()
  })

  it("renders_claim_fragment_live_on_district_card", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const view = buildHud({
      pack,
      strings,
      snapshot: emptySnapshot(),
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
    const props: ScreenProps = {
      view,
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
      lookId: "compute",
    }
    const html = renderToStaticMarkup(createElement(DistrictCardScreen, props))
    expect(html.includes('data-action="district_claim_fragment"')).toBe(true)
    expect(html.includes('data-intent="claim_fragment"')).toBe(true)
    expect(html.includes('data-support="live"')).toBe(true)
    expect(html.includes('data-claim-fragment="live"')).toBe(true)
    expect(html.includes('data-unsupported="1"')).toBe(false)
  })
})

describe("H2.9 deposit client", () => {
  it("posts_deposit_live_with_amount", async () => {
    expect(transportOf("deposit")).toBe("live")
    expect(isLiveMutationEffect("deposit")).toBe(true)
    expect(commandRouteExists("deposit")).toBe(true)
    expect([...commandRoutes]).toContain("/command/deposit")
    let posted: { readonly [key: string]: Json } | undefined
    const adapter = createLiveAdapter({
      origin: "http://adapter.test",
      cityId: "a",
      sessionId: "s",
      commandTemplate,
      post: async () => {
        throw new Error("post")
      },
      cityTime: () => 7n,
      nextSeq: () => 1n,
      fetchSnapshot: async () => emptySnapshot(),
      postCommand: async (args) => {
        posted = args.extra
        return { status: 200, body: canonical({ city_time: 7n }) }
      },
    })
    const result = await adapter.dispatch({ kind: "deposit", amount: "100" })
    expect(result.kind).toBe("applied")
    expect(posted).toEqual({ amount: "100" })
  })

  it("renders_deposit_live_on_bank_review", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const view = buildHud({
      pack,
      strings,
      snapshot: emptySnapshot(),
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
    const props: ScreenProps = {
      view,
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
      moneyTxn: { kind: "review", messageKey: "UI_TXN_REVIEW" },
      onMoneyTxn: () => {},
      onLocal: () => {},
    }
    const html = renderToStaticMarkup(createElement(BankScreen, props))
    expect(html.includes('data-action="bank_deposit"')).toBe(true)
    expect(html.includes('data-intent="deposit"')).toBe(true)
    expect(html.includes('data-support="live"')).toBe(true)
    expect(html.includes('data-deposit="live"')).toBe(true)
    expect(html.includes('data-unsupported="1"')).toBe(false)
  })
})

describe("H2.10 withdraw client", () => {
  it("posts_withdraw_live_with_amount", async () => {
    expect(transportOf("withdraw")).toBe("live")
    expect(isLiveMutationEffect("withdraw")).toBe(true)
    expect(commandRouteExists("withdraw")).toBe(true)
    expect([...commandRoutes]).toContain("/command/withdraw")
    let posted: { readonly [key: string]: Json } | undefined
    const adapter = createLiveAdapter({
      origin: "http://adapter.test",
      cityId: "a",
      sessionId: "s",
      commandTemplate,
      post: async () => {
        throw new Error("post")
      },
      cityTime: () => 7n,
      nextSeq: () => 1n,
      fetchSnapshot: async () => emptySnapshot(),
      postCommand: async (args) => {
        posted = args.extra
        return { status: 200, body: canonical({ city_time: 7n }) }
      },
    })
    const result = await adapter.dispatch({ kind: "withdraw", amount: "10" })
    expect(result.kind).toBe("applied")
    expect(posted).toEqual({ amount: "10" })
  })

  it("renders_withdraw_live_action", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const view = buildHud({
      pack,
      strings,
      snapshot: emptySnapshot(),
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
    const props: ScreenProps = {
      view,
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
      moneyTxn: reviewTxn(),
      onMoneyTxn: () => {},
      onLocal: () => {},
    }
    const html = renderToStaticMarkup(createElement(ActionButton, { ...props, actionId: "bank_withdraw" }))
    expect(html.includes('data-action="bank_withdraw"')).toBe(true)
    expect(html.includes('data-intent="withdraw"')).toBe(true)
    expect(html.includes('data-support="live"')).toBe(true)
    expect(html.includes('data-unsupported="1"')).toBe(false)
  })
})

describe("H2.11 buy_stock client", () => {
  it("posts_buy_stock_live_with_ticker_and_amount", async () => {
    expect(transportOf("buy_stock")).toBe("live")
    expect(isLiveMutationEffect("buy_stock")).toBe(true)
    expect(commandRouteExists("buy_stock")).toBe(true)
    expect([...commandRoutes]).toContain("/command/buy_stock")
    expect(transportOf("claim_prize")).toBe("refusal-only")
    expect(isLiveMutationEffect("claim_prize")).toBe(false)
    let posted: { readonly [key: string]: Json } | undefined
    const adapter = createLiveAdapter({
      origin: "http://adapter.test",
      cityId: "a",
      sessionId: "s",
      commandTemplate,
      post: async () => {
        throw new Error("post")
      },
      cityTime: () => 7n,
      nextSeq: () => 1n,
      fetchSnapshot: async () => emptySnapshot(),
      postCommand: async (args) => {
        posted = args.extra
        return { status: 200, body: canonical({ city_time: 7n }) }
      },
    })
    const result = await adapter.dispatch({ kind: "buy_stock", ticker: "NVDA", amount: "10" })
    expect(result.kind).toBe("applied")
    expect(posted).toEqual({ ticker: "NVDA", amount: "10" })
  })

  it("renders_exchange_buy_live_action", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const view = buildHud({
      pack,
      strings,
      snapshot: emptySnapshot(),
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
    const props: ScreenProps = {
      view,
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
      moneyTxn: reviewTxn(),
      onMoneyTxn: () => {},
      onLocal: () => {},
    }
    const html = renderToStaticMarkup(createElement(ActionButton, { ...props, actionId: "exchange_buy" }))
    expect(html.includes('data-action="exchange_buy"')).toBe(true)
    expect(html.includes('data-intent="buy_stock"')).toBe(true)
    expect(html.includes('data-support="live"')).toBe(true)
    expect(html.includes('data-unsupported="1"')).toBe(false)
    const exchange = renderToStaticMarkup(createElement(ExchangeScreen, props))
    expect(exchange.includes('data-buy-stock="live"')).toBe(false)
    expect(exchange.includes('data-buy-stock="blocked"')).toBe(true)
    expect(exchange.includes('data-hop-priced="0"')).toBe(true)
    expect(exchange.includes(codes.BANK_CLOSED)).toBe(true)
    expect(exchange.includes('data-blocked-code="EXCHANGE_HOP_UNAVAILABLE"')).toBe(false)
    expect(exchange.includes('data-key="UI_REVIEW_TXN"')).toBe(false)
    expect(exchange.includes('data-key="UI_CONFIRM"')).toBe(false)
    expect(exchange.includes('data-action="exchange_buy"')).toBe(false)
    expect(exchange.includes('data-live="0"')).toBe(true)
  })
})
