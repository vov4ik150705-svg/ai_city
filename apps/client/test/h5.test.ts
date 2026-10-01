import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import {
  buildHud,
  emptySnapshot,
  HUD_NAVIGATION,
  hudDestinationByShortcut,
  loadClientPack,
  loadStringTable,
  resolveHudRoute,
  workspaceLoading,
  type ClientSnapshot,
} from "../src/index.ts"
import { isLiveMutationEffect, transportOf } from "../src/hud/liveAdapter.ts"
import { renderPackScreen } from "../src/hud/screens/registry.ts"
import { LeaderboardScreen } from "../src/hud/screens/leaderboard.tsx"
import { BuildingCardScreen } from "../src/hud/screens/building_card.tsx"
import { ResearchScreen } from "../src/hud/screens/research.tsx"
import { AgentsScreen } from "../src/hud/screens/agents.tsx"
import { IndustriesWorkspace } from "../src/hud/workspace/IndustriesWorkspace.tsx"
import { IslandTopbar } from "../src/hud/topbar/IslandTopbar.tsx"
import { CityStatusLook } from "../src/hud/studio/CityStatusLook.tsx"
import type { ScreenProps } from "../src/hud/parts/ScreenFrame.tsx"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const client = join(repo, "apps/client")

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

describe("H5 pack surface acceptance", () => {
  const pack = loadClientPack(loadPack(packBytes()).pack)
  const strings = loadStringTable(readJson("content/strings/en.json"))
  const screensBag = asObj(asObj(readJson("content/params/screens.json"))["screens"])

  function viewOf(snap: ClientSnapshot = emptySnapshot()) {
    return buildHud({
      pack,
      strings,
      snapshot: snap,
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
  }

  function propsOf(extra?: Partial<ScreenProps>): ScreenProps {
    return {
      view: extra?.view ?? viewOf(),
      pack,
      strings,
      demo: false,
      failed: new Set(),
      loading: extra?.loading ?? false,
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

  it("inventories every pack screen panel and flow", () => {
    const screens: string[] = []
    const panels: string[] = []
    const flows: string[] = []
    for (const id of Object.keys(screensBag)) {
      const kind = asObj(screensBag[id] ?? {})["kind"]
      if (kind === "screen") screens.push(id)
      if (kind === "panel") panels.push(id)
      if (kind === "flow") flows.push(id)
    }
    expect(screens).toEqual([
      "build",
      "agents",
      "districts",
      "exchange",
      "bank",
      "research",
      "missions",
      "leaderboard",
      "building_card",
      "agent_card",
      "district_card",
      "offline_return",
      "wallet_connect",
      "settings",
    ])
    expect(panels).toEqual([
      "topbar",
      "overview",
      "active_events",
      "districts_panel",
      "city_card",
      "agents_panel",
      "log_panel",
      "district_overview",
      "scene",
      "stock_bar",
      "bottom_menu",
    ])
    expect(flows).toEqual([
      "flow_return_summary",
      "flow_return_continue",
    ])
    expect(screens.length + panels.length + flows.length).toBe(27)
  })

  it("keeps closed routes closed and remaps districts and research", () => {
    expect(resolveHudRoute("build")).toBeUndefined()
    expect(resolveHudRoute("missions")).toBeUndefined()
    expect(resolveHudRoute("settings")).toBeUndefined()
    expect(resolveHudRoute("districts")?.route).toBe("industries")
    expect(resolveHudRoute("research")?.route).toBe("overview")
    expect(resolveHudRoute("research")?.overviewTab).toBe("research")
    expect(resolveHudRoute("leaderboard")?.route).toBe("leaderboard")
    expect(HUD_NAVIGATION.map((row) => row.shortcut)).toEqual(["1", "2", "3", "4", "5", "6"])
    expect(hudDestinationByShortcut("5")?.id).toBe("industries")
    expect(hudDestinationByShortcut("2")?.id).toBe("agents")
    expect(hudDestinationByShortcut("3")?.id).toBe("exchange")
  })

  it("does not pin workspace loading or qualify the leaderboard from a basket", () => {
    expect(workspaceLoading("journal", true)).toBe(true)
    expect(workspaceLoading("journal", false)).toBe(false)
    expect(workspaceLoading("journal", undefined)).toBe(false)
    expect(workspaceLoading("bank", true)).toBe(false)
    expect(workspaceLoading("industries", true)).toBe(false)
    const appSrc = readFileSync(join(client, "src/hud/App.tsx"), "utf8")
    expect(appSrc.includes("workspaceLoading(route, props.view.logLoading)")).toBe(true)
    expect(appSrc.includes("loading: false")).toBe(false)
    expect(appSrc.includes("hudDestinationByShortcut")).toBe(true)
    const buildSrc = readFileSync(join(client, "src/hud/screens/build.tsx"), "utf8")
    expect(buildSrc.includes("tile_x")).toBe(false)
    expect(buildSrc.includes("tile_y")).toBe(false)
    const withBasket = viewOf({
      ...emptySnapshot(),
      prizeBasket: [{ ticker: "NVDA", farm: 1n, month: 1n }],
      influenceRank: { rank: 1n, influence: 1n, positiveDays: 1n, qualified: false },
    })
    const emptyHtml = renderToStaticMarkup(createElement(LeaderboardScreen, propsOf({ view: withBasket })))
    expect(emptyHtml.includes('data-key="UI_EMPTY_NOT_QUALIFIED"')).toBe(true)
    expect(emptyHtml.includes('data-action="leaderboard_claim"')).toBe(false)
    expect(emptyHtml.includes('data-empty-kind="no_entities_yet"')).toBe(true)
    expect(withBasket.basket.some((row) => row.ticker === "NVDA")).toBe(true)
    const qualified = viewOf({
      ...emptySnapshot(),
      influenceRank: {
        rank: 1n,
        influence: 1n,
        positiveDays: 1n,
        qualified: true,
        board: [
          {
            rank: 1n,
            wallet: "w1",
            influence: 1n,
            gdp: 4n,
            positiveDays: 1n,
            qualified: true,
            self: true,
          },
        ],
      },
    })
    const readyHtml = renderToStaticMarkup(createElement(LeaderboardScreen, propsOf({ view: qualified })))
    expect(readyHtml.includes('data-empty="0"')).toBe(true)
    expect(readyHtml.includes('data-wallet="w1"')).toBe(true)
    const playing = viewOf({
      ...emptySnapshot(),
      influenceRank: {
        rank: 1n,
        influence: 1n,
        positiveDays: 1n,
        qualified: false,
        board: [
          {
            rank: 1n,
            wallet: "w-play",
            influence: 0n,
            gdp: 2n,
            positiveDays: 0n,
            qualified: false,
            self: true,
          },
        ],
      },
    })
    const playingHtml = renderToStaticMarkup(createElement(LeaderboardScreen, propsOf({ view: playing })))
    expect(playingHtml.includes('data-empty="0"')).toBe(true)
    expect(playingHtml.includes('data-key="UI_EMPTY_NOT_QUALIFIED"')).toBe(true)
    expect(playingHtml.includes("hud-tab-season-ranking")).toBe(true)
    expect(playingHtml.includes('data-wallet="w-play"')).toBe(false)
    const busy = renderToStaticMarkup(createElement(LeaderboardScreen, propsOf({ loading: true })))
    expect(busy.includes('data-busy="1"')).toBe(true)
    expect(busy.includes('data-state="loading"')).toBe(true)
  })

  it("opens industries research leaderboard and agent card from live chrome", () => {
    const topbar = renderToStaticMarkup(createElement(IslandTopbar, { view: viewOf(), onNavigate: () => {} }))
    expect(topbar.includes('data-leaderboard-entry="live"')).toBe(true)
    const city = renderToStaticMarkup(
      createElement(CityStatusLook, {
        view: viewOf(),
        strings,
        pack,
        onDetails: () => {},
      }),
    )
    expect(city.includes("data-district-overview")).toBe(false)
    expect(city.includes('data-id="city"')).toBe(true)
    const industries = renderToStaticMarkup(
      createElement(IndustriesWorkspace, {
        view: viewOf(),
        pack,
        strings,
        screen: propsOf(),
        onLook: () => {},
      }),
    )
    expect(industries.includes('data-open-district="live"')).toBe(true)
    expect(industries.includes('data-action="districts_to_exchange"')).toBe(true)
    const agents = renderToStaticMarkup(
      createElement(AgentsScreen, propsOf({ view: viewOf({ ...emptySnapshot(), agents: [{ id: "a1", idleKey: "IDLE_NO_ENERGY" }] }) })),
    )
    expect(agents.includes('data-action="agents_open_card"')).toBe(false)
    expect(agents.includes('data-action="agents_hire"')).toBe(true)
    expect(agents.includes('data-agent="a1"')).toBe(true)
    expect(agents.includes("IDLE_NO_ENERGY")).toBe(true)
    const emptyAgents = renderToStaticMarkup(createElement(AgentsScreen, propsOf({ view: viewOf({ ...emptySnapshot(), agents: [] }) })))
    expect(emptyAgents.includes('data-empty="1"')).toBe(true)
    const missingBuilding = renderToStaticMarkup(createElement(BuildingCardScreen, propsOf()))
    expect(missingBuilding.includes('data-empty="1"')).toBe(true)
    const pickedBuilding = renderToStaticMarkup(createElement(BuildingCardScreen, propsOf({ selectedObjectId: "workshop" })))
    expect(pickedBuilding.includes('data-empty="0"')).toBe(true)
    const research = renderToStaticMarkup(createElement(ResearchScreen, propsOf()))
    expect(research.includes('data-empty="0"')).toBe(true)
    expect(pack.researchAxes.length > 0).toBe(true)
  })

  it("renders every pack screen and keeps claim_prize refusal-only", () => {
    const ids = [
      "agent_card",
      "agents",
      "bank",
      "build",
      "building_card",
      "district_card",
      "districts",
      "exchange",
      "leaderboard",
      "missions",
      "offline_return",
      "research",
      "settings",
      "wallet_connect",
    ]
    for (const id of ids) {
      let html = ""
      try {
        html = renderToStaticMarkup(renderPackScreen(id, propsOf()) ?? createElement("span"))
      } catch (err) {
        throw new Error(`${id}: ${err instanceof Error ? err.message : "render"}`)
      }
      expect(html.includes(`data-screen="${id}"`)).toBe(true)
    }
    const settings = renderToStaticMarkup(renderPackScreen("settings", propsOf()) ?? createElement("span"))
    expect(settings.includes('data-settings-active="0"')).toBe(true)
    expect(transportOf("claim_prize")).toBe("refusal-only")
    expect(isLiveMutationEffect("claim_prize")).toBe(false)
    expect(readFileSync(join(client, "src/hud/topbar/Topbar.tsx"), "utf8").length > 0).toBe(true)
    expect(readFileSync(join(client, "src/hud/workspace/IndustriesFromDistricts.tsx"), "utf8").length > 0).toBe(true)
  })
})
