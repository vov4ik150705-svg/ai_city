export type RootStore = {
  putMinute(wallS: bigint, root: Uint8Array): void
  getMinute(wallS: bigint): Uint8Array | undefined
  putCityDay(key: string, cid: Uint8Array): void
  getCityDay(key: string): Uint8Array | undefined
}

export function memoryRootStore(): RootStore {
  const minutes = new Map<string, Uint8Array>()
  const days = new Map<string, Uint8Array>()
  return {
    putMinute(wallS: bigint, root: Uint8Array): void {
      minutes.set(wallS.toString(), root)
    },
    getMinute(wallS: bigint): Uint8Array | undefined {
      return minutes.get(wallS.toString())
    },
    putCityDay(key: string, cid: Uint8Array): void {
      days.set(key, cid)
    },
    getCityDay(key: string): Uint8Array | undefined {
      return days.get(key)
    },
  }
}
