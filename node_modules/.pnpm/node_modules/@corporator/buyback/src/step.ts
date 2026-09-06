import type { BuybackPack } from "./pack.js"
import { applyStamp, buybackDue, planSend, type BatchStamps } from "./policy.js"

export type BuybackState = {
  readonly collectedWei: bigint
  readonly lastRunCityTime: bigint
  readonly hasRun: bigint
  readonly sendCount: bigint
  readonly stamps: BatchStamps
}

export type StepOut = {
  readonly next: BuybackState
  readonly sendWei: bigint
}

export function emptyBuybackState(): BuybackState {
  return {
    collectedWei: 0n,
    lastRunCityTime: 0n,
    hasRun: 0n,
    sendCount: 0n,
    stamps: {},
  }
}

export function stepBuyback(
  pack: BuybackPack,
  state: BuybackState,
  cityTime: bigint,
  inflowWei: bigint,
  depthWei: bigint,
): StepOut {
  const collected = state.collectedWei + inflowWei
  const hold: BuybackState = { ...state, collectedWei: collected }
  if (!buybackDue(pack.cadence, state.hasRun, state.lastRunCityTime, cityTime)) {
    return { next: hold, sendWei: 0n }
  }
  const sendWei = planSend(pack, collected, depthWei)
  if (sendWei === 0n) return { next: hold, sendWei: 0n }
  const stamped = applyStamp(pack, {}, "eth_collected", cityTime)
  if (stamped === undefined) return { next: hold, sendWei: 0n }
  return {
    next: {
      collectedWei: collected - sendWei,
      lastRunCityTime: cityTime,
      hasRun: 1n,
      sendCount: state.sendCount + 1n,
      stamps: stamped,
    },
    sendWei,
  }
}
