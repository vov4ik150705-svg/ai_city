import type { ReactElement } from "react"
import type { StatusRowView } from "../fields.js"
import { glyphForStatus } from "./HudIcon.js"
import { MetricRow } from "./ValueRow.js"

export { MetricRow } from "./ValueRow.js"

export function StatRow(props: { readonly row: StatusRowView }): ReactElement {
  const row = props.row
  return (
    <MetricRow
      id={row.id}
      label={row.label}
      labelKey={row.key}
      field={row.field}
      glyph={glyphForStatus(row.id)}
      tone={row.tone}
    />
  )
}
