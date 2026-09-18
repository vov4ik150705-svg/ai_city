import type { ReactElement, ReactNode } from "react"
import { isReadyField, type FieldView } from "../fields.js"
import { ExactAmount } from "./ValueRow.js"

export function Facts(props: { readonly children: ReactNode }): ReactElement {
  return <dl className="hud-facts">{props.children}</dl>
}

export function FactRow(props: {
  readonly label: string
  readonly labelKey: string
  readonly field: FieldView
}): ReactElement {
  const field = props.field
  if (!isReadyField(field)) {
    return (
      <div className="hud-facts__row" data-key={props.labelKey} data-field-kind={field.kind}>
        <dt className="hud-card__label">{props.label}</dt>
        <dd data-key={field.key} data-field-kind={field.kind} className="hud-unavailable">
          {field.text}
        </dd>
      </div>
    )
  }
  return (
    <div className="hud-facts__row" data-key={props.labelKey} data-field-kind={field.kind}>
      <dt className="hud-card__label">{props.label}</dt>
      <dd data-key={field.key}>
        <ExactAmount className="hud-facts__v" display={field.text} exact={field.exact} />
      </dd>
    </div>
  )
}

export function FactLine(props: {
  readonly label: string
  readonly labelKey: string
  readonly valueKey: string
  readonly missing?: boolean
  readonly children: ReactNode
}): ReactElement {
  const missing = props.missing === true
  return (
    <div className="hud-facts__row" data-key={props.labelKey}>
      <dt className="hud-card__label">{props.label}</dt>
      <dd data-key={props.valueKey} className={missing ? "hud-unavailable" : undefined}>
        {props.children}
      </dd>
    </div>
  )
}
