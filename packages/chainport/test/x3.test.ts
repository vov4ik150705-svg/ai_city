import { bytesToHex, keccak256 } from "@corporator/engine"
import { codes } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import {
  createLiveTransport,
  createMockPort,
  createRpcPort,
  type JsonRpcPost,
  type PortConfig,
} from "../src/index.ts"
import { selector } from "../src/rpc/abi.ts"
import { bytesToHex as portHex, keccak256 as portKeccak } from "../src/rpc/keccak.ts"
import { ROLE_ENV } from "../src/rpc/sign.ts"

const cfg: PortConfig = {
  voucherTtlS: 1n,
  voucherSignerService: "voucher",
  buybackExecutorService: "buyback",
}

function padAddr(n: bigint): string {
  return "0x" + n.toString(16).padStart(40, "0")
}

function word(n: bigint): string {
  return n.toString(16).padStart(64, "0")
}

function sel(sig: string): string {
  return bytesToHex(keccak256(new TextEncoder().encode(sig))).slice(0, 8)
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function live(post: JsonRpcPost) {
  return createRpcPort(
    cfg,
    createLiveTransport(
      {
        url: "http://127.0.0.1",
        chainId: 1n,
        timeoutMs: 1n,
        bps: 1n,
        gasHeadroomBps: 1n,
        contracts: {
          corpToken: padAddr(1n),
          vault: padAddr(3n),
          stakeRegistry: padAddr(4n),
          merkleRoots: padAddr(5n),
          prizeTreasury: padAddr(6n),
        },
        callers: {
          depositorService: "buyback",
          depositorAddress: padAddr(8n),
          signerService: "voucher",
          signerAddress: padAddr(7n),
        },
      },
      post,
    ),
  )
}

function rpcBody(body: string): { readonly method: string; readonly params: readonly unknown[] } {
  const parsed = JSON.parse(body) as { readonly method?: unknown; readonly params?: unknown }
  const method = typeof parsed.method === "string" ? parsed.method : ""
  const params = Array.isArray(parsed.params) ? parsed.params : []
  return { method, params }
}

describe("X3 chainport", () => {
  it("chainport keccak matches the engine copy", () => {
    const empty = new Uint8Array()
    const abc = new TextEncoder().encode("abc")
    const wide = new Uint8Array(137)
    for (let i = 0; i < wide.length; i += 1) wide[i] = i
    for (const sample of [empty, abc, wide]) {
      expect(sameBytes(portKeccak(sample), keccak256(sample))).toBe(true)
      expect(portHex(sample)).toBe(bytesToHex(sample))
    }
  })

  it("selectors match keccak of the signature", async () => {
    const abi = await import("../src/rpc/abi.ts")
    expect("dataUnstake" in abi).toBe(false)
    expect(Object.hasOwn(selector, "unstake")).toBe(false)
    expect(selector.mintCapital).toBe(sel("mintCapital(address,uint256,uint256)"))
    expect(selector.requestUnstake).toBe(sel("requestUnstake(string,uint256)"))
    expect(selector.claimUnstaked).toBe(sel("claimUnstaked(string)"))
    expect(selector.coolingSnapshot).toBe(sel("coolingSnapshot(address)"))
    expect(selector.outcomeOf).toBe(sel("outcomeOf(string)"))
    expect(selector.releaseExpiredVoucher).toBe(sel("releaseExpiredVoucher(string)"))
    expect(selector.owed).toBe(sel("owed(uint8,address,address)"))
    expect(selector.unsliced).toBe(sel("unsliced(uint8,address)"))
    expect(selector.prizeSlice).toBe(sel("slice(bytes32,address,uint8,address[],uint256[])"))
  })

  it("parses receipt logs and treats a missing logs field as an empty list", async () => {
    const player = padAddr(9n)
    const corp = padAddr(1n)
    const token = padAddr(2n)
    const topic = "0x" + "ab".repeat(32)
    const withLogs = {
      status: "0x1",
      from: player,
      to: corp,
      input: "0xabcdef",
      logs: [{ address: token, topics: [topic], data: "0x01" }],
    }
    const bare = { status: "0x1", from: player, to: corp, input: "0x" }
    let mode: "logs" | "bare" = "logs"
    const post: JsonRpcPost = async (body) => {
      const row = rpcBody(body)
      if (row.method !== "eth_getTransactionReceipt") return undefined
      const result = mode === "logs" ? withLogs : bare
      return JSON.stringify({ jsonrpc: "2.0", id: "0", result })
    }
    const port = live(post)
    const parsed = await port.chain.transactionReceipt("0x" + "cd".repeat(32))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.logs.length).toBe(1)
    expect(parsed.logs[0]?.address).toBe(token)
    expect(parsed.logs[0]?.topics[0]).toBe(topic)
    expect(parsed.logs[0]?.data).toBe("0x01")
    mode = "bare"
    const empty = await port.chain.transactionReceipt("0x" + "ce".repeat(32))
    expect(empty.ok).toBe(true)
    if (!empty.ok) return
    expect(empty.logs.length).toBe(0)
  })

  it("balanceOf with a token calls that token", async () => {
    const player = padAddr(9n)
    const token = padAddr(2n)
    const targets: string[] = []
    const post: JsonRpcPost = async (body) => {
      const row = rpcBody(body)
      if (row.method !== "eth_call") return undefined
      const call = row.params[0]
      if (call !== null && typeof call === "object" && !Array.isArray(call)) {
        const to = (call as { readonly to?: unknown }).to
        if (typeof to === "string") targets.push(to)
      }
      return JSON.stringify({ jsonrpc: "2.0", id: "0", result: "0x" + "0".repeat(63) + "4" })
    }
    const port = live(post)
    const corpBal = await port.corpToken.balanceOf(player)
    const tokenBal = await port.corpToken.balanceOf(player, token)
    expect(corpBal.ok && corpBal.amount).toBe(4n)
    expect(tokenBal.ok && tokenBal.amount).toBe(4n)
    expect(targets).toEqual([padAddr(1n), token])
  })

  it("slice without the signer key is silence and posts no transaction", async () => {
    const previous = process.env[ROLE_ENV.signer]
    delete process.env[ROLE_ENV.signer]
    const methods: string[] = []
    const post: JsonRpcPost = async (body) => {
      methods.push(rpcBody(body).method)
      return JSON.stringify({ jsonrpc: "2.0", id: "0", result: "0x1" })
    }
    try {
      const port = live(post)
      const sliced = await port.prizeTreasury.slice(
        "voucher",
        "0x" + "ab".repeat(32),
        padAddr(2n),
        0n,
        [padAddr(9n)],
        [1n],
      )
      expect(sliced.ok).toBe(false)
      if (!sliced.ok) expect(sliced.code).toBe(codes.SERVICE_DEGRADED)
      expect(methods.includes("eth_sendTransaction")).toBe(false)
      expect(methods.includes("eth_sendRawTransaction")).toBe(false)
    } finally {
      if (previous === undefined) delete process.env[ROLE_ENV.signer]
      else process.env[ROLE_ENV.signer] = previous
    }
  })

  it("latestBlockTime uses the block timestamp and silence is not zero", async () => {
    let stamp: unknown = "0x10"
    const post: JsonRpcPost = async (body) => {
      const row = rpcBody(body)
      if (row.method !== "eth_getBlockByNumber") return undefined
      expect(row.params[0]).toBe("latest")
      if (stamp === "silence") return undefined
      return JSON.stringify({ jsonrpc: "2.0", id: "0", result: { timestamp: stamp } })
    }
    const port = live(post)
    const clock = await port.chain.latestBlockTime()
    expect(clock.ok && clock.amount).toBe(16n)
    stamp = "yesterday"
    const lied = await port.chain.latestBlockTime()
    expect(lied.ok).toBe(false)
    if (!lied.ok) expect(lied.code).toBe(codes.SERVICE_DEGRADED)
    stamp = "0x"
    const bare = await port.chain.latestBlockTime()
    expect(bare.ok).toBe(false)
    if (!bare.ok) expect(bare.code).toBe(codes.SERVICE_DEGRADED)
    stamp = 12
    const numeric = await port.chain.latestBlockTime()
    expect(numeric.ok).toBe(false)
    if (!numeric.ok) expect(numeric.code).toBe(codes.SERVICE_DEGRADED)
    stamp = "silence"
    const down = await port.chain.latestBlockTime()
    expect(down.ok).toBe(false)
    if (!down.ok) expect(down.code).toBe(codes.SERVICE_DEGRADED)
  })

  it("requestUnstake builds the new selector and an empty cooling return is an empty list", async () => {
    const player = padAddr(9n)
    const empty = "0x" + word(96n) + word(128n) + word(160n) + word(0n) + word(0n) + word(0n)
    let sent = ""
    const post: JsonRpcPost = async (body) => {
      const row = rpcBody(body)
      if (row.method === "eth_sendTransaction") {
        const call = row.params[0]
        if (call !== null && typeof call === "object" && !Array.isArray(call)) {
          const data = (call as { readonly data?: unknown }).data
          if (typeof data === "string") sent = data
        }
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: "0x" + "11".repeat(32) })
      }
      if (row.method === "eth_call") {
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: empty })
      }
      return undefined
    }
    const port = live(post)
    const asked = await port.stakeRegistry.requestUnstake(player, "NVDA", 1n)
    expect(asked.ok).toBe(true)
    expect(sent.startsWith("0x" + selector.requestUnstake)).toBe(true)
    expect(sent.startsWith("0x" + sel("unstake(string,uint256)"))).toBe(false)
    const cool = await port.stakeRegistry.coolingSnapshot(player)
    expect(cool.ok).toBe(true)
    if (cool.ok) expect(cool.rows.length).toBe(0)
  })

  it("mock unstake is immediate and the mock clock does not invent a time", async () => {
    const account = "a"
    const mock = createMockPort(cfg, { corp: { [account]: 10n } })
    expect((await mock.stakeRegistry.stake(account, "NVDA", 3n)).ok).toBe(true)
    expect((await mock.stakeRegistry.requestUnstake(account, "NVDA", 3n)).ok).toBe(true)
    const cool = await mock.stakeRegistry.coolingSnapshot(account)
    expect(cool.ok).toBe(true)
    if (cool.ok) expect(cool.rows.length).toBe(0)
    expect((await mock.stakeRegistry.claimUnstaked(account, "NVDA")).ok).toBe(false)
    const clock = await mock.chain.latestBlockTime()
    expect(clock.ok).toBe(false)
    if (!clock.ok) expect(clock.code).toBe(codes.SERVICE_DEGRADED)
    expect((await mock.vault.deposit(account, 10n)).ok).toBe(true)
    expect((await mock.vault.mintCapital(account, 10n, 10n)).ok).toBe(true)
    const voucher = { nonce: "n", account, corpAmount: 1n, issuedAtS: 0n }
    expect((await mock.vault.issueVoucher(voucher)).ok).toBe(true)
    const before = await mock.corpToken.balanceOf(account)
    expect((await mock.vault.releaseExpiredVoucher("n")).ok).toBe(true)
    const after = await mock.corpToken.balanceOf(account)
    const outcome = await mock.vault.outcomeOf("n")
    expect(outcome.ok && outcome.amount).toBe(2n)
    expect(before.ok && after.ok && after.amount === before.amount).toBe(true)
  })
})
