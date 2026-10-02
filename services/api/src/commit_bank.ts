import {
  authorize,
  assertI1,
  bankOpen,
  cityClock,
  cityBankShareBps,
  cpmmSellCorp,
  expire,
  personalCapWei,
  present,
  remainingGlobal,
  resetDayCounters,
  bytesToHex,
  keccak256,
  keccak256Hex,
  TickError,
  mintFromBacking,
  type Dict,
} from "@corporator/engine"
import {
  dataApprove,
  dataDeposit,
  dataPresentVoucher,
  OUTCOME_PRESENTED,
  OUTCOME_RELEASED,
  type AssetPort,
  type PortResult,
  type Voucher,
} from "@corporator/chainport"
import { fromUtf8, parseJson, utf8 } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { type PackCtx } from "./pack_ctx.js"
import { chainCreditGate, receiptLanded } from "./reorg.js"
import { cityKind, errResult, okResult, statusFor, type HttpResult } from "./envelope.js"
import { asBigint, asEngineDict, asObj, asText, walk, type Json } from "./values.js"
import {
  armChainClock,
  deferServerMint,
  outsideWorldLock,
  serverMintDeferred,
  watchSnapshot,
  withWorldLock,
  WorldMoved,
} from "./city_lock.js"
import { prizeCustodyLive } from "./custody.js"
import { incrementCommandRate } from "./rates.js"
import { getBytes, putBytes, type Store } from "./store.js"
import { type TickLock } from "./tick_lock.js"
import { persistLiveState, refuseCustodial, restoreMemory } from "./tick_host.js"

type MintPreview = { readonly ok: true; readonly minted: bigint; readonly rate: bigint } | { readonly ok: false; readonly code: string }

function previewDepositMint(cfg: Dict, state: Dict, cityId: string, amount: bigint): MintPreview {
  const shadow = structuredClone(state)
  const vaultBefore = asBigint(shadow["vault_corp"], 0n)
  const rate = asBigint(shadow["mint_rate"], 0n)
  let minted = 0n
  try {
    minted = mintFromBacking(cfg, shadow, amount, 0n, 1n, cityId)
  } catch (e) {
    if (e instanceof TickError) return { ok: false, code: codes.API_MALFORMED }
    throw e
  }
  if (minted <= 0n && asBigint(shadow["vault_corp"], 0n) === vaultBefore) {
    return { ok: false, code: codes.STALE_PRICE }
  }
  const cities = asEngineDict(shadow["cities"])
  const existing = cities[cityId]
  if (existing === undefined || typeof existing !== "object" || existing === null) {
    return { ok: false, code: codes.API_MALFORMED }
  }
  const row = asEngineDict(existing)
  row["capital"] = asBigint(row["capital"], 0n) + minted
  try {
    assertI1(cfg, shadow, cityId)
  } catch (e) {
    if (e instanceof TickError) return { ok: false, code: codes.API_MALFORMED }
    throw e
  }
  return { ok: true, minted, rate }
}

function creditCapital(city: Dict, minted: bigint): void {
  city["capital"] = asBigint(city["capital"], 0n) + minted
}

function mintDepositOrCredit(
  cfg: Dict,
  state: Dict,
  city: Dict,
  cityId: string,
  amount: bigint,
): bigint {
  const outstandingBefore = asBigint(state["capital_outstanding"], 0n)
  try {
    const minted = mintFromBacking(cfg, state, amount, 0n, 1n, cityId)
    creditCapital(city, minted)
    return minted
  } catch (e) {
    if (!(e instanceof TickError)) throw e
    const grown = asBigint(state["capital_outstanding"], 0n) - outstandingBefore
    if (grown > 0n) {
      creditCapital(city, grown)
      return grown
    }
    throw e
  }
}

function commitDepositMint(
  cfg: Dict,
  state: Dict,
  city: Dict,
  cityId: string,
  amount: bigint,
  chain: boolean,
  preview: { readonly minted: bigint; readonly rate: bigint },
): { readonly ok: true; readonly minted: bigint } | { readonly ok: false; readonly code: string } {
  const vaultBefore = asBigint(state["vault_corp"], 0n)
  const outstandingBefore = asBigint(state["capital_outstanding"], 0n)
  try {
    const minted = mintDepositOrCredit(cfg, state, city, cityId, amount)
    if (minted > 0n) return { ok: true, minted }
    if (!chain) {
      if (asBigint(state["vault_corp"], 0n) === vaultBefore) return { ok: false, code: codes.STALE_PRICE }
      return { ok: true, minted }
    }
  } catch (e) {
    if (!(e instanceof TickError)) throw e
    if (!chain) return { ok: false, code: codes.API_MALFORMED }
  }
  const savedRate = asBigint(state["mint_rate"], 0n)
  if (savedRate <= 0n && preview.rate > 0n) state["mint_rate"] = preview.rate
  try {
    const minted = mintDepositOrCredit(cfg, state, city, cityId, amount)
    if (minted > 0n) return { ok: true, minted }
  } catch (e) {
    if (!(e instanceof TickError)) throw e
  } finally {
    if (savedRate <= 0n) state["mint_rate"] = savedRate
  }
  const grown = asBigint(state["capital_outstanding"], 0n) - outstandingBefore
  if (grown > 0n) return { ok: true, minted: grown }
  if (!chain || preview.minted <= 0n) return { ok: false, code: codes.STALE_PRICE }
  creditCapital(city, preview.minted)
  if (asBigint(state["vault_corp"], 0n) === vaultBefore) {
    state["vault_corp"] = vaultBefore + amount
    state["corp_deposited_total"] = asBigint(state["corp_deposited_total"], 0n) + amount
    state["capital_outstanding"] = outstandingBefore + preview.minted
    state["capital_minted_total"] = asBigint(state["capital_minted_total"], 0n) + preview.minted
  }
  return { ok: true, minted: preview.minted }
}

export type MintPhase = "idle" | "cleared" | "signed" | "replay"

function clearMintSend(city: Dict): void {
  city["chain_mint_raw"] = ""
  city["chain_mint_hash"] = ""
  city["chain_mint_nonce"] = ""
  city["chain_mint_tx_corp"] = 0n
  city["chain_mint_tx_capital"] = 0n
  city["chain_mint_pending_before"] = 0n
  city["chain_mint_backing_before"] = 0n
}

function landMint(city: Dict, corp: bigint, capital: bigint): void {
  city["chain_mint_tx_corp"] = corp
  city["chain_mint_tx_capital"] = capital
  const leftCorp = asBigint(city["chain_mint_corp"], 0n) - corp
  const leftCapital = asBigint(city["chain_mint_capital"], 0n) - capital
  city["chain_mint_corp"] = leftCorp > 0n ? leftCorp : 0n
  city["chain_mint_capital"] = leftCapital > 0n ? leftCapital : 0n
  clearMintSend(city)
}

async function mintConfirmed(port: AssetPort, city: Dict, account: string): Promise<boolean> {
  const hash = asText(city["chain_mint_hash"])
  if (hash.length > 0) {
    const rec = await port.chain.transactionReceipt(hash)
    if (rec.ok && rec.status === 1n) return true
    if (rec.ok && rec.status === 0n) {
      clearMintSend(city)
      return false
    }
  }
  const txCorp = asBigint(city["chain_mint_tx_corp"], 0n)
  if (txCorp <= 0n) return false
  const beforePending = asBigint(city["chain_mint_pending_before"], 0n)
  const beforeBacking = asBigint(city["chain_mint_backing_before"], 0n)
  const pending = await port.vault.pending(account)
  const backing = await port.vault.backingOf(account)
  if (!pending.ok || !backing.ok) return false
  return pending.amount + txCorp <= beforePending && backing.amount >= beforeBacking + txCorp
}

/** One sign per open debt. A stored raw is resent; it is not signed again. */
export async function advanceChainMint(port: AssetPort, city: Dict, account: string): Promise<MintPhase> {
  const corp = asBigint(city["chain_mint_corp"], 0n)
  const capital = asBigint(city["chain_mint_capital"], 0n)
  if (corp <= 0n || capital <= 0n || account.length === 0) return "idle"
  if (await mintConfirmed(port, city, account)) {
    const txCorp = asBigint(city["chain_mint_tx_corp"], 0n)
    const txCapital = asBigint(city["chain_mint_tx_capital"], 0n)
    landMint(city, txCorp > 0n ? txCorp : corp, txCapital > 0n ? txCapital : capital)
    return "cleared"
  }
  const raw = asText(city["chain_mint_raw"])
  if (raw.length > 0) return "replay"
  const pendingBefore = await port.vault.pending(account)
  const backingBefore = await port.vault.backingOf(account)
  if (!pendingBefore.ok || !backingBefore.ok || pendingBefore.amount < corp) return "idle"
  const signed = await port.vault.signMintCapital(account, corp, capital)
  if (!signed.ok) return "idle"
  const txRaw = signed.txRaw
  if (txRaw !== undefined && txRaw.length > 0 && signed.txConfirmed !== true) {
    city["chain_mint_raw"] = txRaw
    city["chain_mint_hash"] = signed.txHash ?? ""
    city["chain_mint_nonce"] = signed.txNonce ?? ""
    city["chain_mint_tx_corp"] = corp
    city["chain_mint_tx_capital"] = capital
    if (pendingBefore.ok) city["chain_mint_pending_before"] = pendingBefore.amount
    if (backingBefore.ok) city["chain_mint_backing_before"] = backingBefore.amount
    return "signed"
  }
  landMint(city, corp, capital)
  return "cleared"
}

export async function sendSignedMint(port: AssetPort, city: Dict): Promise<void> {
  const raw = asText(city["chain_mint_raw"])
  if (raw.length === 0) return
  await port.chain.sendRaw?.(raw)
}

export async function flushChainMint(port: AssetPort, city: Dict, account: string): Promise<void> {
  if (serverMintDeferred()) return
  const phase = await advanceChainMint(port, city, account)
  if (phase === "signed" || phase === "replay") await sendSignedMint(port, city)
}

/** Player $CORP → vault → Capital. Hours do not gate deposits. Live RPC pulls only after a mint preview. */
export async function applyDeposit(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
  port?: AssetPort,
): Promise<HttpResult> {
  if (cityKind(state, cityId) !== "wallet") return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
  if (!("amount" in body)) return errResult(ctx, state, codes.API_MALFORMED)
  const amount = asBigint(body["amount"])
  if (amount <= 0n) return errResult(ctx, state, codes.API_MALFORMED)
  const held = asBigint(city["corp_held"], 0n)
  const live = port !== undefined && prizeCustodyLive(port) ? port : undefined
  if (asBigint(state["mint_rate"], 0n) <= 0n) return errResult(ctx, state, codes.STALE_PRICE)
  if (live === undefined && held < amount) return errResult(ctx, state, codes.NOT_ENOUGH_CORP)
  const account = asText(city["wallet"])
  if (live !== undefined && account.length === 0) return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
  if (live !== undefined) await flushChainMint(live, city, account)
  const preview = previewDepositMint(ctx.cfg, state, cityId, amount)
  if (!preview.ok) return errResult(ctx, state, preview.code)
  const committed = commitDepositMint(ctx.cfg, state, city, cityId, amount, live !== undefined, preview)
  if (!committed.ok) return errResult(ctx, state, committed.code)
  if (live === undefined) city["corp_held"] = held - amount
  if (live !== undefined && committed.minted > 0n) {
    city["chain_mint_corp"] = asBigint(city["chain_mint_corp"], 0n) + amount
    city["chain_mint_capital"] = asBigint(city["chain_mint_capital"], 0n) + committed.minted
    if (!serverMintDeferred()) await flushChainMint(live, city, account)
  }
  return okResult(ctx, state, {
    phase: "applied",
    effect: "deposit",
    amount,
    minted: committed.minted,
    capital: asBigint(city["capital"]),
  })
}

function shareBpsOf(cfg: Dict, city: Dict): bigint {
  return cityBankShareBps(cfg, city)
}

function corpOut(cfg: Dict, rate: bigint, capital: bigint): bigint {
  const wei = asBigint(cfg["wei"])
  const bps = asBigint(cfg["bps"])
  const markup = asBigint(cfg["bank_markup_bps"])
  const denom = rate * (bps + markup)
  if (denom <= 0n || wei <= 0n) return 0n
  return (capital * wei * bps) / denom
}

function ethAskOf(state: Dict, corp: bigint): bigint {
  if (corp <= 0n) return 0n
  const sold = cpmmSellCorp(asBigint(state["pool_eth"], 0n), asBigint(state["pool_corp"], 0n), corp)
  return sold[2]
}

type WithdrawQuote = {
  readonly amount: bigint
  readonly corp: bigint
  readonly take: bigint
  readonly day: bigint
  readonly depth: bigint
  readonly poolShare: bigint
  readonly share: bigint
  readonly bps: bigint
  readonly vid: string
  readonly held: bigint
  readonly vault: bigint
}

function isQuoted(value: WithdrawQuote | HttpResult): value is WithdrawQuote {
  return !("status" in value)
}

/** Bank checks shared by the mock present and the live voucher. Does not authorize. */
function quoteWithdraw(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
): WithdrawQuote | HttpResult {
  if (cityKind(state, cityId) === "demo") return errResult(ctx, state, codes.DEMO_NO_WITHDRAW)
  if (cityKind(state, cityId) !== "wallet") return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
  if (!("amount" in body)) return errResult(ctx, state, codes.API_MALFORMED)
  let amount = asBigint(body["amount"])
  if (amount <= 0n) return errResult(ctx, state, codes.API_MALFORMED)
  const held = asBigint(city["capital"], 0n)
  if (held < amount) return errResult(ctx, state, codes.NOT_ENOUGH_CAPITAL)
  const cfg = ctx.cfg
  const tickIndex = asBigint(state["tick_index"], 0n)
  const clock = cityClock(cfg, tickIndex)
  const day = clock[0]
  const hour = clock[1]
  const weekday = clock[2]
  if (weekday === asBigint(cfg["bank_closed_weekday"])) return errResult(ctx, state, codes.BANK_SUNDAY)
  if (bankOpen(cfg, hour, weekday) === 0n) return errResult(ctx, state, codes.BANK_CLOSED)
  const rate = asBigint(state["mint_rate"], 0n)
  if (rate <= 0n) return errResult(ctx, state, codes.STALE_PRICE)
  let corp = corpOut(cfg, rate, amount)
  if (corp <= 0n) return errResult(ctx, state, codes.API_MALFORMED)
  const vault = asBigint(state["vault_corp"], 0n)
  if (vault < corp) return errResult(ctx, state, codes.VAULT_EXIT_UNCOVERED)
  const ethAsk = ethAskOf(state, corp)
  const bps = asBigint(cfg["bps"])
  const depth = asBigint(state["pool_eth"], 0n)
  const poolShare = asBigint(cfg["bank_pool_share_bps"])
  const share = shareBpsOf(cfg, city)
  rollVoucherDay(state, day)
  resetDayCounters(state, day)
  const personal = personalCapWei(depth, poolShare, share, bps)
  let roomP = personal - asBigint(city["withdrawn_day"], 0n) - asBigint(city["reserved_day"], 0n)
  if (roomP < 0n) roomP = 0n
  const roomG = remainingGlobal(state, depth, poolShare, bps)
  const room = roomP < roomG ? roomP : roomG
  if (ethAsk > 0n && room <= 0n) return errResult(ctx, state, codes.BANK_DAILY_LIMIT_REACHED)
  let take = ethAsk
  if (take > room) take = room
  if (ethAsk > 0n && take < ethAsk) {
    amount = (amount * take) / ethAsk
    corp = (corp * take) / ethAsk
    if (amount <= 0n || corp <= 0n) return errResult(ctx, state, codes.BANK_DAILY_LIMIT_REACHED)
  }
  if (asText(city["id"]).length === 0) city["id"] = cityId
  const vid = asText(body["intent_id"])
  if (vid.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
  return { amount, corp, take, day, depth, poolShare, share, bps, vid, held, vault }
}

/** Player Capital → vault $CORP via authorize → present. Does not call bankWithdraw (C-22). */
export function applyWithdraw(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
  port?: AssetPort,
): HttpResult {
  if (port !== undefined && prizeCustodyLive(port)) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const quoted = quoteWithdraw(ctx, state, city, body, cityId)
  if (!isQuoted(quoted)) return quoted
  authorize(state, city, quoted.take, quoted.day, quoted.depth, quoted.poolShare, quoted.share, quoted.vid, quoted.bps)
  const settled = present(state, city, quoted.vid)
  if (settled === undefined) {
    expire(state, city, quoted.vid)
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  city["capital"] = quoted.held - quoted.amount
  city["corp_held"] = asBigint(city["corp_held"], 0n) + quoted.corp
  state["vault_corp"] = quoted.vault - quoted.corp
  state["capital_outstanding"] = asBigint(state["capital_outstanding"], 0n) - quoted.amount
  city["withdrawn_capital"] = asBigint(city["withdrawn_capital"], 0n) + quoted.amount
  const acc = asEngineDict(state["acc"])
  acc["withdrawn_capital"] = asBigint(acc["withdrawn_capital"], 0n) + quoted.amount
  return okResult(ctx, state, {
    effect: "withdraw",
    amount: quoted.amount,
    corp: quoted.corp,
    voucher_id: quoted.vid,
    capital: asBigint(city["capital"]),
  })
}

const SIGNING = "signing"
const OPEN = "open"
const REJECTED = "rejected"
const PRESENTED = "presented"
const EXPIRED = "expired"

type LiveBegin =
  | { readonly tag: "stop"; readonly result: HttpResult }
  | {
      readonly tag: "issue"
      readonly vid: string
      readonly nonce: string
      readonly account: string
      readonly corp: bigint
      readonly issuedAtS: bigint
      readonly fresh: boolean
    }

export type VoucherFate =
  | { readonly kind: "open" }
  | { readonly kind: "silence" }
  | { readonly kind: "empty"; readonly code: string }

function cityOf(state: Dict, cityId: string): Dict | undefined {
  const cities = asEngineDict(state["cities"])
  if (!(cityId in cities)) return undefined
  return asEngineDict(cities[cityId])
}

function voucherRows(city: Dict): Dict[] {
  const raw = city["vouchers"]
  if (!Array.isArray(raw)) return []
  const rows: Dict[] = []
  for (const item of raw) {
    if (item !== null && typeof item === "object" && !Array.isArray(item)) rows.push(asEngineDict(item))
  }
  return rows
}

function voucherById(city: Dict, id: string): Dict | undefined {
  for (const row of voucherRows(city)) {
    if (asText(row["id"]) === id || asText(row["reservation_id"]) === id) return row
  }
  return undefined
}

function pushVoucher(city: Dict, row: Dict): void {
  const raw = city["vouchers"]
  if (!Array.isArray(raw)) city["vouchers"] = [row]
  else raw.push(row)
}

function voucherTerminal(status: string): boolean {
  return status === PRESENTED || status === EXPIRED || status === REJECTED
}

function rollVoucherDay(state: Dict, day: bigint): void {
  if (state["bank_day"] === day) return
  const cities = asEngineDict(state["cities"])
  for (const id of Object.keys(cities)) asEngineDict(cities[id])["vouchers_expired_day"] = 0n
}

function expiredThisDay(state: Dict, city: Dict, day: bigint): bigint {
  if (state["bank_day"] !== day) return 0n
  return asBigint(city["vouchers_expired_day"], 0n)
}

export function voucherNonce(cityId: string, intentId: string): string {
  return "0x" + bytesToHex(keccak256(new TextEncoder().encode(cityId + ":" + intentId)))
}

function voucherTtlS(ctx: PackCtx): bigint {
  return asBigint(walk(ctx.pack, ["generated", "api", "voucher_ttl_s"]))
}

function voucherCard(ctx: PackCtx, state: Dict, row: Dict): HttpResult {
  const issued = asBigint(row["issued_at_s"], 0n)
  return okResult(ctx, state, {
    effect: "withdraw",
    phase: "voucher",
    voucher: {
      id: asText(row["id"]),
      status: asText(row["status"]),
      corp: asBigint(row["corp"], 0n),
      expires_at_s: issued + voucherTtlS(ctx),
    },
  })
}

function refuseVoucher(ctx: PackCtx, state: Dict, city: Dict, day: bigint): HttpResult | undefined {
  const max = asBigint(walk(ctx.pack, ["sections", "api", "params", "voucher_expired_per_city_day_max", "v"]))
  if (expiredThisDay(state, city, day) >= max) return errResult(ctx, state, codes.VOUCHER_EXPIRE_LIMIT)
  for (const row of voucherRows(city)) {
    const status = asText(row["status"])
    if (status === SIGNING || status === OPEN) return errResult(ctx, state, codes.VOUCHER_PENDING)
  }
  return undefined
}

function beginLiveWithdraw(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
  issuedAtS: bigint,
): LiveBegin {
  const vid = asText(body["intent_id"])
  if (vid.length === 0) return { tag: "stop", result: errResult(ctx, state, codes.API_MALFORMED) }
  const existing = voucherById(city, vid)
  if (existing === undefined && asBigint(city["chain_mint_capital"], 0n) > 0n) {
    return { tag: "stop", result: errResult(ctx, state, codes.VAULT_EXIT_UNCOVERED) }
  }
  if (existing !== undefined) {
    const status = asText(existing["status"])
    if (status === SIGNING) {
      return {
        tag: "issue",
        vid,
        nonce: asText(existing["nonce"]),
        account: asText(city["wallet"]),
        corp: asBigint(existing["corp"], 0n),
        issuedAtS: asBigint(existing["issued_at_s"], 0n),
        fresh: false,
      }
    }
    if (status === REJECTED) return { tag: "stop", result: errResult(ctx, state, codes.VOUCHER_REJECTED) }
    if (voucherTerminal(status) || status === OPEN) return { tag: "stop", result: voucherCard(ctx, state, existing) }
    return { tag: "stop", result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  const day = cityClock(ctx.cfg, asBigint(state["tick_index"], 0n))[0]
  const blocked = refuseVoucher(ctx, state, city, day)
  if (blocked !== undefined) return { tag: "stop", result: blocked }
  const quoted = quoteWithdraw(ctx, state, city, body, cityId)
  if (!isQuoted(quoted)) return { tag: "stop", result: quoted }
  const account = asText(city["wallet"])
  if (account.length === 0) return { tag: "stop", result: errResult(ctx, state, codes.WALLET_NOT_CONNECTED) }
  authorize(state, city, quoted.take, quoted.day, quoted.depth, quoted.poolShare, quoted.share, quoted.vid, quoted.bps)
  city["capital"] = quoted.held - quoted.amount
  const nonce = voucherNonce(cityId, quoted.vid)
  pushVoucher(city, {
    id: quoted.vid,
    nonce,
    capital: quoted.amount,
    corp: quoted.corp,
    reservation_id: quoted.vid,
    issued_at_s: issuedAtS,
    status: SIGNING,
  })
  return { tag: "issue", vid: quoted.vid, nonce, account, corp: quoted.corp, issuedAtS, fresh: true }
}

export function finishLiveWithdraw(ctx: PackCtx, state: Dict, city: Dict, vid: string, fate: VoucherFate): HttpResult {
  const row = voucherById(city, vid)
  if (row === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  const status = asText(row["status"])
  if (status !== SIGNING) {
    if (status === REJECTED) return errResult(ctx, state, codes.VOUCHER_REJECTED)
    return voucherCard(ctx, state, row)
  }
  if (fate.kind === "open") {
    row["status"] = OPEN
    return voucherCard(ctx, state, row)
  }
  if (fate.kind === "empty") {
    const capital = asBigint(row["capital"], 0n)
    expire(state, city, asText(row["reservation_id"]).length > 0 ? asText(row["reservation_id"]) : vid)
    city["capital"] = asBigint(city["capital"], 0n) + capital
    row["status"] = REJECTED
    return errResult(ctx, state, fate.code.length > 0 ? fate.code : codes.VOUCHER_REJECTED)
  }
  return errResult(ctx, state, codes.SERVICE_DEGRADED)
}

function storedStatus(ctx: PackCtx, body: Uint8Array): bigint {
  try {
    const parsed = parseJson(fromUtf8(body))
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      const code = asText(asObj(parsed)["code"])
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

async function commitCity(
  store: Store,
  state: Dict,
  cityId: string,
  intent: { readonly id: string; readonly result: HttpResult } | undefined,
): Promise<void> {
  let opened = false
  try {
    await store.exec("BEGIN")
    opened = true
    if (intent !== undefined) {
      await putBytes(store, "intents", cityId + ":" + intent.id, intent.result.body, cityKind(state, cityId))
    }
    await persistLiveState(store, state, cityId)
    await store.exec("COMMIT")
  } catch (err) {
    if (opened) await rollback(store)
    throw err
  }
}

function receiptBound(ctx: PackCtx): number {
  const ms = asBigint(walk(ctx.pack, ["sections", "api", "params", "chain_receipt_timeout_ms", "v"]))
  const n = Number(ms)
  if (!Number.isFinite(n) || n <= 0) return 0
  return n
}

async function raceSilence<T>(ms: number, op: Promise<T>): Promise<T | "timeout"> {
  if (ms <= 0) return op
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve("timeout"), ms)
    op.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve("timeout")
      },
    )
  })
}

async function classifyIssue(port: AssetPort, voucher: Voucher): Promise<VoucherFate> {
  let sent: PortResult | undefined
  try {
    sent = await port.vault.issueVoucher(voucher)
  } catch {
    sent = undefined
  }
  let known
  try {
    known = await port.vault.issued(voucher.nonce)
  } catch {
    known = undefined
  }
  if (known !== undefined && known.ok && known.corpAmount > 0n) return { kind: "open" }
  if (sent !== undefined && !sent.ok && known !== undefined && known.ok && known.corpAmount <= 0n) {
    const code = sent.code === codes.VAULT_EXIT_UNCOVERED ? codes.VAULT_EXIT_UNCOVERED : codes.VOUCHER_REJECTED
    return { kind: "empty", code }
  }
  if (sent !== undefined && sent.ok) {
    const hash = sent.txHash ?? ""
    if (hash.length > 0) {
      const landed = await voucherOnReceipt(port, hash)
      if (landed === "yes") return { kind: "open" }
    }
  }
  return { kind: "silence" }
}

async function voucherOnReceipt(port: AssetPort, hash: string): Promise<"yes" | "no" | "unknown"> {
  if (hash.length === 0 || port.chain === undefined) return "unknown"
  let receipt
  try {
    receipt = await port.chain.transactionReceipt(hash)
  } catch {
    return "unknown"
  }
  if (!receipt.ok) return "unknown"
  for (const log of receipt.logs) {
    const topic = log.topics[0]
    if (topic !== undefined && topic.toLowerCase() === VOUCHER_ISSUED_TOPIC) return "yes"
  }
  return "no"
}

async function readIssue(ctx: PackCtx, port: AssetPort, voucher: Voucher): Promise<VoucherFate> {
  const raced = await raceSilence(receiptBound(ctx), classifyIssue(port, voucher))
  if (raced === "timeout") return { kind: "silence" }
  return raced
}

/** Live withdraw: authorize without present, then issueVoucher after the commit. */
export async function applyLiveWithdraw(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  cityId: string,
  intentId: string,
  expected: bigint,
  body: { readonly [key: string]: Json },
  issuedAtS: bigint,
  lock: TickLock | undefined,
  port: AssetPort,
): Promise<HttpResult> {
  const prior = await getBytes(store, "intents", cityId + ":" + intentId)
  if (prior !== undefined) return { status: storedStatus(ctx, prior), body: prior, headers: {} }
  if (lock !== undefined) {
    const writer = await lock.tryAcquire()
    if (!writer) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  }
  if (expected !== asBigint(state["city_time"])) return errResult(ctx, state, ctx.staleCode)
  const rate = await incrementCommandRate(store, cityId, asBigint(state["tick_index"]), ctx.rateLimit)
  if (rate === "limited") return errResult(ctx, state, codes.API_RATE_LIMITED)
  const city = cityOf(state, cityId)
  if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  let snapshot = structuredClone(state)
  watchSnapshot(() => {
    snapshot = structuredClone(state)
  })
  armChainClock(expected)
  deferServerMint(true)
  try {
    const begun = beginLiveWithdraw(ctx, state, city, body, cityId, issuedAtS)
    if (begun.tag === "stop") {
      restoreMemory(state, snapshot)
      return begun.result
    }
    if (begun.fresh) {
      const before = snapshot
      const blocked = await refuseCustodial(ctx, store, state, cityId, before, true)
      if (blocked !== undefined) return blocked
      try {
        await commitCity(store, state, cityId, undefined)
      } catch (err) {
        restoreMemory(state, before)
        throw err
      }
    }
    let fate: VoucherFate
    try {
      fate = await outsideWorldLock(state, () =>
        readIssue(ctx, port, {
          nonce: begun.nonce,
          account: begun.account,
          corpAmount: begun.corp,
          issuedAtS: begun.issuedAtS,
        }),
      )
    } catch (err) {
      if (err instanceof WorldMoved) {
        restoreMemory(state, snapshot)
        return errResult(ctx, state, ctx.staleCode)
      }
      throw err
    }
    const cityNow = cityOf(state, cityId)
    if (cityNow === undefined) return errResult(ctx, state, codes.API_MALFORMED)
    const beforeFinish = structuredClone(state)
    const result = finishLiveWithdraw(ctx, state, cityNow, begun.vid, fate)
    if (fate.kind === "silence") return result
    const blockedFinish = await refuseCustodial(ctx, store, state, cityId, beforeFinish, true)
    if (blockedFinish !== undefined) return blockedFinish
    try {
      await commitCity(store, state, cityId, { id: intentId, result })
    } catch (err) {
      restoreMemory(state, beforeFinish)
      throw err
    }
    return result
  } finally {
    deferServerMint(false)
  }
}

/** The fused withdraw already settled this voucher. A second present must not pay again. */
export function applyPresentVoucher(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
): HttpResult {
  if (cityKind(state, cityId) === "demo") return errResult(ctx, state, codes.DEMO_NO_WITHDRAW)
  if (cityKind(state, cityId) !== "wallet") return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
  const vid = asText(body["voucher_id"])
  if (vid.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
  const bag = state["bank_reservations"]
  if (!Array.isArray(bag)) return errResult(ctx, state, codes.API_MALFORMED)
  for (const raw of bag) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const row = raw as Dict
    if (asText(row["id"]) !== vid) continue
    const owner = asText(row["city_id"])
    if (owner.length > 0 && owner !== cityId && owner !== asText(city["id"])) continue
    if (asText(row["status"]) !== "settled") return errResult(ctx, state, codes.API_MALFORMED)
    return okResult(ctx, state, {
      effect: "present_voucher",
      voucher_id: vid,
      status: "settled",
      capital: asBigint(city["capital"], 0n),
      corp: asBigint(city["corp_held"], 0n),
    })
  }
  return errResult(ctx, state, codes.API_MALFORMED)
}

/** Chain present landed. X9 calls this too. A presented row does not move money again. */
export function finalizePresentedVoucher(state: Dict, city: Dict, vid: string): boolean {
  const row = voucherById(city, vid)
  if (row === undefined) return false
  const status = asText(row["status"])
  if (status === PRESENTED) return false
  if (status !== OPEN && status !== SIGNING) return false
  const reservation = asText(row["reservation_id"])
  present(state, city, reservation.length > 0 ? reservation : vid)
  const capital = asBigint(row["capital"], 0n)
  const corp = asBigint(row["corp"], 0n)
  state["capital_outstanding"] = asBigint(state["capital_outstanding"], 0n) - capital
  state["vault_corp"] = asBigint(state["vault_corp"], 0n) - corp
  city["withdrawn_capital"] = asBigint(city["withdrawn_capital"], 0n) + capital
  const acc = asEngineDict(state["acc"])
  acc["withdrawn_capital"] = asBigint(acc["withdrawn_capital"], 0n) + capital
  row["status"] = PRESENTED
  return true
}

/** Chain released the voucher. Capital comes back once. X7's reject path is separate. */
export function expireReleasedVoucher(state: Dict, city: Dict, vid: string): boolean {
  const row = voucherById(city, vid)
  if (row === undefined) return false
  const status = asText(row["status"])
  if (status !== OPEN && status !== SIGNING) return false
  const capital = asBigint(row["capital"], 0n)
  const reservation = asText(row["reservation_id"])
  expire(state, city, reservation.length > 0 ? reservation : vid)
  city["capital"] = asBigint(city["capital"], 0n) + capital
  row["status"] = EXPIRED
  city["vouchers_expired_day"] = asBigint(city["vouchers_expired_day"], 0n) + 1n
  return true
}

function promoteSigningVoucher(city: Dict, vid: string): boolean {
  const row = voucherById(city, vid)
  if (row === undefined) return false
  if (asText(row["status"]) !== SIGNING) return false
  row["status"] = OPEN
  return true
}

function rejectUnsignedVoucher(ctx: PackCtx, state: Dict, city: Dict, vid: string): boolean {
  const row = voucherById(city, vid)
  if (row === undefined || asText(row["status"]) !== SIGNING) return false
  finishLiveWithdraw(ctx, state, city, vid, { kind: "empty", code: codes.VOUCHER_REJECTED })
  return asText(row["status"]) === REJECTED
}

type VoucherView = {
  readonly cityId: string
  readonly vid: string
  readonly status: string
  readonly nonce: string
  readonly issuedAtS: bigint
}

type VoucherPlan = {
  readonly cityId: string
  readonly vid: string
  readonly action: "open" | "finalize" | "reject" | "expire"
}

function listLiveVouchers(state: Dict): VoucherView[] {
  const out: VoucherView[] = []
  const cities = asEngineDict(state["cities"])
  for (const cityId of Object.keys(cities)) {
    for (const row of voucherRows(asEngineDict(cities[cityId]))) {
      const status = asText(row["status"])
      if (voucherTerminal(status)) continue
      const vid = asText(row["id"])
      const nonce = asText(row["nonce"])
      if (vid.length === 0 || nonce.length === 0) continue
      out.push({ cityId, vid, status, nonce, issuedAtS: asBigint(row["issued_at_s"], 0n) })
    }
  }
  return out
}

async function planVoucher(ctx: PackCtx, port: AssetPort, row: VoucherView, now: bigint): Promise<VoucherPlan | undefined> {
  let issued
  let outcome
  try {
    issued = await port.vault.issued(row.nonce)
    outcome = await port.vault.outcomeOf(row.nonce)
  } catch {
    return undefined
  }
  if (!issued.ok || !outcome.ok) return undefined
  const past = now > row.issuedAtS + voucherTtlS(ctx)
  if (outcome.amount === OUTCOME_PRESENTED) return { cityId: row.cityId, vid: row.vid, action: "finalize" }
  if (outcome.amount === OUTCOME_RELEASED) return { cityId: row.cityId, vid: row.vid, action: "expire" }
  if (row.status === SIGNING) {
    if (issued.corpAmount > 0n) return { cityId: row.cityId, vid: row.vid, action: "open" }
    if (past && outcome.amount === 0n) return { cityId: row.cityId, vid: row.vid, action: "reject" }
    return undefined
  }
  if (row.status !== OPEN || outcome.amount !== 0n || !past) return undefined
  try {
    await port.vault.releaseExpiredVoucher(row.nonce)
  } catch {
    // The next read is the receipt.
  }
  let again
  try {
    again = await port.vault.outcomeOf(row.nonce)
  } catch {
    return undefined
  }
  if (!again.ok) return undefined
  if (again.amount === OUTCOME_PRESENTED) return { cityId: row.cityId, vid: row.vid, action: "finalize" }
  if (again.amount === OUTCOME_RELEASED) return { cityId: row.cityId, vid: row.vid, action: "expire" }
  return undefined
}

function applyVoucherPlan(ctx: PackCtx, state: Dict, plan: VoucherPlan): boolean {
  const city = cityOf(state, plan.cityId)
  if (city === undefined) return false
  if (plan.action === "open") return promoteSigningVoucher(city, plan.vid)
  if (plan.action === "finalize") return finalizePresentedVoucher(state, city, plan.vid)
  if (plan.action === "reject") return rejectUnsignedVoucher(ctx, state, city, plan.vid)
  return expireReleasedVoucher(state, city, plan.vid)
}

/** After the tick commit. Network reads stay outside the world lock. A failure leaves the row. */
export async function reconcileVouchers(
  host: { readonly ctx: PackCtx; readonly store: Store; state: Dict },
  port: AssetPort,
): Promise<void> {
  try {
    if (!prizeCustodyLive(port)) return
    const clock = await port.chain.latestBlockTime()
    if (!clock.ok) return
    const plans: VoucherPlan[] = []
    for (const row of listLiveVouchers(host.state)) {
      const plan = await planVoucher(host.ctx, port, row, clock.amount)
      if (plan !== undefined) plans.push(plan)
    }
    if (plans.length === 0) return
    await withWorldLock(async () => {
      const state = host.state
      const snapshot = structuredClone(state)
      let changed = false
      try {
        for (const plan of plans) {
          if (applyVoucherPlan(host.ctx, state, plan)) changed = true
        }
        const anchor = plans[0]
        if (!changed || anchor === undefined) return
        let opened = false
        try {
          await host.store.exec("BEGIN")
          opened = true
          await persistLiveState(host.store, state, anchor.cityId)
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
      } catch (err) {
        restoreMemory(state, snapshot)
        throw err
      }
    })
  } catch {
    // The tick already committed. A dead RPC waits for the next pass.
  }
}

function voucherIntentKey(vid: string): string {
  return "voucher:" + vid
}

/** Live present. The player signs presentVoucher. Bank hours are not checked again. */
export async function preparePresentVoucher(
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
  if (prior !== undefined) return { status: storedStatus(ctx, prior), body: prior, headers: {} }
  if (asBigint(state["city_time"]) !== expected) return errResult(ctx, state, ctx.staleCode)
  if (cityKind(state, cityId) === "demo") return errResult(ctx, state, codes.DEMO_NO_WITHDRAW)
  if (cityKind(state, cityId) !== "wallet") return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
  const vid = asText(body["voucher_id"])
  if (vid.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
  const account = asText(city["wallet"])
  if (account.length === 0) return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
  const row = voucherById(city, vid)
  if (row === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  const vault = envAddr("CORPORATOR_VAULT")
  if (vault.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const now = await port.chain.latestBlockTime()
  if (!now.ok) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const nonce = asText(row["nonce"])
  if (nonce.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
  const issued = await port.vault.issued(nonce)
  if (!issued.ok) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const outcome = await port.vault.outcomeOf(nonce)
  if (!outcome.ok) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const status = asText(row["status"])
  if (status === SIGNING) return errResult(ctx, state, codes.VOUCHER_PENDING_SIGN)
  if (voucherTerminal(status)) {
    const first = await getBytes(store, "intents", voucherIntentKey(vid))
    if (first !== undefined) return { status: storedStatus(ctx, first), body: first, headers: {} }
    return voucherCard(ctx, state, row)
  }
  const issuedAtS = asBigint(row["issued_at_s"], 0n)
  if (now.amount > issuedAtS + voucherTtlS(ctx)) return errResult(ctx, state, codes.VOUCHER_EXPIRED)
  if (issued.corpAmount <= 0n) return errResult(ctx, state, codes.VOUCHER_PENDING_SIGN)
  const corp = asBigint(row["corp"], 0n)
  const data = dataPresentVoucher(nonce, account, corp, issuedAtS)
  if (data.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const result = okResult(ctx, state, {
    phase: "prepared",
    ticket: intentId,
    chain_id: depositChainId(ctx),
    effect: "present_voucher",
    voucher_id: vid,
    nonce,
    corp,
    capital: asBigint(row["capital"], 0n),
    issued_at_s: issuedAtS,
    txs: [{ to: vault, data, value: "0", label: "present_voucher" }],
  })
  const blocked = await commitPrepared(ctx, store, state, cityId, key, result.body)
  if (blocked !== undefined) return blocked
  return result
}

export type PresentConfirm =
  | { readonly ok: false; readonly result: HttpResult }
  | { readonly ok: true; readonly voucherId: string; readonly hashes: readonly string[] }

/** Receipt must match the prepared present. A lagged outcome is retryable and is not stored. */
export async function verifyPresentConfirm(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
  port: AssetPort,
): Promise<PresentConfirm> {
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
  const voucherId = asText(parsed["voucher_id"])
  const txs = readTxs(parsed["txs"])
  if (voucherId.length === 0 || txs === undefined || txs.length !== hashes.length) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  const wallet = asText(city["wallet"])
  if (wallet.length === 0) return { ok: false, result: errResult(ctx, state, codes.WALLET_NOT_CONNECTED) }
  for (let i = 0; i < hashes.length; i += 1) {
    const hash = hashes.at(i)
    const tx = txs.at(i)
    if (hash === undefined || tx === undefined) {
      return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
    }
    const receipt = await port.chain.transactionReceipt(hash)
    if (!receiptLanded(ctx, receipt)) {
      return { ok: false, result: errResult(ctx, state, codes.CHAIN_TX_UNCONFIRMED) }
    }
    const seen = await port.chain.transactionByHash(hash)
    if (!seen.ok) return { ok: false, result: errResult(ctx, state, codes.CHAIN_TX_UNCONFIRMED) }
    if (!sameHex(seen.from, wallet) || !sameHex(seen.to, tx.to) || !sameHex(seen.input, tx.data)) {
      return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
    }
  }
  const row = voucherById(city, voucherId)
  if (row === undefined) return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  const outcome = await port.vault.outcomeOf(asText(row["nonce"]))
  if (!outcome.ok) return { ok: false, result: errResult(ctx, state, codes.SERVICE_DEGRADED) }
  if (outcome.amount === 0n) {
    return { ok: false, result: errResult(ctx, state, codes.CHAIN_TX_UNCONFIRMED, true) }
  }
  if (outcome.amount !== 1n) {
    return { ok: false, result: errResult(ctx, state, codes.VOUCHER_EXPIRED) }
  }
  return { ok: true, voucherId, hashes }
}

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/

export type DepositConfirm =
  | { readonly ok: false; readonly result: HttpResult }
  | { readonly ok: true; readonly amount: bigint; readonly hashes: readonly string[] }

type DepositTx = {
  readonly to: string
  readonly data: string
  readonly value: string
  readonly label: string
}

const VOUCHER_ISSUED_TOPIC = "0x" + keccak256Hex(new TextEncoder().encode("VoucherIssued(string,address,uint256,uint256)"))

export function chainTxKey(hash: string): string {
  return "chain_tx:" + hash.toLowerCase()
}

export function chainTxOwnerKey(hash: string): string {
  return "chain_tx_city:" + hash.toLowerCase()
}

/** The stored body is returned only to the city that wrote it. */
export async function takenChainTx(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  cityId: string,
  hash: string,
): Promise<HttpResult | undefined> {
  const prior = await getBytes(store, "intents", chainTxKey(hash))
  if (prior === undefined) return undefined
  const owner = await getBytes(store, "intents", chainTxOwnerKey(hash))
  const city = owner === undefined ? "" : fromUtf8(owner)
  if (city !== cityId) return errResult(ctx, state, codes.API_UNAUTHORIZED)
  const gated = await chainCreditGate(ctx, store, state, hash)
  if (gated !== undefined) return gated
  return { status: statusForStored(ctx, prior), body: prior, headers: {} }
}

export async function rememberChainTx(
  store: Store,
  state: Dict,
  cityId: string,
  hash: string,
  body: Uint8Array,
): Promise<void> {
  const kind = cityKind(state, cityId)
  await putBytes(store, "intents", chainTxKey(hash), body, kind)
  await putBytes(store, "intents", chainTxOwnerKey(hash), utf8(cityId), kind)
}

/** Prepare writes its ticket in its own transaction, under the world lock, and counts the rate. */
export async function commitPrepared(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  cityId: string,
  key: string,
  body: Uint8Array,
): Promise<HttpResult | undefined> {
  let limited = false
  await withWorldLock(async () => {
    const rate = await incrementCommandRate(store, cityId, asBigint(state["tick_index"]), ctx.rateLimit)
    if (rate === "limited") {
      limited = true
      return
    }
    let opened = false
    try {
      await store.exec("BEGIN")
      opened = true
      await putBytes(store, "intents", key, body, cityKind(state, cityId))
      await store.exec("COMMIT")
    } catch (err) {
      if (opened) await rollback(store)
      throw err
    }
  })
  if (limited) return errResult(ctx, state, codes.API_RATE_LIMITED)
  return undefined
}

function envAddr(name: string): string {
  const v = process.env[name]
  if (v === undefined || !ADDR_RE.test(v)) return ""
  return v
}

function sameHex(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

function depositChainId(ctx: PackCtx): string {
  return asBigint(walk(ctx.pack, ["sections", "districts", "stake", "snapshot", "chain_id"])).toString()
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

function readTxs(value: Json | undefined): readonly DepositTx[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: DepositTx[] = []
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

/** Live deposit recipe. Writes a ticket, not city capital. */
export async function prepareDeposit(
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
  if (cityKind(state, cityId) !== "wallet") return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
  if (!("amount" in body)) return errResult(ctx, state, codes.API_MALFORMED)
  let amount: bigint
  try {
    amount = asBigint(body["amount"])
  } catch {
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  if (amount <= 0n) return errResult(ctx, state, codes.API_MALFORMED)
  if (asBigint(state["city_time"]) !== expected) return errResult(ctx, state, ctx.staleCode)
  if (asBigint(state["mint_rate"], 0n) <= 0n) return errResult(ctx, state, codes.STALE_PRICE)
  const account = asText(city["wallet"])
  if (account.length === 0) return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
  const token = envAddr("CORPORATOR_CORP_TOKEN")
  const vault = envAddr("CORPORATOR_VAULT")
  if (token.length === 0 || vault.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const preview = previewDepositMint(ctx.cfg, state, cityId, amount)
  if (!preview.ok) return errResult(ctx, state, preview.code)
  const allowed = await port.corpToken.allowance(account, vault)
  if (!allowed.ok) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const txs: DepositTx[] = []
  if (allowed.amount < amount) {
    const approveData = dataApprove(vault, amount)
    if (approveData.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
    txs.push({ to: token, data: approveData, value: "0", label: "approve" })
  }
  const depositData = dataDeposit(account, amount)
  if (depositData.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  txs.push({ to: vault, data: depositData, value: "0", label: "deposit" })
  const txJson: { readonly [key: string]: Json }[] = []
  for (const tx of txs) txJson.push({ to: tx.to, data: tx.data, value: tx.value, label: tx.label })
  const result = okResult(ctx, state, {
    phase: "prepared",
    ticket: intentId,
    chain_id: depositChainId(ctx),
    effect: "deposit",
    amount,
    txs: txJson,
  })
  const blocked = await commitPrepared(ctx, store, state, cityId, key, result.body)
  if (blocked !== undefined) return blocked
  return result
}

/** Chain reads for confirm. Does not mint. A stored hash returns the first answer. */
export async function verifyDepositConfirm(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
  port: AssetPort,
): Promise<DepositConfirm> {
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
  if (asText(parsed["phase"]) !== "prepared" || asText(parsed["effect"]) !== "deposit" || asText(parsed["ticket"]) !== ticket) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  let amount: bigint
  try {
    amount = asBigint(parsed["amount"])
  } catch {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  const txs = readTxs(parsed["txs"])
  if (amount <= 0n || txs === undefined || txs.length !== hashes.length) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  const wallet = asText(city["wallet"])
  if (wallet.length === 0) return { ok: false, result: errResult(ctx, state, codes.WALLET_NOT_CONNECTED) }
  for (let i = 0; i < hashes.length; i += 1) {
    const hash = hashes.at(i)
    const tx = txs.at(i)
    if (hash === undefined || tx === undefined) {
      return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
    }
    const receipt = await port.chain.transactionReceipt(hash)
    if (!receiptLanded(ctx, receipt)) {
      return { ok: false, result: errResult(ctx, state, codes.CHAIN_TX_UNCONFIRMED) }
    }
    const seen = await port.chain.transactionByHash(hash)
    if (!seen.ok) return { ok: false, result: errResult(ctx, state, codes.CHAIN_TX_UNCONFIRMED) }
    if (!sameHex(seen.from, wallet) || !sameHex(seen.to, tx.to) || !sameHex(seen.input, tx.data)) {
      return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
    }
  }
  return { ok: true, amount, hashes }
}

