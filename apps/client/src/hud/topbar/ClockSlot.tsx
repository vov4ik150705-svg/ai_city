import type { ReactElement } from "react"

export function ClockSlot(props: { readonly value: string; readonly valueKey: string }): ReactElement {
  return (
    <span data-key={props.valueKey} data-id="clock" className="hud-metric">
      <span className="hud-metric__v">{props.value}</span>
    </span>
  )
}
