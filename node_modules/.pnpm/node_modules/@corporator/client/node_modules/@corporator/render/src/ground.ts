export function cellAt(map: readonly string[], x: bigint, y: bigint): string {
  const row = map[Number(y)]
  if (row === undefined) return ""
  const xi = Number(x)
  if (xi < 0 || xi >= row.length) return ""
  return row[xi] ?? ""
}

export type SceneObject = {
  readonly id: string
  readonly tileX: bigint
  readonly tileY: bigint
  readonly ox?: bigint
  readonly oy?: bigint
  readonly lift?: bigint
  readonly wPx?: bigint
  readonly hPx?: bigint
  readonly flip?: bigint
}

function asInt(value: unknown): bigint {
  if (typeof value === "bigint") return value
  if (typeof value === "number" && Number.isInteger(value)) {
    return BigInt(value)
  }
  return 0n
}

function asTile(value: unknown): bigint | undefined {
  if (typeof value === "bigint") return value
  if (typeof value === "number" && Number.isInteger(value)) {
    return BigInt(value)
  }
  return undefined
}

export function loadScene(root: unknown): {
  readonly legend: { readonly [ch: string]: string }
  readonly map: readonly string[]
  readonly objects: readonly SceneObject[]
} {
  if (root === null || typeof root !== "object" || Array.isArray(root)) {
    return { legend: {}, map: [], objects: [] }
  }
  const row = root as { readonly [key: string]: unknown }
  const legendIn = row["legend"]
  const legend: { [ch: string]: string } = {}
  if (legendIn !== null && typeof legendIn === "object" && !Array.isArray(legendIn)) {
    const obj = legendIn as { readonly [key: string]: unknown }
    for (const key of Object.keys(obj)) {
      const v = obj[key]
      if (typeof v === "string") legend[key] = v
    }
  }
  const mapIn = row["map"]
  const map: string[] = []
  if (Array.isArray(mapIn)) {
    for (const line of mapIn) {
      if (typeof line === "string") map.push(line)
    }
  }
  const objects: SceneObject[] = []
  const objIn = row["objects"]
  if (Array.isArray(objIn)) {
    const two = 1 + 1
    for (const item of objIn) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) continue
      const o = item as { readonly [key: string]: unknown }
      const tile = o["tile"]
      if (!Array.isArray(tile) || tile.length < two) continue
      const tx = asTile(tile[0])
      const ty = asTile(tile[1])
      if (tx === undefined || ty === undefined) continue
      if (typeof o["id"] !== "string") continue
      objects.push({
        id: o["id"],
        tileX: tx,
        tileY: ty,
        ox: asInt(o["ox"]),
        oy: asInt(o["oy"]),
        lift: asInt(o["lift"]),
        wPx: asInt(o["w_px"]),
        hPx: asInt(o["h_px"]),
        flip: asInt(o["flip"]),
      })
    }
  }
  return { legend, map, objects }
}

export function isShore(map: readonly string[], tx: bigint, ty: bigint): boolean {
  const ch = cellAt(map, tx, ty)
  if (ch === "" || ch === "~") return false
  const n = cellAt(map, tx, ty - 1n)
  const s = cellAt(map, tx, ty + 1n)
  const e = cellAt(map, tx + 1n, ty)
  const w = cellAt(map, tx - 1n, ty)
  return n === "~" || s === "~" || e === "~" || w === "~" || n === "" || s === "" || e === "" || w === ""
}

export function isRoadCell(map: readonly string[], x: bigint, y: bigint): boolean {
  const ch = cellAt(map, x, y)
  return ch === "r" || ch === "c"
}

/** 4-bit NESW mask; bit0=N, bit1=E, bit2=S, bit3=W. Same as tiles.neighbor_mask. */
export function neighborMask(map: readonly string[], tx: bigint, ty: bigint): bigint {
  const one = 1n
  const two = one + one
  const four = two + two
  const eight = four + four
  let mask = 0n
  if (isRoadCell(map, tx, ty - 1n)) mask += one
  if (isRoadCell(map, tx + 1n, ty)) mask += two
  if (isRoadCell(map, tx, ty + 1n)) mask += four
  if (isRoadCell(map, tx - 1n, ty)) mask += eight
  return mask
}

function pickAutotile(table: readonly string[], mask: bigint, fallback: string): string {
  const id = table[Number(mask)]
  if (id === undefined || id.length === 0) return fallback
  return id
}

/** Same 16-way pick as art/pipeline/tiles.py road_sprite. Table from the pack. */
export function roadSprite(
  map: readonly string[],
  tx: bigint,
  ty: bigint,
  table: readonly string[],
): string {
  return pickAutotile(table, neighborMask(map, tx, ty), "road_plaza")
}

/** Curb faces adjacent road/crosswalk. Table from the pack. */
export function sidewalkSprite(
  map: readonly string[],
  tx: bigint,
  ty: bigint,
  table: readonly string[],
): string {
  return pickAutotile(table, neighborMask(map, tx, ty), "sidewalk")
}

export function topSpriteId(
  map: readonly string[],
  tx: bigint,
  ty: bigint,
  sprites: { readonly [ch: string]: string },
  roadTable: readonly string[],
  walkTable: readonly string[],
): string {
  const ch = cellAt(map, tx, ty)
  if (ch === "r") return roadSprite(map, tx, ty, roadTable)
  if (ch === "s") return sidewalkSprite(map, tx, ty, walkTable)
  const hit = sprites[ch]
  if (hit !== undefined && hit.length > 0) return hit
  return "island_block"
}

export type PadFoot = {
  readonly tx: bigint
  readonly ty: bigint
  readonly cols: bigint
  readonly rows: bigint
}

export function padFootprints(
  objects: readonly SceneObject[],
  frames: { readonly [id: string]: { readonly kind: string; readonly cols: bigint; readonly rows: bigint } },
  skip: readonly string[],
): readonly PadFoot[] {
  const blocked: { [id: string]: true } = {}
  for (const id of skip) blocked[id] = true
  const out: PadFoot[] = []
  for (const obj of objects) {
    if (blocked[obj.id] === true) continue
    const fr = frames[obj.id]
    if (fr === undefined) continue
    if (fr.kind !== "building") continue
    const cols = fr.cols > 0n ? fr.cols : 1n
    const rows = fr.rows > 0n ? fr.rows : 1n
    out.push({ tx: obj.tileX, ty: obj.tileY, cols, rows })
  }
  return out
}

export function tileOnPad(tx: bigint, ty: bigint, pads: readonly PadFoot[]): boolean {
  for (const pad of pads) {
    if (tx < pad.tx) continue
    if (ty < pad.ty) continue
    if (tx >= pad.tx + pad.cols) continue
    if (ty >= pad.ty + pad.rows) continue
    return true
  }
  return false
}

export function groundTopId(
  map: readonly string[],
  tx: bigint,
  ty: bigint,
  sprites: { readonly [ch: string]: string },
  roadTable: readonly string[],
  walkTable: readonly string[],
  padId: string,
  pads: readonly PadFoot[],
): string {
  void padId
  void pads
  return topSpriteId(map, tx, ty, sprites, roadTable, walkTable)
}

export function lowerSpriteId(
  map: readonly string[],
  tx: bigint,
  ty: bigint,
  dirt: string,
  cliff: string,
  rock: string,
): string {
  const ch = cellAt(map, tx, ty)
  if (ch === "w") return rock
  if (isShore(map, tx, ty)) return cliff
  return dirt
}
