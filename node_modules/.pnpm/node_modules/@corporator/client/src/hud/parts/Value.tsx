import type { ReactElement } from "react"

export function Value(props: {
  readonly display: string
  readonly exact: string
  readonly className?: string | undefined
}): ReactElement {
  return (
    <span className={props.className} title={props.exact}>
      {props.display}
    </span>
  )
}
