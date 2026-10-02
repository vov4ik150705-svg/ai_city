import { keccak256 } from "@corporator/engine"
import { postEth, type JsonRpcPost } from "@corporator/chainport"

export type ChainQuote = {
  readonly ethUsd8dec: bigint
  readonly corpEthWeiPerWhole: bigint
  readonly turnoverUsd8dec: bigint
}

function hexOf(bytes: Uint8Array): string {
  let out = ""
  for (const b of bytes) out += b.toString(16).padStart(2, "0")
  return out
}

function selector(sig: string): string {
  return hexOf(keccak256(new TextEncoder().encode(sig))).slice(0, 8)
}

function topic(sig: string): string {
  return "0x" + hexOf(keccak256(new TextEncoder().encode(sig)))
}

const LATEST_ROUND = selector("latestRoundData()")
const GET_RESERVES = selector("getReserves()")
const TOKEN0 = selector("token0()")
const GET_SLOT0 = selector("getSlot0(bytes32)")
const SWAP_V2 = topic("Swap(address,uint256,uint256,uint256,uint256,address)")

function words(data: string): readonly bigint[] {
  const hex = data.startsWith("0x") ? data.slice(2) : data
  const out: bigint[] = []
  for (let i = 0; i + 64 <= hex.length; i += 64) {
    out.push(BigInt("0x" + hex.slice(i, i + 64)))
  }
  return out
}

function word(data: string, index: number): bigint | undefined {
  return words(data)[index]
}

async function ethCall(post: JsonRpcPost, to: string, data: string): Promise<string | undefined> {
  const raw = await postEth(post, "eth_call", [{ to, data }, "latest"])
  if (raw.status !== "ok" || raw.body.length < 3) return undefined
  return raw.body
}

export function ethUsdFromRound(data: string): bigint | undefined {
  const answer = word(data, 1)
  if (answer === undefined || answer <= 0n) return undefined
  const sign = 1n << 255n
  if (answer >= sign) return undefined
  return answer
}

export function reservesPrice(data: string, token0: string, corp: string, wei: bigint): bigint | undefined {
  const w = words(data)
  const r0 = w[0]
  const r1 = w[1]
  if (r0 === undefined || r1 === undefined || r0 <= 0n || r1 <= 0n || wei <= 0n) return undefined
  const corpIs0 = token0.toLowerCase() === corp.toLowerCase()
  const reserveCorp = corpIs0 ? r0 : r1
  const reserveEth = corpIs0 ? r1 : r0
  if (reserveCorp <= 0n) return undefined
  return (reserveEth * wei) / reserveCorp
}

export function slot0Price(data: string, corpIsToken0: boolean, wei: bigint): bigint | undefined {
  const sqrt = word(data, 0)
  if (sqrt === undefined || sqrt <= 0n || wei <= 0n) return undefined
  const squared = sqrt * sqrt
  const q192 = 1n << 192n
  if (corpIsToken0) {
    if (q192 === 0n) return undefined
    return (squared * wei) / q192
  }
  if (squared === 0n) return undefined
  return (q192 * wei) / squared
}

function pad32(hex: string): string {
  const body = hex.startsWith("0x") ? hex.slice(2) : hex
  return body.padStart(64, "0")
}

export async function readChainQuote(
  post: JsonRpcPost,
  env: { readonly [key: string]: string | undefined },
  wei: bigint,
  windowS: bigint,
): Promise<ChainQuote | undefined> {
  const feed = env["CORPORATOR_FEED_ETH_USD"]
  const pool = env["CORPORATOR_POOL_ADDRESS"]
  const kind = env["CORPORATOR_POOL_KIND"]
  const corp = env["CORPORATOR_CORP_TOKEN"]
  if (feed === undefined || pool === undefined || corp === undefined) return undefined
  const round = await ethCall(post, feed, "0x" + LATEST_ROUND)
  if (round === undefined) return undefined
  const ethUsd = ethUsdFromRound(round)
  if (ethUsd === undefined) return undefined
  let corpWei: bigint | undefined
  if (kind === "v2") {
    const token0 = await ethCall(post, pool, "0x" + TOKEN0)
    const reserves = await ethCall(post, pool, "0x" + GET_RESERVES)
    const tokenWord = token0 === undefined ? undefined : word(token0, 0)
    if (reserves === undefined || tokenWord === undefined) return undefined
    const tokenAddr = "0x" + (tokenWord & ((1n << 160n) - 1n)).toString(16).padStart(40, "0")
    corpWei = reservesPrice(reserves, tokenAddr, corp, wei)
  } else if (kind === "v4") {
    const id = env["CORPORATOR_POOL_ID"]
    if (id === undefined || id.length === 0) return undefined
    const slot = await ethCall(post, pool, "0x" + GET_SLOT0 + pad32(id))
    if (slot === undefined) return undefined
    corpWei = slot0Price(slot, true, wei)
  } else {
    return undefined
  }
  if (corpWei === undefined || corpWei <= 0n) return undefined
  const turnover = await swapTurnover(post, pool, ethUsd, wei, windowS)
  if (turnover === undefined) return undefined
  return { ethUsd8dec: ethUsd, corpEthWeiPerWhole: corpWei, turnoverUsd8dec: turnover }
}

async function swapTurnover(
  post: JsonRpcPost,
  pool: string,
  ethUsd: bigint,
  wei: bigint,
  windowS: bigint,
): Promise<bigint | undefined> {
  const latest = await postEth(post, "eth_blockNumber", [])
  if (latest.status !== "ok") return undefined
  const tip = BigInt(latest.body)
  const nowS = BigInt(Math.floor(Date.now() / 1000))
  let from = tip
  let cursor = tip
  let steps = 0n
  let prevTs = nowS
  while (cursor > 0n && steps <= windowS) {
    const block = await postEth(post, "eth_getBlockByNumber", ["0x" + cursor.toString(16), false])
    if (block.status !== "ok") break
    let row: unknown
    try {
      row = JSON.parse(block.body) as unknown
    } catch {
      break
    }
    if (row === null || typeof row !== "object") break
    const tsRaw = (row as { readonly timestamp?: unknown }).timestamp
    if (typeof tsRaw !== "string") break
    const ts = BigInt(tsRaw)
    if (steps > 0n && ts >= prevTs) break
    if (nowS - ts >= windowS) break
    from = cursor
    prevTs = ts
    cursor -= 1n
    steps += 1n
  }
  const raw = await postEth(post, "eth_getLogs", [
    { address: pool, fromBlock: "0x" + from.toString(16), toBlock: "latest", topics: [SWAP_V2] },
  ])
  if (raw.status !== "ok") return undefined
  let rows: unknown
  try {
    rows = JSON.parse(raw.body) as unknown
  } catch {
    return undefined
  }
  if (!Array.isArray(rows)) return undefined
  let usd = 0n
  for (const row of rows) {
    if (row === null || typeof row !== "object") continue
    const data = (row as { readonly data?: unknown }).data
    if (typeof data !== "string") continue
    const w = words(data)
    const a0 = w[0] ?? 0n
    const a1 = w[1] ?? 0n
    const b0 = w[2] ?? 0n
    const b1 = w[3] ?? 0n
    const ethSide = a1 + b1
    if (wei <= 0n) continue
    usd += (ethSide * ethUsd) / wei
  }
  return usd
}
