import { PRIZE_KETTLE_FARM, type AssetPort } from "@corporator/chainport"
import { keccak256Hex, type Dict } from "@corporator/engine"
import { codes } from "@corporator/protocol"
import { withWorldLock } from "./city_lock.js"
import { prizeAssets, stockAddress } from "./commit_prize.js"
import { prizeCustodyLive } from "./custody.js"
import { cityKind } from "./envelope.js"
import { type ApiHost } from "./host.js"
import { persistLiveState, restoreMemory } from "./tick_host.js"
import { asBigint, asEngineDict, asText, walk } from "./values.js"

const SENDING = "sending"
const SENT = "sent"

type Fresh = {
  readonly id: string
  readonly token: string
  readonly players: readonly string[]
  readonly amounts: readonly bigint[]
}

type OwedRow = {
  readonly cityId: string
  readonly wallet: string
  readonly amount: bigint
}

function citiesOf(state: Dict): Dict {
  return asEngineDict(state["cities"])
}

function cityOf(state: Dict, cityId: string): Dict | undefined {
  const cities = citiesOf(state)
  if (!(cityId in cities)) return undefined
  return asEngineDict(cities[cityId])
}

function persistId(state: Dict): string {
  const ids = Object.keys(citiesOf(state)).sort()
  return ids[0] ?? ""
}

function batchRows(state: Dict): Dict[] {
  const raw = state["fragment_batches"]
  if (!Array.isArray(raw)) return []
  const out: Dict[] = []
  for (const item of raw) {
    if (item !== null && typeof item === "object" && !Array.isArray(item)) out.push(item as Dict)
  }
  return out
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item === "string") out.push(item)
  }
  return out
}

function bigintList(value: unknown): bigint[] {
  if (!Array.isArray(value)) return []
  const out: bigint[] = []
  for (const item of value) out.push(asBigint(item, 0n))
  return out
}

function windowMarks(state: Dict): Dict {
  const raw = state["fragment_windows"]
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) return raw as Dict
  const created: Dict = {}
  state["fragment_windows"] = created
  return created
}

function windowKey(windowId: string, ticker: string): string {
  return windowId + ":" + ticker
}

function setMark(state: Dict, windowId: string, ticker: string, mark: string): boolean {
  const marks = windowMarks(state)
  const key = windowKey(windowId, ticker)
  const cur = asText(marks[key])
  if (cur === mark) return false
  if (mark === "idle" && (cur === "sent" || cur === "short")) return false
  if (mark === "short" && cur === "sent") return false
  marks[key] = mark
  return true
}

/** token, window id, and index joined by NUL so a ticker cannot glue onto the next field. */
function batchIdOf(token: string, windowId: string, index: bigint): string {
  const text = token + "\0" + windowId + "\0" + index.toString()
  return "0x" + keccak256Hex(new TextEncoder().encode(text))
}

function hasSending(state: Dict, ticker: string, windowId?: string): boolean {
  for (const row of batchRows(state)) {
    if (asText(row["status"]) !== SENDING) continue
    if (asText(row["ticker"]) !== ticker) continue
    if (windowId !== undefined && asText(row["window_id"]) !== windowId) continue
    return true
  }
  return false
}

function reservedCities(state: Dict, ticker: string): Set<string> {
  const out = new Set<string>()
  for (const row of batchRows(state)) {
    if (asText(row["status"]) !== SENDING) continue
    if (asText(row["ticker"]) !== ticker) continue
    for (const id of stringList(row["city_ids"])) out.add(id)
  }
  return out
}

function countBatches(state: Dict, token: string, windowId: string): bigint {
  let n = 0n
  for (const row of batchRows(state)) {
    if (asText(row["token"]) === token && asText(row["window_id"]) === windowId) n += 1n
  }
  return n
}

function collect(state: Dict, ticker: string, reserved: ReadonlySet<string>): { readonly rows: OwedRow[]; readonly emptyWallet: boolean } {
  const rows: OwedRow[] = []
  let emptyWallet = false
  for (const cityId of Object.keys(citiesOf(state)).sort()) {
    if (cityKind(state, cityId) !== "wallet") continue
    if (reserved.has(cityId)) continue
    const city = cityOf(state, cityId)
    if (city === undefined) continue
    const amount = asBigint(asEngineDict(city["fragment_owed"])[ticker], 0n)
    if (amount <= 0n) continue
    const wallet = asText(city["wallet"])
    if (wallet.length === 0) {
      emptyWallet = true
      continue
    }
    rows.push({ cityId, wallet, amount })
  }
  return { rows, emptyWallet }
}

function markSent(state: Dict, id: string): boolean {
  let row: Dict | undefined
  for (const item of batchRows(state)) {
    if (asText(item["id"]) === id) row = item
  }
  if (row === undefined) return false
  if (asText(row["status"]) !== SENDING) return false
  const ticker = asText(row["ticker"])
  const cities = stringList(row["city_ids"])
  const amounts = bigintList(row["amounts"])
  const n = cities.length < amounts.length ? cities.length : amounts.length
  for (let i = 0; i < n; i += 1) {
    const cityId = cities[i]
    const amount = amounts[i]
    if (cityId === undefined || amount === undefined || amount <= 0n) continue
    const city = cityOf(state, cityId)
    if (city === undefined) continue
    const owed = asEngineDict(city["fragment_owed"])
    const have = asBigint(owed[ticker], 0n)
    const next = have - amount
    owed[ticker] = next > 0n ? next : 0n
    city["fragment_owed"] = owed
    const sliced = asEngineDict(city["fragment_sliced"])
    sliced[ticker] = asBigint(sliced[ticker], 0n) + amount
    city["fragment_sliced"] = sliced
  }
  row["status"] = SENT
  const windowId = asText(row["window_id"])
  if (!hasSending(state, ticker, windowId)) setMark(state, windowId, ticker, "sent")
  return true
}

function noteShort(host: ApiHost, windowId: string, ticker: string, sum: bigint, bag: bigint): boolean {
  const key = windowKey(windowId, ticker)
  const marks = windowMarks(host.state)
  const cur = asText(marks[key])
  if (cur === "short" || cur === "sent") return false
  marks[key] = "short"
  host.state["fragment_slice_alarm"] = codes.FRAGMENT_POOL_EMPTY
  const prior = host.state["fragment_slice_journal"]
  const journal = Array.isArray(prior) ? prior : []
  journal.push({
    code: codes.FRAGMENT_POOL_EMPTY,
    window_id: windowId,
    ticker,
    owed: sum.toString(),
    bag: bag.toString(),
  })
  host.state["fragment_slice_journal"] = journal
  host.attestLog = [
    ...host.attestLog,
    { id: key, key: codes.FRAGMENT_POOL_EMPTY, badge: "degraded", root: "", cid: "" },
  ]
  return true
}

function openBatches(
  state: Dict,
  ticker: string,
  token: string,
  windowId: string,
  rows: readonly OwedRow[],
  max: bigint,
): Fresh[] {
  const fresh: Fresh[] = []
  let index = countBatches(state, token, windowId)
  let offset = 0
  while (offset < rows.length) {
    const players: string[] = []
    const amounts: bigint[] = []
    const cityIds: string[] = []
    let taken = 0n
    while (offset < rows.length && taken < max) {
      const row = rows[offset]
      offset += 1
      taken += 1n
      if (row === undefined) continue
      players.push(row.wallet)
      amounts.push(row.amount)
      cityIds.push(row.cityId)
    }
    if (players.length === 0) continue
    const id = batchIdOf(token, windowId, index)
    const stored: Dict = {
      id,
      token,
      ticker,
      window_id: windowId,
      index,
      city_ids: cityIds,
      players,
      amounts,
      status: SENDING,
    }
    const all = batchRows(state)
    all.push(stored)
    state["fragment_batches"] = all
    fresh.push({ id, token, players, amounts })
    index += 1n
  }
  return fresh
}

function planFresh(
  host: ApiHost,
  tickers: readonly string[],
  bags: ReadonlyMap<string, bigint>,
  silent: ReadonlySet<string>,
  windowId: string,
  max: bigint,
): { readonly changed: boolean; readonly fresh: Fresh[] } {
  const fresh: Fresh[] = []
  let changed = false
  for (const ticker of tickers) {
    if (silent.has(ticker)) continue
    const bag = bags.get(ticker)
    const token = stockAddress(ticker)
    if (bag === undefined || token.length === 0) continue
    const collected = collect(host.state, ticker, reservedCities(host.state, ticker))
    let sum = 0n
    for (const row of collected.rows) sum += row.amount
    if (sum === 0n) {
      if (!collected.emptyWallet && !hasSending(host.state, ticker) && setMark(host.state, windowId, ticker, "idle")) {
        changed = true
      }
      continue
    }
    if (sum > bag) {
      if (noteShort(host, windowId, ticker, sum, bag)) changed = true
      continue
    }
    const opened = openBatches(host.state, ticker, token, windowId, collected.rows, max)
    if (opened.length === 0) continue
    changed = true
    for (const row of opened) fresh.push(row)
  }
  return { changed, fresh }
}

async function commitState(host: ApiHost, job: (fresh: Fresh[]) => boolean): Promise<Fresh[]> {
  const fresh: Fresh[] = []
  await withWorldLock(async () => {
    const snapshot = structuredClone(host.state)
    try {
      const changed = job(fresh)
      if (!changed) return
      await persistLiveState(host.store, host.state, persistId(host.state))
    } catch (err) {
      fresh.splice(0, fresh.length)
      restoreMemory(host.state, snapshot)
      throw err
    }
  })
  return fresh
}

/** After the tick commits. Reads the chain before the lock; writes owed under the lock. */
export async function sliceFarm(host: ApiHost, port: AssetPort): Promise<void> {
  try {
    if (!prizeCustodyLive(port)) return
    const tickers = prizeAssets(host.ctx)
    const max = asBigint(walk(host.ctx.pack, ["sections", "api", "params", "farm_slice_batch_max", "v"]), 0n)
    const windowId = asBigint(host.state["day"], 0n).toString()
    const usedIds: string[] = []
    for (const row of batchRows(host.state)) {
      if (asText(row["status"]) !== SENDING) continue
      const id = asText(row["id"])
      if (id.length === 0) continue
      let used
      try {
        used = await port.prizeTreasury.batchUsed(id)
      } catch {
        continue
      }
      if (used.ok && used.amount === 1n) usedIds.push(id)
    }
    const bags = new Map<string, bigint>()
    const silent = new Set<string>()
    for (const ticker of tickers) {
      const token = stockAddress(ticker)
      if (token.length === 0) {
        silent.add(ticker)
        continue
      }
      let bag
      try {
        bag = await port.prizeTreasury.unsliced(PRIZE_KETTLE_FARM, token)
      } catch {
        silent.add(ticker)
        continue
      }
      if (!bag.ok) {
        silent.add(ticker)
        continue
      }
      bags.set(ticker, bag.amount)
    }
    const fresh = await commitState(host, (out) => {
      let changed = false
      for (const id of usedIds) {
        if (markSent(host.state, id)) changed = true
      }
      if (max <= 0n) return changed
      const planned = planFresh(host, tickers, bags, silent, windowId, max)
      if (planned.changed) changed = true
      for (const row of planned.fresh) out.push(row)
      return changed
    })
    const landed: string[] = []
    for (const row of fresh) {
      try {
        await port.prizeTreasury.slice(
          port.voucherSignerService,
          row.id,
          row.token,
          PRIZE_KETTLE_FARM,
          row.players,
          row.amounts,
        )
      } catch {
        // Send failure is not the receipt. batchUsed is.
      }
      let used
      try {
        used = await port.prizeTreasury.batchUsed(row.id)
      } catch {
        continue
      }
      if (used.ok && used.amount === 1n) landed.push(row.id)
    }
    if (landed.length === 0) return
    await commitState(host, () => {
      let changed = false
      for (const id of landed) {
        if (markSent(host.state, id)) changed = true
      }
      return changed
    })
  } catch {
    return
  }
}
