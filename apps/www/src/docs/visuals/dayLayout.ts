/** A schedule on the city day: a bar from `from` to `to`, in city hours. */
export type DayRow = {
  readonly label: string
  readonly from: number
  readonly to: number
  readonly note: string
}

/** A moment of the day, drawn as a guide through every row, with what happens then. */
export type DayMark = { readonly at: number; readonly lines: readonly string[] }

export type DayLayout = {
  readonly hours: number
  readonly rows: readonly DayRow[]
  readonly marks: readonly DayMark[]
}

export const DAY_SHEET = {
  width: 1160,
  axisLeft: 190,
  axisRight: 1130,
  firstRow: 72,
  row: 72,
  hoursDy: -12,
  noteDy: 26,
  tick: 6,
  axisGap: 20,
  axisLabelDy: 22,
  markNoteDy: 54,
  markNotePad: 8,
  lineStep: 18,
  bottomPad: 20,
} as const

const pad = (value: number) => String(value).padStart(2, "0")

export function clock(hour: number): string {
  return `${pad(hour)}:00`
}

/** The span as the chapter writes it, with an en dash: 08:00–20:00. */
export function span(row: DayRow): string {
  return `${clock(row.from)}–${clock(row.to)}`
}

export function dayX(layout: DayLayout, hour: number): number {
  const s = DAY_SHEET
  return s.axisLeft + ((s.axisRight - s.axisLeft) * hour) / layout.hours
}

export function rowY(index: number): number {
  return DAY_SHEET.firstRow + index * DAY_SHEET.row
}

export function axisY(layout: DayLayout): number {
  return rowY(layout.rows.length - 1) + DAY_SHEET.noteDy + DAY_SHEET.axisGap
}

export function dayHeight(layout: DayLayout): number {
  const s = DAY_SHEET
  const noteLines = Math.max(0, ...layout.marks.map((mark) => mark.lines.length))
  return axisY(layout) + s.markNoteDy + (noteLines - 1) * s.lineStep + s.bottomPad
}

export function checkDayLayout(layout: DayLayout): string[] {
  const problems: string[] = []
  for (const row of layout.rows) {
    if (!(row.from >= 0 && row.from < row.to && row.to <= layout.hours)) problems.push(`row ${row.label} runs outside the day (${span(row)})`)
  }
  for (const mark of layout.marks) {
    if (!(mark.at >= 0 && mark.at <= layout.hours)) problems.push(`mark ${clock(mark.at)} is outside the day`)
    if (mark.lines.length === 0) problems.push(`mark ${clock(mark.at)} says nothing`)
  }
  if (layout.rows.length === 0) problems.push("the day has no rows")
  return problems
}

/** Every line the sheet writes, spans included: the hours are checked against the chapter, not trusted. */
export function dayWords(layout: DayLayout): string[] {
  return [
    clock(0),
    clock(layout.hours),
    ...layout.rows.flatMap((row) => [row.label, span(row), row.note]),
    ...layout.marks.flatMap((mark) => [clock(mark.at), ...mark.lines]),
  ]
}
