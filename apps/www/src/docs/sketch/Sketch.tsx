import { curveD, dashedD, ellipseD, headD, lineD, PEN, rectD, seeded, type Pt } from "./pen"

type Tone = "ink" | "muted" | "accent"

function strokeClass(tone: Tone): string {
  return `sk-stroke sk-stroke--${tone}`
}

export function SkRect({ x, y, w, h, seed, tone = "ink" }: {
  x: number
  y: number
  w: number
  h: number
  seed: string
  tone?: Tone
}) {
  return <path className={strokeClass(tone)} d={rectD(x, y, w, h, seeded(seed))} />
}

export function SkEllipse({ cx, cy, rx, ry, seed, tone = "ink" }: {
  cx: number
  cy: number
  rx: number
  ry: number
  seed: string
  tone?: Tone
}) {
  return <path className={strokeClass(tone)} d={ellipseD(cx, cy, rx, ry, seeded(seed))} />
}

export function SkLine({ from, to, seed, dashed = false, tone = "ink" }: {
  from: Pt
  to: Pt
  seed: string
  dashed?: boolean
  tone?: Tone
}) {
  const rand = seeded(seed)
  return <path className={strokeClass(tone)} d={dashed ? dashedD(from, to, rand) : lineD(from, to, rand)} />
}

/** A lane separator or lifeline: a faint fine-dashed line that stays behind the drawing. */
export function SkGuide({ from, to, seed }: { from: Pt; to: Pt; seed: string }) {
  return (
    <path
      className="sk-stroke sk-stroke--muted sk-stroke--guide"
      d={dashedD(from, to, seeded(seed), PEN.guideDash, PEN.guideGap)}
    />
  )
}

/** An arrow along the points; the head sits on the last point, a second head on the first when `both`. */
export function SkArrow({ points, seed, dashed = false, both = false, tone = "ink" }: {
  points: readonly Pt[]
  seed: string
  dashed?: boolean
  both?: boolean
  tone?: Tone
}) {
  const rand = seeded(seed)
  const tip = points[points.length - 1]
  const beforeTip = points[points.length - 2]
  const start = points[0]
  const afterStart = points[1]
  if (tip === undefined || beforeTip === undefined || start === undefined || afterStart === undefined) return null
  let shaft = ""
  if (dashed) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]
      const b = points[i + 1]
      if (a !== undefined && b !== undefined) shaft += dashedD(a, b, rand)
    }
  } else {
    shaft = curveD(points, rand)
  }
  return (
    <g className={strokeClass(tone)}>
      <path d={shaft} />
      <path d={headD(tip, beforeTip, rand)} />
      {both ? <path d={headD(start, afterStart, rand)} /> : null}
    </g>
  )
}

/** A hand-drawn horizontal rule for HTML: stretches to its box, keeps a constant pen width. */
export function HandRule({ seed, tone = "ink", className }: { seed: string; tone?: Tone; className?: string }) {
  const rand = seeded(seed)
  const rise = (rand() - 0.5) * 1.6
  const d = lineD({ x: 0, y: 3 }, { x: 100, y: 3 + rise }, rand)
  return (
    <svg
      className={className === undefined ? "hb-hand-rule" : `hb-hand-rule ${className}`}
      viewBox="0 0 100 6"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className={strokeClass(tone)} d={d} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function HandVRule({ seed, className }: { seed: string; className?: string }) {
  const d = lineD({ x: 3, y: 0 }, { x: 3, y: 100 }, seeded(seed))
  return (
    <svg
      className={className === undefined ? "hb-hand-vrule" : `hb-hand-vrule ${className}`}
      viewBox="0 0 6 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className={strokeClass("ink")} d={d} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
