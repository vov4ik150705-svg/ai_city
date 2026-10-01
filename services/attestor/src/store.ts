import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { sha256Hex } from "@corporator/contentpack"
import type { EnvMap } from "@corporator/chainport"

export type RootStore = {
  putMinute(wallS: bigint, root: Uint8Array): void
  getMinute(wallS: bigint): Uint8Array | undefined
  putCityDay(key: string, cid: Uint8Array): void
  getCityDay(key: string): Uint8Array | undefined
}

export type RootBag = {
  readonly minutes: Map<string, Uint8Array>
  readonly days: Map<string, Uint8Array>
}

type PgClient = {
  connect(): Promise<void>
  query(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: Array<{ readonly [key: string]: unknown }> }>
}

type PgCtor = new (config: { connectionString: string }) => PgClient

const TABLE = "attest_roots"
const MINUTE_PREFIX = "minute:"
const DAY_PREFIX = "day:"

function asBytes(payload: unknown): Uint8Array | undefined {
  if (payload instanceof Uint8Array) return Uint8Array.from(payload)
  if (payload instanceof ArrayBuffer) return new Uint8Array(payload)
  return undefined
}

function asPgParam(value: unknown): unknown {
  if (value instanceof Uint8Array) return Buffer.from(value)
  return value
}

function pgClientCtor(): PgCtor {
  const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "api", "package.json"))
  const mod = require("pg") as { Client?: PgCtor; default?: { Client?: PgCtor } }
  const ctor = mod.Client ?? mod.default?.Client
  if (ctor === undefined) throw new Error("pg")
  return ctor
}

export function mapRootStore(bag: RootBag): RootStore {
  return {
    putMinute(wallS: bigint, root: Uint8Array): void {
      bag.minutes.set(wallS.toString(), root)
    },
    getMinute(wallS: bigint): Uint8Array | undefined {
      return bag.minutes.get(wallS.toString())
    },
    putCityDay(key: string, cid: Uint8Array): void {
      bag.days.set(key, cid)
    },
    getCityDay(key: string): Uint8Array | undefined {
      return bag.days.get(key)
    },
  }
}

export function memoryRootStore(): RootStore {
  return mapRootStore({ minutes: new Map(), days: new Map() })
}

async function persistRow(client: PgClient, id: string, payload: Uint8Array): Promise<void> {
  const hash = sha256Hex(payload)
  await client.query(
    `INSERT INTO ${TABLE} (id, payload, payload_hash) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, payload_hash = EXCLUDED.payload_hash`,
    [id, asPgParam(payload), hash],
  )
}

function writeThrough(bag: RootBag, client: PgClient): RootStore {
  const inner = mapRootStore(bag)
  return {
    putMinute(wallS: bigint, root: Uint8Array): void {
      inner.putMinute(wallS, root)
      void persistRow(client, MINUTE_PREFIX + wallS.toString(), root).catch(() => undefined)
    },
    getMinute(wallS: bigint): Uint8Array | undefined {
      return inner.getMinute(wallS)
    },
    putCityDay(key: string, cid: Uint8Array): void {
      inner.putCityDay(key, cid)
      void persistRow(client, DAY_PREFIX + key, cid).catch(() => undefined)
    },
    getCityDay(key: string): Uint8Array | undefined {
      return inner.getCityDay(key)
    },
  }
}

async function hydratePg(url: string): Promise<RootStore> {
  const Client = pgClientCtor()
  const client = new Client({ connectionString: url })
  await client.connect()
  await client.query("SET client_encoding TO 'UTF8'")
  const bag: RootBag = { minutes: new Map(), days: new Map() }
  const res = await client.query(`SELECT id, payload FROM ${TABLE}`)
  for (const row of res.rows) {
    const id = row["id"]
    const payload = asBytes(row["payload"])
    if (typeof id !== "string" || payload === undefined) continue
    if (id.startsWith(MINUTE_PREFIX)) {
      bag.minutes.set(id.slice(MINUTE_PREFIX.length), payload)
      continue
    }
    if (id.startsWith(DAY_PREFIX)) bag.days.set(id.slice(DAY_PREFIX.length), payload)
  }
  return writeThrough(bag, client)
}

/** Same `attest_roots` table as `services/api` migrations. Memory if DATABASE_URL is unset. */
export async function openRootStore(env: EnvMap): Promise<RootStore> {
  const url = env["DATABASE_URL"]
  if (url === undefined || url.length === 0) return memoryRootStore()
  try {
    return await hydratePg(url)
  } catch {
    return memoryRootStore()
  }
}
