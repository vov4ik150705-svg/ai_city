import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { buildHud, emptySnapshot, loadClientPack, loadStringTable } from "../src/index.ts"
import { BankScreen, beginPresent, withdrawReviewAllowed, type BankVoucher } from "../src/hud/screens/bank.tsx"
import { runCsCommand } from "../src/hud/walletTx.ts"
import type { ScreenProps } from "../src/hud/parts/ScreenFrame.tsx"
import type { WalletRequest } from "../src/walletLogin.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

describe("W21", () => {
  const pack = loadClientPack(loadPack(new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))).pack)
  const strings = loadStringTable(readJson("content/strings/en.json"))

  function propsOf(over: Partial<ScreenProps> & { readonly startAmount?: string } = {}): ScreenProps & { readonly startTab?: "withdraw"; readonly startAmount?: string } {
    const view = buildHud({
      pack,
      strings,
      snapshot: {
        ...emptySnapshot(),
        accountKind: "wallet",
        capital: 100n,
        cityTime: 12n,
        bankLimitLive: 1000n,
        corp: 5n * 10n ** pack.weiDecimals,
      },
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
      startTab: "withdraw",
      ...over,
    }
  }

  it("keeps a mock deposit to one applied reply and starts a live deposit with prepare", async () => {
    const mockPosts: Json[] = []
    const mock = await runCsCommand({
      post: async (fields) => {
        mockPosts.push(fields)
        return { ok: true, phase: "applied", effect: "deposit", minted: "1" }
      },
      wallet: undefined,
      from: "",
      expectedChainId: pack.chainId,
      rpcUrl: pack.chainRpc,
      chainName: "Robinhood Chain",
      nativeSymbol: "ETH",
      nativeDecimals: 18,
      pollMs: 1n,
      timeoutMs: 1n,
      now: () => 0n,
      sleep: async () => {},
    })
    expect(mock.kind).toBe("applied")
    expect(mockPosts).toHaveLength(1)
    expect(mockPosts[0]).toMatchObject({ phase: "prepare" })

    const livePosts: Json[] = []
    const calls: string[] = []
    const wallet: WalletRequest = {
      request: async (args) => {
        calls.push(args.method)
        if (args.method === "eth_chainId") return "0x" + pack.chainId.toString(16)
        if (args.method === "eth_sendTransaction") return "0xabc"
        if (args.method === "eth_getTransactionReceipt") return { status: "0x1" }
        return undefined
      },
    }
    const live = await runCsCommand({
      post: async (fields) => {
        livePosts.push(fields)
        const phase = fields["phase"]
        if (phase === "prepare") {
          return {
            phase: "prepared",
            ticket: "t1",
            chain_id: pack.chainId.toString(),
            txs: [{ to: "0xvault", data: "0x01", value: "0", label: "deposit" }],
          }
        }
        return { ok: true, phase: "applied", effect: "deposit" }
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
    })
    expect(live.kind).toBe("signed")
    expect(livePosts[0]).toMatchObject({ phase: "prepare" })
    expect(calls.includes("eth_sendTransaction")).toBe(true)
    expect(livePosts[1]).toMatchObject({ phase: "confirm" })
  })

  it("does not send a transaction when no voucher is open", async () => {
    let signs = 0
    const idle = await beginPresent({
      voucher: undefined,
      sign: async () => {
        signs += 1
      },
    })
    const open: BankVoucher = { id: "v1", status: "signing", corp: "1" }
    const waiting = await beginPresent({
      voucher: open,
      sign: async () => {
        signs += 1
      },
    })
    expect(idle).toBe(false)
    expect(waiting).toBe(false)
    expect(signs).toBe(0)
    const html = renderToStaticMarkup(createElement(BankScreen, propsOf()))
    expect(html.includes('data-present="idle"')).toBe(true)
    expect(html.includes('data-blocked-code="UI_NO_VOUCHER"')).toBe(true)
    const issued = await beginPresent({
      voucher: { id: "v1", status: "issued", corp: "1" },
      sign: async () => {
        signs += 1
      },
    })
    expect(issued).toBe(true)
    expect(signs).toBe(1)
  })

  it("does not open withdraw review when the amount is above capital", () => {
    expect(withdrawReviewAllowed(101n, 100n)).toBe(false)
    expect(withdrawReviewAllowed(100n, 100n)).toBe(true)
    const html = renderToStaticMarkup(createElement(BankScreen, propsOf({ startAmount: "101" })))
    expect(html.includes("hud-dialog")).toBe(false)
    expect(html.includes('data-action="bank_withdraw"')).toBe(false)
    const button = /<button[^>]*data-key="UI_REVIEW_TXN"[^>]*>/.exec(html)?.[0] ?? ""
    expect(button.includes("disabled")).toBe(true)
    const ready = renderToStaticMarkup(
      createElement(BankScreen, propsOf({ bankVoucher: { id: "v1", status: "open", corp: "3" } })),
    )
    expect(ready.includes('data-key="UI_VOUCHER_READY"')).toBe(true)
    expect(ready.includes(`data-exact="${pack.voucherTtlS.toString()}"`)).toBe(true)
    expect(ready.includes('data-present="open"')).toBe(true)
  })
})
