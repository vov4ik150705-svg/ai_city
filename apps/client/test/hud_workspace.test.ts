import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { buildHud, emptySnapshot, loadClientPack, loadStringTable, type SnapshotDistrictLive } from "../src/index.ts"
import { HUD_NAVIGATION, hudDestinationStep, hudPaneMotion, hudRoutePushesParent, resolveHudRoute, workspaceDrawerWide } from "../src/hud/navigation.ts"
import { PACK_SCREEN_IDS } from "../src/hud/screens/registry.ts"
import { resolveBuildingSelection, scenePickSelects } from "../src/hud/selection.ts"
import { DECORATIVE_BUILDING_ID, buildingCardKind } from "../src/hud/parts/hudArt.ts"
import { IndustryCard } from "../src/hud/parts/IndustryCard.tsx"
import { OverviewWorkspace } from "../src/hud/workspace/OverviewWorkspace.tsx"
import { IndustriesWorkspace } from "../src/hud/workspace/IndustriesWorkspace.tsx"
import { JournalFromLog } from "../src/hud/workspace/JournalFromLog.tsx"
import { ResearchScreen } from "../src/hud/screens/research.tsx"
import { BuildingCardScreen } from "../src/hud/screens/building_card.tsx"
import { AgentCardScreen } from "../src/hud/screens/agent_card.tsx"
import { AgentsScreen } from "../src/hud/screens/agents.tsx"
import { BankScreen } from "../src/hud/screens/bank.tsx"
import { IslandTopbar } from "../src/hud/topbar/IslandTopbar.tsx"
import { DistrictCardScreen } from "../src/hud/screens/district_card.tsx"
import { LeaderboardScreen } from "../src/hud/screens/leaderboard.tsx"
import { EventLog, eventKickers, eventLogCopy } from "../src/hud/parts/EventLog.tsx"
import { groupDigits } from "../src/hud/parts/si.ts"
import { agentCallsign } from "../src/hud/callsign.ts"
import { cityLevelSteps } from "../src/hud/cityLevel.ts"
import { CityLevelWorkspace } from "../src/hud/workspace/CityLevelWorkspace.tsx"
import { previewSnapshot } from "../src/hudPreviewData.ts"
import { reviewTxn } from "../src/hud/uiState.ts"
import type { ScreenProps } from "../src/hud/parts/ScreenFrame.tsx"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const client = join(repo, "apps/client")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

function markup(node: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(node)
}

describe("HUD workspace constructor assembly", () => {
  const pack = loadClientPack(loadPack(packBytes()).pack)
  const strings = loadStringTable(readJson("content/strings/en.json"))

  function viewOf(snap = emptySnapshot()) {
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
      view: viewOf(),
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

  function districtsSnap(ids: readonly string[]): ReturnType<typeof emptySnapshot> {
    const rows: SnapshotDistrictLive[] = ids.map((id, i) => {
      const ticker = pack.districts[i]?.ticker ?? ""
      if (id === "consumer") {
        return {
          id,
          ticker,
          stake: 0n,
          tier: 0n,
          frozen: false,
          grace: false,
          stakeThresholdMet: false,
          stakeMultMet: false,
          tierUnlocked: false,
          nodeSideOpen: false,
          mergeFree: false,
        }
      }
      if (id === "automation") {
        return {
          id,
          ticker,
          stake: 1n,
          tier: 1n,
          frozen: false,
          grace: true,
          stakeThresholdMet: true,
          stakeMultMet: true,
          tierUnlocked: true,
          nodeSideOpen: true,
          mergeFree: true,
        }
      }
      if (id === "finance") {
        return {
          id,
          ticker,
          stake: 1n,
          tier: 1n,
          frozen: true,
          grace: false,
          stakeThresholdMet: true,
          stakeMultMet: true,
          tierUnlocked: true,
          nodeSideOpen: true,
          mergeFree: true,
        }
      }
      return {
        id,
        ticker,
        stake: 1n,
        tier: 1n,
        frozen: false,
        grace: false,
        stakeThresholdMet: true,
        stakeMultMet: true,
        tierUnlocked: true,
        nodeSideOpen: true,
        mergeFree: true,
      }
    })
    return {
      ...emptySnapshot(),
      gate: {
        openedDistricts: ["compute", "energy", "automation", "finance"],
        chainWrong: false,
        districts: rows,
        stakeThresholdMet: true,
        tierUnlocked: true,
        stakeMultMet: true,
        nodeSideOpen: true,
        mergeFree: true,
      },
    }
  }

  it("maps only existing routes and tabs without new destination IDs", () => {
    expect(HUD_NAVIGATION.map((row) => row.id)).toEqual([
      "overview",
      "agents",
      "exchange",
      "bank",
      "industries",
      "journal",
    ])
    expect([...PACK_SCREEN_IDS]).toEqual([
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
    ])
    expect(resolveHudRoute("stake")).toBeUndefined()
    expect(resolveHudRoute("seasons")).toBeUndefined()
    expect(resolveHudRoute("building_management")).toBeUndefined()
    expect(resolveHudRoute("companion")).toBeUndefined()
    expect(resolveHudRoute("farm")).toBeUndefined()
    expect(resolveHudRoute("claims")).toBeUndefined()
    expect(resolveHudRoute("districts")?.route).toBe("industries")
    expect(resolveHudRoute("research")?.route).toBe("overview")
    expect(resolveHudRoute("research")?.overviewTab).toBe("research")
    expect(resolveHudRoute("overview")?.route).toBe("overview")
    expect(resolveHudRoute("overview")?.overviewTab).toBe("summary")
    expect(resolveHudRoute("overview", "functions")?.route).toBe("overview")
    expect(resolveHudRoute("overview", "functions")?.overviewTab).toBe("functions")
    expect(HUD_NAVIGATION.map((row) => row.id).includes("functions")).toBe(false)
    expect(resolveHudRoute("leaderboard")?.route).toBe("leaderboard")
    expect(resolveHudRoute("building_card")?.route).toBe("building_card")
    expect(resolveHudRoute("district_card")?.route).toBe("district_card")
    expect(resolveHudRoute("build")).toBeUndefined()
    expect(resolveHudRoute("missions")).toBeUndefined()
    expect(workspaceDrawerWide("industries")).toBe(true)
    expect(workspaceDrawerWide("leaderboard")).toBe(true)
    expect(workspaceDrawerWide("bank")).toBe(true)
    expect(workspaceDrawerWide("building_card")).toBe(true)
    const nav = readFileSync(join(client, "src/hud/navigation.ts"), "utf8")
    expect(nav.includes('"companion"')).toBe(false)
    expect(nav.includes("building_management")).toBe(false)
    expect(nav.includes('"seasons"')).toBe(false)
    expect(hudDestinationStep("overview", 1)).toBe("agents")
    expect(hudDestinationStep("journal", 1)).toBe("overview")
    expect(hudDestinationStep("agents", -1)).toBe("overview")
    expect(hudDestinationStep("building_card", 1)).toBeUndefined()
    expect(hudPaneMotion("", "overview", false)).toBe("in")
    expect(hudPaneMotion("overview", "bank", false)).toBe("forward")
    expect(hudPaneMotion("bank", "overview", false)).toBe("back")
    expect(hudPaneMotion("building_card", "overview", true)).toBe("back")
    expect(hudRoutePushesParent("", "agents", false, false)).toBe(false)
    expect(hudRoutePushesParent("overview", "agents", false, false)).toBe(true)
    expect(hudRoutePushesParent("overview", "bank", false, false)).toBe(true)
    expect(hudRoutePushesParent("industries", "district_card", false, false)).toBe(true)
    expect(hudRoutePushesParent("building_card", "bank", false, false)).toBe(true)
    expect(hudRoutePushesParent("agents", "agents", false, false)).toBe(false)
    expect(hudRoutePushesParent("agents", "agents", true, false)).toBe(true)
    expect(hudRoutePushesParent("overview", "overview", false, true)).toBe(true)
    expect(hudRoutePushesParent("overview", "overview", false, false)).toBe(false)
    expect(resolveHudRoute("city_level")?.route).toBe("city_level")
    expect(workspaceDrawerWide("city_level")).toBe(true)
    const steps = cityLevelSteps(pack.populationThresholdByLevel, pack.slotsAtCityLevel)
    const published = Object.keys(pack.populationThresholdByLevel)
    expect(steps.map((step) => step.level.toString())).toEqual([...published].sort((a, b) => Number(a) - Number(b)))
    for (const key of Object.keys(pack.slotsAtCityLevel)) {
      if (pack.populationThresholdByLevel[key] !== undefined) continue
      expect(steps.some((step) => step.level.toString() === key)).toBe(false)
    }
    const ladder = markup(
      createElement(CityLevelWorkspace, {
        view: viewOf(previewSnapshot(pack, strings)),
        pack,
        strings,
      }),
    )
    expect(ladder.includes('data-ladder="ready"')).toBe(true)
    expect(ladder.includes('data-level="8"')).toBe(false)
    expect(ladder.includes('data-level="7"')).toBe(true)
    expect(ladder.includes('data-next="ready"')).toBe(true)
  })

  it("opens existing overlays for manage and keeps decorative buildings out of the functional catalog", () => {
    expect(pack.buildingIds.length).toBe(18)
    expect(pack.buildingIds.includes(DECORATIVE_BUILDING_ID)).toBe(false)
    expect(buildingCardKind(DECORATIVE_BUILDING_ID)).toBe("decorative")
    expect(scenePickSelects(DECORATIVE_BUILDING_ID)).toBe(false)
    expect(scenePickSelects("Neon Residence")).toBe(false)
    expect(scenePickSelects("bank")).toBe(true)
    expect(scenePickSelects("")).toBe(false)
    expect(resolveBuildingSelection(DECORATIVE_BUILDING_ID, pack).kind).toBe("unmapped")
    expect(resolveBuildingSelection(DECORATIVE_BUILDING_ID, pack).manage).toBeUndefined()
    expect(resolveBuildingSelection("amazon_warehouse", pack).kind).toBe("unmapped")
    expect(resolveBuildingSelection("city_hall", pack).manage?.route).toBe("overview")
    expect(resolveBuildingSelection("bank", pack).manage?.route).toBe("bank")
    expect(resolveBuildingSelection("workshop", pack).manage?.route).toBe("building_card")
    const beacon = pack.districts[0]?.beacon ?? ""
    if (beacon.length > 0) {
      expect(resolveBuildingSelection(beacon, pack).manage?.route).toBe("building_card")
    }
    const html = markup(
      createElement(OverviewWorkspace, {
        view: viewOf(),
        tab: "functions",
        onTab: () => {},
        screen: propsOf(),
        onSelectBuilding: () => {},
      }),
    )
    expect(html.includes('data-key="UI_FUNCTIONS_UNAVAILABLE"')).toBe(true)
    expect(html.includes('data-catalog="functional"')).toBe(false)
    expect(html.includes('data-key="UI_CAPITAL_COST"')).toBe(false)
    expect(html.includes(DECORATIVE_BUILDING_ID)).toBe(false)
    expect(html.includes("amazon_warehouse")).toBe(false)
    expect(html.includes("hud-tab-overview-functions")).toBe(true)
    expect(html.includes("hud-tab-overview-research")).toBe(true)
    expect(html.includes("hud-tab-overview-production")).toBe(true)
    const live = markup(
      createElement(OverviewWorkspace, {
        view: viewOf(previewSnapshot(pack, strings)),
        tab: "functions",
        onTab: () => {},
        screen: propsOf(),
        onSelectBuilding: () => {},
      }),
    )
    expect(live.includes('data-catalog="functional"')).toBe(true)
    expect(live.includes('data-building="workshop"')).toBe(true)
    expect(live.includes('data-key="IDLE_NO_ENERGY"')).toBe(true)
    expect(live.includes('data-key="UI_LAST_TICK_UNPAID"')).toBe(true)
    expect(live.includes('data-key="UI_CAPITAL_COST"')).toBe(false)
    expect(live.includes(DECORATIVE_BUILDING_ID)).toBe(false)
    expect(live.includes("amazon_warehouse")).toBe(false)
    const production = markup(
      createElement(OverviewWorkspace, {
        view: viewOf(previewSnapshot(pack, strings)),
        tab: "production",
        onTab: () => {},
        screen: propsOf(),
        onSelectBuilding: () => {},
      }),
    )
    expect(production.includes('data-id="energy"')).toBe(true)
    expect(production.includes('data-id="compute"')).toBe(true)
    expect(production.includes('data-exact="800"')).toBe(true)
    expect(production.includes('data-exact="1000"')).toBe(true)
    expect(production.includes('data-exact="400"')).toBe(true)
    expect(production.includes('data-exact="600"')).toBe(true)
    expect(production.includes("1,000")).toBe(true)
    expect(production.includes('data-key="UI_ENERGY"')).toBe(true)
    expect(production.includes('data-key="UI_COMPUTE"')).toBe(true)
    expect(production.includes('data-key="UI_CAPITAL_COST"')).toBe(false)
    const fed = previewSnapshot(pack, strings)
    const withNode = viewOf({
      ...fed,
      functions: [
        ...(fed.functions ?? []),
        { id: "power_node", nameKey: "UI_BLD_POWER_NODE", statusKey: "UI_RUNNING", level: 1n },
      ],
    })
    const sourced = markup(
      createElement(OverviewWorkspace, {
        view: withNode,
        tab: "production",
        onTab: () => {},
        screen: propsOf(),
        onSelectBuilding: () => {},
      }),
    )
    const energyCard = sourced.slice(sourced.indexOf('data-id="energy"'), sourced.indexOf('data-id="compute"'))
    expect(energyCard.includes('data-building="power_node"')).toBe(true)
    expect(sourced.slice(sourced.indexOf('data-id="compute"')).includes('data-building="power_node"')).toBe(false)
  })

  it("shows unavailable live industry fields and keeps progression/merge off the overview cards", () => {
    const html = markup(
      createElement(IndustriesWorkspace, {
        view: viewOf(),
        pack,
        strings,
        screen: propsOf(),
        onLook: () => {},
      }),
    )
    expect(html.includes('data-efficiency="unavailable"')).toBe(true)
    expect(html.includes('data-stake="unavailable"')).toBe(true)
    expect(html.includes('data-tier="unavailable"')).toBe(true)
    expect(html.includes("hud-tab-industries-progression")).toBe(true)
    expect(html.includes("hud-tab-industries-merges")).toBe(true)
    expect(html.includes('id="hud-panel-industries-industries"')).toBe(true)
    expect(html.includes('id="hud-panel-industries-progression"')).toBe(false)
    expect(html.includes('id="hud-panel-industries-merges"')).toBe(false)
    expect(html.includes("data-axis=")).toBe(false)
    expect(html.includes("data-merge=")).toBe(false)
    expect(html.includes('data-open-district="live"')).toBe(true)
    expect(html.includes('data-action="districts_open"')).toBe(true)
    expect(html.includes('data-action="districts_open_card"')).toBe(true)
    expect(html.includes('data-action="districts_to_exchange"')).toBe(true)
    expect(html.includes('data-key="UI_TAB_DISTRICTS"')).toBe(true)
    expect(html.includes('data-key="UI_MARKET_VS_EFFICIENCY"')).toBe(true)
    expect(html.includes("Efficiency is not profit")).toBe(false)
    expect(html.includes("does not spawn")).toBe(false)
    expect(html.includes("GOOGL")).toBe(false)
    expect(html.includes("AI / Compute")).toBe(false)
    expect(html.includes("AI / COMPUTE")).toBe(false)
    expect(html.includes("Compute")).toBe(true)
    expect(html.includes("open industry")).toBe(true)
    expect(html.includes("hud-icard__dot")).toBe(false)
    expect(html.includes("108%")).toBe(false)
    expect(html.includes("2.4")).toBe(false)
    expect(html.includes("18:42")).toBe(false)
    expect(html.includes('data-action="unstake"')).toBe(false)
    expect(pack.prizeAssets).toEqual(["NVDA", "TSLA", "AMZN", "AAPL", "MSFT", "COIN"])
    expect(pack.sMinByTicker["NVDA"] !== undefined).toBe(true)
    expect(pack.sMinByTicker["COIN"] !== undefined).toBe(true)
    const tickerHits = pack.prizeAssets.map((ticker) => html.indexOf(`data-ticker="${ticker}"`))
    expect(tickerHits.every((n) => n >= 0)).toBe(true)
    expect([...tickerHits].sort((a, b) => a - b)).toEqual(tickerHits)
    expect((html.match(/data-icard-cta="/g) ?? []).length).toBe(6)
    expect(html.includes('data-icard-cta="unavailable"')).toBe(true)
    expect(html.split('data-action="districts_open_card"').length - 1).toBe(pack.districts.length)
    const previewHtml = markup(
      createElement(IndustriesWorkspace, {
        view: viewOf(previewSnapshot(pack, strings)),
        pack,
        strings,
        screen: propsOf(),
        onLook: () => {},
      }),
    )
    expect(previewHtml.includes("108%")).toBe(false)
    expect(previewHtml.includes("2.4")).toBe(false)
    expect(previewHtml.includes("GOOGL")).toBe(false)
    expect(previewHtml.includes('data-efficiency="unavailable"')).toBe(true)
    expect(previewHtml.includes("data-stock-market")).toBe(false)
    const live = markup(
      createElement(IndustriesWorkspace, {
        view: viewOf(districtsSnap(pack.districts.map((row) => row.id))),
        pack,
        strings,
        screen: propsOf(),
        onLook: () => {},
      }),
    )
    expect(live.includes('data-status="open"')).toBe(true)
    expect(live.includes('data-status="available"')).toBe(true)
    expect(live.includes('data-status="locked"')).toBe(true)
    expect(live.includes('data-status="grace"')).toBe(true)
    expect(live.includes('data-status="frozen"')).toBe(true)
    expect(live.includes('data-icard-cta="open"')).toBe(true)
    expect(live.includes('data-icard-cta="available"')).toBe(true)
    expect(live.includes('data-key="UI_VIEW_INDUSTRY"')).toBe(true)
    expect(live.includes('data-key="UI_OPEN_DISTRICT"')).toBe(true)
    expect(live.includes("hud-icard__dot")).toBe(true)
    expect(live.includes('data-key="UI_OPEN_SPENDS_CORP"')).toBe(true)
    expect(live.includes('data-grace-remaining="unavailable"')).toBe(true)
    expect(live.includes("18:42")).toBe(false)
    expect(live.includes("108%")).toBe(false)
    expect(live.includes("2.4")).toBe(false)
    expect(live.includes("Tier 2")).toBe(false)
    const card = markup(
      createElement(IndustryCard, {
        districtId: "compute",
        ticker: "NVDA",
        role: "Compute",
        market: "Unavailable",
        marketMissing: true,
        effect: "",
        effectMissing: true,
        stake: "Unavailable",
        stakeMissing: true,
        tier: "Unavailable",
        tierMissing: true,
        grace: "Unavailable",
        graceMissing: true,
        frozen: "Unavailable",
        frozenMissing: true,
        effectLabel: "Effect",
        marketLabel: "Market",
        stakeLabel: "Stake",
        tierLabel: "Tier",
        graceLabel: "Grace",
        frozenLabel: "Frozen",
        unavailable: "Unavailable",
        onLook: () => {},
      }),
    )
    expect(card.includes('data-efficiency="unavailable"')).toBe(true)
    expect(card.includes("108%")).toBe(false)
    const detail = markup(createElement(DistrictCardScreen, propsOf()))
    expect(detail.includes('data-industry-detail="unavailable"')).toBe(true)
    const firstDistrict = pack.districts[0]
    if (firstDistrict === undefined) throw new Error("missing district")
    const looked = markup(createElement(DistrictCardScreen, propsOf({ lookId: firstDistrict.id })))
    expect(looked.includes('data-industry-detail="ready"')).toBe(true)
    expect(looked.includes('data-progression="ready"')).toBe(true)
    expect(looked.includes(`data-exact="${pack.mergeCost.toString()}"`)).toBe(true)
    expect(looked.includes("hud-icard--cabinet")).toBe(false)
    expect(looked.includes('data-key="UI_EMPTY_NOTHING_TO_CLAIM"')).toBe(true)
    expect(looked.includes('data-key="UI_FRAGMENTS_HINT"')).toBe(true)
    expect(looked.includes('data-key="UI_FRAGMENTS"')).toBe(true)
    expect(looked.includes('data-fragment-kind="unavailable"')).toBe(true)
    expect(looked.includes('data-claim-fragment="live"')).toBe(true)
    expect(looked.includes("108%")).toBe(false)
    expect(looked.includes("2.4")).toBe(false)
    expect(looked.includes("Tier 2")).toBe(false)
    expect(looked.includes("industry activity")).toBe(false)
    expect(looked.includes("research and AI")).toBe(false)
    const filled = viewOf({
      ...emptySnapshot(),
      fragmentLedger: [{ ticker: firstDistrict.ticker, amount: 5n }],
    })
    const claimed = markup(createElement(DistrictCardScreen, propsOf({ lookId: firstDistrict.id, view: filled })))
    expect(claimed.includes('data-fragment-kind="ready"')).toBe(true)
    expect(claimed.includes('data-exact="5"')).toBe(true)
    expect(claimed.includes('data-key="UI_EMPTY_NOTHING_TO_CLAIM"')).toBe(false)
    const knownEmpty = viewOf({ ...emptySnapshot(), fragmentLedger: [] })
    const none = markup(createElement(DistrictCardScreen, propsOf({ lookId: firstDistrict.id, view: knownEmpty })))
    expect(none.includes('data-fragment-kind="empty"')).toBe(true)
    expect(none.includes('data-key="UI_EMPTY_NOTHING_TO_CLAIM"')).toBe(true)
    const emptyAt = none.indexOf('data-fragment-kind="empty"')
    const progressionAt = none.indexOf('id="hud-panel-district-progression"')
    expect(emptyAt >= 0 && progressionAt > emptyAt).toBe(true)
    expect(none.slice(emptyAt, progressionAt).includes("data-exact=")).toBe(false)
  })

  it("renders industries progression as a six-district catalog and merges as a matching table", () => {
    const prog = markup(
      createElement(IndustriesWorkspace, {
        view: viewOf(),
        pack,
        strings,
        screen: propsOf(),
        onLook: () => {},
        startTab: "progression",
      }),
    )
    expect(prog.includes('id="hud-panel-industries-progression"')).toBe(true)
    expect(prog.includes('data-progression="ready"')).toBe(true)
    expect(prog.includes('data-action="district_unlock_tier"')).toBe(false)
    expect(prog.includes('data-action="district_pick_node"')).toBe(false)
    expect(prog.includes("data-axis=")).toBe(false)
    expect(prog.includes("data-merge=")).toBe(false)
    expect(prog.includes('data-key="UI_NO_RESPEC"')).toBe(true)
    expect((prog.match(/data-no-respec="1"/g) ?? []).length).toBe(1)
    expect(prog.includes('data-key="UI_MARKET_VS_EFFICIENCY"')).toBe(false)
    expect(prog.includes("GOOGL")).toBe(false)
    expect(prog.includes("AI / Compute")).toBe(false)
    expect(prog.includes("n_compute_scale")).toBe(false)
    const progTickers = pack.prizeAssets.map((ticker) => prog.indexOf(`data-ticker="${ticker}"`))
    expect(progTickers.every((n) => n >= 0)).toBe(true)
    expect([...progTickers].sort((a, b) => a - b)).toEqual(progTickers)
    expect(pack.tierCostByTier["1"]).toBe(0n)
    expect(prog.includes('data-tier="unavailable"')).toBe(true)
    const opened = viewOf({
      ...emptySnapshot(),
      gate: {
        openedDistricts: pack.districts.map((row) => row.id),
        districts: pack.districts.map((row) => ({
          id: row.id,
          ticker: row.ticker,
          stake: 1n,
          tier: 1n,
          frozen: false,
          grace: false,
          stakeThresholdMet: true,
          stakeMultMet: true,
          tierUnlocked: false,
          nodeSideOpen: true,
          mergeFree: true,
        })),
      },
    })
    const priced = markup(
      createElement(IndustriesWorkspace, {
        view: opened,
        pack,
        strings,
        screen: propsOf({ view: opened }),
        onLook: () => {},
        startTab: "progression",
      }),
    )
    expect(priced.split('data-action="district_unlock_tier"').length - 1).toBe(pack.prizeAssets.length)
    const tierTwo = pack.tierCostByTier["2"]
    expect(tierTwo !== undefined && tierTwo > 0n).toBe(true)
    if (tierTwo !== undefined) expect(priced.includes(`data-exact="${tierTwo.toString()}"`)).toBe(true)

    const liveProg = markup(
      createElement(IndustriesWorkspace, {
        view: viewOf(districtsSnap(pack.districts.map((row) => row.id))),
        pack,
        strings,
        screen: propsOf(),
        onLook: () => {},
        startTab: "progression",
      }),
    )
    expect(liveProg.includes('data-tier="ready"')).toBe(true)
    expect(liveProg.includes('data-action="district_pick_node"')).toBe(false)

    const merges = markup(
      createElement(IndustriesWorkspace, {
        view: viewOf(),
        pack,
        strings,
        screen: propsOf(),
        onLook: () => {},
        startTab: "merges",
      }),
    )
    expect(merges.includes('id="hud-panel-industries-merges"')).toBe(true)
    expect(merges.includes('data-merges="ready"')).toBe(true)
    expect(merges.split('data-action="district_merge"').length - 1).toBe(pack.mergePairs.length)
    expect((merges.match(/data-merge="/g) ?? []).length).toBe(pack.mergePairs.length)
    for (const pair of pack.mergePairs) {
      expect(merges.includes(`data-merge="${pair.id}"`)).toBe(true)
    }
    expect(merges.includes("compute + consumer")).toBe(false)
    expect(merges.includes("GOOGL")).toBe(false)
    expect(merges.includes("synergy")).toBe(false)
    expect(merges.includes("synergies")).toBe(false)
    expect(merges.includes('data-action="district_pick_node"')).toBe(false)
    expect((merges.match(/data-no-respec="1"/g) ?? []).length).toBe(1)
    expect(merges.includes(`data-exact="${pack.mergeCost.toString()}"`)).toBe(true)
    expect(pack.mergeActiveCap !== undefined).toBe(true)
    if (pack.mergeActiveCap !== undefined) {
      expect(merges.includes(`data-merge-cap="${pack.mergeActiveCap.toString()}"`)).toBe(true)
    }
    expect(merges.includes("NVDA")).toBe(true)
    expect(merges.includes("COIN")).toBe(true)
  })

  it("renders five research items with pack cost/duration and unavailable artwork/start/detail", () => {
    expect(pack.researchAxes.length).toBe(5)
    const html = markup(createElement(ResearchScreen, propsOf()))
    expect((html.match(/data-axis="/g) ?? []).length).toBe(5)
    expect((html.match(/data-research-art="unavailable"/g) ?? []).length).toBe(5)
    expect((html.match(/data-research-start="live"/g) ?? []).length).toBe(5)
    expect((html.match(/data-research-detail="unavailable"/g) ?? []).length).toBe(5)
    for (const axis of pack.researchAxes) {
      expect(html.includes(`data-axis="${axis.id}"`)).toBe(true)
      if (axis.cost !== undefined) expect(html.includes(`data-exact="${axis.cost.toString()}"`)).toBe(true)
      if (axis.timeTicks !== undefined) expect(html.includes(`data-exact="${axis.timeTicks.toString()}"`)).toBe(true)
    }
    const overviewResearch = markup(
      createElement(OverviewWorkspace, {
        view: viewOf(),
        tab: "research",
        onTab: () => {},
        screen: propsOf(),
        onSelectBuilding: () => {},
      }),
    )
    expect((overviewResearch.match(/data-axis="/g) ?? []).length).toBe(5)
  })

  it("keeps journal timestamp/entity/unread unavailable and seasons/farm/claims on existing overlays", () => {
    const copy = eventLogCopy(strings)
    const log = markup(
      createElement(EventLog, {
        kind: "ready",
        messageKey: "UI_EMPTY_NO_ENTITIES",
        message: "empty",
        rows: [{ id: "e1", key: "IDLE_NO_ENERGY", text: "idle", badgeKey: "UI_ATTEST_LOGGED", badgeText: "", root: "", cid: "" }],
        bound: 3,
        openId: "",
        kickers: eventKickers(strings),
        unavailable: copy.unavailable,
        timeLabel: copy.timeLabel,
        entityLabel: copy.entityLabel,
        unreadLabel: copy.unreadLabel,
        onProof: () => {},
      }),
    )
    expect(log.includes('data-event-missing="timestamp-entity-unread"')).toBe(true)
    expect(log.includes('data-field="timestamp"')).toBe(true)
    expect(log.includes('data-field="entity"')).toBe(true)
    expect(log.includes('data-field="unread"')).toBe(true)
    const journal = markup(
      createElement(JournalFromLog, {
        view: viewOf(),
        strings,
        extra: [],
        openId: "",
        onBadge: () => {},
      }),
    )
    expect(journal.includes('data-id="notifications"')).toBe(true)
    expect(journal.includes("data-notify-kind")).toBe(true)
    expect(journal.includes('data-log-kind="unavailable"')).toBe(true)
    const liveJournal = markup(
      createElement(JournalFromLog, {
        view: viewOf(previewSnapshot(pack, strings)),
        strings,
        pack,
        extra: [],
        openId: "",
        onBadge: () => {},
      }),
    )
    expect(liveJournal.includes('data-log-kind="ready"')).toBe(true)
    expect(liveJournal.includes('data-key="IDLE_NO_ENERGY"')).toBe(true)
    expect(liveJournal.includes('data-key="IDLE_NO_COMPUTE"')).toBe(true)
    expect(liveJournal.includes('data-key="BANK_CLOSED"')).toBe(true)
    expect(liveJournal.includes('data-attest="UI_ATTEST_LOGGED"')).toBe(true)
    expect(liveJournal.includes('data-attest="UI_ATTEST_VERIFIED"')).toBe(false)
    expect(liveJournal.includes("Bank interest")).toBe(false)
    expect(liveJournal.includes('data-key="UI_JOURNAL_ALL"')).toBe(true)
    const proved = markup(
      createElement(JournalFromLog, {
        view: viewOf({
          ...emptySnapshot(),
          log: [{ id: "city:1", key: "IDLE_NO_ENERGY", badge: "verified", root: "root-1", cid: "cid-1" }],
        }),
        strings,
        extra: [],
        openId: "",
        onBadge: () => {},
      }),
    )
    expect(proved.includes('data-attest="UI_ATTEST_VERIFIED"')).toBe(true)
    expect(proved.includes('data-tone="ok"')).toBe(true)
    expect(proved.includes("<button")).toBe(true)
    expect(viewOf().shell.events.kind).toBe("unavailable")
    expect(viewOf().shell.notifications.kind).toBe("unavailable")
    const seasons = markup(createElement(LeaderboardScreen, propsOf()))
    expect(seasons.includes("hud-tab-season-ranking")).toBe(true)
    expect(seasons.includes("hud-tab-season-board")).toBe(true)
    expect(seasons.includes("hud-tab-season-claims")).toBe(true)
    expect(seasons.includes("hud-tab-season-farm")).toBe(false)
    expect(seasons.includes("hud-tab-season-season")).toBe(false)
    expect(seasons.includes("hud-tab-season-overview")).toBe(true)
    expect(seasons.includes('data-key="UI_EMPTY_NOT_QUALIFIED"')).toBe(true)
    const ranked = markup(
      createElement(
        LeaderboardScreen,
        propsOf({
          view: viewOf({
            ...emptySnapshot(),
            influenceRank: {
              rank: 2n,
              influence: 3n,
              positiveDays: 4n,
              qualified: true,
              board: [
                { rank: 2n, wallet: "w-rank", influence: 3n, gdp: 8n, positiveDays: 4n, qualified: true, self: true },
              ],
            },
          }),
        }),
      ),
    )
    expect(ranked.includes('data-key="UI_GDP"')).toBe(true)
    expect(ranked.includes('data-key="UI_INFLUENCE"')).toBe(true)
    expect(ranked.includes('data-wallet="w-rank"')).toBe(true)
    const building = markup(createElement(BuildingCardScreen, propsOf({ selectedObjectId: "workshop" })))
    expect(building.includes("hud-tab-building-overview")).toBe(true)
    expect(building.includes("hud-tab-building-staffing")).toBe(true)
    expect(building.includes("hud-tab-building-upgrades")).toBe(true)
    expect(building.includes("hud-tab-building-activity")).toBe(true)
    expect(building.includes('data-key="UI_SCHEDULE"')).toBe(true)
    expect(building.includes('data-key="UI_CURRENT_MODE"')).toBe(true)
    expect(building.includes('data-key="UI_FUNCTION"')).toBe(true)
    expect(building.includes('data-key="UI_STAFFING"')).toBe(true)
    expect(building.includes('data-key="UI_UPGRADES"')).toBe(true)
    expect(building.includes('data-key="UI_ACTIVITY"')).toBe(true)
    expect(building.includes('data-key="UI_DEACTIVATE_HINT"')).toBe(true)
    expect(building.includes('data-action="building_build"')).toBe(true)
    expect(building.includes('data-intent="deactivate"')).toBe(false)
    expect(building.includes('data-action="building_upgrade"')).toBe(false)
    expect(building.includes('data-support="live"')).toBe(true)
    expect(building.includes("construction")).toBe(false)
    expect(building.includes("tile_x")).toBe(false)
    const liveBuilding = markup(
      createElement(
        BuildingCardScreen,
        propsOf({
          selectedObjectId: "workshop",
          view: viewOf({
            ...emptySnapshot(),
            functions: [
              {
                id: "workshop",
                nameKey: "UI_BLD_WORKSHOP",
                statusKey: "UI_RUNNING",
                level: 2n,
                worker: "engineer",
                task: "produce",
                paid: 24n,
              },
            ],
          }),
        }),
      ),
    )
    expect(liveBuilding.includes("hud-bcard--cabinet")).toBe(true)
    expect(liveBuilding.includes('data-thumb="ready"')).toBe(true)
    expect(liveBuilding.includes('data-key="UI_PAID_TICK"')).toBe(true)
    expect(liveBuilding.includes("+24")).toBe(true)
    expect(liveBuilding.includes('data-staff-role="unavailable"')).toBe(true)
    expect(liveBuilding.includes("Trader")).toBe(false)
    expect(liveBuilding.includes("hud-tab-building-staffing")).toBe(true)
    expect(liveBuilding.includes("hud-btn--danger")).toBe(true)
    expect(building.includes("hud-bcard__rows")).toBe(true)
    expect(building.includes('data-key="UI_INPUT"')).toBe(true)
    expect(building.includes('data-key="UI_OUTPUT"')).toBe(true)
    expect(building.includes('data-key="UI_SCHEDULE_ALWAYS"')).toBe(true)
    expect(building.indexOf("hud-bcard__rows")).toBeLessThan(building.indexOf("hud-bcard__foot"))
    const light = readFileSync(join(client, "src/hud/hud-light.css"), "utf8")
    const cardRule = light.indexOf('.hud-workspace[data-workspace="building_card"],')
    expect(cardRule).toBeGreaterThan(-1)
    const cardBlock = light.slice(
      cardRule,
      light.indexOf('.hud-workspace[data-workspace="building_card"] .hud-workspace__header', cardRule),
    )
    expect(cardBlock.includes("left: auto")).toBe(true)
    expect(cardBlock.includes("62%")).toBe(true)
    expect(cardBlock.includes("62vw")).toBe(false)
    expect(cardBlock.includes("max-height: none")).toBe(true)
    expect(cardBlock.includes("left: 0")).toBe(false)
    const headerRule = light.indexOf(
      '.hud-workspace[data-workspace="building_card"] .hud-workspace__header {',
      cardRule,
    )
    expect(headerRule).toBeGreaterThan(-1)
    const headerBlock = light.slice(headerRule, light.indexOf("}", headerRule) + 1)
    expect(headerBlock.includes("position: absolute")).toBe(true)
    expect(light.includes(".hud-btn .hud-ico")).toBe(true)
    expect(light.includes("color: currentColor")).toBe(true)
    const panelRule = light.indexOf('.hud-bcard--cabinet [role="tabpanel"]:not([hidden])')
    expect(panelRule).toBeGreaterThan(-1)
    const panelBlock = light.slice(panelRule, light.indexOf("}", panelRule) + 1)
    expect(panelBlock.includes("overflow: hidden")).toBe(true)
    expect(panelBlock.includes("overflow: auto")).toBe(false)
    expect(panelBlock.includes("min-height: min-content")).toBe(true)
    const store = markup(createElement(BuildingCardScreen, propsOf({ selectedObjectId: "flagship_store" })))
    expect(store.includes("hud-bcard--cabinet")).toBe(true)
    expect(store.includes("hud-bcard__rows")).toBe(true)
    expect(store.includes('data-key="UI_BLD_FLAGSHIP_STORE"')).toBe(true)
    expect(store.includes('data-key="UI_SCHEDULE_RETAIL"')).toBe(true)
    expect(store.includes('data-key="UI_FUNCTION"')).toBe(true)
    expect(store.includes('data-key="UI_INPUT"')).toBe(true)
    expect(store.includes('data-key="UI_OUTPUT"')).toBe(true)
    expect(store.includes('data-key="UI_CURRENT_MODE"')).toBe(true)
    expect(store.includes('data-action="building_build"')).toBe(true)
    expect(store.includes('data-intent="deactivate"')).toBe(false)
    expect(store.includes('data-action="building_upgrade"')).toBe(false)
    expect(store.includes('data-key="UI_SCHEDULE_ALWAYS"')).toBe(false)
    expect(building.includes('data-key="UI_SCHEDULE_RETAIL"')).toBe(false)
    const hall = markup(createElement(BuildingCardScreen, propsOf({ selectedObjectId: "city_hall" })))
    expect(hall.includes("hud-btn--deactivate")).toBe(false)
    expect(hall.includes('data-action="building_build"')).toBe(false)
    expect(hall.includes("hud-tab-building-upgrades")).toBe(true)
    expect(hall.includes('data-upgrades="unavailable"')).toBe(true)
    expect(hall.includes('data-upgrades="ready"')).toBe(false)
    const hallUpgrades = slicePanel(hall, "hud-panel-building-upgrades", "hud-panel-building-activity")
    expect(hallUpgrades.includes('data-key="UI_UNAVAILABLE"')).toBe(true)
    expect(hallUpgrades.includes('data-exact="0"')).toBe(false)
    expect(pack.levelCostById["city_hall"]?.[0]).toBe(0n)
    const workshopL1 = pack.levelCostById["workshop"]?.[0]
    expect(workshopL1 !== undefined).toBe(true)
    if (workshopL1 !== undefined) expect(building.includes(`data-exact="${workshopL1.toString()}"`)).toBe(true)
    const agents = markup(createElement(AgentsScreen, propsOf()))
    const hire1 = pack.hireCostByN["1"]
    expect(hire1 !== undefined).toBe(true)
    if (hire1 !== undefined) expect(agents.includes(`data-exact="${hire1.toString()}"`)).toBe(true)
    expect(agents.includes("data-slots=")).toBe(true)
    expect(light.includes('data-workspace="agents"')).toBe(true)
    expect(light.includes('data-workspace="bank"')).toBe(true)
    expect(light.includes('data-workspace="industries"')).toBe(true)
    expect(light.includes("repeat(3, minmax(0, 1fr))")).toBe(true)
    expect(light.includes("repeat(2, auto)")).toBe(true)
    expect(light.includes("grid-template-rows: minmax(0, 1fr) minmax(0, 1fr)")).toBe(false)
    expect(cardBlock.includes("--hud-light-panel-w")).toBe(true)
    const icardCab = light.indexOf(".hud-card.hud-icard--cabinet")
    expect(icardCab).toBeGreaterThan(-1)
    const icardCabBlock = light.slice(icardCab, light.indexOf("}", icardCab) + 1)
    expect(icardCabBlock.includes("height: auto")).toBe(true)
    expect(icardCabBlock.includes("height: 100%")).toBe(false)
    const rosterPreview = markup(createElement(AgentsScreen, propsOf({ view: viewOf(previewSnapshot(pack, strings)) })))
    expect(rosterPreview.includes('data-agent="h1"')).toBe(true)
    expect(rosterPreview.includes('data-agent="h2"')).toBe(true)
    expect(rosterPreview.includes('data-agent="h3"')).toBe(true)
    expect(rosterPreview.includes("preview-agent")).toBe(false)
    expect(rosterPreview.includes('data-action="agents_open_card"')).toBe(false)
    expect(rosterPreview.includes('data-action="agents_hire"')).toBe(true)
    expect(rosterPreview.includes('data-action="agent_assign"')).toBe(true)
    expect(rosterPreview.includes('data-action="agent_set_objective"')).toBe(true)
    expect(rosterPreview.includes("IDLE_NO_ENERGY")).toBe(true)
    expect(rosterPreview.includes("Frugal")).toBe(false)
    expect(rosterPreview.includes("/ 1200")).toBe(false)
    expect(rosterPreview.includes('data-action="agents_fire"')).toBe(false)
    expect(rosterPreview.includes("Bram")).toBe(true)
    expect(rosterPreview.includes("Nia")).toBe(true)
    expect(rosterPreview.includes("Felix")).toBe(true)
    expect(rosterPreview.includes(">h1<")).toBe(false)
    expect(rosterPreview.includes("Engineer")).toBe(true)
    const callLists = { engineer: ["Bram", "Cole", "Hugo"], trader: ["Felix", "Miles", "Oscar"] }
    const callEngineers = [
      { id: "h1", role: "engineer" },
      { id: "h4", role: "engineer" },
      { id: "h5", role: "engineer" },
      { id: "h9", role: "engineer" },
    ]
    expect(agentCallsign("h1", "engineer", callEngineers, callLists)).toBe("Bram")
    expect(agentCallsign("h4", "engineer", callEngineers, callLists)).toBe("Cole")
    expect(agentCallsign("h5", "engineer", callEngineers, callLists)).toBe("Hugo")
    expect(agentCallsign("h9", "engineer", callEngineers, callLists)).toBe("Bram 2")
    const callTraders = [
      { id: "h10", role: "trader" },
      { id: "h2", role: "trader" },
    ]
    expect(agentCallsign("h2", "trader", callTraders, callLists)).toBe("Felix")
    expect(agentCallsign("h10", "trader", callTraders, callLists)).toBe("Miles")
    expect(agentCallsign("h2", "trader", callEngineers, callLists)).toBe("")
    expect(rosterPreview.includes("Logistician")).toBe(true)
    expect(rosterPreview.includes("Workshop")).toBe(true)
    expect(rosterPreview.includes("Produce")).toBe(true)
    expect(rosterPreview.includes("Overclock")).toBe(true)
    expect(rosterPreview.includes('data-role="manager"')).toBe(true)
    expect(rosterPreview.includes('data-role="scientist"')).toBe(true)
    expect(rosterPreview.includes('data-id="hire-roles"')).toBe(true)
    expect(rosterPreview.includes('data-key="UI_CHANGE_ASSIGNMENT"')).toBe(true)
    expect(rosterPreview.includes('data-key="UI_SET_OBJECTIVE"')).toBe(true)
    expect(rosterPreview.includes('data-key="UI_XP"')).toBe(false)
    expect(rosterPreview.includes('data-blocked-code="NOT_ENOUGH_CAPITAL"')).toBe(true)
    expect(rosterPreview.includes("have 124,800")).toBe(false)
    expect(rosterPreview.includes("need 7,211,048")).toBe(false)
    expect(rosterPreview.includes("Fit")).toBe(false)
    expect(rosterPreview.includes("Home")).toBe(false)
    const hire4 = pack.hireCostByN["4"]
    expect(hire4 !== undefined).toBe(true)
    if (hire4 !== undefined) expect(rosterPreview.includes(`data-exact="${hire4.toString()}"`)).toBe(true)
    expect(rosterPreview.includes("<select")).toBe(false)
    expect(rosterPreview.includes("hud-pick")).toBe(true)
    expect(rosterPreview.includes("hud-status")).toBe(false)
    const agentsCss = readFileSync(join(client, "src/hud/screens/agents-workspace.css"), "utf8")
    expect(agentsCss.includes("list-style: none")).toBe(true)
    expect(agentsCss.includes("text-overflow: ellipsis")).toBe(false)
    const detailRule = agentsCss.indexOf(".hud-agents-workspace__detail {")
    expect(detailRule).toBeGreaterThan(-1)
    const detailBlock = agentsCss.slice(detailRule, agentsCss.indexOf("}", detailRule) + 1)
    expect(detailBlock.includes("overflow: hidden")).toBe(true)
    expect(detailBlock.includes("overflow: auto")).toBe(false)
    expect(light.includes(".hud-agents-workspace__slots")).toBe(false)
    const hoursAgents = markup(
      createElement(
        AgentsScreen,
        propsOf({
          view: viewOf({
            ...previewSnapshot(pack, strings),
            agents: [
              {
                id: "h1",
                idleKey: "IDLE_OUT_OF_HOURS",
                role: "engineer",
                buildingId: "workshop",
                objective: "produce",
                level: 2n,
              },
            ],
          }),
        }),
      ),
    )
    expect(hoursAgents.includes('data-action="agent_set_objective"')).toBe(true)
    expect(hoursAgents.includes("hud-action__warn")).toBe(true)
    expect(hoursAgents.includes('data-key="IDLE_OUT_OF_HOURS"')).toBe(true)
    const emptyAgents = markup(createElement(AgentsScreen, propsOf({ view: viewOf({ ...emptySnapshot(), agents: [] }) })))
    expect(emptyAgents.includes('data-empty="1"')).toBe(true)
    expect(emptyAgents.includes('data-key="UI_EMPTY_NO_ENTITIES"')).toBe(true)
    expect(emptyAgents.includes('data-agent="h1"')).toBe(false)
    expect(emptyAgents.includes('data-action="agents_hire"')).toBe(true)
    const brokeHire = markup(
      createElement(AgentsScreen, propsOf({ view: viewOf({ ...emptySnapshot(), agents: [], capital: 0n, cityLevel: 1n }) })),
    )
    expect(brokeHire.includes('data-blocked-code="NOT_ENOUGH_CAPITAL"')).toBe(true)
    const bank = markup(createElement(BankScreen, propsOf()))
    expect(bank.includes('data-key="UI_DEPOSIT_TITLE"')).toBe(true)
    expect(bank.includes('data-key="UI_ESTIMATE_UNAVAILABLE"')).toBe(true)
    expect(bank.includes('data-key="UI_ESTIMATE_AFTER_FEE"')).toBe(true)
    expect(bank.includes("hud-bank__note")).toBe(false)
    expect(bank.includes('data-key="UI_ENTRY_CHEAPER"')).toBe(true)
    expect(bank.includes("hud-bank__info-note")).toBe(true)
    expect(bank.includes('data-unit="UI_CORP"')).toBe(true)
    expect(bank.includes('data-receive-unit="UI_CAPITAL"')).toBe(true)
    expect(bank.includes('data-preset="5"')).toBe(true)
    expect(bank.includes('data-preset="10"')).toBe(true)
    expect(bank.includes('data-preset="50"')).toBe(true)
    expect(bank.includes("19600")).toBe(false)
    expect(bank.includes("19,600")).toBe(false)
    expect(bank.includes('data-key="UI_MINT_CEILING"')).toBe(true)
    expect(bank.includes(`data-exact="${pack.capitalAnchor.toString()}"`)).toBe(true)
    expect(bank.includes('data-key="UI_MINT_CEILING" data-exact="51"')).toBe(false)
    expect(bank.includes("is-refused")).toBe(true)
    expect(bank.includes("WALLET_NOT_CONNECTED")).toBe(true)
    expect(bank.includes("hud-bank__foot")).toBe(true)
    expect(bank.includes("hud-bank__hours-note")).toBe(false)
    expect(bank.includes('class="hud-card hud-bank"')).toBe(false)
    expect(bank.includes('data-key="UI_REVIEW_TXN"')).toBe(true)
    expect(bank.includes('data-action="bank_deposit"')).toBe(false)
    expect(bank.includes('name="hud-bank-qty"')).toBe(true)
    expect(bank.includes('name="amount"')).toBe(false)
    expect(bank.includes('type="text"')).toBe(true)
    expect(bank.includes('autoComplete="off"')).toBe(true)
    expect(bank.includes('id="hud-tab-withdraw"')).toBe(true)
    const amountTag = /<input[^>]*id="hud-bank-amount"[^>]*>/.exec(bank)?.[0] ?? ""
    expect(amountTag.length > 0).toBe(true)
    expect(amountTag.includes("disabled")).toBe(false)
    expect(light.includes(".hud-root input:-webkit-autofill")).toBe(true)
    expect(light.includes("1000px var(--hud-tone-input) inset")).toBe(true)
    expect(light.includes("--hud-light-dialog-w: 31.625rem")).toBe(true)
    expect(light.includes("hud-dialog-scrim")).toBe(true)
    expect(light.includes(".hud-bank[inert]")).toBe(true)
    const depositReview = markup(
      createElement(
        BankScreen,
        propsOf({
          moneyTxn: reviewTxn(),
          view: viewOf({ ...emptySnapshot(), accountKind: "wallet", corp: 1840n, cityTime: 12n }),
        }),
      ),
    )
    expect(depositReview.includes('data-dialog="review"')).toBe(true)
    expect(depositReview.includes('data-txn="review"')).toBe(true)
    expect(depositReview.includes("inert")).toBe(true)
    expect(depositReview.includes('aria-hidden="true"')).toBe(true)
    expect(depositReview.includes('data-key="UI_CLOSE"')).toBe(true)
    expect(depositReview.includes('data-key="UI_CONFIRM_TXN"')).toBe(true)
    expect(depositReview.includes('data-key="UI_REVIEW_DETAILS"')).toBe(true)
    expect(depositReview.includes('data-key="UI_WHAT_CHANGES"')).toBe(true)
    expect(depositReview.includes('data-key="UI_DEPOSIT_TITLE"')).toBe(true)
    expect(depositReview.includes('data-key="UI_WHAT_YOU_PAY"')).toBe(true)
    expect(depositReview.includes('data-key="UI_FROM_WALLET"')).toBe(true)
    expect(depositReview.includes('data-key="UI_WALLET_BALANCE"')).toBe(true)
    expect(depositReview.includes('data-exact="1840"')).toBe(true)
    expect(depositReview.includes('data-key="UI_WHAT_YOU_GET"')).toBe(true)
    expect(depositReview.includes('data-key="UI_VAULT_FEE"')).toBe(true)
    expect(depositReview.includes(`data-exact="${pack.vaultFeeBps.toString()}"`)).toBe(true)
    expect(depositReview.includes(`data-exact="${pack.capitalAnchor.toString()}"`)).toBe(true)
    expect(depositReview.includes('data-key="UI_MINT_RATE"')).toBe(true)
    expect(depositReview.includes('data-key="UI_WALLET_AFTER"')).toBe(true)
    expect(depositReview.includes('data-key="UI_AFTER_DEPOSIT"')).toBe(true)
    expect(depositReview.includes('data-key="UI_BANK_MINT_RATE"')).toBe(true)
    expect(depositReview.includes('data-key="UI_ESTIMATE_UNAVAILABLE"')).toBe(true)
    expect(depositReview.includes('data-key="UI_ENTRY_CHEAPER"')).toBe(true)
    expect(depositReview.includes('data-key="UI_REVIEW_TXN"')).toBe(true)
    expect(depositReview.includes('data-action="bank_deposit"')).toBe(true)
    expect(depositReview.includes('data-deposit="live"')).toBe(true)
    expect(depositReview.includes('data-key="UI_CONFIRM"')).toBe(true)
    expect(depositReview.includes('data-key="UI_CANCEL"')).toBe(true)
    expect(depositReview.includes("hud-btn--secondary")).toBe(true)
    expect(depositReview.includes("19,600")).toBe(false)
    expect(depositReview.includes("19600")).toBe(false)
    expect(depositReview.includes("~19")).toBe(false)
    expect(depositReview.includes("1,830")).toBe(false)
    expect(depositReview.includes("1830")).toBe(false)
    expect(depositReview.includes("Instantly")).toBe(false)
    expect(depositReview.includes("bank queue")).toBe(false)
    expect(depositReview.includes("traders")).toBe(false)
    expect(depositReview.includes("hud-unavailable")).toBe(true)
    const reviewDeposit = /<button[^>]*data-key="UI_REVIEW_TXN"[^>]*>/.exec(depositReview)?.[0] ?? ""
    expect(reviewDeposit.length > 0).toBe(true)
    expect(reviewDeposit.includes("disabled")).toBe(false)
    expect(depositReview.includes("is-covered")).toBe(true)
    expect(depositReview.includes("hud-dialog__block")).toBe(true)
    const reviewConfirm = /<button[^>]*data-action="bank_deposit"[^>]*>/.exec(depositReview)?.[0] ?? ""
    expect(reviewConfirm.length > 0).toBe(true)
    expect(reviewConfirm.includes("disabled")).toBe(true)
    expect(reviewConfirm.includes('data-support="live"')).toBe(true)
    const demoReview = markup(createElement(BankScreen, propsOf({ moneyTxn: reviewTxn() })))
    expect(demoReview.includes('data-blocked-code="WALLET_NOT_CONNECTED"')).toBe(true)
    expect(demoReview.includes('data-key="UI_CONFIRM"')).toBe(true)
    expect(demoReview.includes("19,600")).toBe(false)
    expect(pack.bankMarkupFloorBps).toBe(650n)
    expect(pack.bankMarkupBps).toBe(1000n)
    expect(pack.bankLevelShareBps["1"]).toBe(2500n)
    expect(pack.bankLevelShareBps["2"]).toBe(4375n)
    const withdraw = markup(createElement(BankScreen, { ...propsOf({ demo: true }), startTab: "withdraw" }))
    expect(withdraw.includes('data-key="UI_WITHDRAW_TITLE"')).toBe(true)
    expect(withdraw.includes('data-key="UI_WITHDRAW_HINT"')).toBe(true)
    expect(withdraw.includes('data-unit="UI_CAPITAL"')).toBe(true)
    expect(withdraw.includes('data-receive-unit="UI_CORP"')).toBe(true)
    expect(withdraw.includes('data-preset="10000"')).toBe(true)
    expect(withdraw.includes('data-preset="25000"')).toBe(true)
    expect(withdraw.includes('data-preset="50000"')).toBe(true)
    expect(withdraw.includes('data-preset="5"')).toBe(false)
    expect(withdraw.includes('data-preset="50"')).toBe(false)
    expect(withdraw.includes("10,000")).toBe(true)
    expect(withdraw.includes('data-key="UI_AUTHORIZE_RESERVE"')).toBe(true)
    expect(withdraw.includes('data-key="UI_PRESENT_VOUCHER"')).toBe(true)
    expect(withdraw.includes('data-intent="present_voucher"')).toBe(true)
    expect(withdraw.includes('data-present="idle"')).toBe(true)
    expect(withdraw.includes('data-blocked-code="UI_NO_VOUCHER"')).toBe(true)
    expect(withdraw.includes("DEMO_NO_WITHDRAW")).toBe(true)
    expect(withdraw.includes('data-key="UI_REVIEW_TXN"')).toBe(true)
    expect(withdraw.includes('data-action="bank_withdraw"')).toBe(false)
    expect(withdraw.includes('data-key="UI_ESTIMATE_UNAVAILABLE"')).toBe(true)
    expect(withdraw.includes('data-key="UI_ESTIMATE_AFTER_QUOTE"')).toBe(true)
    expect(withdraw.includes("Bank Level LV")).toBe(false)
    expect(withdraw.includes('data-key="UI_ENTRY_CHEAPER"')).toBe(false)
    expect(withdraw.includes("hud-bank__note")).toBe(false)
    expect(withdraw.includes("40000")).toBe(false)
    expect(withdraw.includes("40,000")).toBe(false)
    expect(withdraw.includes("100,000")).toBe(false)
    expect(withdraw.includes("~4.5")).toBe(false)
    expect(withdraw.includes("~10%")).toBe(false)
    expect(withdraw.includes("25%")).toBe(false)
    expect(withdraw.includes("6.5%")).toBe(true)
    expect(withdraw.includes("(floor 6.5%)")).toBe(true)
    expect(withdraw.includes("hud-bank__hours-note")).toBe(true)
    expect(withdraw.includes("1840")).toBe(false)
    expect(withdraw.includes('name="hud-bank-qty"')).toBe(true)
    expect(withdraw.includes('name="amount"')).toBe(false)
    const withdrawAmount = /<input[^>]*id="hud-bank-amount"[^>]*>/.exec(withdraw)?.[0] ?? ""
    expect(withdrawAmount.includes("disabled")).toBe(false)
    expect(withdraw.includes(`data-exact="${pack.bankMarkupBps.toString()}"`)).toBe(true)
    const previewWithdraw = markup(
      createElement(BankScreen, {
        ...propsOf({ demo: true, view: viewOf(previewSnapshot(pack, strings)) }),
        startTab: "withdraw",
      }),
    )
    expect(previewWithdraw.includes("DEMO_NO_WITHDRAW")).toBe(true)
    expect(previewWithdraw.includes('data-key="UI_UNAVAILABLE"')).toBe(true)
    expect(previewWithdraw.includes("124,800") || previewWithdraw.includes("124800")).toBe(true)
    expect(previewWithdraw.includes("6.5%")).toBe(true)
    expect(previewWithdraw.includes("LV 2")).toBe(false)
    expect(previewWithdraw.includes("hud-bank__hours-note")).toBe(false)
    expect(previewWithdraw.includes('data-key="UI_ENTRY_CHEAPER"')).toBe(true)
    expect(previewWithdraw.includes("hud-bank__info-note")).toBe(true)
    expect(previewWithdraw.includes("hud-bank__limit-track")).toBe(true)
    expect(previewWithdraw.includes("hud-bank__lead")).toBe(true)
    const shareLv2 = pack.bankLevelShareBps["2"]
    expect(shareLv2).toBeDefined()
    if (shareLv2 !== undefined) {
      expect(previewWithdraw.includes(`data-exact="${shareLv2.toString()}"`)).toBe(true)
    }
    const closedView = viewOf({
      ...emptySnapshot(),
      cityTime: 3n,
      accountKind: "wallet",
      capital: 10000n,
      corp: 50n,
      bankLimitLive: 1n,
    })
    expect(closedView.plaque.key).toBe("BANK_CLOSED")
    const closedWithdraw = markup(
      createElement(BankScreen, { ...propsOf({ demo: false, view: closedView }), startTab: "withdraw" }),
    )
    expect(closedWithdraw.includes('data-hours-reason="BANK_CLOSED"')).toBe(true)
    expect(closedWithdraw.includes('data-bank="closed"')).toBe(true)
    expect(closedWithdraw.includes('data-tone="closed"')).toBe(true)
    expect(closedWithdraw.includes('data-key="UI_CLOSED"')).toBe(true)
    expect(closedWithdraw.includes('data-key="UI_BANK_OPENS_AT"')).toBe(true)
    expect(closedWithdraw.includes("is-refused")).toBe(true)
    expect(closedWithdraw.includes('data-key="UI_AUTHORIZE_RESERVE"')).toBe(true)
    expect(closedWithdraw.includes('data-blocked-code="BANK_CLOSED"')).toBe(true)
    expect(closedWithdraw.includes('data-refusal="BANK_CLOSED"')).toBe(true)
    expect(closedWithdraw.includes("Instantly")).toBe(false)
    expect(closedWithdraw.includes("~-4.5")).toBe(false)
    expect(closedWithdraw.includes("~4.5")).toBe(false)
    expect(closedWithdraw.includes("bank queue")).toBe(false)
    expect(closedWithdraw.includes("feos")).toBe(false)
    expect(closedWithdraw.includes('data-intent="present_voucher"')).toBe(true)
    expect(closedWithdraw.includes('data-blocked-code="UI_NO_VOUCHER"')).toBe(true)
    expect(closedWithdraw.includes("UI_NO_VOUCHER") || closedWithdraw.includes("No voucher yet")).toBe(true)
    expect(closedWithdraw.includes("hud-bank__hours-note")).toBe(true)
    expect(closedWithdraw.includes('data-hours-note="BANK_CLOSED"')).toBe(true)
    expect(closedWithdraw.includes('data-key="IDLE_BANK_CLOSED"')).toBe(true)
    expect(closedWithdraw.includes("hud-btn--primary")).toBe(false)
    const closedAmount = /<input[^>]*id="hud-bank-amount"[^>]*>/.exec(closedWithdraw)?.[0] ?? ""
    expect(closedAmount.includes("disabled")).toBe(false)
    const closedBar = markup(createElement(IslandTopbar, { view: closedView, onNavigate: () => {} }))
    expect(closedBar.includes('data-key="BANK_CLOSED"')).toBe(true)
    expect(closedBar.includes('data-bank="closed"')).toBe(true)
    expect(closedBar.includes(">Bank closed</button>")).toBe(true)
    const noonView = viewOf(previewSnapshot(pack, strings))
    expect(noonView.plaque.key).toBe("UI_BANK")
    const noonBar = markup(createElement(IslandTopbar, { view: noonView, onNavigate: () => {} }))
    expect(noonBar.includes('data-bank="open"')).toBe(true)
    expect(noonBar.includes(">Bank open</button>")).toBe(true)
    const liveWithdrawView = viewOf({
      ...emptySnapshot(),
      accountKind: "wallet",
      capital: 10000n,
      corp: 50n,
      cityTime: 12n,
      bankLimitLive: 12n,
    })
    expect(liveWithdrawView.plaque.key).toBe("UI_BANK")
    const liveWithdraw = markup(
      createElement(BankScreen, { ...propsOf({ demo: false, view: liveWithdrawView }), startTab: "withdraw" }),
    )
    expect(liveWithdraw.includes("hud-btn--primary")).toBe(true)
    expect(liveWithdraw.includes('data-blocked="0"')).toBe(true)
    expect(liveWithdraw.includes("DEMO_NO_WITHDRAW")).toBe(false)
    expect(liveWithdraw.includes("BANK_CLOSED")).toBe(false)
    expect(liveWithdraw.includes("hud-bank__hours-note")).toBe(false)
    expect(liveWithdraw.includes('data-key="UI_ENTRY_CHEAPER"')).toBe(true)
    expect(liveWithdraw.includes("is-refused")).toBe(true)
    expect(liveWithdraw.includes("UI_NO_VOUCHER") || liveWithdraw.includes("No voucher yet")).toBe(true)
    expect(liveWithdraw.includes("6.5%")).toBe(true)
    const summary = markup(
      createElement(OverviewWorkspace, {
        view: viewOf(),
        tab: "summary",
        onTab: () => {},
        screen: propsOf(),
        onSelectBuilding: () => {},
      }),
    )
    expect(summary.includes("hud-overview-summary")).toBe(true)
    expect(summary.includes('data-key="UI_GDP_PROTOCOL"')).toBe(true)
    expect(summary.includes('data-key="UI_TREASURY_NAME"')).toBe(true)
    expect(summary.includes('data-key="UI_COVERAGE"')).toBe(true)
    expect(summary.includes('data-key="UI_PAYROLL"')).toBe(true)
    expect(summary.includes('data-key="UI_PROTOCOL"')).toBe(true)
    expect(summary.includes('data-key="UI_ETH_IN_FLIGHT"')).toBe(true)
    expect(summary.includes('data-key="UI_VAULT_CORP"')).toBe(true)
    expect(summary.includes('data-key="UI_STUDIO_ETH"')).toBe(true)
    expect(summary.includes('data-key="UI_PRIZE_KETTLES"')).toBe(true)
    expect(summary.includes('data-key="UI_PROTOCOL_NOTE"')).toBe(true)
    expect(summary.includes("hud-protocol")).toBe(true)
    expect(summary.includes('data-ticker="NVDA"')).toBe(true)
    expect(summary.includes('data-ticker="TSLA"')).toBe(true)
    expect(summary.includes('data-ticker="AMZN"')).toBe(true)
    expect(summary.includes('data-ticker="AAPL"')).toBe(true)
    expect(summary.includes('data-ticker="MSFT"')).toBe(true)
    expect(summary.includes('data-ticker="COIN"')).toBe(true)
    expect(summary.includes("-0.04")).toBe(false)
    expect(summary.includes("12,400")).toBe(false)
    expect(summary.includes("0.2%")).toBe(false)
    expect(summary.includes("-12")).toBe(false)
    expect(summary.includes("claim_prize")).toBe(false)
    const signed = markup(
      createElement(OverviewWorkspace, {
        view: viewOf({
          ...emptySnapshot(),
          protocolEthInFlight: 4n,
          protocolVaultCorp: 12400n,
          protocolStudioEth: 2n,
          prizeBasket: [{ ticker: "NVDA", farm: -12n, month: 3n }],
        }),
        tab: "summary",
        onTab: () => {},
        screen: propsOf(),
        onSelectBuilding: () => {},
      }),
    )
    expect(signed.includes("-12")).toBe(false)
    expect(signed.includes("12 / 3")).toBe(true)
    expect(signed.includes("0.2%")).toBe(false)
    expect(signed.includes('data-exact="4"')).toBe(true)
    expect(signed.includes('data-exact="12400"')).toBe(true)
    expect(signed.includes('data-exact="2"')).toBe(true)
    expect(signed.includes("12,400")).toBe(true)
    expect(building.includes("hud-agents-workspace")).toBe(false)
    expect(building.includes('data-action="agents_hire"')).toBe(false)
    expect(building.includes("hud-tab-journal")).toBe(false)
    expect(building.includes('data-key="UI_JOURNAL_ALL"')).toBe(false)
    expect(building.includes('data-staffing="unavailable"')).toBe(true)
    expect(building.includes("hud-portrait")).toBe(false)
    expect(building.includes('data-building-activity="empty"')).toBe(true)
    expect(building.includes('data-key="UI_EMPTY_NO_EVENTS"')).toBe(true)

    const vacant = markup(
      createElement(
        BuildingCardScreen,
        propsOf({
          selectedObjectId: "workshop",
          view: viewOf({ ...emptySnapshot(), agents: [] }),
        }),
      ),
    )
    expect(vacant.includes('data-staffing="empty"')).toBe(true)
    expect(vacant.includes('data-key="UI_EMPTY_NO_ENTITIES"')).toBe(true)
    expect(vacant.includes('data-staff-role="unavailable"')).toBe(true)
    expect(vacant.includes("hud-portrait")).toBe(false)
    expect(vacant.includes("hud-acard")).toBe(false)
    expect(vacant.includes('data-action="agent_assign"')).toBe(false)
    expect(vacant.includes('data-action="agents_open_card"')).toBe(false)

    const staffed = markup(
      createElement(
        BuildingCardScreen,
        propsOf({
          selectedObjectId: "workshop",
          view: viewOf({
            ...emptySnapshot(),
            functions: [
              {
                id: "workshop",
                nameKey: "UI_BLD_WORKSHOP",
                statusKey: "UI_RUNNING",
                level: 1n,
                worker: "a-workshop",
                task: "produce",
                paid: 24n,
              },
            ],
            agents: [
              {
                id: "a-workshop",
                idleKey: "IDLE_NO_ENERGY",
                role: "engineer",
                buildingId: "workshop",
                objective: "produce",
              },
              {
                id: "a-store",
                idleKey: "IDLE_NO_COMPUTE",
                role: "trader",
                buildingId: "flagship_store",
                objective: "desk",
              },
            ],
            log: [
              { id: "evt-workshop-1", key: "IDLE_NO_ENERGY", badge: "logged", root: "", cid: "" },
              { id: "evt-city-bank", key: "BANK_CLOSED", badge: "logged", root: "", cid: "" },
            ],
          }),
        }),
      ),
    )
    const staffing = slicePanel(staffed, "hud-panel-building-staffing", "hud-panel-building-upgrades")
    const upgrades = slicePanel(staffed, "hud-panel-building-upgrades", "hud-panel-building-activity")
    const activity = slicePanel(staffed, "hud-panel-building-activity", "hud-bcard__foot")
    expect(staffing.includes('data-agent="a-workshop"')).toBe(true)
    expect(staffing.includes('data-agent="a-store"')).toBe(false)
    expect(staffing.includes('data-agent-role="engineer"')).toBe(true)
    expect(staffing.includes('data-agent-task="produce"')).toBe(true)
    expect(staffing.includes("hud-acard--roster")).toBe(true)
    expect(staffing.includes("hud-portrait--icon")).toBe(false)
    expect(staffing.includes('data-portrait="ready"')).toBe(true)
    expect(staffing.includes('data-key="IDLE_NO_ENERGY"')).toBe(true)
    expect(staffing.includes('data-action="agents_open_card"')).toBe(true)
    expect(staffing.includes('data-key="UI_MANAGE"')).toBe(true)
    expect(staffing.includes('data-action="agent_assign"')).toBe(false)
    expect(staffing.includes("hud-agents-workspace__detail")).toBe(false)
    expect(staffing.includes('data-action="agents_hire"')).toBe(false)
    expect(staffed.includes('data-staff-role="engineer"')).toBe(true)
    expect(staffed.includes('data-staff-task="produce"')).toBe(true)
    expect(staffed.includes('data-staff-role="unavailable"')).toBe(false)
    expect(upgrades.includes('data-upgrades="ready"')).toBe(true)
    expect(upgrades.includes("hud-bcard__rows")).toBe(true)
    expect(upgrades.includes('data-key="UI_CURRENT_LEVEL"')).toBe(true)
    expect(upgrades.includes('data-key="UI_NEXT_LEVEL"')).toBe(true)
    expect(upgrades.includes('data-current-level="1"')).toBe(true)
    expect(upgrades.includes('data-next-level="2"')).toBe(true)
    expect(upgrades.includes('data-key="UI_CAPITAL_COST"')).toBe(true)
    expect(upgrades.includes('data-action="building_upgrade"')).toBe(false)
    expect(upgrades.includes("construction")).toBe(false)
    expect(staffed.includes('data-action="building_upgrade"')).toBe(true)
    const workshopCosts = pack.levelCostById["workshop"] ?? []
    const nextFromL1 = workshopCosts[1]
    expect(nextFromL1 !== undefined).toBe(true)
    if (nextFromL1 !== undefined) {
      expect(upgrades.includes(`data-exact="${nextFromL1.toString()}"`)).toBe(true)
      expect(upgrades.includes(groupDigits(nextFromL1))).toBe(true)
      expect(upgrades.includes(nextFromL1.toString())).toBe(true)
    }
    expect(light.includes("[data-staffing] .hud-portrait--icon")).toBe(false)
    expect(light.includes("[data-staffing] .hud-portrait")).toBe(true)
    expect(light.includes("--hud-icon-display")).toBe(true)

    const logisticsStaff = slicePanel(
      markup(
        createElement(
          BuildingCardScreen,
          propsOf({
            selectedObjectId: "logistics_hub",
            view: viewOf({
              ...emptySnapshot(),
              agents: [
                {
                  id: "h1",
                  idleKey: "IDLE_NO_ENERGY",
                  role: "engineer",
                  buildingId: "workshop",
                  objective: "produce",
                },
                {
                  id: "h2",
                  idleKey: "IDLE_NO_COMPUTE",
                  role: "logistician",
                  buildingId: "logistics_hub",
                  objective: "route",
                },
              ],
            }),
          }),
        ),
      ),
      "hud-panel-building-staffing",
      "hud-panel-building-upgrades",
    )
    expect(logisticsStaff.includes('data-agent="h2"')).toBe(true)
    expect(logisticsStaff.includes('data-agent="h1"')).toBe(false)
    expect(logisticsStaff.includes('data-agent-role="logistician"')).toBe(true)
    expect(logisticsStaff.includes('data-agent-task="route"')).toBe(true)
    expect(logisticsStaff.includes("trader")).toBe(false)
    expect(logisticsStaff.includes("desk")).toBe(false)

    const preview = previewSnapshot(pack, strings)
    const previewAgents = preview.agents ?? []
    expect(previewAgents.some((row) => row.id.startsWith("preview-agent"))).toBe(false)
    const previewH1 = previewAgents.find((row) => row.id === "h1")
    const previewH2 = previewAgents.find((row) => row.id === "h2")
    const previewH3 = previewAgents.find((row) => row.id === "h3")
    expect(previewH1?.role).toBe("engineer")
    expect(previewH1?.buildingId).toBe("workshop")
    expect(previewH1?.objective).toBe("produce")
    expect(previewH2?.role).toBe("logistician")
    expect(previewH2?.buildingId).toBe("logistics_hub")
    expect(previewH2?.objective).toBe("route")
    expect(previewH3?.role).toBe("trader")
    expect(previewH3?.buildingId).toBe("flagship_store")
    expect(previewH3?.objective).toBe("desk")
    expect(previewH3?.idleKey).toBe("IDLE_NO_MATERIALS")
    const seatedBuildings = previewAgents.map((row) => row.buildingId ?? "")
    expect(new Set(seatedBuildings).size).toBe(previewAgents.length)

    const previewView = viewOf(preview)
    const flagshipStaffed = markup(
      createElement(BuildingCardScreen, propsOf({ selectedObjectId: "flagship_store", view: previewView })),
    )
    const flagshipStaffing = slicePanel(flagshipStaffed, "hud-panel-building-staffing", "hud-panel-building-upgrades")
    expect(flagshipStaffing.includes('data-staffing="ready"')).toBe(true)
    expect(flagshipStaffing.includes('data-agent="h3"')).toBe(true)
    expect(flagshipStaffing.includes("Felix")).toBe(true)
    expect(flagshipStaffing.includes(">h3<")).toBe(false)
    expect(flagshipStaffing.includes('data-agent="h1"')).toBe(false)
    expect(flagshipStaffing.includes('data-agent="h2"')).toBe(false)
    expect(flagshipStaffing.includes('data-agent-role="trader"')).toBe(true)
    expect(flagshipStaffing.includes('data-agent-task="desk"')).toBe(true)
    expect(flagshipStaffing.includes('data-key="IDLE_NO_MATERIALS"')).toBe(true)
    expect(flagshipStaffing.includes('data-action="agents_open_card"')).toBe(true)
    expect(flagshipStaffing.includes('data-action="agent_assign"')).toBe(false)
    expect(flagshipStaffing.includes("preview-agent")).toBe(false)
    expect(flagshipStaffed.includes('data-staff-role="trader"')).toBe(true)
    expect(flagshipStaffed.includes('data-staff-task="desk"')).toBe(true)

    const workshopStaffed = markup(
      createElement(BuildingCardScreen, propsOf({ selectedObjectId: "workshop", view: previewView })),
    )
    const workshopStaffing = slicePanel(workshopStaffed, "hud-panel-building-staffing", "hud-panel-building-upgrades")
    expect(workshopStaffing.includes('data-agent="h1"')).toBe(true)
    expect(workshopStaffing.includes('data-agent="h2"')).toBe(false)
    expect(workshopStaffing.includes('data-agent="h3"')).toBe(false)
    expect(workshopStaffed.includes('data-staff-role="engineer"')).toBe(true)

    const hubVacant = markup(
      createElement(BuildingCardScreen, propsOf({ selectedObjectId: "agent_hub", view: previewView })),
    )
    const hubStaffing = slicePanel(hubVacant, "hud-panel-building-staffing", "hud-panel-building-upgrades")
    expect(hubStaffing.includes('data-staffing="empty"')).toBe(true)
    expect(hubStaffing.includes('data-key="UI_EMPTY_NO_ENTITIES"')).toBe(true)
    expect(hubStaffing.includes("hud-portrait")).toBe(false)
    expect(hubStaffing.includes('data-agent="h1"')).toBe(false)
    expect(hubStaffing.includes('data-agent="h3"')).toBe(false)
    expect(hubVacant.includes('data-staff-role="unavailable"')).toBe(true)
    expect(hubVacant.includes("Manager")).toBe(false)
    expect(hubVacant.includes("Trader")).toBe(false)

    const liarStore = markup(
      createElement(
        BuildingCardScreen,
        propsOf({
          selectedObjectId: "flagship_store",
          view: viewOf({
            ...emptySnapshot(),
            functions: [
              {
                id: "flagship_store",
                nameKey: "UI_BLD_FLAGSHIP_STORE",
                statusKey: "UI_RUNNING",
                level: 2n,
                worker: "trader",
                task: "desk",
                paid: 24n,
              },
            ],
            agents: [
              { id: "h1", idleKey: "IDLE_NO_ENERGY", role: "engineer", buildingId: "workshop", objective: "produce" },
              { id: "h2", idleKey: "IDLE_NO_COMPUTE", role: "logistician", buildingId: "logistics_hub", objective: "route" },
            ],
          }),
        }),
      ),
    )
    const liarStaffing = slicePanel(liarStore, "hud-panel-building-staffing", "hud-panel-building-upgrades")
    expect(liarStaffing.includes('data-staffing="empty"')).toBe(true)
    expect(liarStaffing.includes('data-key="UI_EMPTY_NO_ENTITIES"')).toBe(true)
    expect(liarStaffing.includes("hud-acard")).toBe(false)
    expect(liarStore.includes('data-staff-role="unavailable"')).toBe(true)
    expect(liarStore.includes("Trader")).toBe(false)
    expect(liarStore.includes(">Desk<")).toBe(false)
    const opened = markup(
      createElement(
        AgentCardScreen,
        propsOf({
          selectedObjectId: "h2",
          view: viewOf({
            ...emptySnapshot(),
            agents: [
              { id: "h1", idleKey: "IDLE_NO_ENERGY", role: "engineer", buildingId: "workshop", objective: "produce" },
              { id: "h2", idleKey: "IDLE_NO_COMPUTE", role: "logistician", buildingId: "logistics_hub", objective: "route" },
            ],
          }),
        }),
      ),
    )
    expect(opened.includes('data-agent="h2"')).toBe(true)
    expect(opened.includes('data-agent="h1"')).toBe(false)
    expect(activity.includes('data-event-id="evt-workshop-1"')).toBe(true)
    expect(activity.includes('data-event-id="evt-city-bank"')).toBe(false)
    expect(activity.includes("BANK_CLOSED")).toBe(false)
    expect(activity.includes('data-event-variant="compact"')).toBe(true)
    expect(activity.includes("hud-tab-journal")).toBe(false)
    expect(activity.includes('data-attest="UI_ATTEST_LOGGED"')).toBe(true)

    const cityLogOnWorkshop = markup(
      createElement(
        BuildingCardScreen,
        propsOf({
          selectedObjectId: "workshop",
          view: viewOf({
            ...emptySnapshot(),
            log: [{ id: "evt-city-only", key: "BANK_CLOSED", badge: "logged", root: "", cid: "" }],
          }),
        }),
      ),
    )
    expect(cityLogOnWorkshop.includes('data-building-activity="empty"')).toBe(true)
    expect(cityLogOnWorkshop.includes("BANK_CLOSED")).toBe(false)
    expect(cityLogOnWorkshop.includes('data-event-id="evt-city-only"')).toBe(false)

    const capLevel = BigInt(workshopCosts.length)
    const capped = markup(
      createElement(
        BuildingCardScreen,
        propsOf({
          selectedObjectId: "workshop",
          view: viewOf({
            ...emptySnapshot(),
            functions: [
              {
                id: "workshop",
                nameKey: "UI_BLD_WORKSHOP",
                statusKey: "UI_RUNNING",
                level: capLevel,
                worker: "",
                task: "",
              },
            ],
          }),
        }),
      ),
    )
    expect(capped.includes("hud-tab-building-upgrades")).toBe(true)
    expect(capped.includes('data-upgrades="unavailable"')).toBe(true)
    expect(capped.includes('data-upgrades="ready"')).toBe(false)
  })

  it("season_overview_when_not_qualified", () => {
    const loaded = loadClientPack(loadPack(new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))).pack)
    const view = viewOf({
      ...emptySnapshot(),
      periodLabel: "P1",
      influenceRank: { qualified: false, positiveDays: 0n, rank: undefined, influence: 0n },
    })
    const html = markup(createElement(LeaderboardScreen, propsOf({ view, pack: loaded })))
    expect(html.includes('data-key="UI_EMPTY_NOT_QUALIFIED"')).toBe(true)
    expect(html.includes('data-key="UI_INFLUENCE"')).toBe(true)
    expect(html.includes("—")).toBe(true)
    expect(html.includes('data-exact="0"')).toBe(true)
    expect(html.includes(`data-exact="${loaded.qualifyDays.toString()}"`)).toBe(true)
    expect(html.includes("13d")).toBe(false)
    expect(html.includes("Ends in")).toBe(false)
    expect(html.includes("1st")).toBe(false)
    expect(html.includes("prize is yours")).toBe(false)
    expect(html.includes("приз ваш")).toBe(false)
    expect(html.includes('data-action="leaderboard_claim"')).toBe(false)
    expect(html.includes('data-wallet=')).toBe(false)
    expect(view.influenceQualified).toBe(false)
  })
})

function slicePanel(html: string, startId: string, endMarker: string): string {
  const startNeedle = `id="${startId}"`
  const endNeedle = endMarker.startsWith("hud-panel") ? `id="${endMarker}"` : endMarker
  const start = html.indexOf(startNeedle)
  const end = html.indexOf(endNeedle, start + startNeedle.length)
  if (start < 0 || end < 0) return ""
  return html.slice(start, end)
}
