import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { bankPlaqueCode, buildHud, emptySnapshot, formatSi, hudShellVars, loadClientPack, loadHudFixture, loadStringTable } from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const client = join(repo, "apps/client")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

describe("V8 hud_shell", () => {
  it("hud_geometry_from_fixture", () => {
    const hud = loadHudFixture(readJson("content/fixtures/hud_layout.json"))
    const vars = hudShellVars(hud)
    expect(vars["--hud-col"]).toBe(`${hud.column_width_px.toString()}px`)
    expect(vars["--hud-top"]).toBe(`${hud.topbar_height_px.toString()}px`)
    expect(vars["--hud-strip"]).toBe(`${hud.stock_strip_height_px.toString()}px`)
    expect(vars["--hud-menu"]).toBe(`${hud.bottom_menu_height_px.toString()}px`)
    expect(hud.column_width_px).toBe(260n)
    expect(hud.topbar_height_px).toBe(56n)
    expect(hud.stock_strip_height_px).toBe(40n)
    expect(hud.bottom_menu_height_px).toBe(48n)
    const css = readFileSync(join(client, "src/hud/hud.css"), "utf8")
    const begin = css.indexOf("HUD_TOKENS_BEGIN")
    const end = css.indexOf("HUD_TOKENS_END")
    expect(begin >= 0).toBe(true)
    expect(end > begin).toBe(true)
    const rest = css.slice(end + "HUD_TOKENS_END".length)
    expect(/\d+px/.test(rest)).toBe(false)
    expect(/@media[^{]*\d+px/.test(css)).toBe(false)
    const shell = readFileSync(join(client, "src/hud/parts/shell.ts"), "utf8")
    expect(shell.includes("--hud-col")).toBe(true)
    expect(shell.includes("column_width_px")).toBe(true)
    const pack = loadClientPack(loadPack(packBytes()).pack)
    expect(formatSi(9999n, pack.siMin, pack.siBase)).toBe("9999")
    expect(formatSi(10000n, pack.siMin, pack.siBase)).toBe("10.0k")
  })

  it("bank_plaque_always_present", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const strings = loadStringTable(readJson("content/strings/ru.json"))
    const topbar = readFileSync(join(client, "src/hud/topbar/Topbar.tsx"), "utf8")
    expect(topbar.includes("BankPlaque")).toBe(true)
    expect(
      bankPlaqueCode({
        weekday: pack.bankClosedWeekday,
        hour: pack.bankOpenHour,
        closedWeekday: pack.bankClosedWeekday,
        openHour: pack.bankOpenHour,
        closeHour: pack.bankCloseHour,
      }),
    ).toBe("BANK_SUNDAY")
    expect(
      bankPlaqueCode({
        weekday: pack.bankClosedWeekday === 1n ? 2n : 1n,
        hour: pack.bankOpenHour === 0n ? 0n : pack.bankOpenHour - 1n,
        closedWeekday: pack.bankClosedWeekday,
        openHour: pack.bankOpenHour,
        closeHour: pack.bankCloseHour,
      }),
    ).toBe("BANK_CLOSED")
    expect(
      bankPlaqueCode({
        weekday: pack.bankClosedWeekday === 1n ? 2n : 1n,
        hour: pack.bankOpenHour,
        closedWeekday: pack.bankClosedWeekday,
        openHour: pack.bankOpenHour,
        closeHour: pack.bankCloseHour,
      }),
    ).toBe("UI_BANK")
    const view = buildHud({
      pack,
      strings,
      snapshot: emptySnapshot(),
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: true,
    })
    expect(view.plaque.key === "UI_BANK" || view.plaque.key === "BANK_CLOSED" || view.plaque.key === "BANK_SUNDAY").toBe(
      true,
    )
    expect(view.plaque.text.length > 0).toBe(true)
  })

  it("payroll_row_appears_when_trimmed", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const strings = loadStringTable(readJson("content/strings/ru.json"))
    const overview = readFileSync(join(client, "src/hud/left/Overview.tsx"), "utf8")
    expect(overview.includes("PAYROLL_TRIMMED") || overview.includes("payroll")).toBe(true)
    const model = readFileSync(join(client, "src/hud/model.ts"), "utf8")
    expect(model.includes("PAYROLL_TRIMMED")).toBe(true)
    const full = buildHud({
      pack,
      strings,
      snapshot: { ...emptySnapshot(), payrollRatioBps: pack.bps },
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: true,
    })
    expect(full.payroll).toBeUndefined()
    const cut = pack.bps === 0n ? 0n : pack.bps - 1n
    const thin = buildHud({
      pack,
      strings,
      snapshot: { ...emptySnapshot(), payrollRatioBps: cut },
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: true,
    })
    expect(thin.payroll).toBeDefined()
    if (thin.payroll === undefined) return
    expect(thin.payroll.key).toBe("PAYROLL_TRIMMED")
    expect(thin.payroll.text.length > 0).toBe(true)
  })

  it("stock_bar_shows_two_numbers", () => {
    const src = readFileSync(join(client, "src/hud/center/StockBar.tsx"), "utf8")
    expect(src.includes("data-stock-market")).toBe(true)
    expect(src.includes("data-stock-effect")).toBe(true)
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const strings = loadStringTable(readJson("content/strings/ru.json"))
    const view = buildHud({
      pack,
      strings,
      snapshot: {
        ...emptySnapshot(),
        stocks: pack.districts.map((d) => ({
          ticker: d.ticker,
          price: "1",
          dayPct: "+1",
          effect: d.provides,
        })),
      },
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: true,
    })
    expect(view.stocks.length > 0).toBe(true)
    for (const row of view.stocks) {
      expect(row.price.length > 0).toBe(true)
      expect(row.effect.length > 0).toBe(true)
    }
  })
})
