import { SkArrow, SkEllipse, SkLine } from "../sketch/Sketch"
import { estimateWidth } from "./measure"
import { NoteText } from "./SheetText"
import { STATE_SHEET, type StateLayout } from "./stateLayout"

const START_DOT = 5
const HARD_RULE_DY = 7

/** Draws a checked state sheet. Call `checkStateLayout` first: this component trusts the layout. */
export function SketchState({ id, layout, title }: { id: string; layout: StateLayout; title: string }) {
  const start = layout.start
  const dot = start?.points[0]
  return (
    <svg
      className="sk-sheet"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-label={title}
    >
      {start === undefined || dot === undefined ? null : (
        <g>
          <SkEllipse cx={dot.x} cy={dot.y} rx={START_DOT} ry={START_DOT} seed={`${id}:start:dot`} />
          <SkArrow points={start.points} seed={`${id}:start`} />
        </g>
      )}

      {layout.transitions.map((t) => {
        const key = `${t.from}>${t.to}`
        return (
          <g key={key}>
            <SkArrow points={t.points} seed={`${id}:transition:${key}`} />
            <NoteText spot={t.label} lines={t.lines} />
          </g>
        )
      })}

      {Object.entries(layout.states).map(([stateId, word]) => {
        const half = estimateWidth(word.title, "node") / 2
        return (
          <g key={stateId}>
            <text className={word.hard === true ? "sk-node sk-node--hard" : "sk-node"} x={word.x} y={word.y} textAnchor="middle">
              {word.title}
            </text>
            {word.hard === true ? (
              <SkLine
                from={{ x: word.x - half, y: word.y + HARD_RULE_DY }}
                to={{ x: word.x + half, y: word.y + HARD_RULE_DY }}
                seed={`${id}:hard:${stateId}`}
                tone="accent"
              />
            ) : null}
            {word.sub === undefined ? null : (
              <text
                className={word.sub.face === "mono" ? "sk-mono" : "sk-sub"}
                x={word.x}
                y={word.y + STATE_SHEET.subDy}
                textAnchor="middle"
              >
                {word.sub.text}
              </text>
            )}
          </g>
        )
      })}

      {layout.notes.map((note, index) => (
        <NoteText key={index} spot={note.spot} lines={note.lines} />
      ))}
    </svg>
  )
}
