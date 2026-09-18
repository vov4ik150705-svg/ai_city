import type { ReactElement } from "react"

export function Loading(props: {
  readonly kind: string
  readonly text?: string
  readonly textKey?: string
}): ReactElement {
  const text = props.text === undefined ? "Loading" : props.text
  const textKey = props.textKey
  return (
    <div
      data-loading={props.kind}
      data-state="loading"
      {...(textKey === undefined ? {} : { "data-key": textKey })}
      className="hud-load"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="hud-load__text">{text}</span>
    </div>
  )
}
