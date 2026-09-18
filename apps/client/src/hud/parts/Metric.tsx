import type { ReactElement, ReactNode } from "react"

export type HudMetricVariant = "default" | "hero" | "compact"

export function Metric(props: {
  readonly label: string
  readonly labelKey: string
  readonly value: ReactNode
  readonly supporting?: ReactNode
  readonly variant?: HudMetricVariant
}): ReactElement {
  const variant = props.variant ?? "default"
  return (
    <div data-key={props.labelKey} className={`hud-metric-block hud-metric-block--${variant}`}>
      <span className="hud-metric-block__label">{props.label}</span>
      <span className="hud-metric-block__value">{props.value}</span>
      {props.supporting === undefined ? null : (
        <span className="hud-metric-block__supporting">{props.supporting}</span>
      )}
    </div>
  )
}
