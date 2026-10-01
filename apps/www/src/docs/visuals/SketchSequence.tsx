import type { Sequence } from "../mermaid/sequence"
import { SkArrow, SkEllipse, SkGuide, SkLine } from "../sketch/Sketch"
import { estimateWidth } from "./measure"
import { layoutSequence, SEQUENCE, type Phase, type SequenceRow } from "./sequenceLayout"

const PHASE_BADGE = { x: 30, r: 12, textDx: 22, digitDy: 6 } as const

function Label({ row, x, anchor }: { row: SequenceRow; x: number; anchor: "start" | "middle" | "end" }) {
  return (
    <text className={row.mono ? "sk-mono" : "sk-note"} x={x} y={row.labelY} textAnchor={anchor}>
      {row.lines.map((line, index) => (
        <tspan key={line} x={x} dy={index === 0 ? 0 : SEQUENCE.lineStep}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

export function SketchSequence({ id, sequence, phases, title }: {
  id: string
  sequence: Sequence
  phases: readonly Phase[]
  title: string
}) {
  const s = SEQUENCE
  const layout = layoutSequence(sequence, phases)
  const last = sequence.actors.length - 1

  return (
    <svg
      className="sk-sheet"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-label={title}
    >
      {layout.phases.map((phase) => (
        <g key={phase.number}>
          <SkEllipse
            cx={PHASE_BADGE.x}
            cy={phase.y - PHASE_BADGE.digitDy}
            rx={PHASE_BADGE.r}
            ry={PHASE_BADGE.r}
            seed={`${id}:phase:${phase.number}`}
          />
          <text className="sk-sub" x={PHASE_BADGE.x} y={phase.y} textAnchor="middle">
            {phase.number}
          </text>
          <text className="sk-node" x={PHASE_BADGE.x + PHASE_BADGE.textDx} y={phase.y}>
            {phase.label}
          </text>
        </g>
      ))}

      {sequence.actors.map((actor, index) => {
        const x = layout.actorX[index] ?? s.side
        const half = (estimateWidth(actor.label, "node") * 0.9) / 2
        return (
          <g key={actor.id}>
            <text className="sk-node" x={x} y={s.headY} textAnchor="middle">
              {actor.label}
            </text>
            <SkLine from={{ x: x - half, y: s.headY + 8 }} to={{ x: x + half, y: s.headY + 7 }} seed={`${id}:head:${actor.id}`} />
            <SkGuide from={{ x, y: s.headY + 22 }} to={{ x, y: layout.height - 12 }} seed={`${id}:life:${actor.id}`} />
          </g>
        )
      })}

      {layout.rows.map((row, index) => {
        const { from, to, y, message } = row
        const seed = `${id}:msg:${index}`
        if (message.from === message.to) {
          const dir = (layout.columns.get(message.from) ?? 0) === last ? -1 : 1
          const out = from + dir * s.lifelineGap
          const reach = from + dir * s.loop
          return (
            <g key={seed}>
              <SkArrow
                points={[
                  { x: out, y: y - s.loopHalf },
                  { x: reach, y: y - s.loopHalf },
                  { x: reach, y: y + s.loopHalf },
                  { x: out, y: y + s.loopHalf },
                ]}
                dashed={message.reply}
                seed={seed}
              />
              <Label row={row} x={reach + dir * s.loopText} anchor={dir < 0 ? "end" : "start"} />
            </g>
          )
        }
        const dir = to > from ? 1 : -1
        return (
          <g key={seed}>
            <SkArrow
              points={[
                { x: from + dir * s.lifelineGap, y },
                { x: to - dir * s.lifelineGap, y },
              ]}
              dashed={message.reply}
              seed={seed}
            />
            <Label row={row} x={row.labelX} anchor="middle" />
          </g>
        )
      })}
    </svg>
  )
}
