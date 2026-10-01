export type Pt = { readonly x: number; readonly y: number }
export type Rand = () => number

/** One pen for the whole handbook: every stroke uses these limits, so the imperfection stays consistent. */
export const PEN = {
  endJitter: 0.45,
  bowPerLength: 0.009,
  bowMax: 1.6,
  cornerOvershoot: 1.8,
  pointJitter: 0.6,
  headLength: 8,
  headSpread: 0.42,
  dash: 6,
  gap: 5,
  /** Guide lines (lane separators, lifelines) sit behind the drawing: short dashes, wide gaps. */
  guideDash: 3,
  guideGap: 6,
} as const

export function hashString(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** mulberry32: the same key always draws the same stroke. */
export function seeded(key: string): Rand {
  let state = hashString(key)
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function jitter(rand: Rand, amp: number): number {
  return (rand() * 2 - 1) * amp
}

function n(value: number): string {
  return (Math.round(value * 10) / 10).toString()
}

function stroke(a: Pt, b: Pt, rand: Rand, overshoot: number): string {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  const lead = overshoot * rand()
  const tail = overshoot * rand()
  const s = { x: a.x - ux * lead - uy * jitter(rand, PEN.endJitter), y: a.y - uy * lead + ux * jitter(rand, PEN.endJitter) }
  const e = { x: b.x + ux * tail - uy * jitter(rand, PEN.endJitter), y: b.y + uy * tail + ux * jitter(rand, PEN.endJitter) }
  const bow = Math.min(length * PEN.bowPerLength, PEN.bowMax)
  const b1 = jitter(rand, bow)
  const b2 = b1 * 0.6 + jitter(rand, bow * 0.5)
  const c1 = { x: s.x + (e.x - s.x) / 3 - uy * b1, y: s.y + (e.y - s.y) / 3 + ux * b1 }
  const c2 = { x: s.x + ((e.x - s.x) * 2) / 3 - uy * b2, y: s.y + ((e.y - s.y) * 2) / 3 + ux * b2 }
  return `M${n(s.x)} ${n(s.y)}C${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(e.x)} ${n(e.y)}`
}

export function lineD(a: Pt, b: Pt, rand: Rand): string {
  return stroke(a, b, rand, 0)
}

export function rectD(x: number, y: number, w: number, h: number, rand: Rand): string {
  const o = PEN.cornerOvershoot
  const tl = { x, y }
  const tr = { x: x + w, y }
  const br = { x: x + w, y: y + h }
  const bl = { x, y: y + h }
  return stroke(tl, tr, rand, o) + stroke(tr, br, rand, o) + stroke(br, bl, rand, o) + stroke(bl, tl, rand, o)
}

/** A smooth pen line through the points (Catmull-Rom), with the inner points nudged by hand. */
export function curveD(points: readonly Pt[], rand: Rand): string {
  const first = points[0]
  const second = points[1]
  if (first === undefined || second === undefined) return ""
  if (points.length === 2) return stroke(first, second, rand, 0)
  const last = points.length - 1
  const pts = points.map((p, i) =>
    i === 0 || i === last ? p : { x: p.x + jitter(rand, PEN.pointJitter), y: p.y + jitter(rand, PEN.pointJitter) },
  )
  let d = `M${n(first.x)} ${n(first.y)}`
  for (let i = 0; i < last; i++) {
    const p1 = pts[i] ?? first
    const p2 = pts[i + 1] ?? p1
    const p0 = pts[i - 1] ?? p1
    const p3 = pts[i + 2] ?? p2
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    d += `C${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(p2.x)} ${n(p2.y)}`
  }
  return d
}

/** A narrow open arrowhead at `tip`, pointing away from `from`. */
export function headD(tip: Pt, from: Pt, rand: Rand): string {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x)
  const length = PEN.headLength + jitter(rand, 1)
  const wing = (side: number) => {
    const a = angle + Math.PI + side * (PEN.headSpread + jitter(rand, 0.06))
    return { x: tip.x + Math.cos(a) * length, y: tip.y + Math.sin(a) * length }
  }
  const left = wing(-1)
  const right = wing(1)
  return `M${n(left.x)} ${n(left.y)}L${n(tip.x)} ${n(tip.y)}L${n(right.x)} ${n(right.y)}`
}

export function dashedD(a: Pt, b: Pt, rand: Rand, dash: number = PEN.dash, gap: number = PEN.gap): string {
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  const at = (t: number) => ({ x: a.x + ((b.x - a.x) * t) / length, y: a.y + ((b.y - a.y) * t) / length })
  let d = ""
  for (let t = 0; t < length; t += dash + gap) {
    const end = Math.min(length, t + dash + jitter(rand, 1))
    if (end > t) d += stroke(at(t), at(end), rand, 0)
  }
  return d
}

/** A loose ellipse whose stroke overlaps its own start, the way a pen closes a circle. */
export function ellipseD(cx: number, cy: number, rx: number, ry: number, rand: Rand): string {
  const start = rand() * Math.PI * 2
  const steps = 12
  const sweep = Math.PI * 2 + 0.35
  const points: Pt[] = []
  for (let k = 0; k <= steps; k++) {
    const theta = start + (sweep * k) / steps
    const wobble = 1 + jitter(rand, 0.025)
    points.push({ x: cx + Math.cos(theta) * rx * wobble, y: cy + Math.sin(theta) * ry * wobble })
  }
  return curveD(points, rand)
}
