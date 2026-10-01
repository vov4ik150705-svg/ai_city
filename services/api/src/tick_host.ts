import { canonical, fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { errResult, type HttpResult } from "./envelope.js"
import {
  bytesToHex,
  encodeHeader,
  encodeRecord,
  tick,
  tickHeader,
  TickError,
  type Dict,
} from "@corporator/engine"
import { withWorldLock } from "./city_lock.js"
import { type PackCtx } from "./pack_ctx.js"
import { listBytes, putBytes, getBytes, type Store } from "./store.js"
import { asBigint, asEngineDict, asObj, asText, jsonToDict } from "./values.js"
import { cityKind } from "./envelope.js"

/** One row for the whole world. Not a city id; a table key, like any other primary key. */
export const WORLD_ROW_ID = "world"

export type AttestResult = {
  readonly rootHex: string
  readonly cidHex: string
  readonly badge: string
}

export type Attestor = {
  submit(payload: Uint8Array): Promise<AttestResult | undefined>
}

export type TickRun = {
  readonly state: Dict
  readonly records: readonly Dict[]
  readonly headerBytes: Uint8Array
  readonly recordBytes: readonly Uint8Array[]
  readonly attest: AttestResult | undefined
}

function recordSpec(cfg: Dict): Dict {
  return asEngineDict(cfg["record_spec"])
}

function headerSpec(cfg: Dict): Dict {
  return asEngineDict(cfg["header_spec"])
}

function inputsFromHeader(hdr: Json): Dict {
  const row = asObj(hdr)
  return {
    city_id: asText(row["city_id"]),
    tick_index: asBigint(row["tick_index"]),
    city_time: asBigint(row["city_time"]),
    pack_hash: asText(row["pack_hash"]),
    corp_eth_wei_per_whole: asBigint(row["corp_eth_wei_per_whole"]),
    eth_usd_8dec: asBigint(row["eth_usd_8dec"]),
    feed_live: asBigint(row["feed_live"]),
    dex_turnover_usd_8dec: asBigint(row["dex_turnover_usd_8dec"]),
    price_sample_city_time: asBigint(row["price_sample_city_time"]),
    stake_snapshot: asBigint(row["stake_snapshot"]),
    companion_commands: [],
  }
}

function snapJson(value: unknown): Json {
  if (value === null) return null
  if (typeof value === "bigint" || typeof value === "string" || typeof value === "boolean") return value
  if (Array.isArray(value)) {
    const out: Json[] = []
    for (const item of value) out.push(snapJson(item))
    return out
  }
  if (typeof value === "object") {
    const src = value as { readonly [key: string]: unknown }
    const out: { [key: string]: Json } = {}
    for (const key of Object.keys(src)) {
      if (key === "cfg") continue
      const child = src[key]
      if (child === undefined) continue
      out[key] = snapJson(child)
    }
    return out
  }
  return ""
}

function restoreState(cfg: Dict, snap: Json): Dict {
  const state = jsonToDict(snap)
  state["cfg"] = cfg
  return state
}

export function restoreMemory(target: Dict, snapshot: Dict): void {
  for (const key of Object.keys(target)) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, key)) delete target[key]
  }
  for (const key of Object.keys(snapshot)) {
    const value = snapshot[key]
    if (value !== undefined) target[key] = value
  }
}

export async function runTick(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  inputs: Dict,
  attestor?: Attestor,
  onCommitted?: (next: Dict) => void,
): Promise<TickRun> {
  const committed = await withWorldLock(async () => {
    const snapshot = structuredClone(state)
    const cfg = asEngineDict(state["cfg"])
    const cityId =
      asText(inputs["city_id"]) ||
      (Object.keys(asEngineDict(state["cities"]))[0] ?? "")
    const cityTime = asBigint(inputs["city_time"])
    const kind = cityKind(state, cityId)
    const inputId = cityId + ":" + cityTime.toString()
    let opened = false
    let packed:
      | {
          readonly state: Dict
          readonly records: readonly Dict[]
          readonly headerBytes: Uint8Array
          readonly recordBytes: readonly Uint8Array[]
          readonly cityId: string
          readonly cityTime: bigint
        }
      | undefined
    try {
      await store.exec("BEGIN")
      opened = true
      const stepped = tick(state, inputs)
      const next = stepped[0]
      const records = stepped[1]
      const hdr = tickHeader(next, inputs)
      const hdrBytes = encodeHeader(hdr, headerSpec(cfg))
      await putBytes(store, "tick_inputs", inputId, hdrBytes, undefined)
      const recBytes: Uint8Array[] = []
      const spec = recordSpec(cfg)
      for (const rec of records) {
        const blob = encodeRecord(rec, spec)
        recBytes.push(blob)
        const agent = asText(rec["agent_id"])
        await putBytes(store, "records", cityId + ":" + cityTime.toString() + ":" + agent, blob, kind)
      }
      await putBytes(store, "outbox", cityId + ":" + cityTime.toString(), hdrBytes, undefined)
      if (asBigint(next["hour"]) === 0n) {
        await putBytes(
          store,
          "state_snapshots",
          cityId + ":" + cityTime.toString(),
          canonical(snapJson(next)),
          kind,
        )
      }
      await persistLiveState(store, next, cityId)
      await store.exec("COMMIT")
      opened = false
      packed = { state: next, records, headerBytes: hdrBytes, recordBytes: recBytes, cityId, cityTime }
    } catch (err) {
      if (opened) {
        try {
          await store.exec("ROLLBACK")
        } catch {
          // The tick error is the one to surface.
        }
      }
      restoreMemory(state, snapshot)
      throw err
    }
    if (packed === undefined) throw new Error("tick commit missing")
    if (onCommitted !== undefined) onCommitted(packed.state)
    return packed
  })
  let attest: AttestResult | undefined
  if (attestor !== undefined) {
    try {
      const leaves: string[] = [bytesToHex(committed.headerBytes)]
      for (const blob of committed.recordBytes) leaves.push(bytesToHex(blob))
      attest = await attestor.submit(
        canonical({
          city_id: committed.cityId,
          city_time: committed.cityTime.toString(),
          leaves,
        }),
      )
    } catch {
      attest = undefined
    }
  }
  return {
    state: committed.state,
    records: committed.records,
    headerBytes: committed.headerBytes,
    recordBytes: committed.recordBytes,
    attest,
  }
}

export function isPackHashHalt(err: unknown): boolean {
  return err instanceof TickError && err.code === "PACK_HASH"
}

export async function replayStored(
  ctx: PackCtx,
  store: Store,
  genesis: Dict,
  cityId: string,
): Promise<{ readonly headers: readonly Uint8Array[]; readonly records: readonly Uint8Array[] }> {
  const rows = await listBytes(store, "tick_inputs", cityId + ":")
  const ordered = [...rows].sort((a, b) => {
    const ha = asObj(parseJson(fromUtf8(a.payload)))
    const hb = asObj(parseJson(fromUtf8(b.payload)))
    const ta = asBigint(ha["city_time"])
    const tb = asBigint(hb["city_time"])
    if (ta < tb) return 0 - 1
    if (ta > tb) return 1
    return 0
  })
  let st: Dict = structuredClone(genesis)
  const headers: Uint8Array[] = []
  const records: Uint8Array[] = []
  const spec = recordSpec(ctx.cfg)
  const hspec = headerSpec(ctx.cfg)
  for (const row of ordered) {
    const hdr = parseJson(fromUtf8(row.payload))
    const inputs = inputsFromHeader(hdr)
    const stepped = tick(st, inputs)
    st = stepped[0]
    const encodedHdr = encodeHeader(tickHeader(st, inputs), hspec)
    headers.push(encodedHdr)
    for (const rec of stepped[1]) records.push(encodeRecord(rec, spec))
  }
  return { headers, records }
}

export async function replayFromSnapshot(
  ctx: PackCtx,
  store: Store,
  genesis: Dict,
  cityId: string,
  fromCityTime: bigint,
): Promise<{ readonly headers: readonly Uint8Array[]; readonly records: readonly Uint8Array[] }> {
  const snap = await getBytes(store, "state_snapshots", cityId + ":" + fromCityTime.toString())
  let st: Dict
  if (snap === undefined) st = structuredClone(genesis)
  else st = restoreState(ctx.cfg, parseJson(fromUtf8(snap)))
  const rows = await listBytes(store, "tick_inputs", cityId + ":")
  const later = rows.filter((row) => {
    const hdr = asObj(parseJson(fromUtf8(row.payload)))
    return asBigint(hdr["city_time"]) > fromCityTime
  })
  later.sort((a, b) => {
    const ta = asBigint(asObj(parseJson(fromUtf8(a.payload)))["city_time"])
    const tb = asBigint(asObj(parseJson(fromUtf8(b.payload)))["city_time"])
    if (ta < tb) return 0 - 1
    if (ta > tb) return 1
    return 0
  })
  const headers: Uint8Array[] = []
  const records: Uint8Array[] = []
  const spec = recordSpec(ctx.cfg)
  const hspec = headerSpec(ctx.cfg)
  for (const row of later) {
    const hdr = parseJson(fromUtf8(row.payload))
    const inputs = inputsFromHeader(hdr)
    const stepped = tick(st, inputs)
    st = stepped[0]
    headers.push(encodeHeader(tickHeader(st, inputs), hspec))
    for (const rec of stepped[1]) records.push(encodeRecord(rec, spec))
  }
  return { headers, records }
}

export function cityLedgerDirty(city: Dict): boolean {
  if (asBigint(city["corp_held"], 0n) > 0n) return true
  const tokens = asEngineDict(city["tokens_held"])
  for (const key of Object.keys(tokens)) {
    if (asBigint(tokens[key], 0n) > 0n) return true
  }
  const settled = asEngineDict(city["stake_settled"])
  const chain = asEngineDict(city["stake_chain"])
  const names: { [key: string]: 1 } = {}
  for (const key of Object.keys(settled)) names[key] = 1
  for (const key of Object.keys(chain)) names[key] = 1
  for (const key of Object.keys(names)) {
    if (asBigint(settled[key], 0n) !== asBigint(chain[key], 0n)) return true
  }
  return false
}

export function walletLedgerBlocked(state: Dict): boolean {
  const cities = asEngineDict(state["cities"])
  for (const id of Object.keys(cities)) {
    const city = asEngineDict(cities[id])
    if (asText(city["account_kind"]) !== "wallet") continue
    if (cityLedgerDirty(city)) return true
  }
  return false
}

export function liveStartRefusal(state: Dict, live: boolean): string {
  if (!live || !walletLedgerBlocked(state)) return ""
  return codes.LEDGER_NOT_EMPTY_LIVE
}

function noteLedgerRefusal(city: Dict): void {
  const prior = city["ledger_journal"]
  const journal = Array.isArray(prior) ? prior : []
  journal.push({ code: codes.LEDGER_NOT_EMPTY_LIVE })
  city["ledger_journal"] = journal
}

/** Live wallet city must leave the command with an empty custodial ledger. Rolls the command back. */
export async function refuseCustodial(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  cityId: string,
  snapshot: Dict,
  live: boolean,
): Promise<HttpResult | undefined> {
  if (!live) return undefined
  const cities = asEngineDict(state["cities"])
  if (!(cityId in cities)) return undefined
  const city = asEngineDict(cities[cityId])
  if (asText(city["account_kind"]) !== "wallet") return undefined
  if (!cityLedgerDirty(city)) return undefined
  restoreMemory(state, snapshot)
  const restored = asEngineDict(state["cities"])
  if (cityId in restored) noteLedgerRefusal(asEngineDict(restored[cityId]))
  let opened = false
  try {
    await store.exec("BEGIN")
    opened = true
    await persistLiveState(store, state, cityId)
    await store.exec("COMMIT")
  } catch (err) {
    if (opened) {
      try {
        await store.exec("ROLLBACK")
      } catch {
        // The thrown error is the one to surface.
      }
    }
    restoreMemory(state, snapshot)
    throw err
  }
  return errResult(ctx, state, codes.SERVICE_DEGRADED)
}

export async function persistLiveState(store: Store, state: Dict, cityId: string): Promise<void> {
  const payload = canonical(snapJson(state))
  await putBytes(store, "cities", WORLD_ROW_ID, payload, cityKind(state, cityId))
}

async function liveCheckpoint(store: Store, cityId: string): Promise<Json | undefined> {
  if (cityId.length > 0) {
    const row = await getBytes(store, "cities", cityId)
    if (row !== undefined) return parseJson(fromUtf8(row))
  }
  const rows = await listBytes(store, "cities", "")
  const first = rows[0]
  if (first === undefined) return undefined
  return parseJson(fromUtf8(first.payload))
}

export async function restoreLiveState(ctx: PackCtx, store: Store, genesis: Dict): Promise<Dict> {
  const world = await getBytes(store, "cities", WORLD_ROW_ID)
  if (world !== undefined) return restoreState(ctx.cfg, parseJson(fromUtf8(world)))
  const cities = asEngineDict(genesis["cities"])
  const ids = Object.keys(cities)
  const cityId = ids[0] ?? asText(genesis["city_id"])
  if (cityId.length === 0) return structuredClone(genesis)
  const checkpoint = await liveCheckpoint(store, cityId)
  if (checkpoint !== undefined) return restoreState(ctx.cfg, checkpoint)
  const snaps = await listBytes(store, "state_snapshots", cityId + ":")
  let st: Dict = structuredClone(genesis)
  let fromTime = 0n
  let hasSnap = false
  for (const row of snaps) {
    const parsed = parseJson(fromUtf8(row.payload))
    const cityTime = asBigint(asObj(parsed)["city_time"])
    if (!hasSnap || cityTime > fromTime) {
      hasSnap = true
      fromTime = cityTime
      st = restoreState(ctx.cfg, parsed)
    }
  }
  const rows = await listBytes(store, "tick_inputs", cityId + ":")
  const later = rows.filter((row) => {
    const hdr = asObj(parseJson(fromUtf8(row.payload)))
    if (!hasSnap) return true
    return asBigint(hdr["city_time"]) > fromTime
  })
  later.sort((a, b) => {
    const ta = asBigint(asObj(parseJson(fromUtf8(a.payload)))["city_time"])
    const tb = asBigint(asObj(parseJson(fromUtf8(b.payload)))["city_time"])
    if (ta < tb) return 0 - 1
    if (ta > tb) return 1
    return 0
  })
  for (const row of later) {
    const inputs = inputsFromHeader(parseJson(fromUtf8(row.payload)))
    st = tick(st, inputs)[0]
  }
  return st
}

export async function persistGapRecord(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  rec: Dict,
  cityId: string,
): Promise<void> {
  const spec = recordSpec(ctx.cfg)
  const blob = encodeRecord(rec, spec)
  const cityTime = asBigint(rec["city_time"])
  const agent = asText(rec["agent_id"])
  await putBytes(store, "records", cityId + ":" + cityTime.toString() + ":" + agent, blob, cityKind(state, cityId))
}

export { snapJson, restoreState, inputsFromHeader }
