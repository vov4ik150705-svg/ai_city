import type { ReactElement } from "react"
import { Value } from "../parts/Value.js"

export function CapitalSlot(props: {
  readonly caption: string
  readonly display: string
  readonly exact: string
  readonly captionKey: string
}): ReactElement {
  return (
    <span data-key={props.captionKey} data-id="capital" className="hud-metric hud-metric--hero">
      <span className="hud-metric__k">{props.caption}</span>
      <Value className="hud-metric__v" display={props.display} exact={props.exact} />
    </span>
  )
}
