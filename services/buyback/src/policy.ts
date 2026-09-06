import { mulBps } from "@corporator/engine"
import type { BuybackPack, StampField } from "./pack.js"

export type BatchStamps = {
  readonly eth_collected?: bigint
  readonly corp_bought?: bigint
  readonly deposit_confirmed?: bigint
  readonly mint?: bigint
}

export function buybackTranche(depthWei: bigint, trancheCapBps: bigint, bps: bigint): bigint {
  if (bps <= 0n) return 0n
  return mulBps(depthWei, trancheCapBps, bps)
}

export function buybackBelowMin(collectedWei: bigint, minBatchWei: bigint): boolean {
  return collectedWei < minBatchWei
}

export function buybackOrderOk(timestamps: BatchStamps, order: readonly string[]): boolean {
  if (!order.includes("deposit_confirmed") || !order.includes("mint")) return false
  const dep = timestamps.deposit_confirmed
  const minted = timestamps.mint
  if (dep === undefined || minted === undefined) return true
  return dep < minted
}

export function buybackDue(cadence: bigint, hasRun: bigint, lastRunCityTime: bigint, now: bigint): boolean {
  if (cadence <= 0n) return false
  if (now % cadence !== 0n) return false
  if (hasRun === 0n) return true
  return now - lastRunCityTime >= cadence
}

export function planSend(pack: BuybackPack, collectedWei: bigint, depthWei: bigint): bigint {
  if (buybackBelowMin(collectedWei, pack.minBatchWei)) return 0n
  const cap = buybackTranche(depthWei, pack.trancheCapBps, pack.bps)
  const sized = collectedWei < cap ? collectedWei : cap
  return sized <= depthWei ? sized : depthWei
}

export function slippageSafetyOk(pack: BuybackPack): boolean {
  return pack.slippageSafety >= pack.slippageSafetyMin
}

export function trancheSlipWithinTax(pack: BuybackPack, depthWei: bigint): boolean {
  const tranche = buybackTranche(depthWei, pack.trancheCapBps, pack.bps)
  return tranche * pack.slippageSafety <= mulBps(depthWei, pack.creatorTaxBps, pack.bps)
}

export function stampOf(stamps: BatchStamps, field: StampField): bigint | undefined {
  switch (field) {
    case "eth_collected":
      return stamps.eth_collected
    case "corp_bought":
      return stamps.corp_bought
    case "deposit_confirmed":
      return stamps.deposit_confirmed
    case "mint":
      return stamps.mint
    default: {
      const _never: never = field
      return _never
    }
  }
}

export function withStamp(stamps: BatchStamps, field: StampField, cityTime: bigint): BatchStamps {
  switch (field) {
    case "eth_collected":
      return { ...stamps, eth_collected: cityTime }
    case "corp_bought":
      return { ...stamps, corp_bought: cityTime }
    case "deposit_confirmed":
      return { ...stamps, deposit_confirmed: cityTime }
    case "mint":
      return { ...stamps, mint: cityTime }
    default: {
      const _never: never = field
      return _never
    }
  }
}

export function nextUnset(order: readonly StampField[], stamps: BatchStamps): StampField | undefined {
  for (const field of order) {
    if (stampOf(stamps, field) === undefined) return field
  }
  return undefined
}

export function applyStamp(
  pack: BuybackPack,
  stamps: BatchStamps,
  field: StampField,
  cityTime: bigint,
): BatchStamps | undefined {
  if (nextUnset(pack.order, stamps) !== field) return undefined
  if (field === "mint") {
    const dep = stamps.deposit_confirmed
    if (dep === undefined || dep >= cityTime) return undefined
    if (!buybackOrderOk(withStamp(stamps, "mint", cityTime), pack.order)) return undefined
  }
  return withStamp(stamps, field, cityTime)
}
