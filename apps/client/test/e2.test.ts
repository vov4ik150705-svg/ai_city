import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { buildHud, emptySnapshot, loadClientPack, loadStringTable } from "../src/index.ts"
import { EconomyLook } from "../src/hud/studio/EconomyLook.tsx"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

describe("e2_launch_chip", () => {
  it("e2_launch_chip_shows_then_vanishes", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const args = { pack, strings, nowMs: 0n, firstLoginMs: 0n, demo: true }
    const live = buildHud({
      ...args,
      snapshot: {
        ...emptySnapshot(),
        payrollRatioBps: pack.bps * 8n,
        payrollRequested: 1n,
        payrollPaid: 1n,
        payrollBoostBps: pack.bps * 8n,
        payrollBoostDaysLeft: 7n,
      },
    })
    expect(live.shell.payrollPanel.launchWindow?.kind).toBe("ready")
    expect(live.shell.payrollPanel.launchWindow?.text).toBe("Launch window ×8 · ends in 7 city days")
    expect(live.shell.payrollPanel.launchWindow?.text.includes("forever")).toBe(false)
    const markup = renderToStaticMarkup(
      createElement(EconomyLook, {
        view: live,
        strings,
        onManageFunds: () => undefined,
        onPayroll: () => undefined,
        onResource: () => undefined,
      }),
    )
    expect(markup.includes("Launch window ×8")).toBe(true)
    expect(markup.includes("data-key=\"UI_PAYROLL_LAUNCH_WINDOW\"")).toBe(true)

    const gone = buildHud({
      ...args,
      snapshot: {
        ...emptySnapshot(),
        payrollRatioBps: pack.bps * 3n,
        payrollRequested: 1n,
        payrollPaid: 1n,
        payrollBoostBps: pack.bps * 3n,
        payrollBoostDaysLeft: 0n,
      },
    })
    expect(gone.shell.payrollPanel.launchWindow).toBeUndefined()
    const goneMarkup = renderToStaticMarkup(
      createElement(EconomyLook, {
        view: gone,
        strings,
        onManageFunds: () => undefined,
        onPayroll: () => undefined,
        onResource: () => undefined,
      }),
    )
    expect(goneMarkup.includes("Launch window")).toBe(false)
    expect(goneMarkup.includes("×3 forever")).toBe(false)

    const missing = buildHud({ ...args, snapshot: emptySnapshot() })
    expect(missing.shell.payrollPanel.launchWindow?.kind).toBe("unavailable")
  })

  it("e2_client_does_not_compute_launch_window", () => {
    const clientRoot = join(repo, "apps/client/src")
    const files = [
      "boot.ts",
      "hud/shellModel.ts",
      "hud/snapshot.ts",
      "hud/wsFeed.ts",
      "hud/studio/EconomyLook.tsx",
    ]
    for (const rel of files) {
      const src = readFileSync(join(clientRoot, rel), "utf8")
      expect(src.includes("payroll_boost_launch_city_days")).toBe(false)
      expect(src.includes("payroll_boost_launch_bps")).toBe(false)
    }
    const boot = readFileSync(join(clientRoot, "boot.ts"), "utf8")
    expect(boot.includes("aggregate.payroll_boost_bps")).toBe(true)
    expect(boot.includes("aggregate.payroll_boost_days_left")).toBe(true)
  })
})
