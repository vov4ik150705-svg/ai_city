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
  RECENT_ACTIVITY_DEFAULT_ROWS,
  resolveBuildingSelection,
} from "../src/hud/selection.ts"
import { DECORATIVE_BUILDING_ID, buildingCardKind } from "../src/hud/parts/hudArt.ts"

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
    expect(popoverMode({ x: 40, y: 80, visible: true }, false)).toBe("float")
    expect(popoverMode({ x: 40, y: 80, visible: true }, false, true)).toBe("hidden")
    const insets = { top: 56, right: 260, bottom: 48, left: 260 }
    const placement = clampPopoverPlacement(2, 200, 180, 120, 800, 600, insets)
    expect(placement.left).toBe(260)
    expect(placement.top).toBeGreaterThanOrEqual(56)
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
    expect(view.shell.functions.rows.length).toBe(5)
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
})
