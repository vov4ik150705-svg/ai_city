import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import type { Json } from "../src/index.ts"
import { atPath, loadPack } from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const TICKERS = ["NVDA", "TSLA", "AMZN", "AAPL", "MSFT", "COIN"] as const
const ATOMS = 10n ** 18n

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function asDict(value: Json): { readonly [key: string]: Json } {
  expect(typeof value === "object" && value !== null && !Array.isArray(value)).toBe(true)
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {}
  }
  return value
}

describe.sequential("L6 construction", () => {
  it("smin_frozen_in_tokens", () => {
    const pendingRaw = JSON.parse(
      readFileSync(join(repo, "content/params/pending.json"), "utf8"),
    ) as { readonly items?: { readonly [key: string]: unknown } }
    const items = pendingRaw.items ?? {}
    expect("district_stake_threshold" in items).toBe(false)
    expect("district_stake_reference" in items).toBe(false)
    expect("district_stake_usd_assumption" in items).toBe(false)

    const { pack } = loadPack(packBytes())
    const snapVal = atPath(pack, ["sections", "districts", "stake", "snapshot"])
    expect(snapVal === null).toBe(false)
    const snap = asDict(snapVal)
    expect(typeof snap.at === "string" && snap.at.length >= 10).toBe(true)
    expect(typeof snap.rpc === "string" || typeof snap.src === "string").toBe(true)
    const sMin = asDict(atPath(pack, ["sections", "districts", "stake", "s_min"]))
    const feeds = asDict(snap.feeds ?? {})
    const target = atPath(pack, [
      "sections",
      "balance",
      "params",
      "district_stake_usd_target_8dec",
      "v",
    ])
    expect(typeof target).toBe("bigint")
    if (typeof target !== "bigint") return
    for (const ticker of TICKERS) {
      const rec = asDict(sMin[ticker] ?? {})
      expect(rec.u, ticker).toBe("tokens")
      expect(typeof rec.v).toBe("bigint")
      const feed = asDict(feeds[ticker] ?? {})
      expect(typeof feed.answer).toBe("bigint")
      if (typeof rec.v !== "bigint" || typeof feed.answer !== "bigint") continue
      expect(feed.answer > 0n, ticker).toBe(true)
      expect(rec.v, ticker).toBe((target * ATOMS) / feed.answer)
    }
  })
})
