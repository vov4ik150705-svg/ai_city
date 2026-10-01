import { describe, expect, it } from "vitest"
import { codes } from "@corporator/protocol"
import { ensurePackChain, finishChainSign, type ChainTx } from "../src/hud/walletTx.ts"
import type { WalletRequest } from "../src/walletLogin.ts"

const txA: ChainTx = { to: "0xaaa", data: "0x01", value: "0" }
const txB: ChainTx = { to: "0xbbb", data: "0x02", value: "0" }

function wallet(handler: (method: string, params: readonly unknown[] | undefined) => Promise<unknown> | unknown): {
  readonly calls: string[]
  readonly request: WalletRequest
} {
  const calls: string[] = []
  const request: WalletRequest = {
    request: async (args) => {
      calls.push(args.method)
      return handler(args.method, args.params)
    },
  }
  return { calls, request }
}

describe("W18", () => {
  it("signs two transactions in order and does not confirm when the second is rejected", async () => {
    let sends = 0
    const { calls, request } = wallet(async (method) => {
      if (method === "eth_sendTransaction") {
        sends += 1
        if (sends === 1) return "0x11"
        throw new Error("rejected")
      }
      if (method === "eth_getTransactionReceipt") return { status: "0x1" }
      return undefined
    })
    let confirmed = 0
    const signed = await finishChainSign({
      wallet: request,
      from: "0xabc",
      txs: [txA, txB],
      pollMs: 1n,
      timeoutMs: 5n,
      now: () => 0n,
      sleep: async () => {},
      confirm: async () => {
        confirmed += 1
      },
    })
    expect(signed.ok).toBe(false)
    expect(calls).toEqual(["eth_sendTransaction", "eth_getTransactionReceipt", "eth_sendTransaction"])
    expect(confirmed).toBe(0)
  })

  it("switches chain before adding one when the wallet is on the wrong network", async () => {
    let reads = 0
    const { calls, request } = wallet(async (method) => {
      if (method === "eth_chainId") {
        reads += 1
        return reads === 1 ? "0x1" : "0x1237"
      }
      return undefined
    })
    const chain = await ensurePackChain({
      wallet: request,
      chainId: 4663n,
      rpcUrl: "https://rpc.example",
      chainName: "Robinhood Chain",
      nativeSymbol: "ETH",
      nativeDecimals: 18,
    })
    expect(chain.ok).toBe(true)
    const walletCalls = calls.filter((method) => method.startsWith("wallet_"))
    expect(walletCalls[0]).toBe("wallet_switchEthereumChain")
    expect(calls.includes("wallet_addEthereumChain")).toBe(false)
  })

  it("does not send a transaction when prepare returned no txs", async () => {
    const { calls, request } = wallet(async () => {
      throw new Error("should not be asked")
    })
    let confirmed = 0
    const signed = await finishChainSign({
      wallet: request,
      from: "0xabc",
      txs: [],
      pollMs: 1n,
      timeoutMs: 5n,
      now: () => 0n,
      sleep: async () => {},
      confirm: async () => {
        confirmed += 1
      },
    })
    expect(signed.ok).toBe(true)
    if (signed.ok) expect(signed.hashes.length).toBe(0)
    expect(calls.filter((method) => method === "eth_sendTransaction").length).toBe(0)
    expect(confirmed).toBe(0)
    expect(codes.WALLET_TX_REJECTED.length > 0).toBe(true)
  })
})
