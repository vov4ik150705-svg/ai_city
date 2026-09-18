import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { claimEveryAsset, CODE_UNCOVERED } from "@corporator/engine"
import { codes } from "@corporator/protocol"
import {
  buildHud,
  emptySnapshot,
  loadClientPack,
  loadStringTable,
  snapshotFromEnvelope,
} from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

describe("M6 prize_surface", () => {
  it("leaderboard_shows_basket_composition", () => {
    const loaded = loadPack(packBytes())
    const pack = loadClientPack(loaded.pack)
    const strings = loadStringTable(readJson("content/strings/ru.json"))
    const tickers = [...pack.prizeAssets]
    expect(tickers.includes("CORP")).toBe(false)
    expect(tickers.sort().join("\n")).toBe(
      [...pack.districts.map((d) => d.ticker)].sort().join("\n"),
    )
    const view = buildHud({
      pack,
      strings,
      snapshot: {
        ...emptySnapshot(),
        prizeBasket: tickers.map((ticker) => ({ ticker, farm: 0n, month: 0n })),
      },
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: true,
    })
    expect(view.basket.map((row) => row.ticker).join("\n")).toBe(tickers.join("\n"))
    expect(view.usedKeys.includes("UI_PRIZE_BASKET")).toBe(true)
    expect(view.periodHours).toBe(pack.prizePeriodRealHours.toString())
    expect(view.treasury.kind).toBe("unavailable")
    expect(view.treasury.value === "0").toBe(false)
    expect(view.treasury.exact).toBe("")
  })

  it("drain_notice_visible_on_leaderboard", () => {
    const loaded = loadPack(packBytes())
    const pack = loadClientPack(loaded.pack)
    const strings = loadStringTable(readJson("content/strings/ru.json"))
    expect(strings[codes.PRIZE_POOL_EMPTY]).toBeDefined()
    expect(strings[codes.PRIZE_CLAIM_UNCOVERED]).toBeDefined()
    const empty = buildHud({
      pack,
      strings,
      snapshot: { ...emptySnapshot(), prizeNoticeKey: codes.PRIZE_POOL_EMPTY },
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
    expect(empty.prizeNotice?.key).toBe(codes.PRIZE_POOL_EMPTY)
    expect(empty.prizeNotice?.text).toBe(strings[codes.PRIZE_POOL_EMPTY])
    expect(empty.usedKeys.includes(codes.PRIZE_POOL_EMPTY)).toBe(true)
    const uncovered = buildHud({
      pack,
      strings,
      snapshot: { ...emptySnapshot(), prizeNoticeKey: codes.PRIZE_CLAIM_UNCOVERED },
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
    expect(uncovered.prizeNotice?.key).toBe(codes.PRIZE_CLAIM_UNCOVERED)
    expect(uncovered.usedKeys.includes(codes.PRIZE_CLAIM_UNCOVERED)).toBe(true)
    const fromHost = snapshotFromEnvelope({
      city_time: 1n,
      account_kind: "wallet",
      sections: {
        "tick.capital": 9n,
        "seasons.prize_basket": { notice: codes.PRIZE_POOL_EMPTY },
      },
    })
    expect(fromHost.prizeNoticeKey).toBe(codes.PRIZE_POOL_EMPTY)
    expect(fromHost.capital).toBe(9n)
    for (const id of pack.menuIds) {
      const action = pack.actions[id]
      if (action === undefined) continue
      expect(action.effect.includes("drain")).toBe(false)
      expect(action.effect.includes("pause")).toBe(false)
    }
  })

  it("claim_returns_every_asset", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const assets = [...pack.prizeAssets]
    expect(assets.includes("CORP")).toBe(false)
    const owed: { [asset: string]: bigint } = {}
    const covered: { [asset: string]: bigint } = {}
    const dry: { [asset: string]: bigint } = {}
    for (const asset of assets) {
      owed[asset] = 10n
      covered[asset] = 10n
      dry[asset] = 0n
    }
    const paid = claimEveryAsset({
      assets,
      owed,
      poolIn: covered,
      demo: false,
    })
    expect(paid.map((row) => row.asset).join("\n")).toBe(assets.join("\n"))
    expect(paid.every((row) => row.paid === 10n && row.code === "")).toBe(true)
    const uncovered = claimEveryAsset({
      assets,
      owed,
      poolIn: dry,
      demo: false,
    })
    expect(uncovered.map((row) => row.asset).join("\n")).toBe(assets.join("\n"))
    expect(uncovered.every((row) => row.paid === 0n && row.code === CODE_UNCOVERED)).toBe(true)
  })
})
