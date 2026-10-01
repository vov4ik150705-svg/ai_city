import { describe, expect, it } from "vitest"
import { keccak256Hex } from "@corporator/engine"
import {
  executorHopFill,
  posterFromEnv,
  type ExecutorSigner,
  type HopLog,
  type HopPoster,
  type HopRequest,
} from "../src/index.ts"

const executor = "0x" + "ab".repeat(20)
const other = "0x" + "cd".repeat(20)
const token = "0x" + "ef".repeat(20)
const executorKey = "0x" + "11".repeat(32)
const playerKey = "0x" + "22".repeat(32)
const hopTo = "0x" + "33".repeat(20)
const hopData = "0x" + "44".repeat(4)
const hopValue = "0"
const quoted = "1000"
const logged = 7n

function transferTopic(): string {
  return "0x" + keccak256Hex(new TextEncoder().encode("Transfer(address,address,uint256)"))
}

function word(addr: string): string {
  const hex = addr.startsWith("0x") ? addr.slice(2) : addr
  return "0x" + hex.padStart(64, "0")
}

function logOf(to: string, amount: bigint, tokenAddr: string = token, topic: string = transferTopic()): HopLog {
  return {
    address: tokenAddr,
    topics: [topic, word(other), word(to)],
    data: "0x" + amount.toString(16).padStart(64, "0"),
  }
}

function quoteBody(): { readonly ok: true; readonly body: { readonly [key: string]: string } } {
  return {
    ok: true,
    body: { stock_out: quoted, to: hopTo, data: hopData, value: hopValue },
  }
}

function recordingPoster(response: { readonly ok: boolean; readonly body: unknown } | undefined): {
  readonly poster: HopPoster
  readonly sent: HopRequest[]
} {
  const sent: HopRequest[] = []
  const poster: HopPoster = async (body) => {
    sent.push(body)
    return response
  }
  return { poster, sent }
}

function spySign(accept: boolean): { readonly sign: ExecutorSigner; readonly keys: string[]; readonly txs: { readonly to: string; readonly data: string; readonly value: string }[] } {
  const keys: string[] = []
  const txs: { readonly to: string; readonly data: string; readonly value: string }[] = []
  const sign: ExecutorSigner = (key, tx) => {
    keys.push(key)
    txs.push(tx)
    return accept && key === executorKey && key !== playerKey
  }
  return { sign, keys, txs }
}

describe("B2 hop receipt", () => {
  it("a hop answer without a Transfer log is not a fill", async () => {
    const { poster, sent } = recordingPoster(quoteBody())
    const { sign, keys } = spySign(true)
    const out = await executorHopFill({
      poster,
      ticker: "NVDA",
      amount: 9n,
      hopQuality: 1n,
      executor,
      executorKey,
      token,
      logs: [],
      sign,
    })
    expect(out.hopOk).toBe(0n)
    expect(out.stockOut).toBe(0n)
    expect(sent.length).toBe(1)
    expect(sent[0]?.recipient).toBe(executor)
    expect(sent[0]?.want).toBe("tx")
    expect(keys.length).toBe(1)
    expect(keys[0]).toBe(executorKey)
  })

  it("a Transfer to another address is not a fill", async () => {
    const { poster } = recordingPoster(quoteBody())
    const { sign, keys } = spySign(true)
    const out = await executorHopFill({
      poster,
      ticker: "NVDA",
      amount: 9n,
      hopQuality: 0n,
      executor,
      executorKey,
      token,
      logs: [logOf(other, logged)],
      sign,
    })
    expect(out.hopOk).toBe(0n)
    expect(out.stockOut).toBe(0n)
    expect(keys[0]).toBe(executorKey)
  })

  it("hop silence is hopOk 0 and does not throw or sign", async () => {
    const quiet = recordingPoster(undefined)
    const thrown: HopPoster = async () => {
      throw new Error("hop down")
    }
    const quietSign = spySign(true)
    const thrownSign = spySign(true)
    const base = {
      ticker: "NVDA",
      amount: 9n,
      hopQuality: 0n,
      executor,
      executorKey,
      token,
      logs: [logOf(executor, logged)],
    }
    const silent = await executorHopFill({ ...base, poster: quiet.poster, sign: quietSign.sign })
    const failed = await executorHopFill({ ...base, poster: thrown, sign: thrownSign.sign })
    expect(silent.hopOk).toBe(0n)
    expect(silent.stockOut).toBe(0n)
    expect(failed.hopOk).toBe(0n)
    expect(failed.stockOut).toBe(0n)
    expect(quietSign.keys.length).toBe(0)
    expect(thrownSign.keys.length).toBe(0)
    expect(quiet.sent.length).toBe(1)
  })

  it("the fill is the Transfer to the executor, and the signer sees only the executor key", async () => {
    const { poster, sent } = recordingPoster(quoteBody())
    const { sign, keys, txs } = spySign(true)
    const out = await executorHopFill({
      poster,
      ticker: "NVDA",
      amount: 9n,
      hopQuality: 1n,
      executor,
      executorKey,
      token,
      logs: [logOf(executor, 3n), logOf(executor, 4n)],
      sign,
    })
    expect(out.hopOk).toBe(1n)
    expect(out.stockOut).toBe(7n)
    expect(out.stockOut).not.toBe(BigInt(quoted))
    const body = sent[0]
    expect(body?.ticker).toBe("NVDA")
    expect(body?.amount).toBe("9")
    expect(body?.hop_quality).toBe("1")
    expect(body?.want).toBe("tx")
    expect(body?.recipient).toBe(executor)
    expect(keys).toEqual([executorKey])
    expect(keys.includes(playerKey)).toBe(false)
    expect(txs[0]?.to).toBe(hopTo)
    expect(txs[0]?.data).toBe(hopData)
    expect(txs[0]?.value).toBe(hopValue)
    const refused = spySign(false)
    const blocked = await executorHopFill({
      poster,
      ticker: "NVDA",
      amount: 9n,
      hopQuality: 1n,
      executor,
      executorKey,
      token,
      logs: [logOf(executor, logged)],
      sign: refused.sign,
    })
    expect(blocked.hopOk).toBe(0n)
    expect(blocked.stockOut).toBe(0n)
  })

  it("a log on the wrong token or the wrong topic is not a fill", async () => {
    const { poster } = recordingPoster(quoteBody())
    const wrongToken = await executorHopFill({
      poster,
      ticker: "NVDA",
      amount: 9n,
      hopQuality: 1n,
      executor,
      executorKey,
      token,
      logs: [logOf(executor, logged, other)],
      sign: spySign(true).sign,
    })
    const wrongTopic = await executorHopFill({
      poster,
      ticker: "NVDA",
      amount: 9n,
      hopQuality: 1n,
      executor,
      executorKey,
      token,
      logs: [logOf(executor, logged, token, "0x" + "ab".repeat(32))],
      sign: spySign(true).sign,
    })
    expect(wrongToken.hopOk).toBe(0n)
    expect(wrongToken.stockOut).toBe(0n)
    expect(wrongTopic.hopOk).toBe(0n)
    expect(wrongTopic.stockOut).toBe(0n)
  })

  it("a missing hop url does not call fetch", async () => {
    let calls = 0
    const poster = posterFromEnv({}, async () => {
      calls += 1
      return { ok: true, json: async () => quoteBody().body }
    })
    const { sign, keys } = spySign(true)
    const out = await executorHopFill({
      poster,
      ticker: "NVDA",
      amount: 9n,
      hopQuality: 0n,
      executor,
      executorKey,
      token,
      logs: [logOf(executor, logged)],
      sign,
    })
    expect(calls).toBe(0)
    expect(out.hopOk).toBe(0n)
    expect(keys.length).toBe(0)
  })
})
