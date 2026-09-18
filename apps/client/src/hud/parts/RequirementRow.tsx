import type { ReactElement, ReactNode } from "react"

export type RequirementState = "met" | "warning" | "failed" | "unavailable"

export function RequirementRow(props: {
  readonly label: string
  readonly labelKey: string
  readonly requiredLabel: string
  readonly availableLabel: string
  readonly required: ReactNode
  readonly available: ReactNode
  readonly state: RequirementState
  readonly stateText: string
  readonly stateKey: string
}): ReactElement {
  return (
    <div data-key={props.labelKey} data-state={props.state} className="hud-requirement">
      <div className="hud-requirement__head">
        <span className="hud-card__label">{props.label}</span>
        <span data-key={props.stateKey} className={`hud-requirement__state hud-requirement__state--${props.state}`}>
          {props.stateText}
        </span>
      </div>
      <div className="hud-requirement__values">
        <span>
          <span className="hud-muted">{props.requiredLabel}</span>
          <strong>{props.required}</strong>
        </span>
        <span>
          <span className="hud-muted">{props.availableLabel}</span>
          <strong>{props.available}</strong>
        </span>
      </div>
    </div>
  )
}
