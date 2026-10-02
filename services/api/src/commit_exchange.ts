import { dataApprove, type AssetPort, type EnvMap } from "@corporator/chainport"
import { fromUtf8, parseJson } from "@corporator/contentpack"
import { bankOpen, cityClock, cpmmSellCorp, keccak256Hex, type Dict } from "@corporator/engine"
import { codes } from "@corporator/protocol"
import { outsideWorldLock } from "./city_lock.js"
import { commitPrepared, takenChainTx } from "./commit_bank.js"
import { receiptLanded } from "./reorg.js"
import { districtByTicker, districtSpec, resolveDistrictId } from "./commit_districts.js"
import { stockAddress } from "./commit_prize.js"
import { prizeCustodyLive } from "./custody.js"
import { type PackCtx } from "./pack_ctx.js"
import { cityKind, errResult, okResult, statusFor, type HttpResult } from "./envelope.js"
import { getBytes, type Store } from "./store.js"
import { asBigint, asEngineDict, asObj, asText, walk, type Json } from "./values.js"

export type HopFill = (
  ticker: string,
  corpIn: bigint,
  hopQuality?: bigint,
) => Promise<{ readonly ok: boolean; readonly stockOut: bigint }>

export type BuyStockHop = {
  readonly priced: boolean
  readonly fill?: HopFill
}

/** Pack interval and mock sampler are not an executable hop. */
export function hopPriced(feedLive: bigint = 0n): boolean {
  return feedLive !== 0n
}

export async function hopFillFromEnv(
  env: EnvMap,
  ticker: string,
  corpIn: bigint,
  hopQuality: bigint = 0n,
): Promise<{ readonly ok: boolean; readonly stockOut: bigint }> {
  const url = env["CORPORATOR_HOP_URL"]
  if (url === undefined || url.length === 0) return { ok: false, stockOut: 0n }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ticker,
        amount: corpIn.toString(),
        hop_quality: hopQuality > 0n ? "1" : "0",
      }),
    })
    if (!res.ok) return { ok: false, stockOut: 0n }
    const raw: unknown = await res.json()
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, stockOut: 0n }
    const row = asObj(raw as Json)
    const stockOut = asBigint(row["stock_out"], 0n)
    if (stockOut <= 0n) return { ok: false, stockOut: 0n }
    return { ok: true, stockOut }
  } catch {
    return { ok: false, stockOut: 0n }
  }
}

export type HopTx = {
  readonly ok: boolean
  readonly stockOut: bigint
  readonly to: string
  readonly data: string
  readonly value: string
}

const HOP_TX_MISS: HopTx = { ok: false, stockOut: 0n, to: "", data: "", value: "" }

/** Same hop POST as the fill, plus want=tx. A quote without to/data/value is not a transaction. */
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/
const TRANSFER_TOPIC = "0x" + keccak256Hex(new TextEncoder().encode("Transfer(address,address,uint256)"))

function envAddr(name: string): string {
  const v = process.env[name]
  if (v === undefined || !ADDR_RE.test(v)) return ""
  return v
}

export async function hopTxFromEnv(
  env: EnvMap,
  ticker: string,
  corpIn: bigint,
  hopQuality: bigint = 0n,
  recipient: string = "",
): Promise<HopTx> {
  const url = env["CORPORATOR_HOP_URL"]
  if (url === undefined || url.length === 0) return HOP_TX_MISS
  const posted: { [key: string]: string } = {
    ticker,
    amount: corpIn.toString(),
    hop_quality: hopQuality > 0n ? "1" : "0",
    want: "tx",
  }
  if (recipient.length > 0) posted["recipient"] = recipient
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(posted),
    })
    if (!res.ok) return HOP_TX_MISS
    const raw: unknown = await res.json()
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return HOP_TX_MISS
    const row = asObj(raw as Json)
    const to = asText(row["to"])
    const data = asText(row["data"])
    const value = asText(row["value"])
    if (to.length === 0 || data.length === 0 || value.length === 0) return HOP_TX_MISS
    const stockOut = asBigint(row["stock_out"], 0n)
    return { ok: true, stockOut, to, data, value }
  } catch {
    return HOP_TX_MISS
  }
}

function applyHopHaircut(raw: bigint, quality: bigint, haircut: bigint, bps: bigint): bigint {
  if (raw <= 0n) return 0n
  if (quality > 0n) return raw
  if (haircut <= 0n || bps <= haircut) return raw
  const shaved = (raw * (bps - haircut)) / bps
  if (shaved > 0n) return shaved
  return 1n
}

function exchangeLevelReq(ctx: PackCtx): bigint {
  return asBigint(walk(ctx.pack, ["sections", "buildings", "buildings", "exchange", "city_level_req"]))
}

/** Same order as the exchange button: Sunday, closed hours, then city level. Empty when the window is open. */
export function exchangeWindowCode(ctx: PackCtx, state: Dict, city: Dict): string {
  const clock = cityClock(ctx.cfg, asBigint(state["tick_index"], 0n))
  const hour = clock[1] ?? 0n
  const weekday = clock[2] ?? 0n
  if (weekday === asBigint(ctx.cfg["bank_closed_weekday"])) return codes.BANK_SUNDAY
  if (bankOpen(ctx.cfg, hour, weekday) === 0n) return codes.BANK_CLOSED
  if (asBigint(city["city_level"], 1n) < exchangeLevelReq(ctx)) return codes.CITY_LEVEL_TOO_LOW
  return ""
}

/** Player $CORP → hop CORP→ETH→USDG→stock. Fills only when the quote is live and hop returns stock. */
export async function applyBuyStock(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
  hop: BuyStockHop = { priced: false },
): Promise<HttpResult> {
  if (cityKind(state, cityId) !== "wallet") return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
  const ticker = asText(body["ticker"])
  const districtId = resolveDistrictId(ctx, body)
  const spec = districtSpec(ctx, districtId)
  if (ticker.length === 0 || spec === undefined || districtByTicker(ctx, ticker) !== spec.id) {
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  if (!("amount" in body)) return errResult(ctx, state, codes.API_MALFORMED)
  const amount = asBigint(body["amount"])
  if (amount <= 0n) return errResult(ctx, state, codes.API_MALFORMED)
  const windowCode = exchangeWindowCode(ctx, state, city)
  if (windowCode.length > 0) return errResult(ctx, state, windowCode)
  const held = asBigint(city["corp_held"], 0n)
  if (held < amount) return errResult(ctx, state, codes.NOT_ENOUGH_CORP)
  if (!hop.priced || hop.fill === undefined) return errResult(ctx, state, codes.EXCHANGE_HOP_UNAVAILABLE)
  const quality = asBigint(city["hop_quality"], 0n)
  const fill = hop.fill
  const filled = await outsideWorldLock(state, () => fill(ticker, amount, quality))
  if (!filled.ok || filled.stockOut <= 0n) return errResult(ctx, state, codes.EXCHANGE_HOP_UNAVAILABLE)
  return creditBuyStock(ctx, state, city, ticker, amount, filled.stockOut)
}

/** Haircut and ledger credit. Does not ask the hop. stockOut is the raw fill. */
export function creditBuyStock(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  ticker: string,
  amount: bigint,
  rawOut: bigint,
): HttpResult {
  if (rawOut <= 0n) return errResult(ctx, state, codes.EXCHANGE_HOP_UNAVAILABLE)
  const held = asBigint(city["corp_held"], 0n)
  if (held < amount) return errResult(ctx, state, codes.NOT_ENOUGH_CORP)
  const quality = asBigint(city["hop_quality"], 0n)
  const haircut = asBigint(walk(ctx.pack, ["sections", "fragments", "params", "fragment_hop_haircut_bps", "v"]), 0n)
  const bps = asBigint(ctx.cfg["bps"])
  const stockOut = applyHopHaircut(rawOut, quality, haircut, bps)
  const poolEth = asBigint(state["pool_eth"], 0n)
  const poolCorp = asBigint(state["pool_corp"], 0n)
  const sold = cpmmSellCorp(poolEth, poolCorp, amount)
  city["corp_held"] = held - amount
  const tokens = asEngineDict(city["tokens_held"])
  tokens[ticker] = asBigint(tokens[ticker], 0n) + stockOut
  city["tokens_held"] = tokens
  state["pool_eth"] = sold[0]
  state["pool_corp"] = sold[1]
  return okResult(ctx, state, {
    effect: "buy_stock",
    ticker,
    amount,
    stock_out: stockOut,
    eth_out: sold[2],
  })
}

type BuyTx = { readonly to: string; readonly data: string; readonly value: string; readonly label: string }

export type BuyConfirm =
  | { readonly ok: false; readonly result: HttpResult }
  | {
      readonly ok: true
      readonly ticker: string
      readonly amount: bigint
      readonly stockOut: bigint
      readonly hashes: readonly string[]
      readonly delivered: bigint
    }

/** Live delivery. Pool mirror moves. corp_held and tokens_held stay. Journal amount is the log. */
export function applyLiveBuy(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  ticker: string,
  amount: bigint,
  delivered: bigint,
): HttpResult {
  if (delivered <= 0n) return errResult(ctx, state, codes.EXCHANGE_DELIVERY_UNVERIFIED)
  const poolEth = asBigint(state["pool_eth"], 0n)
  const poolCorp = asBigint(state["pool_corp"], 0n)
  const sold = cpmmSellCorp(poolEth, poolCorp, amount)
  state["pool_eth"] = sold[0]
  state["pool_corp"] = sold[1]
  const prior = city["stock_journal"]
  const journal = Array.isArray(prior) ? prior : []
  journal.push({ code: "stock_bought", ticker, amount: delivered })
  city["stock_journal"] = journal
  return okResult(ctx, state, {
    effect: "buy_stock",
    ticker,
    amount,
    stock_out: delivered,
    eth_out: sold[2],
  })
}

function topicAddress(topic: string): string {
  const hex = topic.startsWith("0x") || topic.startsWith("0X") ? topic.slice(2) : topic
  if (hex.length < 40) return ""
  return "0x" + hex.slice(hex.length - 40)
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

function deliveredStock(
  logs: readonly { readonly address: string; readonly topics: readonly string[]; readonly data: string }[],
  token: string,
  wallet: string,
): bigint {
  let sum = 0n
  for (const log of logs) {
    if (!sameHex(log.address, token)) continue
    const sig = log.topics[0]
    const to = log.topics[2]
    if (sig === undefined || to === undefined) continue
    if (!sameHex(sig, TRANSFER_TOPIC)) continue
    if (!sameHex(topicAddress(to), wallet)) continue
    const value = decodeWord(log.data)
    if (value === undefined || value <= 0n) continue
    sum += value
  }
  return sum
}

function buyChainId(ctx: PackCtx): string {
  return asBigint(walk(ctx.pack, ["sections", "districts", "stake", "snapshot", "chain_id"])).toString()
}

function sameHex(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

function statusForStored(ctx: PackCtx, body: Uint8Array): bigint {
  try {
    const parsed = parseJson(fromUtf8(body))
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      const code = asText(parsed["code"])
      if (code.length > 0) return statusFor(ctx, code)
    }
  } catch {
    return ctx.httpOk
  }
  return ctx.httpOk
}

function readHashes(value: Json | undefined): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== "string" || !item.startsWith("0x") || item.length < 3) return undefined
    out.push(item)
  }
  return out
}

function readTxs(value: Json | undefined): readonly BuyTx[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: BuyTx[] = []
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return undefined
    const to = asText(item["to"])
    const data = asText(item["data"])
    const label = asText(item["label"])
    if (to.length === 0 || data.length === 0 || label.length === 0) return undefined
    out.push({ to, data, value: asText(item["value"]), label })
  }
  return out
}

function buyGate(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
  ledger: boolean,
): { readonly ok: false; readonly result: HttpResult } | { readonly ok: true; readonly ticker: string; readonly amount: bigint } {
  if (cityKind(state, cityId) !== "wallet") return { ok: false, result: errResult(ctx, state, codes.WALLET_NOT_CONNECTED) }
  const ticker = asText(body["ticker"])
  const districtId = resolveDistrictId(ctx, body)
  const spec = districtSpec(ctx, districtId)
  if (ticker.length === 0 || spec === undefined || districtByTicker(ctx, ticker) !== spec.id) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  if (!("amount" in body)) return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  let amount: bigint
  try {
    amount = asBigint(body["amount"])
  } catch {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  if (amount <= 0n) return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  const windowCode = exchangeWindowCode(ctx, state, city)
  if (windowCode.length > 0) return { ok: false, result: errResult(ctx, state, windowCode) }
  if (ledger && asBigint(city["corp_held"], 0n) < amount) return { ok: false, result: errResult(ctx, state, codes.NOT_ENOUGH_CORP) }
  return { ok: true, ticker, amount }
}

/** Live buy. Writes a ticket. Does not debit corp_held. */
export async function prepareBuyStock(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
  intentId: string,
  expected: bigint,
  port: AssetPort,
): Promise<HttpResult> {
  const key = cityId + ":" + intentId
  const prior = await getBytes(store, "intents", key)
  if (prior !== undefined) return { status: statusForStored(ctx, prior), body: prior, headers: {} }
  const live = prizeCustodyLive(port)
  const gate = buyGate(ctx, state, city, body, cityId, !live)
  if (!gate.ok) return gate.result
  if (asBigint(state["city_time"]) !== expected) return errResult(ctx, state, ctx.staleCode)
  const wallet = asText(city["wallet"])
  if (live) {
    if (wallet.length === 0) return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
    const bal = await port.corpToken.balanceOf(wallet)
    if (!bal.ok) return errResult(ctx, state, codes.SERVICE_DEGRADED)
    if (bal.amount < gate.amount) return errResult(ctx, state, codes.NOT_ENOUGH_CORP)
  }
  const quality = asBigint(city["hop_quality"], 0n)
  const quoted = await outsideWorldLock(state, () =>
    hopTxFromEnv(process.env, gate.ticker, gate.amount, quality, live ? wallet : ""),
  )
  if (!quoted.ok) return errResult(ctx, state, codes.EXCHANGE_HOP_UNAVAILABLE)
  const txJson: { readonly [key: string]: Json }[] = []
  if (live) {
    const allowed = await port.corpToken.allowance(wallet, quoted.to)
    if (!allowed.ok) return errResult(ctx, state, codes.SERVICE_DEGRADED)
    if (allowed.amount < gate.amount) {
      const corp = envAddr("CORPORATOR_CORP_TOKEN")
      if (corp.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
      const approveData = dataApprove(quoted.to, gate.amount)
      if (approveData.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
      txJson.push({ to: corp, data: approveData, value: "0", label: "approve" })
    }
  }
  txJson.push({ to: quoted.to, data: quoted.data, value: quoted.value, label: "buy" })
  const result = okResult(ctx, state, {
    phase: "prepared",
    ticket: intentId,
    chain_id: buyChainId(ctx),
    effect: "buy_stock",
    ticker: gate.ticker,
    amount: gate.amount,
    stock_out: quoted.stockOut,
    txs: txJson,
  })
  const blocked = await commitPrepared(ctx, store, state, cityId, key, result.body)
  if (blocked !== undefined) return blocked
  return result
}

/** Chain reads for confirm. A stored hash returns the first answer. Does not credit. */
export async function verifyBuyConfirm(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
  port: AssetPort,
  live = false,
): Promise<BuyConfirm> {
  const ticket = asText(body["ticket"])
  const hashes = readHashes(body["tx_hashes"])
  if (ticket.length === 0 || hashes === undefined) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  for (const hash of hashes) {
    const taken = await takenChainTx(ctx, store, state, cityId, hash)
    if (taken !== undefined) return { ok: false, result: taken }
  }
  const raw = await getBytes(store, "intents", cityId + ":" + ticket)
  if (raw === undefined) return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  let parsed: Json
  try {
    parsed = parseJson(fromUtf8(raw))
  } catch {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  if (asText(parsed["phase"]) !== "prepared" || asText(parsed["effect"]) !== "buy_stock" || asText(parsed["ticket"]) !== ticket) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  const ticker = asText(parsed["ticker"])
  let amount: bigint
  let stockOut: bigint
  try {
    amount = asBigint(parsed["amount"])
    stockOut = asBigint(parsed["stock_out"], 0n)
  } catch {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  const txs = readTxs(parsed["txs"])
  if (ticker.length === 0 || amount <= 0n || txs === undefined || txs.length !== hashes.length) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  const wallet = asText(city["wallet"])
  if (wallet.length === 0) return { ok: false, result: errResult(ctx, state, codes.WALLET_NOT_CONNECTED) }
  const stock = live ? stockAddress(ticker) : ""
  if (live && stock.length === 0) return { ok: false, result: errResult(ctx, state, codes.SERVICE_DEGRADED) }
  let delivered = 0n
  let sawBuy = false
  for (let i = 0; i < hashes.length; i += 1) {
    const hash = hashes.at(i)
    const tx = txs.at(i)
    if (hash === undefined || tx === undefined) {
      return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
    }
    const receipt = await port.chain.transactionReceipt(hash)
    if (!receipt.ok || !receiptLanded(ctx, receipt)) {
      return { ok: false, result: errResult(ctx, state, codes.CHAIN_TX_UNCONFIRMED) }
    }
    const seen = await port.chain.transactionByHash(hash)
    if (!seen.ok) return { ok: false, result: errResult(ctx, state, codes.CHAIN_TX_UNCONFIRMED) }
    if (!sameHex(seen.from, wallet) || !sameHex(seen.to, tx.to) || !sameHex(seen.input, tx.data)) {
      return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
    }
    if (live && tx.label === "buy") {
      sawBuy = true
      delivered = deliveredStock(receipt.logs, stock, wallet)
      if (delivered < stockOut || delivered <= 0n) {
        return { ok: false, result: errResult(ctx, state, codes.EXCHANGE_DELIVERY_UNVERIFIED) }
      }
    }
  }
  if (live && !sawBuy) return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  return { ok: true, ticker, amount, stockOut, hashes, delivered: live ? delivered : stockOut }
}
