import type { ReactElement } from "react"
import { FactLine } from "./Facts.js"
import { groupDigits } from "./si.js"

export function PackCost(props: {
  readonly amount: bigint | undefined
  readonly label: string
  readonly unavailable: string
  readonly unit?: string
}): ReactElement {
  const missing = props.amount === undefined
  const unit = props.unit
  return (
    <FactLine
      label={props.label}
      labelKey="UI_CAPITAL_COST"
      valueKey={missing ? "UI_UNAVAILABLE" : "UI_CAPITAL_COST"}
      missing={missing}
    >
      {missing || props.amount === undefined ? (
        <span data-key="UI_UNAVAILABLE">{props.unavailable}</span>
      ) : (
        <span data-exact={props.amount.toString()}>
          {groupDigits(props.amount)}
          {unit === undefined || unit.length === 0 ? "" : ` ${unit}`}
        </span>
      )}
    </FactLine>
  )
}
