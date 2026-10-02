import type { AssetPort, TxViewResult } from "@corporator/chainport"
import { canonical, fromUtf8, parseJson } from "@corporator/contentpack"
import type { Dict } from "@corporator/engine"
import { codes } from "@corporator/protocol"
import { withWorldLock } from "./city_lock.js"
import { prizeCustodyLive } from "./custody.js"
import { cityKind, errResult, type HttpResult } from "./envelope.js"
import type { PackCtx } from "./pack_ctx.js"
import { getBytes, listBytes, putBytes, type Store } from "./store.js"
import { persistLiveState, restoreMemory } from "./tick_host.js"
import { asBigint, asEngineDict, asObj, asText, walk, type Json } from "./values.js"

export type ChainEffect = "deposit" | "stake" | "buy" | "present"

const EFFECTS: readonly ChainEffect[] = ["deposit", "stake", "buy", "present"]

type Credit = { readonly [key: string]: Json }

type Host = { readonly ctx: PackCtx; readonly store: Store; state: Dict }

function chainMin(ctx: PackCtx): bigint {
  return asBigint(walk(ctx.pack, ["sections", "api", "params", "chain_min_confirmations", "v"]), 1n)
}

/** One confirmation is a successful receipt. A higher pack minimum is not invented here. */
export function receiptLanded(ctx: PackCtx, receipt: TxViewResult): boolean {
  if (!receipt.ok || receipt.status !== 1n) return false
  return chainMin(ctx) <= 1n
}

export function chainCreditKey(hash: string): string {
  return "reorg:" + hash.toLowerCase()
}

export async function creditBlockHash(port: AssetPort, hash: string): Promise<string> {
  try {
    const receipt = await port.chain.transactionReceipt(hash)
    if (!receipt.ok || receipt.blockHash === undefined || receipt.blockHash.length === 0) return ""
    return receipt.blockHash
  } catch {
    return ""
  }
}

function cityOf(state: Dict, cityId: string): Dict | undefined {
  const cities = asEngineDict(state["cities"])
  if (!(cityId in cities)) return undefined
  return asEngineDict(cities[cityId])
}

function dec(value: bigint): string {
  return value.toString()
}

function big(row: Credit, key: string): bigint {
  const raw = row[key]
  if (typeof raw !== "string" || raw.length === 0) return 0n
  try {
    return BigInt(raw)
  } catch {
    return 0n
  }
}

function text(row: Credit, key: string): string {
  return asText(row[key])
}

function flag(row: Credit, key: string): boolean {
  return text(row, key) === "1"
}

function districtList(city: Dict): string {
  const raw = city["districts"]
  if (!Array.isArray(raw)) return ""
  const ids: string[] = []
  for (const item of raw) {
    if (typeof item === "string" && item.length > 0) ids.push(item)
  }
  return ids.join(",")
}

function stakeMoved(before: Dict, after: Dict): {
  readonly ticker: string
  readonly stakeBefore: string
  readonly stakeAfter: string
  readonly chainBefore: string
  readonly chainAfter: string
} {
  const empty = { ticker: "", stakeBefore: "0", stakeAfter: "0", chainBefore: "0", chainAfter: "0" }
  const bSettled = asEngineDict(before["stake_settled"])
  const aSettled = asEngineDict(after["stake_settled"])
  const bChain = asEngineDict(before["stake_chain"])
  const aChain = asEngineDict(after["stake_chain"])
  const keys = [...new Set([...Object.keys(bSettled), ...Object.keys(aSettled), ...Object.keys(bChain), ...Object.keys(aChain)])].sort()
  for (const ticker of keys) {
    const bs = asBigint(bSettled[ticker], 0n)
    const as_ = asBigint(aSettled[ticker], 0n)
    const bc = asBigint(bChain[ticker], 0n)
    const ac = asBigint(aChain[ticker], 0n)
    if (bs === as_ && bc === ac) continue
    return {
      ticker,
      stakeBefore: dec(bs),
      stakeAfter: dec(as_),
      chainBefore: dec(bc),
      chainAfter: dec(ac),
    }
  }
  return empty
}

function voucherMoved(before: Dict, after: Dict): { readonly id: string; readonly nonce: string; readonly reservation: string } {
  const rows = Array.isArray(after["vouchers"]) ? after["vouchers"] : []
  const prior = Array.isArray(before["vouchers"]) ? before["vouchers"] : []
  for (const item of rows) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = asObj(item)
    if (asText(row["status"]) !== "presented") continue
    const id = asText(row["id"])
    for (const old of prior) {
      if (old === null || typeof old !== "object" || Array.isArray(old)) continue
      const prev = asObj(old)
      if (asText(prev["id"]) !== id || asText(prev["status"]) === "presented") continue
      return { id, nonce: asText(row["nonce"]), reservation: asText(row["reservation_id"]) }
    }
  }
  return { id: "", nonce: "", reservation: "" }
}

function money(state: Dict, city: Dict): { readonly [key: string]: bigint } {
  const acc = asEngineDict(state["acc"])
  return {
    capital: asBigint(city["capital"], 0n),
    vault: asBigint(state["vault_corp"], 0n),
    outstanding: asBigint(state["capital_outstanding"], 0n),
    minted_total: asBigint(state["capital_minted_total"], 0n),
    deposited_total: asBigint(state["corp_deposited_total"], 0n),
    mint_corp: asBigint(city["chain_mint_corp"], 0n),
    mint_capital: asBigint(city["chain_mint_capital"], 0n),
    withdrawn_capital: asBigint(city["withdrawn_capital"], 0n),
    acc_withdrawn: asBigint(acc["withdrawn_capital"], 0n),
    pool_eth: asBigint(state["pool_eth"], 0n),
    pool_corp: asBigint(state["pool_corp"], 0n),
    bank_reserved: asBigint(state["bank_reserved_today_wei"], 0n),
    bank_used: asBigint(state["bank_used_today_wei"], 0n),
    reserved_day: asBigint(city["reserved_day"], 0n),
    withdrawn_day: asBigint(city["withdrawn_day"], 0n),
  }
}

const BLIND = [
  "capital",
  "vault",
  "outstanding",
  "minted_total",
  "deposited_total",
  "mint_corp",
  "mint_capital",
  "withdrawn_capital",
  "acc_withdrawn",
] as const

const MATCH = ["pool_eth", "pool_corp", "bank_reserved", "bank_used", "reserved_day", "withdrawn_day"] as const

function buildCredit(
  before: Dict,
  after: Dict,
  cityId: string,
  effect: ChainEffect,
  blockHash: string,
): Credit {
  const cityBefore = cityOf(before, cityId)
  const cityAfter = cityOf(after, cityId)
  const left = cityBefore === undefined ? money(before, {}) : money(before, cityBefore)
  const right = cityAfter === undefined ? money(after, {}) : money(after, cityAfter)
  const stake = cityBefore === undefined || cityAfter === undefined ? stakeMoved({}, {}) : stakeMoved(cityBefore, cityAfter)
  const voucher = cityBefore === undefined || cityAfter === undefined ? voucherMoved({}, {}) : voucherMoved(cityBefore, cityAfter)
  const row: { [key: string]: Json } = {
    city_id: cityId,
    effect,
    block_hash: blockHash,
    rolled: "0",
    restored: "0",
    burned: "0",
    kept: "0",
    ticker: stake.ticker,
    stake_before: stake.stakeBefore,
    stake_after: stake.stakeAfter,
    chain_before: stake.chainBefore,
    chain_after: stake.chainAfter,
    districts_before: cityBefore === undefined ? "" : districtList(cityBefore),
    districts_after: cityAfter === undefined ? "" : districtList(cityAfter),
    voucher_id: voucher.id,
    nonce: voucher.nonce,
    reservation_id: voucher.reservation,
    siblings: "",
  }
  const keys = [...BLIND, ...MATCH]
  for (const key of keys) {
    const a = left[key] ?? 0n
    const b = right[key] ?? 0n
    row[key] = dec(b - a)
  }
  return row
}

export async function noteChainCredit(
  ctx: PackCtx,
  store: Store,
  before: Dict,
  after: Dict,
  cityId: string,
  hash: string,
  effect: ChainEffect,
  blockHash: string,
  siblings: readonly string[],
): Promise<void> {
  if (chainMin(ctx) < 0n) return
  if (!EFFECTS.includes(effect)) return
  const built = buildCredit(before, after, cityId, effect, blockHash)
  const row: { [key: string]: Json } = {}
  for (const key of Object.keys(built)) {
    const value = built[key]
    if (value !== undefined) row[key] = value
  }
  const rest: string[] = []
  for (const item of siblings) {
    if (item.toLowerCase() === hash.toLowerCase()) continue
    rest.push(item.toLowerCase())
  }
  row["siblings"] = rest.join(",")
  await putBytes(store, "intents", chainCreditKey(hash), canonical(row), cityKind(after, cityId))
}

function readCredit(raw: Uint8Array): Credit | undefined {
  let parsed: Json
  try {
    parsed = parseJson(fromUtf8(raw))
  } catch {
    return undefined
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return undefined
  const row = parsed
  const effect = asText(row["effect"])
  if (effect !== "deposit" && effect !== "stake" && effect !== "buy" && effect !== "present") return undefined
  return row
}

/** While the credit is rolled back, the stored success body is not the answer. */
export async function chainCreditGate(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  hash: string,
): Promise<HttpResult | undefined> {
  const raw = await getBytes(store, "intents", chainCreditKey(hash))
  if (raw === undefined) return undefined
  const row = readCredit(raw)
  if (row === undefined) return undefined
  if (flag(row, "rolled") && !flag(row, "restored")) return errResult(ctx, state, codes.CHAIN_REORG)
  return undefined
}

function effectOf(row: Credit): ChainEffect {
  const effect = text(row, "effect")
  if (effect === "stake" || effect === "buy" || effect === "present") return effect
  return "deposit"
}

function receiptGone(receipt: TxViewResult, blockHash: string): boolean {
  if (!receipt.ok) return receipt.code === codes.CHAIN_TX_UNCONFIRMED
  if (receipt.status !== 1n) return true
  const seen = receipt.blockHash
  return blockHash.length > 0 && seen !== undefined && seen.length > 0 && seen.toLowerCase() !== blockHash.toLowerCase()
}

function receiptBack(receipt: TxViewResult, blockHash: string): boolean {
  if (!receipt.ok || receipt.status !== 1n) return false
  const seen = receipt.blockHash
  if (blockHash.length > 0 && seen !== undefined && seen.length > 0 && seen.toLowerCase() !== blockHash.toLowerCase()) {
    return false
  }
  return true
}

function writeBlind(state: Dict, city: Dict, row: Credit, dir: bigint): boolean {
  let moved = false
  const acc = asEngineDict(state["acc"])
  for (const key of BLIND) {
    const delta = big(row, key)
    if (delta === 0n) continue
    const current = field(state, city, acc, key)
    const next = current + delta * dir
    const floored = next < 0n ? 0n : next
    if (floored === current) continue
    setField(state, city, acc, key, floored)
    moved = true
  }
  state["acc"] = acc
  return moved
}

function field(state: Dict, city: Dict, acc: Dict, key: string): bigint {
  if (key === "capital") return asBigint(city["capital"], 0n)
  if (key === "vault") return asBigint(state["vault_corp"], 0n)
  if (key === "outstanding") return asBigint(state["capital_outstanding"], 0n)
  if (key === "minted_total") return asBigint(state["capital_minted_total"], 0n)
  if (key === "deposited_total") return asBigint(state["corp_deposited_total"], 0n)
  if (key === "mint_corp") return asBigint(city["chain_mint_corp"], 0n)
  if (key === "mint_capital") return asBigint(city["chain_mint_capital"], 0n)
  if (key === "withdrawn_capital") return asBigint(city["withdrawn_capital"], 0n)
  return asBigint(acc["withdrawn_capital"], 0n)
}

function setField(state: Dict, city: Dict, acc: Dict, key: string, value: bigint): void {
  if (key === "capital") city["capital"] = value
  else if (key === "vault") state["vault_corp"] = value
  else if (key === "outstanding") state["capital_outstanding"] = value
  else if (key === "minted_total") state["capital_minted_total"] = value
  else if (key === "deposited_total") state["corp_deposited_total"] = value
  else if (key === "mint_corp") city["chain_mint_corp"] = value
  else if (key === "mint_capital") city["chain_mint_capital"] = value
  else if (key === "withdrawn_capital") city["withdrawn_capital"] = value
  else acc["withdrawn_capital"] = value
}

function shiftMatched(current: bigint, delta: bigint, dir: bigint): bigint | undefined {
  if (delta === 0n) return undefined
  const after = current
  if (dir < 0n) {
    const next = current - delta
    if (next < 0n) return undefined
    return next
  }
  return after + delta
}

function writeMatched(state: Dict, city: Dict, row: Credit, dir: bigint): boolean {
  let moved = false
  const acc = asEngineDict(state["acc"])
  for (const key of MATCH) {
    const delta = big(row, key)
    const current = matchedField(state, city, key)
    const next = shiftMatched(current, delta, dir)
    if (next === undefined || next === current) continue
    if (dir < 0n && current !== (current - delta) + delta) continue
    setMatched(state, city, key, next)
    moved = true
  }
  state["acc"] = acc
  return moved
}

function matchedField(state: Dict, city: Dict, key: string): bigint {
  if (key === "pool_eth") return asBigint(state["pool_eth"], 0n)
  if (key === "pool_corp") return asBigint(state["pool_corp"], 0n)
  if (key === "bank_reserved") return asBigint(state["bank_reserved_today_wei"], 0n)
  if (key === "bank_used") return asBigint(state["bank_used_today_wei"], 0n)
  if (key === "reserved_day") return asBigint(city["reserved_day"], 0n)
  return asBigint(city["withdrawn_day"], 0n)
}

function setMatched(state: Dict, city: Dict, key: string, value: bigint): void {
  if (key === "pool_eth") state["pool_eth"] = value
  else if (key === "pool_corp") state["pool_corp"] = value
  else if (key === "bank_reserved") state["bank_reserved_today_wei"] = value
  else if (key === "bank_used") state["bank_used_today_wei"] = value
  else if (key === "reserved_day") city["reserved_day"] = value
  else city["withdrawn_day"] = value
}

function writeStake(city: Dict, row: Credit, dir: bigint): boolean {
  const ticker = text(row, "ticker")
  if (ticker.length === 0) return false
  const settled = asEngineDict(city["stake_settled"])
  const chain = asEngineDict(city["stake_chain"])
  const currentSettled = asBigint(settled[ticker], 0n)
  const currentChain = asBigint(chain[ticker], 0n)
  const beforeS = big(row, "stake_before")
  const afterS = big(row, "stake_after")
  const beforeC = big(row, "chain_before")
  const afterC = big(row, "chain_after")
  const fromS = dir < 0n ? afterS : beforeS
  const toS = dir < 0n ? beforeS : afterS
  const fromC = dir < 0n ? afterC : beforeC
  const toC = dir < 0n ? beforeC : afterC
  if (currentSettled !== fromS || currentChain !== fromC) return false
  settled[ticker] = toS
  chain[ticker] = toC
  city["stake_settled"] = settled
  city["stake_chain"] = chain
  const fromIds = dir < 0n ? text(row, "districts_after") : text(row, "districts_before")
  const toIds = dir < 0n ? text(row, "districts_before") : text(row, "districts_after")
  if (districtList(city) === fromIds && fromIds !== toIds) {
    city["districts"] = toIds.length === 0 ? [] : toIds.split(",")
  }
  return true
}

function setVoucher(city: Dict, id: string, status: string): boolean {
  if (id.length === 0) return false
  const raw = city["vouchers"]
  if (!Array.isArray(raw)) return false
  let moved = false
  for (const item of raw) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = asEngineDict(item)
    if (asText(row["id"]) !== id) continue
    if (asText(row["status"]) === status) continue
    row["status"] = status
    moved = true
  }
  return moved
}

function setReservation(state: Dict, id: string, status: string): boolean {
  if (id.length === 0) return false
  const raw = state["bank_reservations"]
  if (!Array.isArray(raw)) return false
  let moved = false
  for (const item of raw) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = asEngineDict(item)
    if (asText(row["id"]) !== id) continue
    if (asText(row["status"]) === status) continue
    row["status"] = status
    moved = true
  }
  return moved
}

async function markSiblings(store: Store, state: Dict, row: Credit): Promise<void> {
  const packed = text(row, "siblings")
  if (packed.length === 0) return
  const rolled = flag(row, "rolled")
  const restored = flag(row, "restored")
  if (!rolled && !flag(row, "kept")) return
  for (const hash of packed.split(",")) {
    if (hash.length === 0) continue
    const mirror: { [key: string]: Json } = {
      city_id: text(row, "city_id"),
      effect: text(row, "effect"),
      block_hash: "",
      rolled: rolled ? "1" : "0",
      restored: restored ? "1" : "0",
      burned: "0",
      kept: flag(row, "kept") ? "1" : "0",
      siblings: "",
    }
    await putBytes(store, "intents", chainCreditKey(hash), canonical(mirror), cityKind(state, text(row, "city_id")))
  }
}

function noteReorg(city: Dict): void {
  const prior = city["ledger_journal"]
  const journal = Array.isArray(prior) ? [...prior] : []
  journal.push({ code: codes.CHAIN_REORG })
  city["ledger_journal"] = journal
}

function applyCredit(state: Dict, row: { [key: string]: Json }, dir: bigint): boolean {
  const city = cityOf(state, text(row, "city_id"))
  if (city === undefined) return false
  let moved = writeBlind(state, city, row, dir)
  if (writeMatched(state, city, row, dir)) moved = true
  if (effectOf(row) === "stake" && writeStake(city, row, dir)) moved = true
  if (effectOf(row) === "present") {
    const status = dir < 0n ? "open" : "presented"
    const reservation = dir < 0n ? "open" : "settled"
    if (setVoucher(city, text(row, "voucher_id"), status)) moved = true
    if (setReservation(state, text(row, "reservation_id"), reservation)) moved = true
  }
  if (moved && dir < 0n) noteReorg(city)
  return moved
}

type Verdict = "roll" | "keep" | "restore" | "none"

async function judge(port: AssetPort, state: Dict, row: Credit, receipt: TxViewResult): Promise<Verdict> {
  const blockHash = text(row, "block_hash")
  const back = receiptBack(receipt, blockHash)
  const gone = receiptGone(receipt, blockHash)
  if (flag(row, "burned") && !flag(row, "restored") && back) return "restore"
  if (flag(row, "rolled") || flag(row, "kept") || flag(row, "restored")) return "none"
  if (!gone) return "none"
  const effect = effectOf(row)
  if (effect === "present") {
    const nonce = text(row, "nonce")
    if (nonce.length === 0) return "keep"
    const used = await port.vault.used(nonce)
    if (!used.ok) return "none"
    if (used.used) return "keep"
    return "roll"
  }
  if (effect === "deposit") {
    const vaultDelta = big(row, "vault")
    if (vaultDelta > 0n) {
      const city = cityOf(state, text(row, "city_id"))
      const wallet = city === undefined ? "" : asText(city["wallet"])
      if (wallet.length === 0) return "none"
      const backing = await port.vault.backingOf(wallet)
      if (!backing.ok) return "none"
      const vaultNow = asBigint(state["vault_corp"], 0n)
      const next = vaultNow - vaultDelta
      if (next < backing.amount) return "keep"
    }
  }
  return "roll"
}

/** Re-reads live credits. A missing receipt rolls the effect back once. Silence does not. */
export async function reconcileChainCredits(host: Host, port: AssetPort): Promise<void> {
  if (!prizeCustodyLive(port)) return
  const rows = await listBytes(host.store, "intents", "reorg:")
  const plans: { readonly hash: string; readonly verdict: Verdict }[] = []
  for (const item of rows) {
    const row = readCredit(item.payload)
    if (row === undefined) continue
    const hash = item.id.startsWith("reorg:") ? item.id.slice("reorg:".length) : ""
    if (hash.length === 0) continue
    let receipt: TxViewResult
    try {
      receipt = await port.chain.transactionReceipt(hash)
    } catch {
      continue
    }
    const verdict = await judge(port, host.state, row, receipt)
    if (verdict === "none") continue
    plans.push({ hash, verdict })
  }
  if (plans.length === 0) return
  await withWorldLock(async () => {
    const state = host.state
    const snapshot = structuredClone(state)
    let opened = false
    try {
      await host.store.exec("BEGIN")
      opened = true
      let cityId = ""
      for (const plan of plans) {
        const raw = await getBytes(host.store, "intents", chainCreditKey(plan.hash))
        if (raw === undefined) continue
        const parsed = readCredit(raw)
        if (parsed === undefined) continue
        const row: { [key: string]: Json } = { ...parsed }
        if (plan.verdict === "keep") {
          row["kept"] = "1"
        } else if (plan.verdict === "restore") {
          if (applyCredit(state, row, 1n)) row["restored"] = "1"
        } else if (applyCredit(state, row, -1n)) {
          row["rolled"] = "1"
          row["burned"] = "1"
        } else {
          row["kept"] = "1"
        }
        const id = text(row, "city_id")
        await putBytes(host.store, "intents", chainCreditKey(plan.hash), canonical(row), cityKind(state, id))
        await markSiblings(host.store, state, row)
        if (id.length > 0) cityId = id
      }
      if (cityId.length > 0) await persistLiveState(host.store, state, cityId)
      await host.store.exec("COMMIT")
    } catch (err) {
      if (opened) {
        try {
          await host.store.exec("ROLLBACK")
        } catch {
          // The persist error is the one to surface.
        }
      }
      restoreMemory(state, snapshot)
      throw err
    }
  })
}
