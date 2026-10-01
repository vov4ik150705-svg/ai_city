import { SkGuide, SkLine } from "../sketch/Sketch"
import { axisY, clock, DAY_SHEET, dayHeight, dayX, rowY, span, type DayLayout } from "./dayLayout"
import { NoteText } from "./SheetText"

/** Draws a checked city day. Call `checkDayLayout` first: this component trusts the layout. */
export function SketchDay({ id, layout, title }: { id: string; layout: DayLayout; title: string }) {
  const s = DAY_SHEET
  const height = dayHeight(layout)
  const axis = axisY(layout)
  const hours = Array.from({ length: layout.hours + 1 }, (_, hour) => hour)
  const labelled = new Set([0, layout.hours, ...layout.marks.map((mark) => mark.at)])

  return (
    <svg
      className="sk-sheet"
      viewBox={`0 0 ${s.width} ${height}`}
      role="img"
      aria-label={title}
    >
      {layout.marks.map((mark) => (
        <SkGuide
          key={`guide-${mark.at}`}
          from={{ x: dayX(layout, mark.at), y: rowY(0) - s.row / 2 }}
          to={{ x: dayX(layout, mark.at), y: axis }}
          seed={`${id}:mark:${mark.at}`}
        />
      ))}

      {layout.rows.map((row, index) => {
        const y = rowY(index)
        const from = dayX(layout, row.from)
        const to = dayX(layout, row.to)
        return (
          <g key={row.label}>
            <text className="sk-node" x={20} y={y + 6}>
              {row.label}
            </text>
            <SkLine from={{ x: from, y }} to={{ x: to, y }} seed={`${id}:bar:${row.label}`} />
            <SkLine from={{ x: from, y: y - s.tick }} to={{ x: from, y: y + s.tick }} seed={`${id}:open:${row.label}`} />
            <SkLine from={{ x: to, y: y - s.tick }} to={{ x: to, y: y + s.tick }} seed={`${id}:close:${row.label}`} />
            <NoteText spot={{ x: (from + to) / 2, y: y + s.hoursDy, anchor: "middle" }} lines={[span(row)]} />
            <NoteText spot={{ x: (from + to) / 2, y: y + s.noteDy, anchor: "middle" }} lines={[row.note]} />
          </g>
        )
      })}

      <SkLine from={{ x: dayX(layout, 0), y: axis }} to={{ x: dayX(layout, layout.hours), y: axis }} seed={`${id}:axis`} />
      {hours.map((hour) => (
        <SkLine
          key={`tick-${hour}`}
          from={{ x: dayX(layout, hour), y: axis - (labelled.has(hour) ? s.tick : s.tick / 2) }}
          to={{ x: dayX(layout, hour), y: axis + (labelled.has(hour) ? s.tick : s.tick / 2) }}
          seed={`${id}:tick:${hour}`}
        />
      ))}
      {[...labelled].map((hour) => (
        <text key={`clock-${hour}`} className="sk-mono" x={dayX(layout, hour)} y={axis + s.axisLabelDy} textAnchor="middle">
          {clock(hour)}
        </text>
      ))}

      {layout.marks.map((mark) => (
        <NoteText
          key={`note-${mark.at}`}
          spot={{ x: dayX(layout, mark.at) + s.markNotePad, y: axis + s.markNoteDy, anchor: "start" }}
          lines={mark.lines}
        />
      ))}
    </svg>
  )
}
