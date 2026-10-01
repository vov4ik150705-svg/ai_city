import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { buildHud, emptySnapshot, loadClientPack, loadStringTable } from "../src/index.ts"
import { AgentsScreen, commitAssignment } from "../src/hud/screens/agents.tsx"
import { ExchangeScreen, beginExchangeBuy } from "../src/hud/screens/exchange.tsx"
import type { ScreenProps } from "../src/hud/parts/ScreenFrame.tsx"
import type { WalletRequest } from "../src/walletLogin.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

describe("W22", () => {
  const pack = loadClientPack(loadPack(new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))).pack)
  const strings = loadStringTable(readJson("content/strings/en.json"))

  function propsOf(extra: Partial<ScreenProps> = {}): ScreenProps {
    const view = buildHud({
      pack,
      strings,
      snapshot: extra.view === undefined ? emptySnapshot() : emptySnapshot(),
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
    return {
      view,
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
      ...extra,
    }
  }

  it("calls prepare when the hop is live and does not sign when it is not", async () => {
    const posts: Json[] = []
    let sends = 0
    const wallet: WalletRequest = {
      request: async (args) => {
        if (args.method === "eth_sendTransaction") {
          sends += 1
          return "0xabc"
        }
        if (args.method === "eth_chainId") return "0x" + pack.chainId.toString(16)
        if (args.method === "eth_getTransactionReceipt") return { status: "0x1" }
        return undefined
      },
    }
    const chain = {
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
    }
    const dark = await beginExchangeBuy({
      hopLive: false,
      post: async (fields) => {
        posts.push(fields)
        return {}
      },
      ...chain,
    })
    expect(dark.kind).toBe("failed")
    if (dark.kind === "failed") expect(dark.code).toBe(codes.EXCHANGE_HOP_UNAVAILABLE)
    expect(posts).toHaveLength(0)
    expect(sends).toBe(0)

    const live = await beginExchangeBuy({
      hopLive: true,
      post: async (fields) => {
        posts.push(fields)
        if (fields["phase"] === "prepare") {
          return {
            phase: "prepared",
            ticket: "t1",
            chain_id: pack.chainId.toString(),
            txs: [{ to: "0xhop", data: "0x01", value: "0", label: "buy" }],
          }
        }
        return { ok: true, phase: "applied", effect: "buy_stock" }
      },
      ...chain,
    })
    expect(live.kind).toBe("signed")
    expect(posts[0]).toMatchObject({ phase: "prepare" })
    expect(sends).toBe(1)

    const blocked = renderToStaticMarkup(
      createElement(
        ExchangeScreen,
        propsOf({
          view: buildHud({
            pack,
            strings,
            snapshot: { ...emptySnapshot(), cityTime: 12n, cityLevel: 3n, quoteLive: false },
            nowMs: 0n,
            firstLoginMs: 0n,
            demo: false,
          }),
        }),
      ),
    )
    expect(blocked.includes(codes.EXCHANGE_HOP_UNAVAILABLE)).toBe(true)
    expect(blocked.includes("data-txn")).toBe(false)
    expect(blocked.includes("UI_TXN_AWAITING_AUTHORIZATION")).toBe(false)
    expect(blocked.includes('data-action="exchange_buy"')).toBe(false)
  })

  it("omits a building whose construction is still running", () => {
    const view = buildHud({
      pack,
      strings,
      snapshot: {
        ...emptySnapshot(),
        agents: [{ id: "a1", idleKey: "UI_AVAILABLE", role: "engineer" }],
        functions: [
          { id: "workshop", nameKey: "UI_BLD_WORKSHOP", statusKey: "IDLE_NO_AGENT", construction: 0n },
          { id: "energy_plant", nameKey: "UI_BLD_ENERGY_PLANT", statusKey: "IDLE_NO_AGENT", construction: 4n },
        ],
      },
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: false,
    })
    const html = renderToStaticMarkup(createElement(AgentsScreen, propsOf({ view })))
    expect(html.includes('data-assign-ids="workshop"')).toBe(true)
    expect(html.includes("energy_plant")).toBe(false)
  })

  it("shows the server refusal when the seat is gone and does not reject", async () => {
    const code = await commitAssignment(() => Promise.reject(new Error("BUILDING_MISSING")))
    expect(code).toBe("BUILDING_MISSING")
    const empty = await commitAssignment(() => Promise.resolve({ kind: "applied" }))
    expect(empty).toBe("")
  })
})
