import { canonical, type Json } from "@corporator/contentpack"
import { bytesToHex, merkleRoot } from "@corporator/engine"
import { aggregateKey, cityDayOf, type AttestorPack } from "./pack.js"
import { cidV1 } from "./cid.js"

export type SealedTick = {
  readonly cityId: string
  readonly cityTime: bigint
  readonly leaves: readonly Uint8Array[]
}

export function cityReps(ticks: readonly SealedTick[]): readonly SealedTick[] {
  const seen = new Set<string>()
  const out: SealedTick[] = []
  for (const tick of minuteLeavesOrder(ticks)) {
    if (seen.has(tick.cityId)) continue
    seen.add(tick.cityId)
    out.push(tick)
  }
  return out
}

function minuteLeavesOrder(ticks: readonly SealedTick[]): readonly SealedTick[] {
  return [...ticks].sort((a, b) => {
    if (a.cityId < b.cityId) return -1
    if (a.cityId > b.cityId) return 1
    if (a.cityTime < b.cityTime) return -1
    if (a.cityTime > b.cityTime) return 1
    return 0
  })
}

export function minuteLeaves(ticks: readonly SealedTick[]): readonly Uint8Array[] {
  const out: Uint8Array[] = []
  for (const tick of minuteLeavesOrder(ticks)) {
    for (const leaf of tick.leaves) out.push(leaf)
  }
  return out
}

export function minuteRoot(pack: AttestorPack, ticks: readonly SealedTick[]): Uint8Array | undefined {
  const leaves = minuteLeaves(ticks)
  if (leaves.length === 0) return undefined
  return merkleRoot(leaves, pack.leafPrefix, pack.nodePrefix)
}

export function cityDayPayload(cityId: string, cityDay: bigint, root: Uint8Array): Uint8Array {
  const body: Json = {
    city_day: cityDay,
    city_id: cityId,
    root: bytesToHex(root),
  }
  return canonical(body)
}

export function cityDayCid(pack: AttestorPack, cityId: string, cityTime: bigint, root: Uint8Array): Uint8Array {
  return cidV1(pack, cityDayPayload(cityId, cityDayOf(pack, cityTime), root))
}

export function cityDayStoreKey(pack: AttestorPack, cityId: string, cityTime: bigint): string {
  return aggregateKey(cityId, cityDayOf(pack, cityTime))
}
