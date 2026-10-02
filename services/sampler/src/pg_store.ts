import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { canonical, fromUtf8, parseJson, sha256Hex } from "@corporator/contentpack"
import type { SamplerPack } from "./pack.js"
import type { PriceSampleRow, PriceSampleStore } from "./loop.js"
import type { SamplerEnv } from "./source.js"
import { asBig, asObj } from "./values.js"

export type SqlRunner = {
  query(sql: string, params: readonly unknown[]): Promise<readonly { readonly [key: string]: unknown }[]>
}

type PgClient = {
  connect(): Promise<void>
  query(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: Array<{ readonly [key: string]: unknown }> }>
  end(): Promise<void>
}

type PgCtor = new (config: { connectionString: string }) => PgClient

const WORLD_ID = "world"

export type SampleClock = {
  readonly tickIndex: bigint | undefined
  readonly cityTime: bigint | undefined
}

export function sampleCityTime(pack: SamplerPack, last: SampleClock): bigint {
  if (last.cityTime !== undefined) return last.cityTime
  if (last.tickIndex !== undefined) return pack.anchorHour + last.tickIndex * pack.tickLengthCityHours
  return pack.anchorHour
}

export function priceSamplePayload(row: PriceSampleRow): Uint8Array {
  return canonical({
    city_time: row.cityTime,
    eth_usd_8dec: row.ethUsd8dec,
    corp_eth_wei_per_whole: row.corpEthWeiPerWhole,
    dex_turnover_usd_8dec: row.dexTurnoverUsd8dec,
  })
}

function asBytes(payload: unknown): Uint8Array | undefined {
  if (payload instanceof Uint8Array) return Uint8Array.from(payload)
  if (payload instanceof ArrayBuffer) return new Uint8Array(payload)
  return undefined
}

function asPgParam(value: unknown): unknown {
  if (value instanceof Uint8Array) return Buffer.from(value)
  return value
}

function clockFrom(payload: Uint8Array): SampleClock | undefined {
  try {
    const body = asObj(parseJson(fromUtf8(payload)))
    const tickIndex = "tick_index" in body ? asBig(body["tick_index"]) : undefined
    const cityTime = "city_time" in body ? asBig(body["city_time"]) : undefined
    return { tickIndex, cityTime }
  } catch {
    return undefined
  }
}

export function priceSampleStore(sql: SqlRunner, pack: SamplerPack): PriceSampleStore {
  return {
    async cityTime(): Promise<bigint> {
      const rows = await sql.query("SELECT payload FROM cities WHERE id = $1", [WORLD_ID])
      const row = rows[0]
      if (row === undefined) return sampleCityTime(pack, { tickIndex: undefined, cityTime: undefined })
      const payload = asBytes(row["payload"])
      if (payload === undefined) throw new Error("price sample clock")
      const clock = clockFrom(payload)
      if (clock === undefined) throw new Error("price sample clock")
      return sampleCityTime(pack, clock)
    },
    async putSample(row: PriceSampleRow): Promise<void> {
      const payload = priceSamplePayload(row)
      await sql.query(
        `INSERT INTO price_samples (id, payload, payload_hash) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, payload_hash = EXCLUDED.payload_hash`,
        [row.cityTime.toString(), payload, sha256Hex(payload)],
      )
    },
  }
}

function pgClientCtor(): PgCtor {
  const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "api", "package.json"))
  const mod = require("pg") as { Client?: PgCtor; default?: { Client?: PgCtor } }
  const ctor = mod.Client ?? mod.default?.Client
  if (ctor === undefined) throw new Error("pg")
  return ctor
}

export async function openPriceSampleStore(env: SamplerEnv, pack: SamplerPack): Promise<PriceSampleStore> {
  const url = env["DATABASE_URL"]
  if (url === undefined || url.length === 0) throw new Error("DATABASE_URL")
  const client = new (pgClientCtor())({ connectionString: url })
  await client.connect()
  try {
    await client.query("SET client_encoding TO 'UTF8'")
  } catch (err) {
    await client.end()
    throw err
  }
  return priceSampleStore(
    {
      async query(sql: string, params: readonly unknown[]): Promise<readonly { readonly [key: string]: unknown }[]> {
        const res = await client.query(sql, params.map(asPgParam))
        return res.rows
      },
    },
    pack,
  )
}
