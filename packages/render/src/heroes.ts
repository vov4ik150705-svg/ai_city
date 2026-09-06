export type HeroLot = {
  readonly id: string
  readonly tileX: bigint
  readonly tileY: bigint
  readonly spanX: bigint
  readonly spanZ: bigint
}

export type HeroCatalogRow = {
  readonly lodHigh: string
  readonly lodLow: string
  readonly quadsHigh: bigint
  readonly quadsLow: bigint
  readonly material: string
  readonly shaHigh: string
  readonly shaLow: string
}

function asInt(value: unknown): bigint {
  if (typeof value === "bigint") return value
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value)
  if (typeof value === "string" && value.length > 0) {
    try {
      return BigInt(value)
    } catch {
      return 0n
    }
  }
  return 0n
}

export function loadHeroCatalog(root: unknown): { readonly [id: string]: HeroCatalogRow } {
  if (root === null || typeof root !== "object" || Array.isArray(root)) return {}
  const out: { [id: string]: HeroCatalogRow } = {}
  const row = root as { readonly [key: string]: unknown }
  for (const id of Object.keys(row)) {
    const item = row[id]
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const rec = item as { readonly [key: string]: unknown }
    const lodHigh = rec["lod_high"]
    const lodLow = rec["lod_low"]
    const material = rec["material"]
    const shaHigh = rec["sha_high"]
    const shaLow = rec["sha_low"]
    if (typeof lodHigh !== "string" || typeof lodLow !== "string") continue
    if (typeof material !== "string" || typeof shaHigh !== "string" || typeof shaLow !== "string") {
      continue
    }
    out[id] = {
      lodHigh,
      lodLow,
      quadsHigh: asInt(rec["quads_high"]),
      quadsLow: asInt(rec["quads_low"]),
      material,
      shaHigh,
      shaLow,
    }
  }
  return out
}

/** Lots from generated.placement.reference_layout; only ids present in the hero catalog. */
export function plantHeroes(
  layout: unknown,
  catalog: { readonly [id: string]: HeroCatalogRow },
): readonly HeroLot[] {
  if (!Array.isArray(layout)) return []
  const out: HeroLot[] = []
  for (const item of layout) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const rec = item as { readonly [key: string]: unknown }
    if (typeof rec["id"] !== "string") continue
    const id = rec["id"]
    if (catalog[id] === undefined) continue
    const spanX = asInt(rec["w"])
    const spanZ = asInt(rec["h"])
    if (spanX <= 0n || spanZ <= 0n) continue
    out.push({
      id,
      tileX: asInt(rec["x"]),
      tileY: asInt(rec["y"]),
      spanX,
      spanZ,
    })
  }
  return out
}

export function pickHeroLod(distance: bigint, near: bigint): "high" | "low" {
  if (distance <= near) return "high"
  return "low"
}
