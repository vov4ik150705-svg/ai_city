import { PGlite } from "@electric-sql/pglite"
import { canonical, sha256Hex, type Json } from "@corporator/contentpack"
import pg from "pg"
import { asText } from "./values.js"

export type Row = { readonly [key: string]: unknown }

export type Store = {
  exec(sql: string): Promise<void>
  query(sql: string, params: readonly unknown[]): Promise<readonly Row[]>
  close(): Promise<void>
}

function asPgParam(value: unknown): unknown {
  if (value instanceof Uint8Array) return Buffer.from(value)
  return value
}

function asBytes(payload: unknown): Uint8Array | undefined {
  if (payload instanceof Uint8Array) return Uint8Array.from(payload)
  if (payload instanceof ArrayBuffer) return new Uint8Array(payload)
  return undefined
}

export async function openPglite(): Promise<Store> {
  const db = new PGlite()
  const ready = (db as { readonly waitReady?: Promise<void> }).waitReady
  if (ready !== undefined) await ready
  return {
    async exec(sql: string): Promise<void> {
      await db.exec(sql)
    },
    async query(sql: string, params: readonly unknown[]): Promise<readonly Row[]> {
      const res = await db.query<Row>(sql, params as unknown[])
      return res.rows
    },
    async close(): Promise<void> {
      const closer = db as { close?: () => Promise<void> }
      if (closer.close !== undefined) await closer.close()
    },
  }
}

export async function openPg(url: string): Promise<Store> {
  // One Client: runTick BEGIN/COMMIT must not hop pool connections. docs/ARCHITECTURE.md §9
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  await client.query("SET client_encoding TO 'UTF8'")
  return {
    async exec(sql: string): Promise<void> {
      await client.query(sql)
    },
    async query(sql: string, params: readonly unknown[]): Promise<readonly Row[]> {
      const res = await client.query(sql, params.map(asPgParam))
      return res.rows
    },
    async close(): Promise<void> {
      await client.end()
    },
  }
}

export function payloadHash(bytes: Uint8Array): string {
  return sha256Hex(bytes)
}

export async function putBytes(
  store: Store,
  table: string,
  id: string,
  payload: Uint8Array,
  accountKind: string | undefined,
): Promise<void> {
  const hash = payloadHash(payload)
  if (accountKind === undefined) {
    await store.query(
      `INSERT INTO ${table} (id, payload, payload_hash) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, payload_hash = EXCLUDED.payload_hash`,
      [id, payload, hash],
    )
    return
  }
  await store.query(
    `INSERT INTO ${table} (id, payload, payload_hash, account_kind) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, payload_hash = EXCLUDED.payload_hash, account_kind = EXCLUDED.account_kind`,
    [id, payload, hash, accountKind],
  )
}

export async function getBytes(store: Store, table: string, id: string): Promise<Uint8Array | undefined> {
  const rows = await store.query(`SELECT payload FROM ${table} WHERE id = $1`, [id])
  const row = rows[0]
  if (row === undefined) return undefined
  return asBytes(row["payload"])
}

export async function listBytes(
  store: Store,
  table: string,
  prefix: string,
): Promise<readonly { readonly id: string; readonly payload: Uint8Array }[]> {
  const rows = await store.query(
    `SELECT id, payload FROM ${table} WHERE id LIKE $1 ORDER BY id`,
    [prefix + "%"],
  )
  const out: { readonly id: string; readonly payload: Uint8Array }[] = []
  for (const row of rows) {
    const id = asText(row["id"])
    const payload = asBytes(row["payload"])
    if (payload !== undefined) out.push({ id, payload })
  }
  return out
}

export async function putJson(
  store: Store,
  table: string,
  id: string,
  value: Json,
  accountKind: string | undefined,
): Promise<void> {
  await putBytes(store, table, id, canonical(value), accountKind)
}
