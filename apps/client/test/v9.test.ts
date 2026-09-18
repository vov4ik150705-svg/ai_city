import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { blockingRefusal, loadClientPack, loadStringTable } from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const screensDir = join(repo, "apps/client/src/hud/screens")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

describe("V9 hud_screens", () => {
  it("every_screen_has_empty_and_loading", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const ids = Object.keys(pack.screens).sort()
    expect(ids.length > 0).toBe(true)
    const files = readdirSync(screensDir).filter((n) => n.endsWith(".tsx")).sort()
    expect(files).toEqual(ids.map((id) => `${id}.tsx`))
    const registry = readFileSync(join(screensDir, "registry.ts"), "utf8")
    for (const id of ids) {
      const meta = pack.screens[id]
      expect(meta).toBeDefined()
      if (meta === undefined) continue
      expect(meta.loadingKind.length > 0).toBe(true)
      expect(meta.emptyKind.length > 0).toBe(true)
      expect(pack.emptyKinds[meta.emptyKind]).toBeDefined()
      expect(registry.includes(`"${id}"`)).toBe(true)
    }
      expect(registry.includes("commit:build")).toBe(true)
  })

  it("refusal_shows_one_blocking_code", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const action = pack.actions["bank_withdraw"]
    expect(action).toBeDefined()
    if (action === undefined) return
    const hit = blockingRefusal({
      action,
      capabilities: pack.capabilities,
      demo: false,
      isolated: pack.demoIsolated,
      failed: new Set(["wallet", "capital"]),
      showCount: pack.refusalShowCount,
    })
    expect(hit.code).toBe(codes.WALLET_NOT_CONNECTED)
    expect(hit.rest.includes(codes.NOT_ENOUGH_CAPITAL)).toBe(true)
    expect(pack.refusalShowCount).toBe(1n)
    expect(pack.onboardSteps.map((s) => s.id)).toEqual(["clock", "seat", "payout", "idle", "bank", "wallet"])
    const last = pack.onboardSteps[pack.onboardSteps.length - 1]
    expect(last?.codes.includes(codes.DEMO_NO_WITHDRAW)).toBe(true)
  })

  it("no_cyrillic_in_components", () => {
    const cyr = /[\u0400-\u04FF]/
    for (const name of readdirSync(screensDir)) {
      if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue
      const text = readFileSync(join(screensDir, name), "utf8")
      expect(cyr.test(text)).toBe(false)
    }
    const css = readFileSync(join(repo, "apps/client/src/hud/hud.css"), "utf8")
    expect(cyr.test(css)).toBe(false)
    const en = loadStringTable(readJson("content/strings/en.json"))
    expect(en["UI_OVERVIEW"]).toBe("Overview")
    expect(cyr.test(en["UI_OVERVIEW"] ?? "")).toBe(false)
    loadStringTable(readJson("content/strings/ru.json"))
  })
})
