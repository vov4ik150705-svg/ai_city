import type { LabelSpot } from "./flowLayout"

export const NOTE_STEP = 18
const SUB_DY = 5

type PenPart = { readonly text: string; readonly sub: boolean }

/** Splits `S_min` into `S` and a subscript `min`, the way the prose typesets $S_{\min}$. */
export function penParts(line: string): PenPart[] {
  const parts: PenPart[] = []
  let rest = line
  for (let match = /(\p{L})_([A-Za-z]+)/u.exec(rest); match !== null; match = /(\p{L})_([A-Za-z]+)/u.exec(rest)) {
    const [whole, base = "", sub = ""] = match
    parts.push({ text: rest.slice(0, match.index) + base, sub: false }, { text: sub, sub: true })
    rest = rest.slice(match.index + whole.length)
  }
  if (rest !== "") parts.push({ text: rest, sub: false })
  return parts
}

/** What the reader sees of a line: the subscript marker is gone. */
export function penText(line: string): string {
  return penParts(line)
    .map((part) => part.text)
    .join("")
}

function PenLine({ line }: { line: string }) {
  let lowered = false
  return (
    <>
      {penParts(line).map((part, index) => {
        const dy = part.sub ? SUB_DY : lowered ? -SUB_DY : undefined
        lowered = part.sub
        return (
          <tspan key={index} dy={dy} className={part.sub ? "sk-subscript" : undefined}>
            {part.text}
          </tspan>
        )
      })}
    </>
  )
}

/** A pen annotation of one or more lines, stacked down from its spot. */
export function NoteText({ spot, lines, className = "sk-note" }: {
  spot: LabelSpot
  lines: readonly string[]
  className?: string
}) {
  return (
    <text className={className} x={spot.x} y={spot.y} textAnchor={spot.anchor}>
      {lines.map((line, index) => (
        <tspan key={line} x={spot.x} y={spot.y + index * NOTE_STEP}>
          <PenLine line={line} />
        </tspan>
      ))}
    </text>
  )
}
