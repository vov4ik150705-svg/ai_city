import { ART, PEN, type Clock, type Marks, type Pt } from "./guideLayout.js"

const SVG_NS = "http://www.w3.org/2000/svg"

function el(name: string, attrs: Readonly<Record<string, string | number>>): SVGElement {
  const node = document.createElementNS(SVG_NS, name)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
  return node
}

function fmt(n: number): string {
  return n.toFixed(1)
}

// Catmull-Rom through the traced points, emitted as cubic Béziers.
function smoothPath(points: readonly Pt[]): string {
  const first = points[0]
  if (first === undefined) return ""
  let d = `M${fmt(first[0])} ${fmt(first[1])}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    if (p0 === undefined || p1 === undefined || p2 === undefined || p3 === undefined) continue
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(p2[0])} ${fmt(p2[1])}`
  }
  return d
}

function polyline(points: readonly Pt[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${fmt(p[0])} ${fmt(p[1])}`).join(" ")
}

// A ring drawn the way a pen closes a circle: slightly uneven, with a small overshoot.
function penRing(at: Pt, r: number): string {
  const steps = 14
  const start = -1.95
  const sweep = Math.PI * 2 + 0.32
  const pts: Pt[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const a = start + sweep * t
    const rr = r * (1 + 0.035 * Math.sin(a * 2 + 0.6) - 0.03 * t)
    pts.push([at[0] + rr * Math.cos(a), at[1] + rr * Math.sin(a)])
  }
  return smoothPath(pts)
}

function pen(d: string, width: number, extra: Readonly<Record<string, string | number>> = {}): SVGElement {
  return el("path", { d, class: "qg-pen", "stroke-width": width, ...extra })
}

function drawClock(g: SVGElement, clock: Clock): void {
  const [cx, cy] = clock.at
  g.append(el("circle", { cx, cy, r: clock.r, class: "qg-pen-fill" }))
  g.append(pen(penRing(clock.at, clock.r), PEN.ring))
  const ticks: string[] = []
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const r0 = clock.r * 0.7
    const r1 = clock.r * 0.84
    ticks.push(
      `M${fmt(cx + r0 * Math.sin(a))} ${fmt(cy - r0 * Math.cos(a))} L${fmt(cx + r1 * Math.sin(a))} ${fmt(cy - r1 * Math.cos(a))}`,
    )
  }
  g.append(pen(ticks.join(" "), PEN.tick))
  g.append(pen(clock.hands.map((h) => `M${fmt(cx)} ${fmt(cy)} L${fmt(h[0])} ${fmt(h[1])}`).join(" "), PEN.hand))
  g.append(el("circle", { cx, cy, r: PEN.hand * 0.8, class: "qg-pen-dot" }))
  g.append(pen(clock.rays.map(([a, b]) => polyline([a, b])).join(" "), PEN.ray))
}

export function buildMarks(svg: SVGSVGElement, marks: Marks | null): void {
  svg.replaceChildren()
  svg.setAttribute("viewBox", `0 0 ${ART.naturalW} ${ART.naturalH}`)
  if (marks === null) return

  const defs = el("defs", {})
  const filter = el("filter", { id: "qg-hand", x: "-5%", y: "-5%", width: "110%", height: "110%" })
  filter.append(
    el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.045", numOctaves: 2, seed: 7, result: "n" }),
    el("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: 2.4, xChannelSelector: "R", yChannelSelector: "G" }),
  )
  defs.append(filter)
  svg.append(defs)

  const halo = el("g", { class: "qg-halo" })
  const ink = el("g", { class: "qg-ink", filter: "url(#qg-hand)" })
  const dash = `${PEN.dash} ${PEN.gap}`

  for (const s of marks.strokes) {
    const d = smoothPath(s.points)
    const width = s.dashed ? PEN.dashed : PEN.solid
    const pattern: Readonly<Record<string, string>> = s.dashed ? { "stroke-dasharray": dash } : {}
    halo.append(pen(d, width + PEN.halo, pattern))
    ink.append(pen(d, width, pattern))
    if (s.head !== null) {
      const h = polyline(s.head)
      halo.append(pen(h, PEN.head + PEN.halo))
      ink.append(pen(h, PEN.head))
    }
  }

  if (marks.clock !== null) drawClock(ink, marks.clock)

  for (const b of marks.badges) {
    ink.append(el("circle", { cx: b.at[0], cy: b.at[1], r: b.r, class: "qg-pen-fill" }))
    ink.append(pen(penRing(b.at, b.r), PEN.ring))
  }

  const type = el("g", { class: "qg-type" })
  for (const b of marks.badges) {
    const t = el("text", {
      class: "qg-badge-num",
      "font-size": PEN.badgeSize,
      transform: `translate(${b.at[0]} ${b.at[1]}) skewX(${PEN.slant})`,
    })
    t.textContent = b.label
    type.append(t)
  }
  for (const l of marks.labels) {
    const attrs = {
      "font-size": PEN.labelSize,
      transform: `translate(${l.at[0]} ${l.at[1]}) rotate(${l.rotate}) skewX(${PEN.slant})`,
    }
    const back = el("text", { ...attrs, class: "qg-label qg-label--halo", "stroke-width": PEN.labelHalo })
    const front = el("text", { ...attrs, class: "qg-label", "stroke-width": PEN.labelWeight })
    back.textContent = l.text
    front.textContent = l.text
    type.append(back, front)
  }

  svg.append(halo, ink, type)
}
