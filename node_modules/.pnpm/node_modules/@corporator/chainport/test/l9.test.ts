import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { atPath, loadPack, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import {
  launchIntent,
  postSignedRaw,
  readCreatorTaxBps,
  type JsonRpcPost,
} from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const ADDR = /^0x[0-9a-fA-F]{40}$/

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function asObj(value: Json): { readonly [key: string]: Json } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(codes.API_MALFORMED)
  }
  return value
}

function asText(value: Json | undefined): string {
  if (typeof value !== "string") throw new Error(codes.API_MALFORMED)
  return value
}

function asBig(value: Json | undefined): bigint {
  if (typeof value !== "bigint") throw new Error(codes.API_MALFORMED)
  return value
}

function encodeUint256(value: bigint): string {
  let hex = value.toString(16)
  while (hex.length < 64) hex = "0" + hex
  return `0x${hex}`
}

function padAddr(n: bigint): `0x${string}` {
  const hex = n.toString(16)
  let out = hex
  while (out.length < 40) out = "0" + out
  return (`0x${out}`) as `0x${string}`
}

describe.sequential("L9 construction", () => {
  it("launch_no_buy", () => {
    const loaded = loadPack(packBytes())
    const share = asBig(atPath(loaded.pack, ["sections", "launch", "params", "launch_buy_share_bps", "v"]))
    const tax = asBig(atPath(loaded.pack, ["sections", "economy", "params", "creator_tax_bps", "v"]))
    const tokens = asBig(atPath(loaded.pack, ["generated", "launch", "launch_buy_tokens"]))
    const gross = asBig(atPath(loaded.pack, ["generated", "launch", "launch_buy_gross_wei"]))
    expect(share).toBe(0n)
    expect(tokens).toBe(0n)
    expect(gross).toBe(0n)
    const intent = launchIntent(share, tax)
    expect(intent).not.toBeUndefined()
    if (intent === undefined) return
    expect(intent.valueWei).toBe(0n)
    expect(intent.taxBps).toBe(tax)
    expect(launchIntent(1n, tax)).toBeUndefined()
    const script = readFileSync(join(repo, "contracts", "script", "PlayerReady.s.sol"), "utf8")
    expect(script.includes("launchAndBuy")).toBe(false)
    expect(script.includes("CORPORATOR_CORP_TOKEN")).toBe(true)
    expect(script.includes("PackConstants.LAUNCH_BUY_SHARE_BPS == 0")).toBe(true)
  })

  it("deployed_tax_matches_pack", async () => {
    const loaded = loadPack(packBytes())
    const tax = asBig(atPath(loaded.pack, ["sections", "economy", "params", "creator_tax_bps", "v"]))
    const constants = readFileSync(join(repo, "contracts", "test", "PackConstants.sol"), "utf8")
    expect(constants.includes(`CREATOR_TAX_BPS = ${tax.toString()}`)).toBe(true)
    expect(constants.includes("LAUNCH_BUY_SHARE_BPS = 0")).toBe(true)
    const deployed = asObj(atPath(loaded.pack, ["sections", "launch", "deployed"]))
    const token = asText(deployed["token"])
    const curve = asText(deployed["curve"])
    const pool = asText(deployed["pool"])
    const hook = asText(deployed["hook"])
    const tx = asText(deployed["tx"])
    expect(token).toBe("")
    expect(curve).toBe("")
    expect(pool).toBe("")
    expect(hook).toBe("")
    expect(tx).toBe("")
    const curveAddr = padAddr(9n)
    expect(ADDR.test(curveAddr)).toBe(true)
    const post: JsonRpcPost = async (body: string) => {
      const row = JSON.parse(body) as { readonly method?: unknown }
      if (row.method !== "eth_call") return undefined
      return JSON.stringify({ jsonrpc: "2.0", id: "0", result: encodeUint256(tax) })
    }
    const got = await readCreatorTaxBps(post, curveAddr)
    expect(got).toBe(tax)
    const liar: JsonRpcPost = async () =>
      JSON.stringify({ jsonrpc: "2.0", id: "0", result: encodeUint256(tax + 1n) })
    const lied = await readCreatorTaxBps(liar, curveAddr)
    expect(lied).toBe(tax + 1n)
    expect(lied === tax).toBe(false)
    const kotsTax = 100n
    expect(tax).not.toBe(kotsTax)
    const kotsPost: JsonRpcPost = async () =>
      JSON.stringify({ jsonrpc: "2.0", id: "0", result: encodeUint256(kotsTax) })
    const kotsGot = await readCreatorTaxBps(kotsPost, curveAddr)
    expect(kotsGot).toBe(kotsTax)
    expect(kotsGot === tax).toBe(false)
  })

  it("launch_raw_tx_has_zero_value", async () => {
    const loaded = loadPack(packBytes())
    const share = asBig(atPath(loaded.pack, ["sections", "launch", "params", "launch_buy_share_bps", "v"]))
    const tax = asBig(atPath(loaded.pack, ["sections", "economy", "params", "creator_tax_bps", "v"]))
    const intent = launchIntent(share, tax)
    expect(intent).not.toBeUndefined()
    if (intent === undefined) return
    expect(intent.valueWei).toBe(0n)
    const methods: string[] = []
    const signed = "0x02f86c" + "ab".repeat(64)
    const post: JsonRpcPost = async (body: string) => {
      const row = JSON.parse(body) as { readonly method?: unknown }
      if (typeof row.method !== "string") return undefined
      methods.push(row.method)
      if (row.method === "eth_sendRawTransaction") {
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: "0x" + "cd".repeat(32) })
      }
      return undefined
    }
    const sent = await postSignedRaw(post, signed)
    expect(sent.status).toBe("ok")
    expect(methods.includes("eth_sendRawTransaction")).toBe(true)
    expect(methods.includes("eth_sendTransaction")).toBe(false)
    const numbered: JsonRpcPost = async () => JSON.stringify({ jsonrpc: "2.0", id: "0", result: 1 })
    const lied = await postSignedRaw(numbered, signed)
    expect(lied.status).toBe("silence")
    const empty = await postSignedRaw(post, "")
    expect(empty.status).toBe("silence")
  })
})
