import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { buildHud, emptySnapshot, loadClientPack, loadStringTable } from "../src/index.ts"
import { HUD_NAVIGATION, resolveHudRoute, workspaceDrawerWide } from "../src/hud/navigation.ts"
import { PACK_SCREEN_IDS } from "../src/hud/screens/registry.ts"
import { resolveBuildingSelection } from "../src/hud/selection.ts"
import { DECORATIVE_BUILDING_ID, buildingCardKind } from "../src/hud/parts/hudArt.ts"
import { IndustryCard } from "../src/hud/parts/IndustryCard.tsx"
import { OverviewWorkspace } from "../src/hud/workspace/OverviewWorkspace.tsx"
import { IndustriesWorkspace } from "../src/hud/workspace/IndustriesWorkspace.tsx"
import { JournalFromLog } from "../src/hud/workspace/JournalFromLog.tsx"
import { ResearchScreen } from "../src/hud/screens/research.tsx"
import { BuildingCardScreen } from "../src/hud/screens/building_card.tsx"
import { DistrictCardScreen } from "../src/hud/screens/district_card.tsx"
import { LeaderboardScreen } from "../src/hud/screens/leaderboard.tsx"
import { EventLog, eventKickers, eventLogCopy } from "../src/hud/parts/EventLog.tsx"
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
      "onboarding_demo",
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
    expect(workspaceDrawerWide("bank")).toBe(false)
    const nav = readFileSync(join(client, "src/hud/navigation.ts"), "utf8")
    expect(nav.includes('"companion"')).toBe(false)
    expect(nav.includes("building_management")).toBe(false)
    expect(nav.includes('"seasons"')).toBe(false)
  })

  it("opens existing overlays for manage and keeps decorative buildings out of the functional catalog", () => {
    expect(pack.buildingIds.length).toBe(18)
    expect(pack.buildingIds.includes(DECORATIVE_BUILDING_ID)).toBe(false)
    expect(buildingCardKind(DECORATIVE_BUILDING_ID)).toBe("decorative")
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
    expect(html.includes('data-catalog="functional"')).toBe(true)
    expect(html.includes(DECORATIVE_BUILDING_ID)).toBe(false)
    expect(html.includes("amazon_warehouse")).toBe(false)
    expect(html.includes("hud-tab-overview-functions")).toBe(true)
    expect(html.includes("hud-tab-overview-research")).toBe(true)
    expect(html.includes("hud-tab-overview-production")).toBe(true)
  })

  it("shows unavailable live industry fields and keeps progression/merge off the overview cards", () => {
    const html = markup(
      createElement(IndustriesWorkspace, {
        view: viewOf(),
        pack,
        strings,
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
    const card = markup(
      createElement(IndustryCard, {
        districtId: "compute",
        ticker: "NVDA",
        role: "Compute",
        market: "Unavailable",
        marketMissing: true,
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
    expect(looked.includes('data-progression="unavailable"')).toBe(true)
  })

  it("renders five research items with pack cost/duration and unavailable artwork/start/detail", () => {
    expect(pack.researchAxes.length).toBe(5)
    const html = markup(createElement(ResearchScreen, propsOf()))
    expect((html.match(/data-axis="/g) ?? []).length).toBe(5)
    expect((html.match(/data-research-art="unavailable"/g) ?? []).length).toBe(5)
    expect((html.match(/data-research-start="unavailable"/g) ?? []).length).toBe(5)
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
    expect(viewOf().shell.events.kind).toBe("unavailable")
    expect(viewOf().shell.notifications.kind).toBe("unavailable")
    const seasons = markup(createElement(LeaderboardScreen, propsOf()))
    expect(seasons.includes("hud-tab-season-season")).toBe(true)
    expect(seasons.includes("hud-tab-season-farm")).toBe(true)
    expect(seasons.includes("hud-tab-season-claims")).toBe(true)
    const building = markup(createElement(BuildingCardScreen, propsOf({ selectedObjectId: "workshop" })))
    expect(building.includes("hud-tab-building-overview")).toBe(true)
    expect(building.includes("hud-tab-building-staffing")).toBe(true)
    expect(building.includes("hud-tab-building-upgrades")).toBe(true)
    expect(building.includes("hud-tab-building-activity")).toBe(true)
  })
})
