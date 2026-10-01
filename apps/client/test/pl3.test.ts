import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { buildHud, emptySnapshot, loadClientPack, loadStringTable } from "../src/index.ts"
import { openIntentFlight } from "../src/hud/parts/ActionButton.tsx"
import { BankScreen } from "../src/hud/screens/bank.tsx"
import { ExchangeScreen, exchangeBlockCode } from "../src/hud/screens/exchange.tsx"
import { OfflineReturnScreen } from "../src/hud/screens/offline_return.tsx"
import type { ScreenProps } from "../src/hud/parts/ScreenFrame.tsx"
import {
  applyWsEvent,
  chainFieldsEmptyFor,
  parseWsEvent,
  patchCarriesChainClock,
  socketResetsQuiet,
} from "../src/hud/wsFeed.ts"
import { runCsCommand } from "../src/hud/walletTx.ts"
import { walletIdentityChanged } from "../src/walletLogin.ts"
import type { WalletRequest } from "../src/walletLogin.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

describe("PL3 client truth", () => {
  const pack = loadClientPack(loadPack(packBytes()).pack)
  const strings = loadStringTable(readJson("content/strings/en.json"))
  const levelNeed = pack.buildingMeta["exchange"]?.cityLevelReq
  if (levelNeed === undefined) throw new Error("exchange level")

  function viewOf(snap: ReturnType<typeof emptySnapshot> = emptySnapshot()) {
    return buildHud({ pack, strings, snapshot: snap, nowMs: 0n, firstLoginMs: 0n, demo: false })
  }

  function propsOf(snap: ReturnType<typeof emptySnapshot> = emptySnapshot()): ScreenProps {
    return {
      view: viewOf(snap),
      pack,
      strings,
      demo: false,
      failed: new Set(),
      loading: false,
      onClose: () => {},
      onNavigate: () => {},
      pendingCell: "",
      pendingTileX: 0n,
      pendingTileY: 0n,
      onIntent: async () => {},
      onCommit: async () => {},
      moneyTxn: undefined,
      onMoneyTxn: () => {},
      onLocal: () => {},
    }
  }

  it("tick patch carries chain time and vouchers and keeps city time", () => {
    const start = {
      ...emptySnapshot(),
      cityTime: 40n,
      chainTimeS: 1n,
      vouchers: [{ id: "old", status: "open", corp: 1n, expiresAtS: 9n }],
    }
    const tick = parseWsEvent({
      channel: "tick",
      city_time: 99n,
      sections: {
        "tick.building_level": {
          chain_time_s: 50n,
          vouchers: [{ id: "new", status: "open", corp: 2n, expires_at_s: 80n }],
        },
      },
    })
    if (tick === undefined || tick.kind !== "patch") throw new Error("tick")
    expect(patchCarriesChainClock(tick.sections)).toBe(true)
    const after = applyWsEvent(start, tick)
    expect(after.cityTime).toBe(40n)
    expect(after.chainTimeS).toBe(50n)
    expect(after.vouchers?.[0]?.id).toBe("new")
  })

  it("pulse does not postpone resync after chain fields stay empty past the pack window", () => {
    const windowMs = 100n
    expect(chainFieldsEmptyFor(undefined, 1_000n, windowMs)).toBe(windowMs + 1n)
    expect(socketResetsQuiet({ patchCarriesChain: false, emptyForMs: windowMs, windowMs })).toBe(true)
    expect(socketResetsQuiet({ patchCarriesChain: false, emptyForMs: windowMs + 1n, windowMs })).toBe(false)
    expect(socketResetsQuiet({ patchCarriesChain: true, emptyForMs: windowMs + 1n, windowMs })).toBe(true)
  })

  it("exchange button code matches hours, level, then the quote", () => {
    expect(exchangeBlockCode({ hoursKey: "BANK_SUNDAY", levelGate: "locked", quoteReady: false })).toBe(codes.BANK_SUNDAY)
    expect(exchangeBlockCode({ hoursKey: "BANK_CLOSED", levelGate: "open", quoteReady: false })).toBe(codes.BANK_CLOSED)
    expect(exchangeBlockCode({ hoursKey: "UI_BANK", levelGate: "locked", quoteReady: true })).toBe(codes.CITY_LEVEL_TOO_LOW)
    expect(exchangeBlockCode({ hoursKey: "UI_BANK", levelGate: "open", quoteReady: false })).toBe(codes.EXCHANGE_HOP_UNAVAILABLE)
    const closed = renderToStaticMarkup(createElement(ExchangeScreen, propsOf()))
    expect(closed.includes('data-blocked-code="BANK_CLOSED"')).toBe(true)
    expect(closed.includes('data-blocked-code="EXCHANGE_HOP_UNAVAILABLE"')).toBe(false)
    const level = renderToStaticMarkup(
      createElement(ExchangeScreen, propsOf({ ...emptySnapshot(), cityTime: 12n, cityLevel: 1n, quoteLive: true, quoteAgeMs: 1n })),
    )
    expect(level.includes('data-blocked-code="CITY_LEVEL_TOO_LOW"')).toBe(true)
    const quote = renderToStaticMarkup(
      createElement(
        ExchangeScreen,
        propsOf({
          ...emptySnapshot(),
          accountKind: "wallet",
          corp: 1n,
          cityTime: 12n,
          cityLevel: levelNeed,
          quoteLive: false,
          quoteAgeMs: 1n,
        }),
      ),
    )
    expect(quote.includes('data-blocked-code="EXCHANGE_HOP_UNAVAILABLE"')).toBe(true)
  })

  it("offline return shows this city's hours or the caught-up fact, not the pack catalog", () => {
    const bare = renderToStaticMarkup(createElement(OfflineReturnScreen, propsOf()))
    expect(bare.includes('data-offline="merge"')).toBe(false)
    expect(bare.includes("$")).toBe(false)
    expect(bare.includes('data-key="UI_OFFLINE_CAUGHT_UP"')).toBe(true)
    const caught = renderToStaticMarkup(createElement(OfflineReturnScreen, propsOf({ ...emptySnapshot(), offlineHours: 4n })))
    expect(caught.includes('data-offline="hours"')).toBe(true)
    expect(caught.includes('data-exact="4"')).toBe(true)
    expect(caught.includes('data-key="UI_OFFLINE_CAUGHT_UP"')).toBe(false)
    expect(caught.includes("$")).toBe(false)
  })

  it("bank mint line uses the snapshot rate and does not label the anchor as the live rate", () => {
    const missing = renderToStaticMarkup(createElement(BankScreen, propsOf()))
    expect(missing.includes(`data-exact="${pack.mintRate.toString()}" class="hud-bank__fact-v"`)).toBe(false)
    expect(missing.includes('class="hud-bank__fact-v"')).toBe(true)
    const live = renderToStaticMarkup(createElement(BankScreen, propsOf({ ...emptySnapshot(), mintRate: 1234n })))
    expect(live.includes('data-exact="1234"')).toBe(true)
    expect(live.includes(`data-exact="${pack.mintRate.toString()}" class="hud-bank__fact-v"`)).toBe(false)
  })

  it("a changed account or chain drops the session and the same account does not", () => {
    const signed = "0xAbC"
    const chain = 4663n
    expect(walletIdentityChanged({ signedAddress: signed, accounts: ["0xabc"], chainId: undefined, expectedChain: chain })).toBe(false)
    expect(walletIdentityChanged({ signedAddress: signed, accounts: ["0xdef"], chainId: undefined, expectedChain: chain })).toBe(true)
    expect(walletIdentityChanged({ signedAddress: signed, accounts: [], chainId: undefined, expectedChain: chain })).toBe(true)
    expect(walletIdentityChanged({ signedAddress: signed, accounts: undefined, chainId: chain, expectedChain: chain })).toBe(false)
    expect(walletIdentityChanged({ signedAddress: signed, accounts: undefined, chainId: chain + 1n, expectedChain: chain })).toBe(true)
  })

  it("a second click does not enter while the first intent is in flight", () => {
    const flight = openIntentFlight()
    expect(flight.enter()).toBe(true)
    expect(flight.enter()).toBe(false)
    flight.leave()
    expect(flight.enter()).toBe(true)
  })

  it("a stale confirm retries the same ticket and does not prepare or sign again", async () => {
    const posts: Json[] = []
    let sends = 0
    const wallet: WalletRequest = {
      request: async (args) => {
        if (args.method === "eth_chainId") return "0x" + pack.chainId.toString(16)
        if (args.method === "eth_sendTransaction") {
          sends += 1
          return "0xabc"
        }
        if (args.method === "eth_getTransactionReceipt") return { status: "0x1" }
        return undefined
      },
    }
    let confirms = 0
    const ran = await runCsCommand({
      post: async (fields) => {
        posts.push(fields)
        if (fields["phase"] === "prepare") {
          return {
            phase: "prepared",
            ticket: "t-same",
            chain_id: pack.chainId.toString(),
            txs: [{ to: "0xvault", data: "0x01", value: "0" }],
          }
        }
        confirms += 1
        if (confirms === 1) throw new Error(codes.API_PACK_STALE)
        return { phase: "applied", effect: "deposit" }
      },
      wallet,
      from: "0xabc",
      expectedChainId: pack.chainId,
      rpcUrl: pack.chainRpc,
      chainName: "Robinhood Chain",
      nativeSymbol: "ETH",
      nativeDecimals: 18,
      pollMs: 1n,
      timeoutMs: 1n,
      now: () => 0n,
      sleep: async () => {},
      beforeConfirm: async () => {},
    })
    expect(ran.kind).toBe("signed")
    expect(sends).toBe(1)
    expect(posts.filter((row) => row["phase"] === "prepare")).toHaveLength(1)
    const confirmsPosted = posts.filter((row) => row["phase"] === "confirm")
    expect(confirmsPosted).toHaveLength(2)
    expect(confirmsPosted[0]?.["ticket"]).toBe("t-same")
    expect(confirmsPosted[1]?.["ticket"]).toBe("t-same")
    expect(confirmsPosted[0]?.["tx_hashes"]).toEqual(confirmsPosted[1]?.["tx_hashes"])
  })
})
