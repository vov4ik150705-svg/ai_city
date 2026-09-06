import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { blockingRefusal, failedTokens, loadClientPack } from "../src/index.ts"
import { autopilotJournalCode, filterNeedle, journalMatchesCompanion } from "../src/hud/screens/companion.tsx"

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
    expect(pack.autopilotLive).toBe(true)
    const row = pack.settingsRows.find((r) => r.id === "autopilot")
    expect(row?.v1).toBe("live")
    const toggle = pack.actions["companion_toggle"]
    expect(toggle).toBeDefined()
    if (toggle === undefined) return
    expect(toggle.v1).toBe("live")
    expect(toggle.requires.includes("v1_feature")).toBe(false)
    expect(toggle.requires.includes("not_demo_companion")).toBe(true)
    expect(autopilotJournalCode(true)).toBe(codes.COMPANION_ACTED)
    expect(autopilotJournalCode(false)).toBe(codes.COMPANION_OFF)
    const hit = blockingRefusal({
      action: toggle,
      capabilities: pack.capabilities,
      demo: true,
      isolated: pack.demoIsolated,
      failed: failedTokens({
        demo: true,
        walletConnected: false,
        capitalPositive: false,
        corpPositive: false,
        bankOpen: true,
        bankSunday: false,
        buildTileIllegal: false,
      }),
      showCount: pack.refusalShowCount,
    })
    expect(hit.code).toBe(codes.DEMO_NO_COMPANION)
    expect(hit.rest.includes(codes.FEATURE_NOT_IN_V1)).toBe(false)
  })

  it("companion_journal_filters_codes", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const logFilter = pack.actions["log_filter_companion"]
    const screenFilter = pack.actions["companion_filter"]
    expect(logFilter).toBeDefined()
    expect(screenFilter).toBeDefined()
    if (logFilter === undefined || screenFilter === undefined) return
    expect(logFilter.effect.startsWith("filter:")).toBe(true)
    expect(screenFilter.effect).toBe(logFilter.effect)
    const needle = filterNeedle(logFilter.effect)
    expect(needle.length > 0).toBe(true)
    expect(journalMatchesCompanion(codes.COMPANION_ACTED, needle)).toBe(true)
    expect(journalMatchesCompanion(codes.COMPANION_OFF, needle)).toBe(true)
    expect(journalMatchesCompanion(codes.DEMO_NO_COMPANION, needle)).toBe(true)
    expect(journalMatchesCompanion(codes.PAYROLL_TRIMMED, needle)).toBe(false)
    expect(pack.screens["companion"]).toBeDefined()
  })

  it("nft_crane_still_zero", () => {
    const root = readJson("content/out/pack.json")
    expect(paramV(root, "companion", "companion_revenue_live")).toBe(0n)
    expect(paramV(root, "fragments", "fragment_nft_share_bps")).toBe(0n)
    expect(paramV(root, "seasons", "prize_nft_share_bps")).toBe(0n)
    expect(paramV(root, "seasons", "prize_cork_share_bps")).toBe(0n)
    const src = readFileSync(join(repo, "apps/client/src/hud/screens/companion.tsx"), "utf8")
    expect(/nft/i.test(src)).toBe(false)
    const flipped = { v: 1 }
    expect(flipped.v === 0).toBe(false)
  })
})
