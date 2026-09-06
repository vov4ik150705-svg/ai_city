export type SampleStore = {
  putPriceDay(cityDay: bigint, payload: Uint8Array): void
  getPriceDay(cityDay: bigint): Uint8Array | undefined
}

export function memoryStore(): SampleStore {
  const rows = new Map<string, Uint8Array>()
  return {
    putPriceDay(cityDay: bigint, payload: Uint8Array): void {
      rows.set(cityDay.toString(), payload)
    },
    getPriceDay(cityDay: bigint): Uint8Array | undefined {
      return rows.get(cityDay.toString())
    },
  }
}
