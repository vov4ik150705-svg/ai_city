import { channelMap, codes, sessionScheme, wsHeartbeatMs, wsTemplate } from "@corporator/protocol"
import { snapshotFromEnvelope } from "../boot.js"
import { applyPath } from "../command.js"
import { authHeaders } from "../session.js"
import type { ClientSnapshot } from "./snapshot.js"

export const WS_CHANNEL_CLASSES = ["tick", "aggregate", "price", "log", "efficiency"] as const
export type WsChannelClass = (typeof WS_CHANNEL_CLASSES)[number]

export type WsPulse = {
  readonly kind: "pulse"
  readonly packHash: string
}

export type WsPatch = {
  readonly kind: "patch"
  readonly channel: WsChannelClass
  readonly sections: { readonly [sourceId: string]: unknown }
}

export type WsEvent = WsPulse | WsPatch

function keepDefined<K extends keyof ClientSnapshot>(
  prev: ClientSnapshot,
  parsed: ClientSnapshot,
  key: K,
): ClientSnapshot[K] {
  const val = parsed[key]
  return val === undefined ? prev[key] : val
}

export function applyWsEvent(snap: ClientSnapshot, event: WsEvent): ClientSnapshot {
  if (event.kind === "pulse") return snap
  const parsed = snapshotFromEnvelope({
    city_time: snap.cityTime,
    account_kind: snap.accountKind,
    sections: event.sections,
  })
  if (event.channel === "tick") {
    return {
      ...snap,
      cityTime: snap.cityTime,
      capital: keepDefined(snap, parsed, "capital"),
      energy: keepDefined(snap, parsed, "energy"),
      compute: keepDefined(snap, parsed, "compute"),
      energyDemand: keepDefined(snap, parsed, "energyDemand"),
      computeDemand: keepDefined(snap, parsed, "computeDemand"),
      functions: keepDefined(snap, parsed, "functions"),
      agents: keepDefined(snap, parsed, "agents"),
      stake: keepDefined(snap, parsed, "stake"),
      population: keepDefined(snap, parsed, "population"),
      cityLevel: keepDefined(snap, parsed, "cityLevel"),
      productivity: keepDefined(snap, parsed, "productivity"),
      cityLabel: keepDefined(snap, parsed, "cityLabel"),
      bankLimitLive: keepDefined(snap, parsed, "bankLimitLive"),
      gate: keepDefined(snap, parsed, "gate"),
      chainTimeS: keepDefined(snap, parsed, "chainTimeS"),
      vouchers: parsed.vouchers !== undefined ? parsed.vouchers : snap.vouchers,
      mintRate: keepDefined(snap, parsed, "mintRate"),
      offlineHours: keepDefined(snap, parsed, "offlineHours"),
    }
  }
  if (event.channel === "aggregate") {
    return {
      ...snap,
      cityTime: snap.cityTime,
      payrollRatioBps: keepDefined(snap, parsed, "payrollRatioBps"),
      payrollBoostBps: keepDefined(snap, parsed, "payrollBoostBps"),
      payrollBoostDaysLeft: keepDefined(snap, parsed, "payrollBoostDaysLeft"),
      payrollPaid: keepDefined(snap, parsed, "payrollPaid"),
      payrollRequested: keepDefined(snap, parsed, "payrollRequested"),
      gdp: keepDefined(snap, parsed, "gdp"),
      happiness: keepDefined(snap, parsed, "happiness"),
      stability: keepDefined(snap, parsed, "stability"),
      seasonLabel: keepDefined(snap, parsed, "seasonLabel"),
      periodLabel: keepDefined(snap, parsed, "periodLabel"),
      influenceRank: keepDefined(snap, parsed, "influenceRank"),
      fragmentLedger: keepDefined(snap, parsed, "fragmentLedger"),
      prizeNoticeKey: parsed.prizeNoticeKey.length > 0 ? parsed.prizeNoticeKey : snap.prizeNoticeKey,
      prizeBasket: parsed.prizeBasket.length > 0 ? parsed.prizeBasket : snap.prizeBasket,
      population: keepDefined(snap, parsed, "population"),
      cityLevel: keepDefined(snap, parsed, "cityLevel"),
      productivity: keepDefined(snap, parsed, "productivity"),
    }
  }
  if (event.channel === "price") {
    return {
      ...snap,
      cityTime: snap.cityTime,
      corp: keepDefined(snap, parsed, "corp"),
      quoteLive: keepDefined(snap, parsed, "quoteLive"),
      quoteAgeMs: keepDefined(snap, parsed, "quoteAgeMs"),
      quoteCorpEth: keepDefined(snap, parsed, "quoteCorpEth"),
      protocolEthInFlight: keepDefined(snap, parsed, "protocolEthInFlight"),
      protocolVaultCorp: keepDefined(snap, parsed, "protocolVaultCorp"),
      protocolStudioEth: keepDefined(snap, parsed, "protocolStudioEth"),
      gate: keepDefined(snap, parsed, "gate"),
    }
  }
  if (event.channel === "log") {
    return {
      ...snap,
      cityTime: snap.cityTime,
      log: keepDefined(snap, parsed, "log"),
      logLoading: keepDefined(snap, parsed, "logLoading"),
      logError: keepDefined(snap, parsed, "logError"),
      unreadCount: keepDefined(snap, parsed, "unreadCount"),
    }
  }
  return {
    ...snap,
    cityTime: snap.cityTime,
    stocks: parsed.stocks.length > 0 ? parsed.stocks : snap.stocks,
    gate: keepDefined(snap, parsed, "gate"),
  }
}

export function cityWsUrl(origin: string, cityId: string): string {
  const path = applyPath(wsTemplate, "city_id", cityId)
  if (origin.startsWith("https://")) return "wss://" + origin.slice("https://".length) + path
  if (origin.startsWith("http://")) return "ws://" + origin.slice("http://".length) + path
  throw new Error(codes.API_MALFORMED)
}

/** One protocol token. The browser can send this; it cannot set Authorization. */
export function sessionWsProtocol(sessionId: string): string {
  return sessionScheme + "." + sessionId
}

type SocketWithHeaders = {
  new (
    url: string,
    options?:
      | string
      | readonly string[]
      | { readonly headers: { readonly [name: string]: string }; readonly protocols: readonly string[] },
  ): WebSocket
}

/** Node sends Authorization. A browser constructor rejects that options bag and falls back to the protocol. */
export function openCitySocket(url: string, sessionId: string): WebSocket {
  const protocol = sessionWsProtocol(sessionId)
  const Ctor = WebSocket as unknown as SocketWithHeaders
  try {
    return new Ctor(url, { headers: authHeaders(sessionId), protocols: [protocol] })
  } catch {
    return new WebSocket(url, [protocol])
  }
}

export function isWsChannelClass(value: unknown): value is WsChannelClass {
  if (typeof value !== "string") return false
  for (const row of WS_CHANNEL_CLASSES) {
    if (row === value) return true
  }
  return false
}

export function sourcesOfChannel(channel: WsChannelClass): readonly string[] {
  const out: string[] = []
  for (const id of Object.keys(channelMap)) {
    const mapped = channelMap[id as keyof typeof channelMap]
    if (mapped === channel) out.push(id)
  }
  return out
}

export function parseWsEvent(body: unknown): WsEvent | undefined {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return undefined
  const row = body as { readonly [key: string]: unknown }
  const channel = row["channel"]
  if (channel === "clock") return undefined
  if (isWsChannelClass(channel)) {
    const sectionsRaw = row["sections"]
    if (sectionsRaw === null || typeof sectionsRaw !== "object" || Array.isArray(sectionsRaw)) return undefined
    const allowed = new Set(sourcesOfChannel(channel))
    const sections: { [id: string]: unknown } = {}
    const bag = sectionsRaw as { readonly [key: string]: unknown }
    for (const id of Object.keys(bag)) {
      if (allowed.has(id)) sections[id] = bag[id]
    }
    return { kind: "patch", channel, sections }
  }
  const packHash = row["pack_hash"]
  if (typeof packHash !== "string" || packHash.length === 0) return undefined
  return { kind: "pulse", packHash }
}

/** Chain clock or the voucher list was present on this snapshot. */
export function chainClockCarried(snap: Pick<ClientSnapshot, "chainTimeS" | "vouchers">): boolean {
  if (snap.chainTimeS !== undefined) return true
  return snap.vouchers !== undefined
}

/** Tick section included the chain clock or the voucher list, even when the list is empty. */
export function patchCarriesChainClock(sections: { readonly [key: string]: unknown }): boolean {
  const buildings = sections["tick.building_level"]
  if (buildings === null || typeof buildings !== "object" || Array.isArray(buildings)) return false
  const row = buildings as { readonly [key: string]: unknown }
  return "chain_time_s" in row || "vouchers" in row
}

/** How long the chain clock has been missing. No sighting is already past the window. */
export function chainFieldsEmptyFor(freshAt: bigint | undefined, nowMs: bigint, windowMs: bigint): bigint {
  if (freshAt === undefined) return windowMs > 0n ? windowMs + 1n : 1n
  if (nowMs < freshAt) return 0n
  return nowMs - freshAt
}

/**
 * A socket event postpones resync while chain fields are still inside the pack window.
 * Past that window only a patch that carries them does.
 */
export function socketResetsQuiet(args: {
  readonly patchCarriesChain: boolean
  readonly emptyForMs: bigint
  readonly windowMs: bigint
}): boolean {
  if (args.patchCarriesChain) return true
  if (args.windowMs <= 0n) return true
  return args.emptyForMs <= args.windowMs
}

export function staleWaitMs(ageMs: bigint, heartbeatMs: bigint = wsHeartbeatMs): bigint {
  if (ageMs >= heartbeatMs) return 0n
  return heartbeatMs - ageMs
}
