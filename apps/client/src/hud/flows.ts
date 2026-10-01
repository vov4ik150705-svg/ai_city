import { clipOfflineHours } from "@corporator/engine"
import type { ClientPack } from "../packview.js"

export type OfflineWindow = {
  readonly baseHours: bigint
  readonly automationHours: readonly bigint[]
  readonly automationTotalHours: bigint
  readonly mergeHours: bigint
  readonly addedHours: bigint
  readonly unclippedHours: bigint
  readonly clippedHours: bigint
  readonly clippedAwayHours: bigint
  readonly hardCapHours: bigint
  readonly ticksCap: bigint
  readonly reachedCap: boolean
}

export type FlowLaunch = "offline_return" | ""

export type WalletLoginPhase = "missing" | "connecting" | "wrong_chain" | "ready"

export type FlowStorage = {
  readonly getItem: (key: string) => string | null
  readonly setItem: (key: string, value: string) => void
}

const CITYTIME_PREFIX = "corporator.lastCityTime."

function liveFlowStorage(): FlowStorage | undefined {
  try {
    if (typeof sessionStorage === "undefined") return undefined
    return sessionStorage
  } catch {
    return undefined
  }
}

export function cityFlowKey(cityId: string): string {
  return CITYTIME_PREFIX + cityId
}

function readStore(storage: FlowStorage | undefined): FlowStorage | undefined {
  return storage === undefined ? liveFlowStorage() : storage
}

export function sumHours(parts: readonly bigint[]): bigint {
  let total = 0n
  for (const part of parts) total += part
  return total
}

export function offlineWindowOf(pack: ClientPack): OfflineWindow {
  const baseHours = pack.offlineCapBaseHours
  const automationHours = pack.offlineAutomationHours
  const automationTotalHours = sumHours(automationHours)
  const mergeHours = pack.offlineMergeHours
  const addedHours = automationTotalHours + mergeHours
  const hardCapHours = baseHours + automationTotalHours
  const clippedHours = clipOfflineHours(baseHours, addedHours, hardCapHours)
  const unclippedHours = baseHours + addedHours
  const clippedAwayHours = unclippedHours < clippedHours ? 0n : unclippedHours - clippedHours
  return {
    baseHours,
    automationHours,
    automationTotalHours,
    mergeHours,
    addedHours,
    unclippedHours,
    clippedHours,
    clippedAwayHours,
    hardCapHours,
    ticksCap: pack.offlineReturnTicksCap,
    reachedCap: clippedAwayHours > 0n,
  }
}

export function autoLaunchFlow(args: {
  readonly lastCityTime: bigint | undefined
  readonly cityTime: bigint
}): FlowLaunch {
  if (args.lastCityTime !== undefined && args.cityTime > args.lastCityTime) return "offline_return"
  return ""
}

export function parseWalletChain(value: unknown): bigint | undefined {
  if (typeof value === "bigint") return value
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value)
  if (typeof value !== "string" || value.length === 0) return undefined
  try {
    return BigInt(value)
  } catch {
    return undefined
  }
}

export function walletLoginPhase(args: {
  readonly hasWallet: boolean
  readonly connecting: boolean
  readonly expectedChain: bigint
  readonly gotChain: bigint | undefined
}): WalletLoginPhase {
  if (args.connecting) return "connecting"
  if (!args.hasWallet) return "missing"
  if (args.expectedChain > 0n && args.gotChain !== undefined && args.gotChain !== args.expectedChain) {
    return "wrong_chain"
  }
  return "ready"
}

export function loadLastCityTime(cityId: string | undefined, storage?: FlowStorage): bigint | undefined {
  if (cityId === undefined || cityId.length === 0) return undefined
  const store = readStore(storage)
  if (store === undefined) return undefined
  const raw = store.getItem(cityFlowKey(cityId))
  if (raw === null || raw.length === 0) return undefined
  try {
    return BigInt(raw)
  } catch {
    return undefined
  }
}

export function storeLastCityTime(cityId: string | undefined, cityTime: bigint, storage?: FlowStorage): void {
  if (cityId === undefined || cityId.length === 0) return
  const store = readStore(storage)
  if (store === undefined) return
  store.setItem(cityFlowKey(cityId), cityTime.toString())
}
