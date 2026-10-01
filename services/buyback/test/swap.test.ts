import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { keccak256Hex } from "@corporator/engine"
import { addressOfPrivateKey } from "../../../packages/chainport/src/rpc/sign.ts"
import { collectorDepsFromEnv, loadBuybackPack, resetSwapInflight } from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const priv = "0x" + "11".repeat(32)
const token = "0x" + "ef".repeat(20)
const hopTo = "0x" + "33".repeat(20)
const hopData = "0x" + "ab".repeat(4)
const logged = 7n
const chain = "4663"

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function word(addr: string): string {
  const hex = addr.startsWith("0x") ? addr.slice(2) : addr
  return "0x" + hex.padStart(64, "0")
}

function transferTopic(): string {
  return "0x" + keccak256Hex(new TextEncoder().encode("Transfer(address,address,uint256)"))
}

function rpc(result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: "0", result }), { status: 200 })
}

function receipt(to: string): { readonly status: string; readonly logs: readonly { readonly address: string; readonly topics: readonly string[]; readonly data: string }[] } {
  return {
    status: "0x1",
    logs: [
      {
        address: token,
        topics: [transferTopic(), word(hopTo), word(to)],
        data: "0x" + logged.toString(16).padStart(64, "0"),
      },
    ],
  }
}

const methods: string[] = []
const original = globalThis.fetch

afterEach(() => {
  globalThis.fetch = original
  methods.length = 0
  resetSwapInflight()
})

describe("live swap", () => {
  it("broadcasts the quoted swap and reads the Transfer from the receipt", async () => {
    const executor = addressOfPrivateKey(priv)
    expect(executor).toBeTypeOf("string")
    if (executor === undefined) return
    const pack = loadBuybackPack(packBytes())
    globalThis.fetch = async (url, init) => {
      const target = String(url)
      if (target.startsWith("http://hop.invalid")) {
        return new Response(
          JSON.stringify({ stock_out: "1", to: hopTo, data: hopData, value: "0" }),
          { status: 200 },
        )
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as { readonly method?: string }
      const method = body.method ?? ""
      methods.push(method)
      if (method === "eth_chainId") return rpc("0x1237")
      if (method === "eth_getTransactionCount") return rpc("0x1")
      if (method === "eth_gasPrice") return rpc("0x1")
      if (method === "eth_estimateGas") return rpc("0x5208")
      if (method === "eth_sendRawTransaction") return rpc("0x" + "aa".repeat(32))
      if (method === "eth_getTransactionReceipt") return rpc(receipt(executor))
      return rpc(null)
    }
    const env = {
      CORPORATOR_HOP_URL: "http://hop.invalid/swap",
      CORPORATOR_RPC_URL: "http://rpc.invalid",
      CORPORATOR_RPC_TIMEOUT_MS: "1000",
      CORPORATOR_CHAIN_ID: chain,
      CORPORATOR_BUYBACK_EXECUTOR: executor,
      CORPORATOR_BUYBACK_EXECUTOR_KEY: priv,
      CORPORATOR_STOCK_NVDA: token,
    }
    const got = await collectorDepsFromEnv(env, pack).hop("NVDA", 1000n)
    expect(methods.includes("eth_sendRawTransaction")).toBe(true)
    expect(got.hopOk).toBe(1n)
    expect(got.stockOut).toBe(logged)
  })

  it("does not count a receipt Transfer to another address", async () => {
    const executor = addressOfPrivateKey(priv)
    if (executor === undefined) return
    const pack = loadBuybackPack(packBytes())
    globalThis.fetch = async (url, init) => {
      const target = String(url)
      if (target.startsWith("http://hop.invalid")) {
        return new Response(JSON.stringify({ stock_out: "1", to: hopTo, data: hopData, value: "0" }), { status: 200 })
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as { readonly method?: string }
      const method = body.method ?? ""
      if (method === "eth_chainId") return rpc("0x1237")
      if (method === "eth_getTransactionCount") return rpc("0x2")
      if (method === "eth_gasPrice") return rpc("0x1")
      if (method === "eth_estimateGas") return rpc("0x5208")
      if (method === "eth_sendRawTransaction") return rpc("0x" + "bb".repeat(32))
      if (method === "eth_getTransactionReceipt") return rpc(receipt(hopTo))
      return rpc(null)
    }
    const env = {
      CORPORATOR_HOP_URL: "http://hop.invalid/swap",
      CORPORATOR_RPC_URL: "http://rpc.invalid",
      CORPORATOR_RPC_TIMEOUT_MS: "1000",
      CORPORATOR_CHAIN_ID: chain,
      CORPORATOR_BUYBACK_EXECUTOR: executor,
      CORPORATOR_BUYBACK_EXECUTOR_KEY: priv,
      CORPORATOR_STOCK_NVDA: token,
    }
    const got = await collectorDepsFromEnv(env, pack).hop("NVDA", 1000n)
    expect(got.hopOk).toBe(0n)
    expect(got.stockOut).toBe(0n)
  })

  it("does not broadcast a second swap while the first receipt is missing", async () => {
    const executor = addressOfPrivateKey(priv)
    if (executor === undefined) return
    const pack = loadBuybackPack(packBytes())
    let sends = 0
    globalThis.fetch = async (url, init) => {
      const target = String(url)
      if (target.startsWith("http://hop.invalid")) {
        return new Response(JSON.stringify({ stock_out: "1", to: hopTo, data: hopData, value: "0" }), { status: 200 })
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as { readonly method?: string }
      const method = body.method ?? ""
      if (method === "eth_chainId") return rpc("0x1237")
      if (method === "eth_getTransactionCount") return rpc("0x3")
      if (method === "eth_gasPrice") return rpc("0x1")
      if (method === "eth_estimateGas") return rpc("0x5208")
      if (method === "eth_sendRawTransaction") {
        sends += 1
        return rpc("0x" + "cc".repeat(32))
      }
      if (method === "eth_getTransactionReceipt") return rpc(null)
      return rpc(null)
    }
    const env = {
      CORPORATOR_HOP_URL: "http://hop.invalid/swap",
      CORPORATOR_RPC_URL: "http://rpc.invalid",
      CORPORATOR_RPC_TIMEOUT_MS: "1000",
      CORPORATOR_CHAIN_ID: chain,
      CORPORATOR_BUYBACK_EXECUTOR: executor,
      CORPORATOR_BUYBACK_EXECUTOR_KEY: priv,
      CORPORATOR_STOCK_NVDA: token,
    }
    const deps = collectorDepsFromEnv(env, pack)
    const first = await deps.hop("NVDA", 1000n)
    const second = await deps.hop("NVDA", 1000n)
    expect(first.stockOut).toBe(0n)
    expect(second.stockOut).toBe(0n)
    expect(sends).toBe(1)
  })

  it("keeps a pending NVDA receipt when the next hop is another ticker", async () => {
    const executor = addressOfPrivateKey(priv)
    if (executor === undefined) return
    const pack = loadBuybackPack(packBytes())
    let sends = 0
    let reads = 0
    globalThis.fetch = async (url, init) => {
      const target = String(url)
      if (target.startsWith("http://hop.invalid")) {
        return new Response(JSON.stringify({ stock_out: "1", to: hopTo, data: hopData, value: "0" }), { status: 200 })
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as { readonly method?: string }
      const method = body.method ?? ""
      if (method === "eth_chainId") return rpc("0x1237")
      if (method === "eth_getTransactionCount") return rpc("0x4")
      if (method === "eth_gasPrice") return rpc("0x1")
      if (method === "eth_estimateGas") return rpc("0x5208")
      if (method === "eth_sendRawTransaction") {
        sends += 1
        return rpc("0x" + "dd".repeat(32))
      }
      if (method === "eth_getTransactionReceipt") {
        reads += 1
        if (reads === 1) return rpc(null)
        return rpc(receipt(executor))
      }
      return rpc(null)
    }
    const env = {
      CORPORATOR_HOP_URL: "http://hop.invalid/swap",
      CORPORATOR_RPC_URL: "http://rpc.invalid",
      CORPORATOR_RPC_TIMEOUT_MS: "1000",
      CORPORATOR_CHAIN_ID: chain,
      CORPORATOR_BUYBACK_EXECUTOR: executor,
      CORPORATOR_BUYBACK_EXECUTOR_KEY: priv,
      CORPORATOR_STOCK_NVDA: token,
      CORPORATOR_STOCK_TSLA: "0x" + "12".repeat(20),
    }
    const deps = collectorDepsFromEnv(env, pack)
    expect((await deps.hop("NVDA", 1000n)).stockOut).toBe(0n)
    expect((await deps.hop("TSLA", 1000n)).stockOut).toBe(0n)
    expect((await deps.hop("NVDA", 1000n)).stockOut).toBe(logged)
    expect(sends).toBe(1)
  })
})
