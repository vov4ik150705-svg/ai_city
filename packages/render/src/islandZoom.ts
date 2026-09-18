import { clampOrbit } from "./orbit.js"
import { ZOOM_FACTOR } from "./islandConfig.js"

/** Multiplicative zoom. A 1 m step at 800–44000 is forbidden. */
export function zoomOrbitDistance(
  distance: bigint,
  dir: bigint,
  min: bigint,
  max: bigint,
): bigint {
  if (dir === 0n) return clampOrbit(distance, min, max)
  const cur = Number(distance)
  const next = dir > 0n ? cur / ZOOM_FACTOR : cur * ZOOM_FACTOR
  if (!Number.isFinite(next) || next <= 0) return clampOrbit(distance, min, max)
  return clampOrbit(BigInt(Math.round(next)), min, max)
}

export function meshoptDecoderReady(
  decoder: { readonly ready?: Promise<void> } | null | undefined,
): Promise<void> {
  if (decoder === null || decoder === undefined || decoder.ready === undefined) {
    return Promise.reject(new Error("MESHOPT_DECODER_MISSING"))
  }
  return decoder.ready
}
