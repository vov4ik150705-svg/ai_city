import { canonical, type Json } from "@corporator/contentpack"
import type { BatchStamps } from "./policy.js"

export type BatchStore = {
  put(batchId: string, payload: Uint8Array): void
  get(batchId: string): Uint8Array | undefined
}

export function memoryBatchStore(): BatchStore {
  const rows = new Map<string, Uint8Array>()
  return {
    put(batchId: string, payload: Uint8Array): void {
      rows.set(batchId, payload)
    },
    get(batchId: string): Uint8Array | undefined {
      return rows.get(batchId)
    },
  }
}

export function batchJson(batchId: string, sendWei: bigint, stamps: BatchStamps): Json {
  const row: { [key: string]: Json } = {
    batch_id: batchId,
    send_wei: sendWei,
  }
  if (stamps.eth_collected !== undefined) row["eth_collected"] = stamps.eth_collected
  if (stamps.corp_bought !== undefined) row["corp_bought"] = stamps.corp_bought
  if (stamps.deposit_confirmed !== undefined) row["deposit_confirmed"] = stamps.deposit_confirmed
  if (stamps.mint !== undefined) row["mint"] = stamps.mint
  return row
}

export function publishBatch(
  store: BatchStore,
  batchId: string,
  sendWei: bigint,
  stamps: BatchStamps,
): void {
  store.put(batchId, canonical(batchJson(batchId, sendWei, stamps)))
}
