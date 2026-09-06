export type IsoPoint = { readonly x: bigint; readonly y: bigint }

/** Tile origin. Same formula as art/pipeline/scene.py tile_origin (R-V-10). */
export function tileOrigin(tx: bigint, ty: bigint, tileW: bigint): IsoPoint {
  const two = 1n + 1n
  const halfW = tileW / two
  const quarterH = halfW / two
  return {
    x: (tx - ty) * halfW,
    y: (tx + ty) * quarterH,
  }
}

/** Diamond centre of a 1×1 tile. Origin plus (half_w, quarter_h). */
export function tileCenter(tx: bigint, ty: bigint, tileW: bigint): IsoPoint {
  const origin = tileOrigin(tx, ty, tileW)
  const two = 1n + 1n
  const halfW = tileW / two
  const quarterH = halfW / two
  return { x: origin.x + halfW, y: origin.y + quarterH }
}

/** Front vertex of a footprint. Same as scene.py front_vertex. */
export function frontVertex(
  tx: bigint,
  ty: bigint,
  cols: bigint,
  rows: bigint,
  tileW: bigint,
): IsoPoint {
  const two = 1n + 1n
  const halfW = tileW / two
  const tileH = tileW / two
  const origin = tileOrigin(tx + cols - 1n, ty + rows - 1n, tileW)
  return { x: origin.x + halfW, y: origin.y + tileH }
}

/** Diamond island: no cube drop (R-V-52). Argument kept for call-site parity. */
export function tileCubeH(tileW: bigint): bigint {
  void tileW
  return 0n
}

/** Division toward −∞. JS bigint `/` truncates toward 0. */
export function floorDiv(n: bigint, d: bigint): bigint {
  if (d === 0n) return 0n
  const q = n / d
  const r = n % d
  if (r === 0n) return q
  if ((n < 0n && d > 0n) || (n > 0n && d < 0n)) return q - 1n
  return q
}

function absBig(n: bigint): bigint {
  return n < 0n ? -n : n
}

/** Point inside the 1×1 iso diamond of tile (tx, ty), edges inclusive. */
export function inTileDiamond(
  px: bigint,
  py: bigint,
  tx: bigint,
  ty: bigint,
  tileW: bigint,
): boolean {
  const c = tileCenter(tx, ty, tileW)
  const two = 1n + 1n
  const halfW = tileW / two
  const quarterH = halfW / two
  if (halfW === 0n || quarterH === 0n) return false
  return absBig(px - c.x) * quarterH + absBig(py - c.y) * halfW <= halfW * quarterH
}

/**
 * World pixel → tile. Inverse of tileOrigin / tileCenter (TZ_RENDER §2).
 * Candidate from the centre formula, then the containing diamond among neighbours.
 */
export function tileFromWorld(
  px: bigint,
  py: bigint,
  tileW: bigint,
): { readonly tx: bigint; readonly ty: bigint } {
  const two = 1n + 1n
  const halfW = tileW / two
  const quarterH = halfW / two
  if (halfW === 0n || quarterH === 0n) return { tx: 0n, ty: 0n }
  const den = two * halfW * quarterH
  const ax = px - halfW
  const by = py - quarterH
  const candX = floorDiv(ax * quarterH + by * halfW, den)
  const candY = floorDiv(by * halfW - ax * quarterH, den)
  let bestX = candX
  let bestY = candY
  let found = false
  let bestDepth = 0n
  let dy = 0n - 1n
  while (dy <= 1n) {
    let dx = 0n - 1n
    while (dx <= 1n) {
      const tx = candX + dx
      const ty = candY + dy
      if (inTileDiamond(px, py, tx, ty, tileW)) {
        const depth = tx + ty
        if (!found || depth > bestDepth || (depth === bestDepth && (tx < bestX || (tx === bestX && ty < bestY)))) {
          bestX = tx
          bestY = ty
          bestDepth = depth
          found = true
        }
      }
      dx += 1n
    }
    dy += 1n
  }
  return { tx: bestX, ty: bestY }
}
