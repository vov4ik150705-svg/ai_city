import { loadPack, parseJson, fromUtf8 } from "@corporator/contentpack"
import { codes, packTemplate, stateTemplate } from "@corporator/protocol"
import { applyPath } from "./command.js"
import type { ClientSnapshot, SnapshotDistrictLive, SnapshotBoardRow, SnapshotPrizeRow } from "./hud/model.js"
import { authHeaders } from "./session.js"
import { asObj, asBig } from "./values.js"

export type FetchBytes = (
  url: string,
  headers?: { readonly [name: string]: string },
) => Promise<Uint8Array>

export type BootOk = {
  readonly ok: true
  readonly packBytes: Uint8Array
  readonly packJson: ReturnType<typeof loadPack>["pack"]
  readonly snapshot: ClientSnapshot
  readonly cityTime: bigint
  readonly accountKind: string
  readonly packHash: string
}

export type BootErr = {
  readonly ok: false
  readonly code: string
}

export type BootResult = BootOk | BootErr

function sectionMaybe(sections: { readonly [key: string]: unknown }, id: string): bigint | undefined {
  if (!Object.prototype.hasOwnProperty.call(sections, id)) return undefined
  const val = sections[id]
  if (typeof val === "bigint") return val
  return undefined
}

function potBig(row: { readonly [key: string]: unknown }, id: string): bigint {
  const val = row[id]
  if (typeof val === "bigint") return val
  return 0n
}

function prizeFromSections(sections: { readonly [key: string]: unknown }): {
  readonly prizeNoticeKey: string
  readonly protocolEthInFlight: bigint | undefined
  readonly protocolVaultCorp: bigint | undefined
  readonly protocolStudioEth: bigint | undefined
  readonly prizeBasket: readonly {
    readonly ticker: string
    readonly farm: bigint
    readonly month: bigint
  }[]
} {
  let prizeNoticeKey = ""
  const prizeBasket: { ticker: string; farm: bigint; month: bigint }[] = []
  const raw = sections["seasons.prize_basket"]
  if (raw !== undefined && raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as { readonly [key: string]: unknown }
    const notice = obj["notice"]
    if (typeof notice === "string") prizeNoticeKey = notice
    for (const ticker of Object.keys(obj)) {
      if (ticker === "notice") continue
      const row = obj[ticker]
      if (row === null || typeof row !== "object" || Array.isArray(row)) continue
      const pots = row as { readonly [key: string]: unknown }
      prizeBasket.push({ ticker, farm: potBig(pots, "farm"), month: potBig(pots, "month") })
    }
  }
  return {
    prizeNoticeKey,
    protocolEthInFlight: sectionMaybe(sections, "wallet.protocol_eth_in_flight"),
    protocolVaultCorp: sectionMaybe(sections, "wallet.protocol_vault_corp"),
    protocolStudioEth: sectionMaybe(sections, "wallet.protocol_studio_eth"),
    prizeBasket,
  }
}

function sectionObj(
  sections: { readonly [key: string]: unknown },
  id: string,
): { readonly [key: string]: unknown } | undefined {
  const raw = sections[id]
  if (raw === undefined || raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined
  return raw as { readonly [key: string]: unknown }
}

function nestedBig(obj: { readonly [key: string]: unknown } | undefined, key: string): bigint | undefined {
  if (obj === undefined) return undefined
  const val = obj[key]
  if (typeof val === "bigint") return val
  return undefined
}

/** Remaining build ticks. `true` is still under construction; zero and missing are not. */
function constructionLeft(value: unknown): bigint | undefined {
  if (value === true) return 1n
  if (typeof value === "bigint") return value > 0n ? value : undefined
  if (typeof value === "string" && value.length > 0) {
    try {
      const n = BigInt(value)
      return n > 0n ? n : undefined
    } catch {
      return undefined
    }
  }
  return undefined
}

function asLive(value: unknown): boolean | undefined {
  if (value === true || value === 1n) return true
  if (value === false || value === 0n) return false
  return undefined
}

function rowsOf(obj: { readonly [key: string]: unknown } | undefined): readonly unknown[] {
  if (obj === undefined) return []
  const raw = obj["rows"]
  return Array.isArray(raw) ? raw : []
}

function functionsFromSections(
  sections: { readonly [key: string]: unknown },
): ClientSnapshot["functions"] {
  const obj = sectionObj(sections, "tick.building_level")
  if (obj === undefined) return undefined
  if (!("rows" in obj)) return undefined
  const out: {
    id: string
    nameKey: string
    statusKey: string
    construction?: bigint
    level: bigint | undefined
    worker: string
    task: string
    paid?: bigint
  }[] = []
  for (const item of rowsOf(obj)) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as { readonly [key: string]: unknown }
    const id = row["id"]
    const nameKey = row["nameKey"]
    const statusKey = row["statusKey"]
    if (typeof id !== "string" || typeof nameKey !== "string" || typeof statusKey !== "string") continue
    const worker = row["worker"]
    const task = row["task"]
    const paid = nestedBig(row, "paid")
    const construction = constructionLeft(row["construction"])
    out.push({
      id,
      nameKey,
      statusKey,
      ...(construction === undefined ? {} : { construction }),
      level: nestedBig(row, "level"),
      worker: typeof worker === "string" ? worker : "",
      task: typeof task === "string" ? task : "",
      ...(paid === undefined ? {} : { paid }),
    })
  }
  return out
}

function textOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function bigintOrZero(value: unknown, fallback: bigint = 0n): bigint {
  if (typeof value === "bigint") return value
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value)
  if (typeof value === "string" && value.length > 0) {
    try {
      return BigInt(value)
    } catch {
      return fallback
    }
  }
  return fallback
}

function traitsOf(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item === "string" && item.length > 0) out.push(item)
  }
  return out
}

function agentsFromSections(sections: { readonly [key: string]: unknown }): ClientSnapshot["agents"] {
  const obj = sectionObj(sections, "tick.agent_state")
  if (obj === undefined) return undefined
  if (!("rows" in obj)) return undefined
  const out: {
    id: string
    idleKey: string
    role: string
    buildingId: string
    objective: string
    level: bigint
    xp: bigint
    traits: readonly string[]
  }[] = []
  for (const item of rowsOf(obj)) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as { readonly [key: string]: unknown }
    const id = row["id"]
    const idleKey = row["idleKey"]
    if (typeof id !== "string" || typeof idleKey !== "string") continue
    out.push({
      id,
      idleKey,
      role: textOrEmpty(row["role"]),
      buildingId: textOrEmpty(row["buildingId"] ?? row["building_id"]),
      objective: textOrEmpty(row["objective"]),
      level: bigintOrZero(row["level"]),
      xp: bigintOrZero(row["xp"]),
      traits: traitsOf(row["traits"]),
    })
  }
  return out
}

function stocksFromSections(sections: { readonly [key: string]: unknown }): ClientSnapshot["stocks"] {
  const obj = sectionObj(sections, "oracle.stock_price")
  const out: { ticker: string; price: string; dayPct: string; effect: string; held?: bigint }[] = []
  for (const item of rowsOf(obj)) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as { readonly [key: string]: unknown }
    const ticker = row["ticker"]
    if (typeof ticker !== "string" || ticker.length === 0) continue
    const price = row["price"]
    const dayPct = row["day_pct"]
    const effect = row["effect"]
    const held = row["stocks"]
    out.push({
      ticker,
      price: typeof price === "string" ? price : "",
      dayPct: typeof dayPct === "string" ? dayPct : "",
      effect: typeof effect === "string" ? effect : "",
      ...(typeof held === "bigint" ? { held } : {}),
    })
  }
  return out
}

function vouchersFromBuilding(
  buildings: { readonly [key: string]: unknown } | undefined,
): ClientSnapshot["vouchers"] {
  if (buildings === undefined) return undefined
  const raw = buildings["vouchers"]
  if (!Array.isArray(raw)) return undefined
  const out: { id: string; status: string; corp: bigint; expiresAtS: bigint }[] = []
  for (const item of raw) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as { readonly [key: string]: unknown }
    const id = row["id"]
    const status = row["status"]
    const corp = row["corp"]
    const expires = row["expires_at_s"]
    if (typeof id !== "string" || id.length === 0) continue
    if (typeof status !== "string" || status.length === 0) continue
    if (typeof corp !== "bigint" || typeof expires !== "bigint") continue
    out.push({ id, status, corp, expiresAtS: expires })
  }
  return out
}

function cooldownFromBuilding(
  buildings: { readonly [key: string]: unknown } | undefined,
): ClientSnapshot["unstakeCooldown"] {
  if (buildings === undefined) return undefined
  const raw = buildings["unstake_cooldown"]
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const table = raw as { readonly [key: string]: unknown }
  const out: { ticker: string; amount: bigint; readyAtS: bigint }[] = []
  for (const ticker of Object.keys(table)) {
    const item = table[ticker]
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as { readonly [key: string]: unknown }
    const amount = row["amount"]
    const ready = row["ready_at_s"]
    if (typeof amount !== "bigint" || typeof ready !== "bigint") continue
    if (amount <= 0n) continue
    out.push({ ticker, amount, readyAtS: ready })
  }
  return out
}

function boardOf(obj: { readonly [key: string]: unknown }): readonly SnapshotBoardRow[] {
  const raw = obj["board"]
  const out: SnapshotBoardRow[] = []
  if (!Array.isArray(raw)) return out
  for (const item of raw) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as { readonly [key: string]: unknown }
    const wallet = row["wallet"]
    const rank = row["rank"]
    const influence = row["influence"]
    const gdp = row["gdp"]
    const positiveDays = row["positive_days"]
    if (typeof wallet !== "string" || wallet.length === 0) continue
    if (typeof rank !== "bigint" || typeof influence !== "bigint") continue
    if (typeof gdp !== "bigint" || typeof positiveDays !== "bigint") continue
    out.push({
      rank,
      wallet,
      influence,
      gdp,
      positiveDays,
      qualified: asLive(row["qualified"]) === true,
      self: asLive(row["self"]) === true,
    })
  }
  return out
}

function prizeBoardOf(obj: { readonly [key: string]: unknown }): readonly SnapshotPrizeRow[] {
  const raw = obj["prize_board"]
  const out: SnapshotPrizeRow[] = []
  if (!Array.isArray(raw)) return out
  for (const item of raw) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as { readonly [key: string]: unknown }
    const wallet = row["wallet"]
    const rank = row["rank"]
    const influence = row["influence"]
    const gdp = row["gdp"]
    const positiveDays = row["positive_days"]
    const payout = row["payout"]
    if (typeof wallet !== "string" || wallet.length === 0) continue
    if (typeof rank !== "bigint" || typeof influence !== "bigint") continue
    if (typeof gdp !== "bigint" || typeof positiveDays !== "bigint") continue
    if (typeof payout !== "bigint") continue
    out.push({
      rank,
      wallet,
      influence,
      gdp,
      positiveDays,
      qualified: asLive(row["qualified"]) === true,
      self: asLive(row["self"]) === true,
      payout,
    })
  }
  return out
}

function rankFromSections(sections: { readonly [key: string]: unknown }): ClientSnapshot["influenceRank"] {
  const obj = sectionObj(sections, "seasons.influence_rank")
  if (obj === undefined) return undefined
  if (!("influence" in obj) && !("positive_days" in obj) && !("rank" in obj) && !("board" in obj)) return undefined
  const influence = nestedBig(obj, "influence")
  const positiveDays = nestedBig(obj, "positive_days")
  if (influence === undefined || positiveDays === undefined) return undefined
  return {
    rank: nestedBig(obj, "rank"),
    influence,
    positiveDays,
    qualified: asLive(obj["qualified"]) === true,
    board: boardOf(obj),
    prizeBoard: prizeBoardOf(obj),
  }
}

function ledgerFromSections(
  sections: { readonly [key: string]: unknown },
): ClientSnapshot["fragmentLedger"] {
  const obj = sectionObj(sections, "fragments.city_ledger")
  if (obj === undefined) return undefined
  if (!("rows" in obj) && !("total" in obj)) return undefined
  const out: { ticker: string; amount: bigint }[] = []
  for (const item of rowsOf(obj)) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as { readonly [key: string]: unknown }
    const ticker = row["ticker"]
    const amount = row["amount"]
    if (typeof ticker !== "string" || typeof amount !== "bigint") continue
    out.push({ ticker, amount })
  }
  return out
}

function labelOf(obj: { readonly [key: string]: unknown } | undefined, key: string): string | undefined {
  if (obj === undefined) return undefined
  const val = obj[key]
  return typeof val === "string" && val.length > 0 ? val : undefined
}

function logFromSections(sections: { readonly [key: string]: unknown }): ClientSnapshot["log"] {
  if (!Object.prototype.hasOwnProperty.call(sections, "log.events")) return undefined
  const raw = sections["log.events"]
  if (raw === undefined || raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const obj = raw as { readonly [key: string]: unknown }
  const rows = obj["rows"]
  if (!Array.isArray(rows)) return undefined
  const out: { id: string; key: string; badge: string; root: string; cid: string }[] = []
  for (const item of rows) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as { readonly [key: string]: unknown }
    const id = row["id"]
    const key = row["key"]
    const badge = row["badge"]
    const root = row["root"]
    const cid = row["cid"]
    if (typeof id !== "string" || typeof key !== "string") continue
    out.push({
      id,
      key,
      badge: typeof badge === "string" ? badge : "",
      root: typeof root === "string" ? root : "",
      cid: typeof cid === "string" ? cid : "",
    })
  }
  return out
}

function flagOf(value: unknown): boolean | undefined {
  return asLive(value)
}

function textList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: string[] = []
  for (const item of value) {
    if (typeof item === "string" && item.length > 0) out.push(item)
  }
  return out
}

function districtsFromEfficiency(
  sections: { readonly [key: string]: unknown },
): readonly SnapshotDistrictLive[] | undefined {
  const obj = sectionObj(sections, "oracle.district_efficiency")
  if (obj === undefined || !("rows" in obj)) return undefined
  const out: SnapshotDistrictLive[] = []
  for (const item of rowsOf(obj)) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as { readonly [key: string]: unknown }
    const id = row["id"]
    const ticker = row["ticker"]
    if (typeof id !== "string" || id.length === 0) continue
    const stakeOk = flagOf(row["stake_ok"])
    const stakeMult = flagOf(row["stake_mult_ok"])
    const tierOk = flagOf(row["tier_unlocked"])
    const nodeOpen = flagOf(row["node_open"])
    const mergeOk = flagOf(row["merge_free"])
    const stakeMin = nestedBig(row, "stake_min")
    out.push({
      id,
      ticker: typeof ticker === "string" ? ticker : "",
      stake: nestedBig(row, "stake") ?? 0n,
      tier: nestedBig(row, "tier") ?? 0n,
      frozen: flagOf(row["frozen"]) === true,
      grace: flagOf(row["grace"]) === true,
      stakeThresholdMet: stakeOk === true,
      stakeMultMet: stakeMult === true,
      tierUnlocked: tierOk === true,
      nodeSideOpen: nodeOpen === true,
      mergeFree: mergeOk === true,
      ...(stakeMin === undefined ? {} : { stakeMin }),
    })
  }
  return out
}

function gateFromSections(
  sections: { readonly [key: string]: unknown },
  buildings: { readonly [key: string]: unknown } | undefined,
): ClientSnapshot["gate"] {
  const opened = buildings === undefined ? undefined : textList(buildings["opened_districts"])
  const chain = sectionObj(sections, "wallet.chain")
  const match = chain === undefined ? undefined : asLive(chain["match"])
  const districts = districtsFromEfficiency(sections)
  if (opened === undefined && match === undefined && districts === undefined) return undefined
  return {
    openedDistricts: opened,
    chainWrong: match === undefined ? undefined : match === false,
    districts,
    stakeThresholdMet: undefined,
    tierUnlocked: undefined,
    stakeMultMet: undefined,
    nodeSideOpen: undefined,
    mergeFree: undefined,
  }
}

function logMeta(
  sections: { readonly [key: string]: unknown },
  log: ClientSnapshot["log"],
): {
  readonly unreadCount: bigint | undefined
  readonly logLoading: boolean | undefined
  readonly logError: boolean | undefined
} {
  if (!Object.prototype.hasOwnProperty.call(sections, "log.events")) {
    return { unreadCount: undefined, logLoading: undefined, logError: undefined }
  }
  const raw = sections["log.events"]
  if (raw === undefined || raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { unreadCount: undefined, logLoading: undefined, logError: undefined }
  }
  const obj = raw as { readonly [key: string]: unknown }
  const loading = asLive(obj["loading"])
  const error = asLive(obj["error"])
  const unread = nestedBig(obj, "unread")
  return {
    unreadCount: unread ?? (log === undefined ? undefined : BigInt(log.length)),
    logLoading: loading,
    logError: error,
  }
}

export function snapshotFromEnvelope(body: unknown): ClientSnapshot {
  const obj = asObj(body)
  if (!("city_time" in obj)) throw new Error(codes.API_PACK_STALE)
  const sectionsRaw = obj["sections"]
  const sections = sectionsRaw === undefined ? {} : asObj(sectionsRaw)
  const kind = obj["account_kind"]
  const prize = prizeFromSections(sections)
  const buildings = sectionObj(sections, "tick.building_level")
  const rank = sectionObj(sections, "seasons.influence_rank")
  const quotes = sectionObj(sections, "oracle.stock_price")
  const log = logFromSections(sections)
  const meta = logMeta(sections, log)
  const known = sectionMaybe(sections, "wallet.corp_known")
  const overlayCorp = sectionMaybe(sections, "wallet.corp_balance")
  const corp = known === 0n ? undefined : (overlayCorp ?? nestedBig(buildings, "corp_held"))
  return {
    cityTime: asBig(obj["city_time"]),
    accountKind: typeof kind === "string" ? kind : "wallet",
    capital: sectionMaybe(sections, "tick.capital"),
    corp,
    energy: sectionMaybe(sections, "tick.energy"),
    compute: sectionMaybe(sections, "tick.compute"),
    population: nestedBig(buildings, "population") ?? sectionMaybe(sections, "aggregate.population"),
    cityLevel: nestedBig(buildings, "city_level") ?? sectionMaybe(sections, "aggregate.city_level"),
    payrollRatioBps: sectionMaybe(sections, "aggregate.payroll_ratio") ?? nestedBig(buildings, "payroll_ratio"),
    payrollBoostBps: sectionMaybe(sections, "aggregate.payroll_boost_bps"),
    payrollBoostDaysLeft: sectionMaybe(sections, "aggregate.payroll_boost_days_left"),
    payrollPaid: sectionMaybe(sections, "aggregate.payroll_paid") ?? nestedBig(buildings, "payroll_paid"),
    payrollRequested:
      sectionMaybe(sections, "aggregate.payroll_requested") ?? nestedBig(buildings, "payroll_requested"),
    energyDemand: sectionMaybe(sections, "tick.energy_demand") ?? nestedBig(buildings, "energy_demand"),
    computeDemand: sectionMaybe(sections, "tick.compute_demand") ?? nestedBig(buildings, "compute_demand"),
    gdp: sectionMaybe(sections, "aggregate.gdp"),
    happiness: sectionMaybe(sections, "aggregate.happiness"),
    stability: sectionMaybe(sections, "aggregate.stability"),
    productivity: nestedBig(buildings, "productivity") ?? sectionMaybe(sections, "aggregate.productivity"),
    seasonLabel: labelOf(rank, "season_label"),
    periodLabel: labelOf(rank, "period_label"),
    cityLabel: labelOf(buildings, "city_label"),
    unreadCount: meta.unreadCount,
    logLoading: meta.logLoading,
    logError: meta.logError,
    quoteLive: asLive(quotes === undefined ? undefined : quotes["live"]),
    quoteAgeMs: nestedBig(quotes, "age_ms"),
    quoteCorpEth: nestedBig(quotes, "corp_eth"),
    bankLimitLive: nestedBig(buildings, "bank_limit_live"),
    functions: functionsFromSections(sections),
    stocks: stocksFromSections(sections),
    vouchers: vouchersFromBuilding(buildings),
    unstakeCooldown: cooldownFromBuilding(buildings),
    chainTimeS: nestedBig(buildings, "chain_time_s"),
    mintRate: nestedBig(buildings, "mint_rate"),
    offlineHours: nestedBig(buildings, "offline_hours"),
    agents: agentsFromSections(sections),
    influenceRank: rankFromSections(sections),
    fragmentLedger: ledgerFromSections(sections),
    stake: sectionMaybe(sections, "wallet.stake_tokens"),
    log,
    prizeNoticeKey: prize.prizeNoticeKey,
    protocolEthInFlight: prize.protocolEthInFlight,
    protocolVaultCorp: prize.protocolVaultCorp,
    protocolStudioEth: prize.protocolStudioEth,
    prizeBasket: prize.prizeBasket,
    gate: gateFromSections(sections, buildings),
  }
}

export async function bootFromHost(args: {
  readonly origin: string
  readonly packHash: string
  readonly cityId: string
  readonly sessionId?: string
  readonly fetchBytes: FetchBytes
}): Promise<BootResult> {
  try {
    const packPath = applyPath(packTemplate, "pack_hash", args.packHash)
    const packBytes = await args.fetchBytes(args.origin + packPath)
    const loaded = loadPack(packBytes)
    if (loaded.hash !== args.packHash) return { ok: false, code: codes.API_PACK_STALE }
    const statePath = applyPath(stateTemplate, "city_id", args.cityId)
    const stateUrl = args.origin + statePath
    const stateBytes =
      args.sessionId === undefined || args.sessionId.length === 0
        ? await args.fetchBytes(stateUrl)
        : await args.fetchBytes(stateUrl, authHeaders(args.sessionId))
    const envelope = parseJson(fromUtf8(stateBytes))
    const snapshot = snapshotFromEnvelope(envelope)
    return {
      ok: true,
      packBytes,
      packJson: loaded.pack,
      snapshot,
      cityTime: snapshot.cityTime,
      accountKind: snapshot.accountKind,
      packHash: loaded.hash,
    }
  } catch {
    return { ok: false, code: codes.API_PACK_STALE }
  }
}

export function originFromListen(bind: string, port: bigint): string {
  return "http://" + bind + ":" + port.toString()
}

/** Env origin when it is set; otherwise the pack listen origin. */
export function apiOrigin(listenOrigin: string, envOrigin: string | undefined): string {
  if (envOrigin !== undefined && envOrigin.length > 0) return envOrigin
  return listenOrigin
}
