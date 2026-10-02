import {
  dataPrizeClaim,
  PRIZE_KETTLE_FARM,
  type AssetPort,
} from "@corporator/chainport"
import { fromUtf8, parseJson } from "@corporator/contentpack"
import { cityClock, settleCities, windowSettleDue, type Dict } from "@corporator/engine"
import { codes } from "@corporator/protocol"
import { armChainClock, deferServerMint, watchSnapshot, WorldMoved } from "./city_lock.js"
import { commitPrepared, rememberChainTx, takenChainTx } from "./commit_bank.js"
import { prizeAssets, prizeChainId, prizeTreasuryAddress, stockAddress } from "./commit_prize.js"
import { cityKind, errResult, okResult, statusFor, type HttpResult } from "./envelope.js"
import { type PackCtx } from "./pack_ctx.js"
import { incrementCommandRate } from "./rates.js"
import { getBytes, putBytes, type Store } from "./store.js"
import { type TickLock } from "./tick_lock.js"
import { persistLiveState, refuseCustodial, restoreMemory } from "./tick_host.js"
import { asBigint, asEngineDict, asText, type Json } from "./values.js"

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function packData(ctx: PackCtx): Dict {
  return asEngineDict(ctx.cfg["data"])
}

function citiesOf(state: Dict): Dict {
  return asEngineDict(state["cities"])
}

function settleSubset(cities: Dict): Dict {
  const subset: Dict = {}
  for (const cid of Object.keys(cities)) {
    const raw = cities[cid]
    if (raw === undefined || raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const row = raw as Dict
    if (row["fragment_ledger"] === undefined && row["fragment_pool"] === undefined) continue
    subset[cid] = row
  }
  return subset
}

function poolArg(state: Dict, subset: Dict): Dict | bigint {
  const raw = state["fragment_pools"]
  if (raw !== undefined && raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    return asEngineDict(raw)
  }
  let pool = 0n
  for (const cid of Object.keys(subset)) {
    const row = subset[cid]
    if (row === undefined || row === null || typeof row !== "object" || Array.isArray(row)) continue
    pool = asBigint((row as Dict)["fragment_pool"], 0n)
    if (pool > 0n) break
  }
  return pool
}

function settleWindowIfDue(ctx: PackCtx, state: Dict): boolean {
  const data = packData(ctx)
  const tickIndex = asBigint(state["tick_index"], 0n)
  const clock = cityClock(ctx.cfg, tickIndex)
  if (!windowSettleDue(data, clock[0], clock[1])) return false
  const subset = settleSubset(citiesOf(state))
  if (Object.keys(subset).length === 0) return false
  settleCities(data, subset, poolArg(state, subset))
  return true
}

function settlementHas(city: Dict, code: string): boolean {
  const raw = asEngineDict(city["fragment_settlement"])
  for (const item of asList(raw["codes"])) {
    if (asText(item) === code) return true
  }
  return false
}

function owedTotal(city: Dict): bigint {
  const owed = asEngineDict(city["fragment_owed"])
  let total = 0n
  for (const ticker of Object.keys(owed)) {
    total += asBigint(owed[ticker], 0n)
  }
  return total
}

function payOwed(city: Dict): Json[] {
  const owed = asEngineDict(city["fragment_owed"])
  const held = asEngineDict(city["tokens_held"])
  const listed: Json[] = []
  const tickers = Object.keys(owed).sort()
  for (const ticker of tickers) {
    const amount = asBigint(owed[ticker], 0n)
    if (amount <= 0n) continue
    held[ticker] = asBigint(held[ticker], 0n) + amount
    owed[ticker] = 0n
    listed.push({ ticker, paid: amount })
  }
  city["fragment_owed"] = owed
  city["tokens_held"] = held
  return listed
}

function emptyClaimCode(city: Dict, settledNow: boolean): string {
  if (settledNow && settlementHas(city, codes.FRAGMENT_POOL_EMPTY)) return codes.FRAGMENT_POOL_EMPTY
  if (settledNow && settlementHas(city, codes.FRAGMENT_NO_CLAIMS)) return codes.FRAGMENT_NO_CLAIMS
  return codes.FRAGMENT_NO_CLAIMS
}

/** Pays settled fragment_owed into tokens_held. Settles the global window first when due. */
export function applyClaimFragment(ctx: PackCtx, state: Dict, city: Dict, cityId: string): HttpResult {
  if (cityKind(state, cityId) === "demo") return errResult(ctx, state, codes.DEMO_NO_CLAIM)
  const settledNow = settleWindowIfDue(ctx, state)
  if (owedTotal(city) <= 0n) return errResult(ctx, state, emptyClaimCode(city, settledNow))
  const listed = payOwed(city)
  return okResult(ctx, state, { effect: "claim_fragment", assets: listed })
}

function sameHex(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

function intentKey(cityId: string, intentId: string): string {
  return cityId + ":" + intentId
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

async function rollback(store: Store): Promise<void> {
  try {
    await store.exec("ROLLBACK")
  } catch {
    // The caller's error is the one to surface.
  }
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

type StoredTx = {
  readonly to: string
  readonly data: string
  readonly ticker: string
  readonly amount: bigint
}

function readStoredTxs(value: Json | undefined): readonly StoredTx[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const out: StoredTx[] = []
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return undefined
    const to = asText(item["to"])
    const data = asText(item["data"])
    const ticker = asText(item["ticker"])
    const amount = asBigint(item["amount"], 0n)
    if (to.length === 0 || data.length === 0 || ticker.length === 0 || amount <= 0n) return undefined
    out.push({ to, data, ticker, amount })
  }
  return out
}

function unconfirmed(ctx: PackCtx, state: Dict): HttpResult {
  return errResult(ctx, state, codes.CHAIN_TX_UNCONFIRMED)
}

export type FragmentMove = { readonly ticker: string; readonly amount: bigint }

export type FragmentConfirm =
  | { readonly ok: false; readonly result: HttpResult }
  | { readonly ok: true; readonly hashes: readonly string[]; readonly moves: readonly FragmentMove[] }

/** Live prepare. Chain owed is read before any state write. Mock claim stays applyClaimFragment. */
export async function prepareClaimFragment(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  city: Dict,
  cityId: string,
  intentId: string,
  expected: bigint,
  port: AssetPort,
): Promise<HttpResult> {
  const key = intentKey(cityId, intentId)
  const prior = await getBytes(store, "intents", key)
  if (prior !== undefined) return { status: statusForStored(ctx, prior), body: prior, headers: {} }
  if (cityKind(state, cityId) === "demo") return errResult(ctx, state, codes.DEMO_NO_CLAIM)
  if (asBigint(state["city_time"]) !== expected) return errResult(ctx, state, ctx.staleCode)
  const wallet = asText(city["wallet"])
  if (wallet.length === 0) return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
  const treasury = prizeTreasuryAddress()
  if (treasury.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const txJson: { readonly [key: string]: Json }[] = []
  for (const asset of prizeAssets(ctx)) {
    const token = stockAddress(asset)
    if (token.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
    const owed = await port.prizeTreasury.owed(PRIZE_KETTLE_FARM, token, wallet)
    if (!owed.ok) return errResult(ctx, state, codes.SERVICE_DEGRADED)
    if (owed.amount <= 0n) continue
    const data = dataPrizeClaim(token, PRIZE_KETTLE_FARM)
    if (data.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
    txJson.push({
      to: treasury,
      data,
      value: "0",
      label: "claim",
      ticker: asset,
      amount: owed.amount.toString(),
    })
  }
  if (txJson.length === 0) {
    const code = owedTotal(city) > 0n ? codes.FRAGMENT_SLICE_PENDING : codes.FRAGMENT_NO_CLAIMS
    return errResult(ctx, state, code)
  }
  const result = okResult(ctx, state, {
    phase: "prepared",
    ticket: intentId,
    chain_id: prizeChainId(ctx),
    effect: "claim_fragment",
    txs: txJson,
  })
  const blocked = await commitPrepared(ctx, store, state, cityId, key, result.body)
  if (blocked !== undefined) return blocked
  return result
}

export async function verifyClaimFragment(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
  port: AssetPort,
): Promise<FragmentConfirm> {
  const ticket = asText(body["ticket"])
  const hashes = readHashes(body["tx_hashes"])
  if (ticket.length === 0 || hashes === undefined) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  for (const hash of hashes) {
    const taken = await takenChainTx(ctx, store, state, cityId, hash)
    if (taken !== undefined) return { ok: false, result: taken }
  }
  const raw = await getBytes(store, "intents", intentKey(cityId, ticket))
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
  if (asText(parsed["phase"]) !== "prepared" || asText(parsed["effect"]) !== "claim_fragment" || asText(parsed["ticket"]) !== ticket) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  const txs = readStoredTxs(parsed["txs"])
  if (txs === undefined || txs.length !== hashes.length) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  const wallet = asText(city["wallet"])
  if (wallet.length === 0) return { ok: false, result: errResult(ctx, state, codes.WALLET_NOT_CONNECTED) }
  const moves: FragmentMove[] = []
  for (let i = 0; i < hashes.length; i += 1) {
    const hash = hashes[i]
    const tx = txs[i]
    if (hash === undefined || tx === undefined) {
      return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
    }
    const receipt = await port.chain.transactionReceipt(hash)
    if (!receipt.ok || receipt.status !== 1n) return { ok: false, result: unconfirmed(ctx, state) }
    const seen = await port.chain.transactionByHash(hash)
    if (!seen.ok) return { ok: false, result: unconfirmed(ctx, state) }
    if (!sameHex(seen.from, wallet) || !sameHex(seen.to, tx.to) || !sameHex(seen.input, tx.data)) {
      return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
    }
    moves.push({ ticker: tx.ticker, amount: tx.amount })
  }
  return { ok: true, hashes, moves }
}

function moveClaimed(city: Dict, ticker: string, amount: bigint): bigint {
  const sliced = asEngineDict(city["fragment_sliced"])
  const have = asBigint(sliced[ticker], 0n)
  const move = amount <= have ? amount : have
  sliced[ticker] = have - move
  city["fragment_sliced"] = sliced
  const claimed = asEngineDict(city["fragment_claimed"])
  claimed[ticker] = asBigint(claimed[ticker], 0n) + move
  city["fragment_claimed"] = claimed
  return move
}

export async function confirmClaimFragment(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  cityId: string,
  intentId: string,
  expected: bigint,
  moves: readonly FragmentMove[],
  hashes: readonly string[],
  lock: TickLock | undefined,
  live = false,
): Promise<HttpResult> {
  for (const hash of hashes) {
    const taken = await takenChainTx(ctx, store, state, cityId, hash)
    if (taken !== undefined) return taken
  }
  if (lock !== undefined) {
    const writer = await lock.tryAcquire()
    if (!writer) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  }
  if (asBigint(state["city_time"]) !== expected) return errResult(ctx, state, ctx.staleCode)
  const rate = await incrementCommandRate(store, cityId, asBigint(state["tick_index"]), ctx.rateLimit)
  if (rate === "limited") return errResult(ctx, state, codes.API_RATE_LIMITED)
  const cities = asEngineDict(state["cities"])
  if (!(cityId in cities)) return errResult(ctx, state, codes.API_MALFORMED)
  const city = asEngineDict(cities[cityId])
  let snapshot = structuredClone(state)
  watchSnapshot(() => {
    snapshot = structuredClone(state)
  })
  armChainClock(expected)
  deferServerMint(true)
  try {
    for (const move of moves) {
      const have = asBigint(asEngineDict(city["fragment_sliced"])[move.ticker], 0n)
      if (move.amount <= 0n || have < move.amount) return errResult(ctx, state, codes.FRAGMENT_SLICE_PENDING)
    }
    const listed: Json[] = []
    for (const move of moves) {
      listed.push({ ticker: move.ticker, claimed: moveClaimed(city, move.ticker, move.amount).toString() })
    }
    const result = okResult(ctx, state, { effect: "claim_fragment", phase: "applied", assets: listed })
    const blocked = await refuseCustodial(ctx, store, state, cityId, snapshot, live)
    if (blocked !== undefined) return blocked
    let opened = false
    try {
      await store.exec("BEGIN")
      opened = true
      await putBytes(store, "intents", intentKey(cityId, intentId), result.body, cityKind(state, cityId))
      if (result.status === ctx.httpOk) {
        for (const hash of hashes) {
          await rememberChainTx(store, state, cityId, hash, result.body)
        }
      }
      await persistLiveState(store, state, cityId)
      await store.exec("COMMIT")
    } catch (err) {
      if (opened) await rollback(store)
      restoreMemory(state, snapshot)
      throw err
    }
    return result
  } catch (err) {
    restoreMemory(state, snapshot)
    if (err instanceof WorldMoved) return errResult(ctx, state, ctx.staleCode)
    throw err
  } finally {
    deferServerMint(false)
  }
}
