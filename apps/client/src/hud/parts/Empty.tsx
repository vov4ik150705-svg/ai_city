import type { ReactElement } from "react"

export function Empty(props: { readonly textKey: string; readonly text: string }): ReactElement {
  return (
    <p data-key={props.textKey} className="hud-muted">
      {props.text}
    </p>
  )
}
