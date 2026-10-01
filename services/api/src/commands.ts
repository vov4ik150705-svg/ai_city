import type { AssetPort } from "@corporator/chainport"
import { fromUtf8, parseJson } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { type PackCtx } from "./pack_ctx.js"
import { applyLive } from "./commit.js"
import type { BuyStockHop } from "./commit_exchange.js"
import {
  applyDeposit,
  applyLiveWithdraw,
  chainTxKey,
  finalizePresentedVoucher,
  advanceChainMint,
  prepareDeposit,
  sendSignedMint,
  preparePresentVoucher,
  verifyDepositConfirm,
  verifyPresentConfirm,
} from "./commit_bank.js"
import {
  claimConfirmResult,
  prepareClaimUnstake,
  prepareStake,
  prepareUnstake,
  stakeConfirmResult,
  unstakeConfirmResult,
  verifyClaimConfirm,
  verifyStakeConfirm,
  verifyUnstakeConfirm,
} from "./commit_districts.js"
import { applyLiveBuy, creditBuyStock, prepareBuyStock, verifyBuyConfirm } from "./commit_exchange.js"
import { confirmClaimFragment, prepareClaimFragment, verifyClaimFragment } from "./commit_fragments.js"
import { applyClaimPrize, launchDeployed, prepareClaimPrize, verifyPrizeConfirm, walletCallerOf } from "./commit_prize.js"
import { portCfgFromPack, prizeCustodyLive, selectApiPort } from "./custody.js"
import { loadProjectLive } from "./project_live.js"
import { applyChainRows, applyClaimReceipt, applyUnstakeReceipt } from "./project.js"
import { cityKind, errResult, okResult, statusFor, type HttpResult } from "./envelope.js"
import { incrementCommandRate } from "./rates.js"
import { sessionFromHeaders } from "./session.js"
import { getBytes, putBytes, type Store } from "./store.js"
import { type TickLock } from "./tick_lock.js"
import { persistLiveState, refuseCustodial, restoreMemory } from "./tick_host.js"
import { armChainClock, deferServerMint, watchSnapshot, withWorldLock, WorldMoved } from "./city_lock.js"
import { asBigint, asEngineDict, asObj, asText, type Dict, type Json } from "./values.js"

function intentKey(cityId: string, intentId: string): string {
  return cityId + ":" + intentId
}

function statusOfStored(ctx: PackCtx, body: Uint8Array): bigint {
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

function cityRow(state: Dict, cityId: string): Dict | undefined {
  const cities = asEngineDict(state["cities"])
  if (!(cityId in cities)) return undefined
  return asEngineDict(cities[cityId])
}

async function rollback(store: Store): Promise<void> {
  try {
    await store.exec("ROLLBACK")
  } catch {
    // The caller's error is the one to surface.
  }
}

/** Debt stays until a receipt or a chain read. The raw tx is committed before it is sent. */
export async function settleServerMint(
  store: Store,
  state: Dict,
  cityId: string,
  port: AssetPort,
): Promise<void> {
  if (!prizeCustodyLive(port)) return
  const city = cityRow(state, cityId)
  if (city === undefined) return
  const account = asText(city["wallet"])
  if (account.length === 0) return
  if (asBigint(city["chain_mint_corp"], 0n) <= 0n || asBigint(city["chain_mint_capital"], 0n) <= 0n) return
  const snapshot = structuredClone(state)
  const phase = await advanceChainMint(port, city, account)
  if (phase === "cleared" || phase === "signed") {
    try {
      await withWorldLock(async () => {
        let opened = false
        try {
          await store.exec("BEGIN")
          opened = true
          await persistLiveState(store, state, cityId)
          await store.exec("COMMIT")
        } catch (err) {
          if (opened) await rollback(store)
          throw err
        }
      })
    } catch (err) {
      restoreMemory(state, snapshot)
      throw err
    }
  }
  if (phase === "signed" || phase === "replay") await sendSignedMint(port, city)
}

export async function handleCommand(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  effect: string,
  body: Uint8Array,
  headers: { readonly [name: string]: string },
  lock: TickLock | undefined = undefined,
  portOverride?: AssetPort,
): Promise<HttpResult> {
  const session = await sessionFromHeaders(ctx, store, state, headers)
  if (session === undefined) return errResult(ctx, state, codes.API_UNAUTHORIZED)
  const cityId = session.cityId
  let parsed
  try {
    parsed = parseJson(fromUtf8(body))
  } catch {
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  const obj = asObj(parsed)
  const intentId = asText(obj["intent_id"])
  if (intentId.length === 0 || !("expected_city_time" in obj)) {
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  let expected: bigint
  try {
    expected = asBigint(obj["expected_city_time"])
  } catch {
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  const port = portOverride ?? selectApiPort(portCfgFromPack(ctx.pack), process.env)
  const oracle = await loadProjectLive(ctx, store, state, cityId)
  const hop =
    oracle.hopFill === undefined
      ? { priced: false as const }
      : { priced: true as const, fill: oracle.hopFill }
  const phase = asText(obj["phase"])
  const liveDeposit = effect === "deposit" && prizeCustodyLive(port)
  await settleServerMint(store, state, cityId, port)
  try {
    if (liveDeposit) {
      const city = cityRow(state, cityId)
      if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
      if (phase === "prepare") {
        return await prepareDeposit(ctx, store, state, city, obj, cityId, intentId, expected, port)
      }
      if (phase === "confirm") {
        const checked = await verifyDepositConfirm(ctx, store, state, city, obj, cityId, port)
        if (!checked.ok) return checked.result
        return await withWorldLock(() =>
          executeDepositConfirm(
            ctx,
            store,
            state,
            cityId,
            intentId,
            expected,
            checked.amount,
            checked.hashes,
            lock,
            port,
          ),
        )
      }
      return errResult(ctx, state, codes.API_MALFORMED)
    }
    if (effect === "stake" && prizeCustodyLive(port) && asText(obj["source"]) === "wallet") {
      const city = cityRow(state, cityId)
      if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
      if (phase === "prepare") {
        return await prepareStake(ctx, store, state, city, obj, cityId, intentId, expected, port)
      }
      if (phase === "confirm") {
        const checked = await verifyStakeConfirm(ctx, store, state, city, obj, cityId, port)
        if (!checked.ok) return checked.result
        return await withWorldLock(() =>
          executeStakeConfirm(ctx, store, state, cityId, intentId, expected, checked.districtId, checked.rows, checked.hashes, lock, port),
        )
      }
      return errResult(ctx, state, codes.API_MALFORMED)
    }
    if (effect === "unstake" && prizeCustodyLive(port)) {
      const city = cityRow(state, cityId)
      if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
      if (phase === "prepare") {
        return await prepareUnstake(ctx, store, state, city, obj, cityId, intentId, expected, port)
      }
      if (phase === "confirm") {
        const checked = await verifyUnstakeConfirm(ctx, store, state, city, obj, cityId, port)
        if (!checked.ok) return checked.result
        return await withWorldLock(() =>
          executeUnstakeConfirm(
            ctx,
            store,
            state,
            cityId,
            intentId,
            expected,
            checked.districtId,
            checked.ticker,
            checked.amount,
            checked.priorCooling,
            checked.rows,
            checked.cooling,
            checked.hashes,
            lock,
            port,
          ),
        )
      }
      return errResult(ctx, state, codes.API_MALFORMED)
    }
    if (effect === "claim_unstaked" && prizeCustodyLive(port)) {
      const city = cityRow(state, cityId)
      if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
      if (cityKind(state, cityId) === "demo") return errResult(ctx, state, codes.DEMO_NO_CLAIM)
      if (phase === "prepare") {
        return await prepareClaimUnstake(ctx, store, state, city, obj, cityId, intentId, expected, port)
      }
      if (phase === "confirm") {
        const checked = await verifyClaimConfirm(ctx, store, state, city, obj, cityId, port)
        if (!checked.ok) return checked.result
        return await withWorldLock(() =>
          executeClaimConfirm(
            ctx,
            store,
            state,
            cityId,
            intentId,
            expected,
            checked.districtId,
            checked.ticker,
            checked.amount,
            checked.cooling,
            checked.hashes,
            lock,
            port,
          ),
        )
      }
      return errResult(ctx, state, codes.API_MALFORMED)
    }
    if (effect === "buy_stock" && prizeCustodyLive(port)) {
      const city = cityRow(state, cityId)
      if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
      if (phase === "prepare") {
        return await prepareBuyStock(ctx, store, state, city, obj, cityId, intentId, expected, port)
      }
      if (phase === "confirm") {
        const checked = await verifyBuyConfirm(ctx, store, state, city, obj, cityId, port, true)
        if (!checked.ok) return checked.result
        return await withWorldLock(() =>
          executeBuyConfirm(
            ctx,
            store,
            state,
            cityId,
            intentId,
            expected,
            checked.ticker,
            checked.amount,
            checked.stockOut,
            checked.hashes,
            lock,
            checked.delivered,
            port,
          ),
        )
      }
      return errResult(ctx, state, codes.API_MALFORMED)
    }
    if (effect === "buy_stock" && (phase === "prepare" || phase === "confirm")) {
      const city = cityRow(state, cityId)
      if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
      if (phase === "prepare") {
        return await prepareBuyStock(ctx, store, state, city, obj, cityId, intentId, expected, port)
      }
      const checked = await verifyBuyConfirm(ctx, store, state, city, obj, cityId, port)
      if (!checked.ok) return checked.result
      return await withWorldLock(() =>
        executeBuyConfirm(ctx, store, state, cityId, intentId, expected, checked.ticker, checked.amount, checked.stockOut, checked.hashes, lock),
      )
    }
    if (effect === "claim_prize" && launchDeployed(ctx)) {
      const city = cityRow(state, cityId)
      if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
      if (phase === "prepare") {
        return await prepareClaimPrize(ctx, store, state, city, cityId, intentId, expected, port)
      }
      if (phase === "confirm") {
        const checked = await verifyPrizeConfirm(ctx, store, state, city, obj, cityId, port)
        if (!checked.ok) return checked.result
        return await withWorldLock(() =>
          executePrizeConfirm(ctx, store, state, cityId, intentId, expected, checked.hashes, lock, port),
        )
      }
      return errResult(ctx, state, codes.API_MALFORMED)
    }
    if (effect === "present_voucher" && prizeCustodyLive(port)) {
      const city = cityRow(state, cityId)
      if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
      if (phase === "prepare") {
        return await preparePresentVoucher(ctx, store, state, city, obj, cityId, intentId, expected, port)
      }
      if (phase === "confirm") {
        const checked = await verifyPresentConfirm(ctx, store, state, city, obj, cityId, port)
        if (!checked.ok) return checked.result
        return await withWorldLock(() =>
          executePresentConfirm(ctx, store, state, cityId, intentId, expected, checked.voucherId, checked.hashes, lock, port),
        )
      }
      return errResult(ctx, state, codes.API_MALFORMED)
    }
    if (effect === "claim_fragment" && prizeCustodyLive(port)) {
      const city = cityRow(state, cityId)
      if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
      if (phase === "prepare") {
        return await prepareClaimFragment(ctx, store, state, city, cityId, intentId, expected, port)
      }
      if (phase === "confirm") {
        const checked = await verifyClaimFragment(ctx, store, state, city, obj, cityId, port)
        if (!checked.ok) return checked.result
        return await withWorldLock(() =>
          confirmClaimFragment(ctx, store, state, cityId, intentId, expected, checked.moves, checked.hashes, lock, true),
        )
      }
      return errResult(ctx, state, codes.API_MALFORMED)
    }
    if (effect === "withdraw" && prizeCustodyLive(port)) {
      const clock = await port.chain.latestBlockTime()
      if (!clock.ok) return errResult(ctx, state, codes.SERVICE_DEGRADED)
      return await withWorldLock(() =>
        applyLiveWithdraw(ctx, store, state, cityId, intentId, expected, obj, clock.amount, lock, port),
      )
    }
    return await withWorldLock(() =>
      executeCommand(ctx, store, state, effect, cityId, intentId, expected, obj, lock, port, hop),
    )
  } finally {
    await settleServerMint(store, state, cityId, port)
  }
}

async function executeCommand(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  effect: string,
  cityId: string,
  intentId: string,
  expected: bigint,
  obj: { readonly [key: string]: Json },
  lock: TickLock | undefined,
  port: AssetPort,
  hop: BuyStockHop,
): Promise<HttpResult> {
  const key = intentKey(cityId, intentId)
  const prior = await getBytes(store, "intents", key)
  if (prior !== undefined) {
    return { status: statusOfStored(ctx, prior), body: prior, headers: {} }
  }
  if (lock !== undefined) {
    const writer = await lock.tryAcquire(cityId)
    if (!writer) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  }
  const now = asBigint(state["city_time"])
  if (expected !== now) {
    return errResult(ctx, state, ctx.staleCode)
  }
  const tickIndex = asBigint(state["tick_index"])
  const rate = await incrementCommandRate(store, cityId, tickIndex, ctx.rateLimit)
  if (rate === "limited") return errResult(ctx, state, codes.API_RATE_LIMITED)
  let snapshot = structuredClone(state)
  watchSnapshot(() => {
    snapshot = structuredClone(state)
  })
  armChainClock(expected)
  deferServerMint(true)
  try {
    let result: HttpResult
    try {
      if (ctx.stubEffects.has(effect)) {
        result = errResult(ctx, state, codes.FEATURE_NOT_IN_V1)
      } else {
        const live = await applyLive(ctx, state, effect, obj, cityId, port, hop)
        if (live !== undefined) result = live
        else {
          const refusals = ctx.refusals[effect]
          const first = refusals === undefined ? undefined : refusals[0]
          if (first !== undefined) result = errResult(ctx, state, first)
          else result = errResult(ctx, state, codes.FEATURE_NOT_IN_V1)
        }
      }
    } catch (err) {
      restoreMemory(state, snapshot)
      if (err instanceof WorldMoved) return errResult(ctx, state, ctx.staleCode)
      throw err
    }
    const blocked = await refuseCustodial(ctx, store, state, cityId, snapshot, prizeCustodyLive(port))
    if (blocked !== undefined) return blocked
    let opened = false
    try {
      await store.exec("BEGIN")
      opened = true
      await putBytes(store, "intents", key, result.body, cityKind(state, cityId))
      await persistLiveState(store, state, cityId)
      await store.exec("COMMIT")
    } catch (err) {
      if (opened) await rollback(store)
      restoreMemory(state, snapshot)
      throw err
    }
    return result
  } finally {
    deferServerMint(false)
  }
}

async function executeDepositConfirm(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  cityId: string,
  intentId: string,
  expected: bigint,
  amount: bigint,
  hashes: readonly string[],
  lock: TickLock | undefined,
  port: AssetPort,
): Promise<HttpResult> {
  for (const hash of hashes) {
    const prior = await getBytes(store, "intents", chainTxKey(hash))
    if (prior !== undefined) return { status: statusOfStored(ctx, prior), body: prior, headers: {} }
  }
  if (lock !== undefined) {
    const writer = await lock.tryAcquire(cityId)
    if (!writer) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  }
  const now = asBigint(state["city_time"])
  if (expected !== now) return errResult(ctx, state, ctx.staleCode)
  const tickIndex = asBigint(state["tick_index"])
  const rate = await incrementCommandRate(store, cityId, tickIndex, ctx.rateLimit)
  if (rate === "limited") return errResult(ctx, state, codes.API_RATE_LIMITED)
  const city = cityRow(state, cityId)
  if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  let snapshot = structuredClone(state)
  watchSnapshot(() => {
    snapshot = structuredClone(state)
  })
  armChainClock(expected)
  deferServerMint(true)
  try {
    let result: HttpResult
    try {
      result = await applyDeposit(
        ctx,
        state,
        city,
        { amount, intent_id: intentId, expected_city_time: expected },
        cityId,
        port,
      )
    } catch (err) {
      restoreMemory(state, snapshot)
      if (err instanceof WorldMoved) return errResult(ctx, state, ctx.staleCode)
      throw err
    }
    const blocked = await refuseCustodial(
      ctx,
      store,
      state,
      cityId,
      snapshot,
      port !== undefined && prizeCustodyLive(port),
    )
    if (blocked !== undefined) return blocked
    let opened = false
    try {
      await store.exec("BEGIN")
      opened = true
      await putBytes(store, "intents", intentKey(cityId, intentId), result.body, cityKind(state, cityId))
      if (result.status === ctx.httpOk) {
        for (const hash of hashes) {
          await putBytes(store, "intents", chainTxKey(hash), result.body, cityKind(state, cityId))
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
  } finally {
    deferServerMint(false)
  }
}

async function executeStakeConfirm(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  cityId: string,
  intentId: string,
  expected: bigint,
  districtId: string,
  rows: readonly { readonly ticker: string; readonly amount: bigint }[],
  hashes: readonly string[],
  lock: TickLock | undefined,
  port: AssetPort,
): Promise<HttpResult> {
  for (const hash of hashes) {
    const prior = await getBytes(store, "intents", chainTxKey(hash))
    if (prior !== undefined) return { status: statusOfStored(ctx, prior), body: prior, headers: {} }
  }
  if (lock !== undefined) {
    const writer = await lock.tryAcquire(cityId)
    if (!writer) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  }
  const now = asBigint(state["city_time"])
  if (expected !== now) return errResult(ctx, state, ctx.staleCode)
  const tickIndex = asBigint(state["tick_index"])
  const rate = await incrementCommandRate(store, cityId, tickIndex, ctx.rateLimit)
  if (rate === "limited") return errResult(ctx, state, codes.API_RATE_LIMITED)
  const city = cityRow(state, cityId)
  if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  let snapshot = structuredClone(state)
  watchSnapshot(() => {
    snapshot = structuredClone(state)
  })
  armChainClock(expected)
  deferServerMint(true)
  try {
    let result: HttpResult
    try {
      applyChainRows(ctx, state, city, rows, true)
      result = stakeConfirmResult(ctx, state, city, districtId)
    } catch (err) {
      restoreMemory(state, snapshot)
      if (err instanceof WorldMoved) return errResult(ctx, state, ctx.staleCode)
      throw err
    }
    const blocked = await refuseCustodial(
      ctx,
      store,
      state,
      cityId,
      snapshot,
      port !== undefined && prizeCustodyLive(port),
    )
    if (blocked !== undefined) return blocked
    let opened = false
    try {
      await store.exec("BEGIN")
      opened = true
      await putBytes(store, "intents", intentKey(cityId, intentId), result.body, cityKind(state, cityId))
      if (result.status === ctx.httpOk) {
        for (const hash of hashes) {
          await putBytes(store, "intents", chainTxKey(hash), result.body, cityKind(state, cityId))
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
  } finally {
    deferServerMint(false)
  }
}

async function executeUnstakeConfirm(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  cityId: string,
  intentId: string,
  expected: bigint,
  districtId: string,
  ticker: string,
  amount: bigint,
  priorCooling: bigint,
  rows: readonly { readonly ticker: string; readonly amount: bigint }[],
  cooling: readonly { readonly ticker: string; readonly amount: bigint; readonly readyAtS: bigint }[],
  hashes: readonly string[],
  lock: TickLock | undefined,
  port: AssetPort,
): Promise<HttpResult> {
  for (const hash of hashes) {
    const prior = await getBytes(store, "intents", chainTxKey(hash))
    if (prior !== undefined) return { status: statusOfStored(ctx, prior), body: prior, headers: {} }
  }
  if (lock !== undefined) {
    const writer = await lock.tryAcquire(cityId)
    if (!writer) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  }
  const now = asBigint(state["city_time"])
  if (expected !== now) return errResult(ctx, state, ctx.staleCode)
  const tickIndex = asBigint(state["tick_index"])
  const rate = await incrementCommandRate(store, cityId, tickIndex, ctx.rateLimit)
  if (rate === "limited") return errResult(ctx, state, codes.API_RATE_LIMITED)
  const city = cityRow(state, cityId)
  if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  let snapshot = structuredClone(state)
  watchSnapshot(() => {
    snapshot = structuredClone(state)
  })
  armChainClock(expected)
  deferServerMint(true)
  try {
    let result: HttpResult
    try {
      applyUnstakeReceipt(ctx, state, city, rows, cooling, ticker, priorCooling, amount)
      result = unstakeConfirmResult(ctx, state, city, districtId)
    } catch (err) {
      restoreMemory(state, snapshot)
      if (err instanceof WorldMoved) return errResult(ctx, state, ctx.staleCode)
      throw err
    }
    const blocked = await refuseCustodial(
      ctx,
      store,
      state,
      cityId,
      snapshot,
      port !== undefined && prizeCustodyLive(port),
    )
    if (blocked !== undefined) return blocked
    let opened = false
    try {
      await store.exec("BEGIN")
      opened = true
      await putBytes(store, "intents", intentKey(cityId, intentId), result.body, cityKind(state, cityId))
      if (result.status === ctx.httpOk) {
        for (const hash of hashes) {
          await putBytes(store, "intents", chainTxKey(hash), result.body, cityKind(state, cityId))
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
  } finally {
    deferServerMint(false)
  }
}

async function executePresentConfirm(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  cityId: string,
  intentId: string,
  expected: bigint,
  voucherId: string,
  hashes: readonly string[],
  lock: TickLock | undefined,
  port: AssetPort,
): Promise<HttpResult> {
  for (const hash of hashes) {
    const prior = await getBytes(store, "intents", chainTxKey(hash))
    if (prior !== undefined) return { status: statusOfStored(ctx, prior), body: prior, headers: {} }
  }
  if (lock !== undefined) {
    const writer = await lock.tryAcquire(cityId)
    if (!writer) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  }
  if (expected !== asBigint(state["city_time"])) return errResult(ctx, state, ctx.staleCode)
  const rate = await incrementCommandRate(store, cityId, asBigint(state["tick_index"]), ctx.rateLimit)
  if (rate === "limited") return errResult(ctx, state, codes.API_RATE_LIMITED)
  const city = cityRow(state, cityId)
  if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  const snapshot = structuredClone(state)
  deferServerMint(true)
  try {
    finalizePresentedVoucher(state, city, voucherId)
    const cities = asEngineDict(state["cities"])
    const cityNow = asEngineDict(cities[cityId])
    const raw = cityNow["vouchers"]
    let presented = false
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item === null || typeof item !== "object" || Array.isArray(item)) continue
        const row = asObj(item)
        if (asText(row["id"]) !== voucherId && asText(row["reservation_id"]) !== voucherId) continue
        presented = asText(row["status"]) === "presented"
      }
    }
    if (!presented) return errResult(ctx, state, codes.API_MALFORMED)
    const result = okResult(ctx, state, {
      effect: "present_voucher",
      phase: "applied",
      voucher_id: voucherId,
      status: "presented",
    })
    const blocked = await refuseCustodial(ctx, store, state, cityId, snapshot, prizeCustodyLive(port))
    if (blocked !== undefined) return blocked
    let opened = false
    try {
      await store.exec("BEGIN")
      opened = true
      await putBytes(store, "intents", intentKey(cityId, intentId), result.body, cityKind(state, cityId))
      await putBytes(store, "intents", "voucher:" + voucherId, result.body, cityKind(state, cityId))
      if (result.status === ctx.httpOk) {
        for (const hash of hashes) {
          await putBytes(store, "intents", chainTxKey(hash), result.body, cityKind(state, cityId))
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
  } finally {
    deferServerMint(false)
  }
}

async function executeClaimConfirm(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  cityId: string,
  intentId: string,
  expected: bigint,
  districtId: string,
  ticker: string,
  amount: bigint,
  cooling: readonly { readonly ticker: string; readonly amount: bigint; readonly readyAtS: bigint }[],
  hashes: readonly string[],
  lock: TickLock | undefined,
  port: AssetPort,
): Promise<HttpResult> {
  for (const hash of hashes) {
    const prior = await getBytes(store, "intents", chainTxKey(hash))
    if (prior !== undefined) return { status: statusOfStored(ctx, prior), body: prior, headers: {} }
  }
  if (lock !== undefined) {
    const writer = await lock.tryAcquire(cityId)
    if (!writer) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  }
  const now = asBigint(state["city_time"])
  if (expected !== now) return errResult(ctx, state, ctx.staleCode)
  const tickIndex = asBigint(state["tick_index"])
  const rate = await incrementCommandRate(store, cityId, tickIndex, ctx.rateLimit)
  if (rate === "limited") return errResult(ctx, state, codes.API_RATE_LIMITED)
  const city = cityRow(state, cityId)
  if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  let snapshot = structuredClone(state)
  watchSnapshot(() => {
    snapshot = structuredClone(state)
  })
  armChainClock(expected)
  deferServerMint(true)
  try {
    let result: HttpResult
    try {
      applyClaimReceipt(ctx, city, cooling, ticker, amount)
      result = claimConfirmResult(ctx, state, city, districtId, amount)
    } catch (err) {
      restoreMemory(state, snapshot)
      if (err instanceof WorldMoved) return errResult(ctx, state, ctx.staleCode)
      throw err
    }
    const blocked = await refuseCustodial(
      ctx,
      store,
      state,
      cityId,
      snapshot,
      port !== undefined && prizeCustodyLive(port),
    )
    if (blocked !== undefined) return blocked
    let opened = false
    try {
      await store.exec("BEGIN")
      opened = true
      await putBytes(store, "intents", intentKey(cityId, intentId), result.body, cityKind(state, cityId))
      if (result.status === ctx.httpOk) {
        for (const hash of hashes) {
          await putBytes(store, "intents", chainTxKey(hash), result.body, cityKind(state, cityId))
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
  } finally {
    deferServerMint(false)
  }
}

async function executeBuyConfirm(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  cityId: string,
  intentId: string,
  expected: bigint,
  ticker: string,
  amount: bigint,
  stockOut: bigint,
  hashes: readonly string[],
  lock: TickLock | undefined,
  delivered?: bigint,
  port?: AssetPort,
): Promise<HttpResult> {
  for (const hash of hashes) {
    const prior = await getBytes(store, "intents", chainTxKey(hash))
    if (prior !== undefined) return { status: statusOfStored(ctx, prior), body: prior, headers: {} }
  }
  if (lock !== undefined) {
    const writer = await lock.tryAcquire(cityId)
    if (!writer) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  }
  if (asBigint(state["city_time"]) !== expected) return errResult(ctx, state, ctx.staleCode)
  const rate = await incrementCommandRate(store, cityId, asBigint(state["tick_index"]), ctx.rateLimit)
  if (rate === "limited") return errResult(ctx, state, codes.API_RATE_LIMITED)
  const city = cityRow(state, cityId)
  if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  let snapshot = structuredClone(state)
  watchSnapshot(() => {
    snapshot = structuredClone(state)
  })
  armChainClock(expected)
  deferServerMint(true)
  try {
    let result: HttpResult
    try {
      result =
        delivered === undefined
          ? creditBuyStock(ctx, state, city, ticker, amount, stockOut)
          : applyLiveBuy(ctx, state, city, ticker, amount, delivered)
    } catch (err) {
      restoreMemory(state, snapshot)
      if (err instanceof WorldMoved) return errResult(ctx, state, ctx.staleCode)
      throw err
    }
    const blocked = await refuseCustodial(
      ctx,
      store,
      state,
      cityId,
      snapshot,
      port !== undefined && prizeCustodyLive(port),
    )
    if (blocked !== undefined) return blocked
    let opened = false
    try {
      await store.exec("BEGIN")
      opened = true
      await putBytes(store, "intents", intentKey(cityId, intentId), result.body, cityKind(state, cityId))
      if (result.status === ctx.httpOk) {
        for (const hash of hashes) {
          await putBytes(store, "intents", chainTxKey(hash), result.body, cityKind(state, cityId))
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
  } finally {
    deferServerMint(false)
  }
}

async function executePrizeConfirm(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  cityId: string,
  intentId: string,
  expected: bigint,
  hashes: readonly string[],
  lock: TickLock | undefined,
  port: AssetPort,
): Promise<HttpResult> {
  for (const hash of hashes) {
    const prior = await getBytes(store, "intents", chainTxKey(hash))
    if (prior !== undefined) return { status: statusOfStored(ctx, prior), body: prior, headers: {} }
  }
  if (lock !== undefined) {
    const writer = await lock.tryAcquire(cityId)
    if (!writer) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  }
  if (asBigint(state["city_time"]) !== expected) return errResult(ctx, state, ctx.staleCode)
  const rate = await incrementCommandRate(store, cityId, asBigint(state["tick_index"]), ctx.rateLimit)
  if (rate === "limited") return errResult(ctx, state, codes.API_RATE_LIMITED)
  const city = cityRow(state, cityId)
  if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  let snapshot = structuredClone(state)
  watchSnapshot(() => {
    snapshot = structuredClone(state)
  })
  armChainClock(expected)
  deferServerMint(true)
  try {
    let result: HttpResult
    try {
      result = await applyClaimPrize(ctx, state, city, cityId, {
        live: true,
        treasury: port.prizeTreasury,
        caller: walletCallerOf(city),
        settled: true,
      })
    } catch (err) {
      restoreMemory(state, snapshot)
      if (err instanceof WorldMoved) return errResult(ctx, state, ctx.staleCode)
      throw err
    }
    const blocked = await refuseCustodial(
      ctx,
      store,
      state,
      cityId,
      snapshot,
      port !== undefined && prizeCustodyLive(port),
    )
    if (blocked !== undefined) return blocked
    let opened = false
    try {
      await store.exec("BEGIN")
      opened = true
      await putBytes(store, "intents", intentKey(cityId, intentId), result.body, cityKind(state, cityId))
      if (result.status === ctx.httpOk) {
        for (const hash of hashes) {
          await putBytes(store, "intents", chainTxKey(hash), result.body, cityKind(state, cityId))
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
  } finally {
    deferServerMint(false)
  }
}


