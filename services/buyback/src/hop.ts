import { keccak256Hex } from "@corporator/engine"

const ADDR_HEX = 40
const TRANSFER_TOPIC = "0x" + keccak256Hex(new TextEncoder().encode("Transfer(address,address,uint256)"))

export type HopRequest = {
  readonly ticker: string
  readonly amount: string
  readonly hop_quality: string
  readonly want: string
  readonly recipient: string
}

export type HopResponse = {
  readonly ok: boolean
  readonly body: unknown
}

export type HopPoster = (body: HopRequest) => Promise<HopResponse | undefined>

export type HopLog = {
  readonly address: string
  readonly topics: readonly string[]
  readonly data: string
}

export type HopQuote =
  | {
      readonly ok: true
      readonly stockOut: bigint
      readonly to: string
      readonly data: string
      readonly value: string
    }
  | { readonly ok: false }

export type SwapTx = {
  readonly to: string
  readonly data: string
  readonly value: string
}

export type ExecutorSigner = (executorKey: string, tx: SwapTx) => boolean

export type ExecutorHop = {
  readonly hopOk: bigint
  readonly stockOut: bigint
}

const NONE: ExecutorHop = { hopOk: 0n, stockOut: 0n }
const MISS: HopQuote = { ok: false }

function sameHex(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

function topicAddress(topic: string): string {
  const hex = topic.startsWith("0x") || topic.startsWith("0X") ? topic.slice(2) : topic
  if (hex.length < ADDR_HEX) return ""
  return "0x" + hex.slice(hex.length - ADDR_HEX)
}

function decodeWord(data: string): bigint | undefined {
  const hex = data.startsWith("0x") || data.startsWith("0X") ? data.slice(2) : data
  if (hex.length === 0 || !/^[0-9a-fA-F]+$/.test(hex)) return undefined
  try {
    return BigInt("0x" + hex)
  } catch {
    return undefined
  }
}

export function transferStock(logs: readonly HopLog[], token: string, executor: string): bigint {
  if (token.length === 0 || executor.length === 0) return 0n
  let sum = 0n
  for (const log of logs) {
    if (!sameHex(log.address, token)) continue
    const sig = log.topics[0]
    const to = log.topics[2]
    if (sig === undefined || to === undefined) continue
    if (!sameHex(sig, TRANSFER_TOPIC)) continue
    if (!sameHex(topicAddress(to), executor)) continue
    const value = decodeWord(log.data)
    if (value === undefined || value <= 0n) continue
    sum += value
  }
  return sum
}

function asRecord(value: unknown): { readonly [key: string]: unknown } | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined
  return value as { readonly [key: string]: unknown }
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function bigOf(value: unknown): bigint {
  if (typeof value === "bigint") return value
  if (typeof value === "string" && value.length > 0) {
    try {
      return BigInt(value)
    } catch {
      return 0n
    }
  }
  return 0n
}

export async function readHopTx(
  poster: HopPoster,
  ticker: string,
  amount: bigint,
  hopQuality: bigint,
  recipient: string,
): Promise<HopQuote> {
  if (ticker.length === 0 || amount <= 0n || recipient.length === 0) return MISS
  try {
    const res = await poster({
      ticker,
      amount: amount.toString(),
      hop_quality: hopQuality > 0n ? "1" : "0",
      want: "tx",
      recipient,
    })
    if (res === undefined || !res.ok) return MISS
    const row = asRecord(res.body)
    if (row === undefined) return MISS
    const to = textOf(row["to"])
    const data = textOf(row["data"])
    const value = textOf(row["value"])
    if (to.length === 0 || data.length === 0 || value.length === 0) return MISS
    return { ok: true, stockOut: bigOf(row["stock_out"]), to, data, value }
  } catch {
    return MISS
  }
}

export function posterFromEnv(
  env: { readonly [key: string]: string | undefined },
  fetchImpl: (
    url: string,
    init: {
      readonly method: string
      readonly headers: { readonly "content-type": string }
      readonly body: string
    },
  ) => Promise<{ readonly ok: boolean; readonly json: () => Promise<unknown> }>,
): HopPoster {
  return async (body) => {
    const url = env["CORPORATOR_HOP_URL"]
    if (url === undefined || url.length === 0) return undefined
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const parsed = await res.json()
      return { ok: res.ok, body: parsed }
    } catch {
      return undefined
    }
  }
}

export async function executorHopFill(args: {
  readonly poster: HopPoster
  readonly ticker: string
  readonly amount: bigint
  readonly hopQuality: bigint
  readonly executor: string
  readonly executorKey: string
  readonly token: string
  readonly logs: readonly HopLog[]
  readonly sign: ExecutorSigner
  readonly broadcast?: (tx: SwapTx) => Promise<readonly HopLog[]>
}): Promise<ExecutorHop> {
  const quote = await readHopTx(args.poster, args.ticker, args.amount, args.hopQuality, args.executor)
  if (!quote.ok) return NONE
  let signed = false
  try {
    signed = args.sign(args.executorKey, { to: quote.to, data: quote.data, value: quote.value })
  } catch {
    return NONE
  }
  if (!signed) return NONE
  let logs = args.logs
  if (args.broadcast !== undefined) {
    try {
      logs = await args.broadcast({ to: quote.to, data: quote.data, value: quote.value })
    } catch {
      return NONE
    }
  }
  const got = transferStock(logs, args.token, args.executor)
  if (got <= 0n) return NONE
  return { hopOk: 1n, stockOut: got }
}
