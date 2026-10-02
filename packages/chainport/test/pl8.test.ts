import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { atPath, loadPack, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { createLiveTransport, createRpcPort, type JsonRpcPost, type PortConfig } from "../src/index.ts"
import { ROLE_ENV, addressOfPrivateKey } from "../src/rpc/sign.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const PRIV = "0x" + "11".repeat(32)

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function asObj(value: Json): { readonly [key: string]: Json } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("pack")
  return value
}

function asBig(value: Json | undefined): bigint {
  if (typeof value !== "bigint") throw new Error("pack")
  return value
}

function asText(value: Json | undefined): string {
  if (typeof value !== "string") throw new Error("pack")
  return value
}

function padAddr(n: bigint): string {
  return "0x" + n.toString(16).padStart(40, "0")
}

function rpcBody(body: string): { readonly method: string; readonly params: readonly unknown[] } {
  const row = JSON.parse(body) as { readonly method?: unknown; readonly params?: unknown }
  if (typeof row.method !== "string" || !Array.isArray(row.params)) throw new Error("rpc")
  return { method: row.method, params: row.params }
}

describe("PL8 raw role transactions", () => {
  it("prizeDeposit signs the executor key and putRoot signs the attestor key", async () => {
    const loaded = loadPack(packBytes())
    const keys = asObj(atPath(loaded.pack, ["sections", "arch", "keys"]))
    const buy = asText(asObj(keys["buyback_executor"])["service"])
    const chainId = 4663n
    const corp = padAddr(1n)
    const vault = padAddr(2n)
    const stake = padAddr(3n)
    const roots = padAddr(4n)
    const prizes = padAddr(5n)
    const methods: string[] = []
    let allowance = "0x" + "0".repeat(64)
    const post: JsonRpcPost = async (body) => {
      const row = rpcBody(body)
      methods.push(row.method)
      if (row.method === "eth_call") {
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: allowance })
      }
      if (row.method === "eth_chainId") {
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: "0x" + chainId.toString(16) })
      }
      if (row.method === "eth_getTransactionCount") {
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: "0x1" })
      }
      if (row.method === "eth_gasPrice") {
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: "0x2" })
      }
      if (row.method === "eth_estimateGas") {
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: "0x5208" })
      }
      if (row.method === "eth_sendRawTransaction") {
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: "0x" + "ab".repeat(32) })
      }
      if (row.method === "eth_getTransactionReceipt") {
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: { status: "0x1" } })
      }
      return undefined
    }
    const cfg: PortConfig = {
      voucherTtlS: asBig(atPath(loaded.pack, ["generated", "api", "voucher_ttl_s"])),
      voucherSignerService: "api",
      buybackExecutorService: buy,
      bps: 10000n,
      gasHeadroomBps: 1000n,
    }
    const live = createLiveTransport(
      {
        url: "http://127.0.0.1:9",
        chainId,
        timeoutMs: 1n,
        bps: 10000n,
        gasHeadroomBps: 1000n,
        contracts: { corpToken: corp, vault, stakeRegistry: stake, merkleRoots: roots, prizeTreasury: prizes },
        callers: {
          depositorService: buy,
          depositorAddress: padAddr(8n),
          signerService: "api",
          signerAddress: padAddr(9n),
        },
      },
      post,
    )
    const port = createRpcPort(cfg, live)
    const executorKey = ROLE_ENV.buyback_executor
    const attestorKey = ROLE_ENV.attestor
    const prevExec = process.env[executorKey]
    const prevAtt = process.env[attestorKey]
    delete process.env[executorKey]
    delete process.env[attestorKey]
    try {
      methods.length = 0
      const quiet = await port.prizeTreasury.deposit(buy, padAddr(6n), 0n, 1n)
      expect(quiet.ok).toBe(false)
      if (!quiet.ok) expect(quiet.code).toBe(codes.SERVICE_DEGRADED)
      expect(methods.includes("eth_sendTransaction")).toBe(false)
      expect(methods.includes("eth_sendRawTransaction")).toBe(false)
      methods.length = 0
      const unsigned = await port.vault.deposit(padAddr(8n), 1n)
      expect(unsigned.ok).toBe(false)
      expect(methods.includes("eth_sendTransaction")).toBe(false)
      expect(methods.includes("eth_sendRawTransaction")).toBe(false)
      process.env[executorKey] = PRIV
      methods.length = 0
      const deposited = await port.prizeTreasury.deposit(buy, padAddr(6n), 0n, 1n)
      expect(deposited.ok).toBe(true)
      expect(methods.includes("eth_sendRawTransaction")).toBe(true)
      expect(methods.includes("eth_sendTransaction")).toBe(false)
      methods.length = 0
      const root = "0x" + "ab".repeat(32)
      const rootQuiet = await port.merkleRoots.putRoot("c", 1n, root)
      expect(rootQuiet.ok).toBe(false)
      expect(methods.includes("eth_sendRawTransaction")).toBe(false)
      process.env[attestorKey] = PRIV
      methods.length = 0
      const rooted = await port.merkleRoots.putRoot("c", 1n, root)
      expect(rooted.ok).toBe(true)
      expect(methods.includes("eth_sendRawTransaction")).toBe(true)
      expect(methods.includes("eth_sendTransaction")).toBe(false)
      const house = addressOfPrivateKey(PRIV)
      expect(house).toBeDefined()
      if (house === undefined) return
      methods.length = 0
      const wrong = await port.vault.deposit(padAddr(8n), 1n)
      expect(wrong.ok).toBe(false)
      expect(methods.includes("eth_sendTransaction")).toBe(false)
      expect(methods.includes("eth_sendRawTransaction")).toBe(false)
      allowance = "0x" + "ff".repeat(32)
      methods.length = 0
      const covered = await port.vault.deposit(house, 1n)
      expect(covered.ok).toBe(true)
      expect(methods.includes("eth_sendTransaction")).toBe(false)
      expect(methods.filter((name) => name === "eth_sendRawTransaction").length).toBe(1)
      allowance = "0x" + "0".repeat(64)
      methods.length = 0
      const opened = await port.vault.deposit(house, 1n)
      expect(opened.ok).toBe(true)
      expect(methods.includes("eth_sendTransaction")).toBe(false)
      expect(methods.filter((name) => name === "eth_sendRawTransaction").length).toBe(2)
      const callers = {
        depositorService: buy,
        depositorAddress: house,
        signerService: "api",
        signerAddress: padAddr(9n),
      }
      const returning = createRpcPort(
        cfg,
        createLiveTransport(
          {
            url: "http://127.0.0.1:9",
            chainId,
            timeoutMs: 1n,
            bps: 10000n,
            gasHeadroomBps: 1000n,
            contracts: { corpToken: corp, vault, stakeRegistry: stake, merkleRoots: roots, prizeTreasury: prizes },
            callers,
          },
          post,
        ),
      )
      methods.length = 0
      const sentBack = await returning.prizeTreasury.returnUnsettled(buy, padAddr(6n), 0n)
      expect(sentBack.ok).toBe(true)
      expect(methods.includes("eth_sendTransaction")).toBe(false)
      expect(methods.includes("eth_sendRawTransaction")).toBe(true)
    } finally {
      if (prevExec === undefined) delete process.env[executorKey]
      else process.env[executorKey] = prevExec
      if (prevAtt === undefined) delete process.env[attestorKey]
      else process.env[attestorKey] = prevAtt
    }
  })
})
