import type { ReactElement } from "react"
import { StatusChip, statusKindFromKey } from "./StatusChip.js"

export type StatusBadgeProps = {
  readonly text: string
  readonly textKey: string
}

export function StatusBadge(props: StatusBadgeProps): ReactElement {
  return (
    <StatusChip
      label={props.text}
      labelKey={props.textKey}
      kind={statusKindFromKey(props.textKey)}
      surface="badge"
    />
  )
}
