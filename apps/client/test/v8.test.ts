import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import {
  buildHud,
  emptySnapshot,
  hudShellVars,
  loadClientPack,
  loadHudFixture,
  loadStringTable,
  resolveHudRoute,
  HUD_NAVIGATION,
} from "../src/index.ts"
import {
  clampPopoverPlacement,
  islandChromeVisible,
  popoverMode,
  POPOVER_ANCHOR_GAP_PX,
  RECENT_ACTIVITY_DEFAULT_ROWS,
  ACTIVE_FUNCTIONS_DEFAULT_ROWS,
  resolveBuildingSelection,
} from "../src/hud/selection.ts"
import { DECORATIVE_BUILDING_ID, buildingCardKind } from "../src/hud/parts/hudArt.ts"
import { BuildingCard } from "../src/hud/parts/BuildingCard.tsx"
import { readyField } from "../src/hud/fields.ts"
import { previewSnapshot } from "../src/hudPreviewData.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const client = join(repo, "apps/client")

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

function pack() {
  return loadClientPack(loadPack(new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))).pack)
}

describe("HUD shared constructor", () => {
  it("hud_geometry_from_fixture", () => {
    const hud = loadHudFixture(readJson("content/fixtures/hud_layout.json"))
    const vars = hudShellVars(hud)
    expect(vars["--hud-col"]).toBe(`${hud.column_width_px.toString()}px`)
    expect(vars["--hud-top"]).toBe(`${hud.topbar_height_px.toString()}px`)
    expect(vars["--hud-strip"]).toBe(`${hud.stock_strip_height_px.toString()}px`)
    expect(vars["--hud-menu"]).toBe(`${hud.bottom_menu_height_px.toString()}px`)
    const css = readFileSync(join(client, "src/hud/hud.css"), "utf8")
    expect(css.includes(".hud-menu")).toBe(true)
    expect(css.includes(".hud-stocks")).toBe(true)
    expect(css.includes("overflow-x: auto")).toBe(false)
    expect(css.includes("grid-template-columns: repeat(5, minmax(0, 1fr))")).toBe(true)
    expect(css.includes("overscroll-behavior: contain")).toBe(true)
    const app = readFileSync(join(client, "src/hud/App.tsx"), "utf8")
    expect(app.includes("StockBar")).toBe(false)
    expect(app.includes("BottomNav")).toBe(false)
    expect(app.includes('onNavigate("settings")')).toBe(false)
    expect(existsSync(join(client, "src/hud/center/BottomNav.tsx"))).toBe(false)
    expect(existsSync(join(client, "src/hud/center/StockBar.tsx"))).toBe(false)
    const registry = readFileSync(join(client, "src/hud/screens/registry.ts"), "utf8")
    expect(registry.includes("SettingsScreen")).toBe(true)
  })

  it("building_select_opens_popover_not_route", () => {
    const currentPack = pack()
    expect(HUD_NAVIGATION.map((row) => row.id)).toEqual([
      "overview",
      "agents",
      "exchange",
      "bank",
      "industries",
      "journal",
    ])
    expect(resolveHudRoute("build")).toBeUndefined()
    expect(resolveHudRoute("missions")).toBeUndefined()
    expect(resolveHudRoute("settings")).toBeUndefined()
    expect(currentPack.buildingIds.length).toBe(18)
    expect(currentPack.buildingIds.includes(DECORATIVE_BUILDING_ID)).toBe(false)
    expect(buildingCardKind(DECORATIVE_BUILDING_ID)).toBe("decorative")
    expect(resolveBuildingSelection(DECORATIVE_BUILDING_ID, currentPack).manage).toBeUndefined()
    expect(resolveBuildingSelection("city_hall", currentPack).manage?.route).toBe("overview")
    expect(islandChromeVisible(false)).toBe(true)
    expect(islandChromeVisible(true)).toBe(false)
  })

  it("bank_plaque_always_present", () => {
    const currentPack = pack()
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const view = buildHud({
      pack: currentPack,
      strings,
      snapshot: emptySnapshot(),
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: true,
    })
    expect(view.plaque.text.length > 0).toBe(true)
    expect(view.shell.functions.kind).toBe("unavailable")
    expect(view.shell.events.kind).toBe("unavailable")
    expect(popoverMode({ x: 40, y: 80, width: 0, height: 0, visible: true }, false)).toBe("float")
    expect(popoverMode({ x: 40, y: 80, width: 0, height: 0, visible: true }, false, true)).toBe("hidden")
    expect(popoverMode({ x: 420, y: 280, width: 90, height: 110, visible: true }, true)).toBe("float")
    expect(popoverMode(undefined, true)).toBe("dock")
    expect(popoverMode({ x: 0, y: 0, width: 0, height: 0, visible: false }, false)).toBe("dock")
    const insets = { top: 56, right: 260, bottom: 48, left: 260 }
    const placement = clampPopoverPlacement(2, 200, 180, 120, 800, 600, insets)
    expect(placement.left).toBe(260)
    expect(placement.top).toBeGreaterThanOrEqual(56)
    const below = clampPopoverPlacement(400, 300, 180, 100, 800, 600, insets, 80, 100)
    expect(below.left).toBe(400 - 180 / 2)
    expect(below.top).toBe(300 + 100 / 2 + POPOVER_ANCHOR_GAP_PX)
    expect(below.top >= 300 + 100 / 2).toBe(true)
    const flipped = clampPopoverPlacement(400, 500, 180, 120, 800, 600, insets, 80, 80)
    const buildingTop = 500 - 80 / 2
    expect(flipped.top).toBe(buildingTop - POPOVER_ANCHOR_GAP_PX - 120)
    expect(flipped.top + 120 <= buildingTop).toBe(true)
    const covered = clampPopoverPlacement(400, 480, 180, 160, 800, 600, { top: 56, right: 260, bottom: 200, left: 260 }, 80, 80)
    expect(covered.top + 160 <= 480 - 80 / 2).toBe(true)
    const inWell = clampPopoverPlacement(400, 360, 180, 100, 800, 600, { top: 56, right: 260, bottom: 0, left: 260 }, 80, 80)
    expect(inWell.top).toBe(360 + 80 / 2 + POPOVER_ANCHOR_GAP_PX)
    const hall = clampPopoverPlacement(340, 290, 200, 110, 1200, 800, { top: 56, right: 260, bottom: 0, left: 260 }, 70, 160)
    const store = clampPopoverPlacement(720, 410, 200, 110, 1200, 800, { top: 56, right: 260, bottom: 0, left: 260 }, 90, 80)
    expect(hall.left === store.left && hall.top === store.top).toBe(false)
    expect(hall.top + 110 <= 290 - 160 / 2 || hall.top >= 290 + 160 / 2 || hall.left + 200 <= 340 - 70 / 2 || hall.left >= 340 + 70 / 2).toBe(true)
  })

  it("payroll_row_appears_when_trimmed", () => {
    const currentPack = pack()
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const view = buildHud({
      pack: currentPack,
      strings,
      snapshot: {
        ...emptySnapshot(),
        payrollRatioBps: currentPack.bps - 1n,
        payrollRequested: 1n,
        payrollPaid: 0n,
      },
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: true,
    })
    expect(view.payroll?.key).toBe("PAYROLL_TRIMMED")
    expect(view.shell.payrollPanel.trim?.key).toBe("PAYROLL_TRIMMED")
  })

  it("payroll_coverage_shows_boost_without_trim", () => {
    const currentPack = pack()
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const boosted = currentPack.bps * 3n
    const view = buildHud({
      pack: currentPack,
      strings,
      snapshot: {
        ...emptySnapshot(),
        payrollRatioBps: boosted,
        payrollRequested: 1n,
        payrollPaid: 1n,
      },
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: true,
    })
    expect(view.payroll).toBeUndefined()
    expect(view.shell.payrollPanel.trim).toBeUndefined()
    expect(view.shell.payrollPanel.coverage.text).toBe("300%")
  })

  it("stock_bar_shows_two_numbers", () => {
    const currentPack = pack()
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const view = buildHud({
      pack: currentPack,
      strings,
      snapshot: {
        ...emptySnapshot(),
        functions: Array.from({ length: 8 }, (_, index) => ({
          id: currentPack.buildingIds[index % currentPack.buildingIds.length] ?? "bank",
          nameKey: "UI_BANK",
          statusKey: "UI_UNAVAILABLE",
        })),
      },
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: true,
    })
    expect(view.shell.functions.rows.length).toBe(8)
    expect(ACTIVE_FUNCTIONS_DEFAULT_ROWS).toBe(5)
    expect(view.stocks.length).toBe(currentPack.districts.length)
    expect(RECENT_ACTIVITY_DEFAULT_ROWS).toBe(3)
    const workspace = readFileSync(join(client, "src/hud/parts/Workspace.tsx"), "utf8")
    const scene = readFileSync(join(client, "src/hud/SceneHost.tsx"), "utf8")
    const app = readFileSync(join(client, "src/hud/App.tsx"), "utf8")
    expect(workspace.includes('role="complementary"')).toBe(true)
    expect(workspace.includes("aria-modal")).toBe(false)
    expect(app.includes('import("./SceneHost.js")')).toBe(true)
    expect(app.includes("key={cityTime}")).toBe(false)
    expect(scene.includes("handle.setCityTime(props.cityTime)")).toBe(true)
  })

  it("preview_popover_facts_come_from_pack_roles", () => {
    const currentPack = pack()
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const snap = previewSnapshot(currentPack, strings)
    const rows = snap.functions
    expect(rows === undefined).toBe(false)
    if (rows === undefined) return
    expect(rows.length > 0).toBe(true)
    const store = rows.find((row) => row.id === "flagship_store") ?? rows.find((row) => row.worker === "trader")
    const staffed = store ?? rows.find((row) => (row.worker ?? "").length > 0)
    expect(staffed === undefined).toBe(false)
    if (staffed === undefined) return
    expect(staffed.level).toBe(2n)
    expect((staffed.worker ?? "").length > 0).toBe(true)
    expect((staffed.task ?? "").length > 0).toBe(true)
    expect(staffed.paid).toBe(24n)
    const workshop = rows.find((row) => row.id === "workshop")
    expect(workshop?.statusKey).toBe("IDLE_NO_ENERGY")
    expect(workshop?.paid).toBe(0n)
    expect(workshop?.level).toBe(2n)
    const power = rows.find((row) => row.id === "power_node")
    if (power !== undefined) expect(power.statusKey).not.toBe("IDLE_NO_ENERGY")
    const agents = snap.agents ?? []
    const h1 = agents.find((row) => row.id === "h1")
    const h2 = agents.find((row) => row.id === "h2")
    const h3 = agents.find((row) => row.id === "h3")
    expect(h1?.buildingId).toBe("workshop")
    expect(h2?.buildingId).toBe("logistics_hub")
    expect(h3?.id).toBe("h3")
    expect(h3?.role).toBe("trader")
    expect(h3?.buildingId).toBe("flagship_store")
    expect(h3?.objective).toBe("desk")
    expect(agents.some((row) => row.id.startsWith("preview-agent"))).toBe(false)
    expect(new Set(agents.map((row) => row.buildingId ?? "")).size).toBe(agents.length)
  })

  it("popover_idle_reason_reads_function_status_and_city_energy", () => {
    const popover = readFileSync(join(client, "src/hud/BuildingPopover.tsx"), "utf8")
    const card = readFileSync(join(client, "src/hud/parts/BuildingCard.tsx"), "utf8")
    expect(popover.includes("UI_LAST_TICK_UNPAID")).toBe(true)
    expect(popover.includes("Last tick unpaid")).toBe(false)
    expect(popover.includes("shell.energy")).toBe(true)
    expect(card.includes("glyph=\"go\"")).toBe(false)
    expect(card.includes("glyph=\"gear\"")).toBe(true)
    expect(card.includes("hud-building-detail__level")).toBe(false)
    const energy = {
      id: "energy",
      key: "UI_ENERGY",
      label: "Energy",
      availableLabel: "Available",
      availableLabelKey: "UI_AVAILABLE",
      demandLabel: "Demand",
      demandLabelKey: "UI_RESOURCE_DEMAND",
      available: readyField("UI_AVAILABLE", "800", "800"),
      demand: readyField("UI_RESOURCE_DEMAND", "1,000", "1000"),
    }
    const shared = {
      buildingId: "workshop",
      title: "Workshop",
      titleKey: "UI_BLD_WORKSHOP",
      ticker: "NVDA" as string | undefined,
      districtId: "compute" as string | undefined,
      mapped: true,
      decorative: "Decorative",
      statusLabel: "Status",
      statusText: "no energy",
      statusKey: "IDLE_NO_ENERGY",
      missingStatus: false,
      manageLabel: "Manage",
      unmapped: "Unmapped",
      unavailable: "Unavailable",
      facts: [
        { label: "Level", labelKey: "UI_BUILDING_LEVEL", value: "LV 2", valueKey: "UI_BUILDING_LEVEL", missing: false },
        { label: "Worker", labelKey: "UI_BUILDING_WORKER", value: "Engineer", valueKey: "UI_BUILDING_WORKER", missing: false },
      ],
      variant: "popover" as const,
      idle: true,
      idleLabel: "Idle",
      reasonText: "no energy",
      reasonKey: "IDLE_NO_ENERGY",
      energy,
      tickText: "Last tick unpaid",
      tickKey: "UI_LAST_TICK_UNPAID",
      closeLabel: "close",
      closeKey: "UI_CLOSE",
      onManage: () => {},
      onClose: () => {},
    }
    const idle = renderToStaticMarkup(createElement(BuildingCard, shared))
    expect(idle.includes("data-key=\"UI_IDLE\"")).toBe(true)
    expect(idle.includes("data-key=\"IDLE_NO_ENERGY\"")).toBe(true)
    expect(idle.includes("hud-building-detail__dot--idle")).toBe(true)
    expect(idle.includes("hud-building-detail__dot--reason")).toBe(true)
    expect(idle.includes("hud-building-detail__close")).toBe(true)
    expect(idle.includes("data-key=\"UI_MANAGE\"")).toBe(true)
    expect(idle.includes("data-key=\"UI_LAST_TICK_UNPAID\"")).toBe(true)
    expect(idle.includes("data-exact=\"800\"")).toBe(true)
    expect(idle.includes("energy-have--zero")).toBe(false)
    expect(idle.includes("hud-building-detail__level")).toBe(false)
    expect(idle.includes("LV 2")).toBe(false)
    const broke = renderToStaticMarkup(
      createElement(BuildingCard, {
        ...shared,
        energy: {
          ...energy,
          available: readyField("UI_AVAILABLE", "0", "0"),
        },
      }),
    )
    expect(broke.includes("energy-have--zero")).toBe(true)
    expect(broke.includes("data-exact=\"0\"")).toBe(true)
    const paid = renderToStaticMarkup(
      createElement(BuildingCard, {
        ...shared,
        idle: false,
        statusText: "Running",
        statusKey: "UI_RUNNING",
        reasonText: "Running",
        reasonKey: "UI_RUNNING",
        tickText: "+24 Capital / Paid last tick",
        tickKey: "UI_PAYROLL_PAID",
      }),
    )
    expect(paid.includes("data-key=\"UI_LAST_TICK_UNPAID\"")).toBe(false)
    expect(paid.includes("data-key=\"UI_PAYROLL_PAID\"")).toBe(true)
    expect(paid.includes("data-key=\"UI_IDLE\"")).toBe(false)
  })
})
