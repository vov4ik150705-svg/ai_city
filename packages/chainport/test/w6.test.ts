import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { atPath, loadPack, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import { createLiveTransport, createRpcPort, type JsonRpcPost, type PortConfig } from "../src/index.ts"
import { transportFromPost } from "../src/rpc/fixture.ts"
import { addressOfPrivateKey, gasLimitOf, parseLegacyTx, recoverLegacySender, ROLE_ENV } from "../src/rpc/sign.ts"

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

function padAddr(n: bigint): string {
  return "0x" + n.toString(16).padStart(40, "0")
}

function qty(n: bigint): string {
  return "0x" + n.toString(16)
}

describe("W6 server signature and chain reads", () => {
  it("signs with the role key, takes the pending nonce, and does not resend it", async () => {
    const loaded = loadPack(packBytes())
    const burn = asBig(atPath(loaded.pack, ["sections", "economy", "params", "spend_burn_bps", "v"]))
    const fund = asBig(atPath(loaded.pack, ["sections", "economy", "params", "spend_fund_bps", "v"]))
    const proto = asBig(atPath(loaded.pack, ["sections", "economy", "params", "spend_protocol_bps", "v"]))
    const bps = burn + fund + proto
    const headroom = asBig(atPath(loaded.pack, ["sections", "api", "params", "server_gas_headroom_bps", "v"]))
    const chainId = asBig(asObj(atPath(loaded.pack, ["sections", "districts", "stake", "snapshot"]))["chain_id"])
    const from = addressOfPrivateKey(PRIV)
    expect(from !== undefined).toBe(true)
    if (from === undefined) return
    const vault = padAddr(2n)
    const estimate = 100000n
    const gasPrice = 3n
    const limit = gasLimitOf(estimate, bps, headroom)
    expect(limit !== undefined).toBe(true)
    const cfg: PortConfig = {
      voucherTtlS: 1n,
      voucherSignerService: "api",
      buybackExecutorService: "buyback",
      bps,
      gasHeadroomBps: headroom,
    }
    const previous = process.env[ROLE_ENV.minter]
    process.env[ROLE_ENV.minter] = PRIV
    let pending = 4n
    let confirmed = false
    const raws: string[] = []
    const sends: string[] = []
    const post: JsonRpcPost = async (body: string) => {
      const row = JSON.parse(body) as { readonly method?: unknown; readonly params?: unknown }
      if (typeof row.method !== "string") return undefined
      if (row.method === "eth_chainId") {
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: qty(chainId) })
      }
      if (row.method === "eth_getTransactionCount") {
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: qty(pending) })
      }
      if (row.method === "eth_gasPrice") {
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: qty(gasPrice) })
      }
      if (row.method === "eth_estimateGas") {
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: qty(estimate) })
      }
      if (row.method === "eth_sendRawTransaction") {
        const params = row.params
        const raw = Array.isArray(params) && typeof params[0] === "string" ? params[0] : ""
        raws.push(raw)
        sends.push(row.method)
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: "0x" + "ab".repeat(32) })
      }
      if (row.method === "eth_getTransactionReceipt") {
        if (!confirmed) return JSON.stringify({ jsonrpc: "2.0", id: "0", result: null })
        return JSON.stringify({
          jsonrpc: "2.0",
          id: "0",
          result: { status: "0x1", from, to: vault, input: "0x" },
        })
      }
      return undefined
    }
    const counted = transportFromPost(post)
    const nonceRead = await counted.call("eth_getTransactionCount", [from, "pending"])
    expect(nonceRead.status).toBe("ok")
    if (nonceRead.status === "ok") expect(nonceRead.body).toBe(qty(pending))
    try {
      const live = createLiveTransport(
        {
          url: "http://127.0.0.1",
          chainId,
          timeoutMs: 1n,
          bps,
          gasHeadroomBps: headroom,
          contracts: {
            corpToken: padAddr(1n),
            vault,
            stakeRegistry: padAddr(3n),
            merkleRoots: padAddr(4n),
          },
        },
        post,
      )
      const port = createRpcPort(cfg, live)
      const first = await port.vault.mintCapital(padAddr(9n), 1n, 1n)
      expect(first.ok).toBe(true)
      expect(sends.length).toBe(1)
      const raw = raws[0]
      expect(raw !== undefined).toBe(true)
      if (raw === undefined) return
      const fields = parseLegacyTx(raw)
      expect(fields !== undefined).toBe(true)
      if (fields === undefined) return
      expect(fields.nonce).toBe(4n)
      expect(fields.gasLimit).toBe(limit)
      expect(recoverLegacySender(raw, chainId)).toBe(from)
      const second = await port.vault.mintCapital(padAddr(9n), 1n, 1n)
      expect(second.ok).toBe(false)
      expect(sends.length).toBe(1)
      confirmed = true
      pending = 5n
      const third = await port.vault.mintCapital(padAddr(9n), 1n, 1n)
      expect(third.ok).toBe(true)
      expect(sends.length).toBe(2)
      const next = raws[1]
      expect(next !== undefined).toBe(true)
      if (next === undefined) return
      expect(parseLegacyTx(next)?.nonce).toBe(5n)
    } finally {
      if (previous === undefined) delete process.env[ROLE_ENV.minter]
      else process.env[ROLE_ENV.minter] = previous
    }
  })

  it("does not send when eth_chainId is not the configured chain", async () => {
    const loaded = loadPack(packBytes())
    const burn = asBig(atPath(loaded.pack, ["sections", "economy", "params", "spend_burn_bps", "v"]))
    const fund = asBig(atPath(loaded.pack, ["sections", "economy", "params", "spend_fund_bps", "v"]))
    const proto = asBig(atPath(loaded.pack, ["sections", "economy", "params", "spend_protocol_bps", "v"]))
    const bps = burn + fund + proto
    const headroom = asBig(atPath(loaded.pack, ["sections", "api", "params", "server_gas_headroom_bps", "v"]))
    const chainId = asBig(asObj(atPath(loaded.pack, ["sections", "districts", "stake", "snapshot"]))["chain_id"])
    const previous = process.env[ROLE_ENV.minter]
    process.env[ROLE_ENV.minter] = PRIV
    const sends: string[] = []
    const post: JsonRpcPost = async (body: string) => {
      const row = JSON.parse(body) as { readonly method?: unknown }
      if (row.method === "eth_chainId") {
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: "0x1" })
      }
      if (row.method === "eth_sendRawTransaction") {
        sends.push("sent")
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: "0x" + "cd".repeat(32) })
      }
      return undefined
    }
    try {
      const live = createLiveTransport(
        {
          url: "http://127.0.0.1",
          chainId,
          timeoutMs: 1n,
          bps,
          gasHeadroomBps: headroom,
          contracts: {
            corpToken: padAddr(1n),
            vault: padAddr(2n),
            stakeRegistry: padAddr(3n),
            merkleRoots: padAddr(4n),
          },
        },
        post,
      )
      const port = createRpcPort(
        { voucherTtlS: 1n, voucherSignerService: "api", buybackExecutorService: "buyback", bps, gasHeadroomBps: headroom },
        live,
      )
      const minted = await port.vault.mintCapital(padAddr(9n), 1n, 1n)
      expect(minted.ok).toBe(false)
      if (!minted.ok) expect(minted.code).toBe(codes.SERVICE_DEGRADED)
      expect(sends.length).toBe(0)
    } finally {
      if (previous === undefined) delete process.env[ROLE_ENV.minter]
      else process.env[ROLE_ENV.minter] = previous
    }
  })

  it("does not sign when the minter key is absent", async () => {
    const loaded = loadPack(packBytes())
    const burn = asBig(atPath(loaded.pack, ["sections", "economy", "params", "spend_burn_bps", "v"]))
    const fund = asBig(atPath(loaded.pack, ["sections", "economy", "params", "spend_fund_bps", "v"]))
    const proto = asBig(atPath(loaded.pack, ["sections", "economy", "params", "spend_protocol_bps", "v"]))
    const bps = burn + fund + proto
    const headroom = asBig(atPath(loaded.pack, ["sections", "api", "params", "server_gas_headroom_bps", "v"]))
    const chainId = asBig(asObj(atPath(loaded.pack, ["sections", "districts", "stake", "snapshot"]))["chain_id"])
    const previous = process.env[ROLE_ENV.minter]
    delete process.env[ROLE_ENV.minter]
    const sends: string[] = []
    const post: JsonRpcPost = async (body: string) => {
      const row = JSON.parse(body) as { readonly method?: unknown }
      if (row.method === "eth_sendRawTransaction") sends.push("sent")
      return JSON.stringify({ jsonrpc: "2.0", id: "0", result: "0x1" })
    }
    try {
      const live = createLiveTransport(
        {
          url: "http://127.0.0.1",
          chainId,
          timeoutMs: 1n,
          bps,
          gasHeadroomBps: headroom,
          contracts: {
            corpToken: padAddr(1n),
            vault: padAddr(2n),
            stakeRegistry: padAddr(3n),
            merkleRoots: padAddr(4n),
          },
        },
        post,
      )
      const port = createRpcPort(
        { voucherTtlS: 1n, voucherSignerService: "api", buybackExecutorService: "buyback", bps, gasHeadroomBps: headroom },
        live,
      )
      const minted = await port.vault.mintCapital(padAddr(9n), 1n, 1n)
      expect(minted.ok).toBe(false)
      if (!minted.ok) expect(minted.code).toBe(codes.SERVICE_DEGRADED)
      expect(sends.length).toBe(0)
    } finally {
      if (previous !== undefined) process.env[ROLE_ENV.minter] = previous
    }
  })
})
