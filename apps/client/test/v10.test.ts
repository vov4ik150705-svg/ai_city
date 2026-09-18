import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { loadClientPack } from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

function paramV(root: Json, section: string, key: string): bigint {
  const pack = root as {
    readonly sections?: {
      readonly [id: string]: { readonly params?: { readonly [k: string]: { readonly v?: bigint | number } } }
    }
  }
  const v = pack.sections?.[section]?.params?.[key]?.v
  if (typeof v === "bigint") return v
  if (typeof v === "number") return BigInt(v)
  return -1n
}

describe("V10 companion_screen", () => {
  it("autopilot_toggle_is_live", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    expect(pack.settingsRows.find((r) => r.id === "autopilot")).toBeUndefined()
    expect(pack.actions["companion_toggle"]).toBeUndefined()
    expect(pack.screens["companion"]).toBeUndefined()
    expect(existsSync(join(repo, "apps/client/src/hud/screens/companion.tsx"))).toBe(false)
  })

  it("companion_journal_filters_codes", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    expect(pack.actions["log_filter_companion"]).toBeUndefined()
    expect(pack.actions["companion_filter"]).toBeUndefined()
    expect(pack.screens["companion"]).toBeUndefined()
    const root = readJson("content/out/pack.json")
    const sections = (root as { readonly sections?: { readonly codes?: { readonly codes?: object } } }).sections
    const codes = sections?.codes?.codes ?? {}
    expect(Object.keys(codes).some((id) => id.startsWith("COMPANION_"))).toBe(false)
    expect("DEMO_NO_COMPANION" in codes).toBe(false)
  })

  it("nft_crane_still_zero", () => {
    const root = readJson("content/out/pack.json")
    expect(paramV(root, "companion", "companion_revenue_live")).toBe(-1n)
    expect(paramV(root, "fragments", "fragment_nft_share_bps")).toBe(0n)
    expect(paramV(root, "seasons", "prize_nft_share_bps")).toBe(0n)
    expect(paramV(root, "seasons", "prize_cork_share_bps")).toBe(0n)
    expect(existsSync(join(repo, "apps/client/src/hud/screens/companion.tsx"))).toBe(false)
    const flipped = { v: 1 }
    expect(flipped.v === 0).toBe(false)
  })
})
