import { randomUUID } from "node:crypto"
import { canonical, fromUtf8, parseJson } from "@corporator/contentpack"
import { tickLengthRealMs } from "@corporator/protocol"
import { getBytes, putBytes, type Store } from "./store.js"
import { WORLD_ROW_ID } from "./tick_host.js"

export type TickLock = {
  tryAcquire(): Promise<boolean>
  release(): Promise<void>
}

export type LockSlot = {
  readonly token: string
  readonly replica: string
  readonly expiresMs: bigint
}

type Lease = {
  readonly token: string
  readonly expiresMs: bigint
}

export function replicaIdOf(hostname: string | undefined): string | undefined {
  if (hostname === undefined || hostname.length === 0) return undefined
  return hostname
}

function encodeLease(replica: string, token: string, expiresMs: bigint): Uint8Array {
  return canonical({
    expires_ms: expiresMs.toString(),
    replica,
    token,
  })
}

function decodeLease(payload: Uint8Array): Lease | undefined {
  const parsed = parseJson(fromUtf8(payload))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return undefined
  const row = parsed as { readonly [key: string]: unknown }
  const token = row["token"]
  const expires = row["expires_ms"]
  if (typeof token !== "string" || token.length === 0) return undefined
  if (typeof expires !== "string" || expires.length === 0) return undefined
  let expiresMs: bigint
  try {
    expiresMs = BigInt(expires)
  } catch {
    return undefined
  }
  if (expiresMs < 0n) return undefined
  return { token, expiresMs }
}

function leaseOpen(row: Lease, now: bigint): boolean {
  return row.expiresMs > now
}

export function memoryTickLock(held: Map<string, LockSlot>, replicaId: string, nowMs: () => number = Date.now): TickLock {
  const token = randomUUID()
  return {
    async tryAcquire(): Promise<boolean> {
      const now = BigInt(nowMs())
      const row = held.get(WORLD_ROW_ID)
      const mine = row !== undefined && row.token === token
      const open = row !== undefined && row.expiresMs > now
      if (row !== undefined && open && !mine) return false
      held.set(WORLD_ROW_ID, { token, replica: replicaId, expiresMs: now + tickLengthRealMs })
      return true
    },
    async release(): Promise<void> {
      const row = held.get(WORLD_ROW_ID)
      if (row !== undefined && row.token === token) held.delete(WORLD_ROW_ID)
    },
  }
}

async function rollback(store: Store): Promise<void> {
  try {
    await store.exec("ROLLBACK")
  } catch {
    // The caller's error is the one to surface.
  }
}

export function pgTickLock(store: Store, replicaId: string, nowMs: () => number = Date.now): TickLock {
  const token = randomUUID()
  return {
    async tryAcquire(): Promise<boolean> {
      const now = BigInt(nowMs())
      const payload = encodeLease(replicaId, token, now + tickLengthRealMs)
      await store.exec("BEGIN")
      try {
        await store.exec("LOCK TABLE tick_locks IN EXCLUSIVE MODE")
        const existing = await getBytes(store, "tick_locks", WORLD_ROW_ID)
        const decoded = existing === undefined ? undefined : decodeLease(existing)
        const mine = decoded !== undefined && decoded.token === token
        const open = decoded !== undefined && leaseOpen(decoded, now)
        if (decoded !== undefined && open && !mine) {
          await store.exec("COMMIT")
          return false
        }
        await putBytes(store, "tick_locks", WORLD_ROW_ID, payload, undefined)
        await store.exec("COMMIT")
        return true
      } catch (err) {
        await rollback(store)
        throw err
      }
    },
    async release(): Promise<void> {
      await store.exec("BEGIN")
      try {
        await store.exec("LOCK TABLE tick_locks IN EXCLUSIVE MODE")
        const existing = await getBytes(store, "tick_locks", WORLD_ROW_ID)
        const decoded = existing === undefined ? undefined : decodeLease(existing)
        if (decoded !== undefined && decoded.token === token) {
          await store.query(`DELETE FROM tick_locks WHERE id = $1`, [WORLD_ROW_ID])
        }
        await store.exec("COMMIT")
      } catch (err) {
        await rollback(store)
        throw err
      }
    },
  }
}
