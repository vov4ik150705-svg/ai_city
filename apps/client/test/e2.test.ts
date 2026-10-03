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

type NodeProps = {
  readonly className?: string
  readonly onClick?: () => void
  readonly children?: unknown
}

function findClass(node: unknown, className: string): { readonly type: unknown; readonly props: NodeProps } | undefined {
  if (node === null || node === undefined || typeof node !== "object") return undefined
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findClass(child, className)
      if (found !== undefined) return found
    }
    return undefined
  }
  const el = node as { readonly type?: unknown; readonly props?: NodeProps }
  if (el.props === undefined) return undefined
  const names = el.props.className?.split(" ") ?? []
  if (names.includes(className)) return { type: el.type, props: el.props }
  return findClass(el.props.children, className)
}

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

    let funds = 0
    let payroll = 0
    const tree = EconomyLook({
      view: live,
      strings,
      onManageFunds: () => {
        funds += 1
      },
      onPayroll: () => {
        payroll += 1
      },
      onResource: () => undefined,
    })
    const capitalBtn = findClass(tree, "hud-economy__capital")
    const payrollBtn = findClass(tree, "hud-economy__payroll")
    expect(capitalBtn?.type).toBe("button")
    expect(payrollBtn?.type).toBe("button")
    capitalBtn?.props.onClick?.()
    capitalBtn?.props.onClick?.()
    expect(funds).toBe(2)
    expect(payroll).toBe(0)
    payrollBtn?.props.onClick?.()
    expect(funds).toBe(2)
    expect(payroll).toBe(1)
    const host = readFileSync(join(repo, "apps/client/src/hud/SceneHost.tsx"), "utf8")
    expect(host.includes("bloomStrengthBps: 0n")).toBe(false)
    expect(host.includes("bloomStrengthBps: props.bloomStrengthBps")).toBe(true)
    const preview = readFileSync(join(repo, "apps/client/src/islandPreview.ts"), "utf8")
    expect(preview.includes("bloomStrengthBps: 0n")).toBe(false)
    expect(preview.includes("bloomStrengthBps,")).toBe(true)
    const three = readFileSync(join(repo, "packages/render/src/three.ts"), "utf8")
    expect(three.includes("look !== undefined ? 0")).toBe(false)
    const app = readFileSync(join(repo, "apps/client/src/hud/App.tsx"), "utf8")
    expect(app.includes('openRoute("bank")')).toBe(true)
    expect(pack.bloomStrengthBps).toBe(3500n)
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
