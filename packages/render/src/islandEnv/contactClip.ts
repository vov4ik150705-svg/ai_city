/** Predicate clip for contact discs. No Three.js — the mesh probe lives in contact.ts. */

const RING = 48
const SEARCH = 8
const MIN_R = 0.12
const EDGE_INSET = 0.94

/** Cosine vs world-up. Cliffs (~0.2) must fail; a 45° bank (0.707) still counts as deck. */
export const DECK_NORMAL_MIN = 0.62
export const DECK_BELOW = 0.35
export const DECK_ABOVE = 0.5

/** True when a downward ray hit is the top deck, not a cliff wall or underside. */
export function isDeckSample(hitY: number, normalY: number, deckY: number): boolean {
  if (normalY < DECK_NORMAL_MIN) return false
  if (hitY < deckY - DECK_BELOW) return false
  if (hitY > deckY + DECK_ABOVE) return false
  return true
}

function ringFits(inside: (x: number, z: number) => boolean, x: number, z: number, radius: number): boolean {
  let d = 0
  while (d < RING) {
    const a = (d / RING) * Math.PI * 2
    if (!inside(x + Math.cos(a) * radius, z + Math.sin(a) * radius)) return false
    d += 1
  }
  return true
}

/** Shrink a disc so every rim sample stays inside. Off-centre hosts become 0. */
export function clipRadiusWithTest(
  inside: (x: number, z: number) => boolean,
  x: number,
  z: number,
  want: number,
): number {
  if (want <= 0) return 0
  if (!inside(x, z)) return 0
  if (ringFits(inside, x, z, want)) return want
  let lo = 0
  let hi = want
  let k = 0
  while (k < SEARCH) {
    const mid = (lo + hi) * 0.5
    if (ringFits(inside, x, z, mid)) lo = mid
    else hi = mid
    k += 1
  }
  if (lo < MIN_R) return 0
  return lo * EDGE_INSET
}
