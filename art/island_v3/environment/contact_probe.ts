/** Adversarial probe for contact-AO deck clipping. Not a Vitest construction test. */

import { DECK_ABOVE, DECK_BELOW, DECK_NORMAL_MIN, clipRadiusWithTest, isDeckSample } from "./contactClip.ts"

function circleDeck(radius: number): (x: number, z: number) => boolean {
  const r2 = radius * radius
  return (x, z) => x * x + z * z <= r2
}

const inside = circleDeck(10)

const interior = clipRadiusWithTest(inside, 0, 0, 4)
if (interior !== 4) throw new Error("interior disc should stay 4, got " + String(interior))

const edge = clipRadiusWithTest(inside, 8, 0, 5)
if (!(edge > 0 && edge < 2.05)) {
  throw new Error("edge disc must shrink under the remaining 2 units, got " + String(edge))
}

const off = clipRadiusWithTest(inside, 20, 0, 4)
if (off !== 0) throw new Error("off-deck host should be 0, got " + String(off))

const zero = clipRadiusWithTest(inside, 0, 0, 0)
if (zero !== 0) throw new Error("want 0 should stay 0")

const leak = 8 + edge
if (leak >= 10) throw new Error("clipped rim still leaves the deck: " + String(leak))

function deckWithBite(
  radius: number,
  minDist: number,
  a0: number,
  a1: number,
): (x: number, z: number) => boolean {
  const r2 = radius * radius
  return (x, z) => {
    const d2 = x * x + z * z
    if (d2 > r2) return false
    const dist = Math.sqrt(d2)
    if (dist <= minDist) return true
    const a = Math.atan2(z, x)
    if (a > a0 && a < a1) return false
    return true
  }
}

const bitten = clipRadiusWithTest(deckWithBite(10, 6, 0.18, 0.35), 0, 0, 8)
if (!(bitten > 0 && bitten <= 6 * 0.94 + 0.02)) {
  throw new Error("12-degree rim bite must shrink the disc, got " + String(bitten))
}

if (!isDeckSample(0, 1, 0)) throw new Error("flat deck hit must pass")
if (isDeckSample(0, 0.2, 0)) throw new Error("cliff wall (normal.y 0.2) must fail")
if (isDeckSample(0, DECK_NORMAL_MIN - 0.01, 0)) throw new Error("just-under deck cosine must fail")
if (!isDeckSample(0, DECK_NORMAL_MIN, 0)) throw new Error("deck cosine floor must pass")
if (isDeckSample(0 - (DECK_BELOW + 0.05), 1, 0)) throw new Error("cliff ledge below deck band must fail")
if (!isDeckSample(0 - (DECK_BELOW - 0.01), 1, 0)) throw new Error("hit inside lower deck band must pass")
if (isDeckSample(DECK_ABOVE + 0.05, 1, 0)) throw new Error("hit above deck band must fail")
if (!isDeckSample(DECK_ABOVE - 0.05, 1, 0)) throw new Error("hit inside upper deck band must pass")

console.log("contact clip: interior=" + String(interior) + " edge=" + String(edge) + " off=" + String(off))
