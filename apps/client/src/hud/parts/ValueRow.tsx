import type { ReactElement, ReactNode } from "react"
import type { FieldView } from "../fields.js"
import { HudIcon, type HudGlyph } from "./HudIcon.js"
import { Value } from "./Value.js"

export function ExactAmount(props: {
  readonly display: string
  readonly exact: string
  readonly className?: string | undefined
}): ReactElement {
  return <Value className={props.className} display={props.display} exact={props.exact} />
}

export function FieldValue(props: {
  readonly field: FieldView
  readonly readyClassName?: string
  readonly missingClassName?: string
}): ReactElement {
  const field = props.field
  switch (field.kind) {
    case "ready": {
      const readyClassName = props.readyClassName
      if (readyClassName === undefined) {
        return <ExactAmount display={field.text} exact={field.exact} />
      }
      return <ExactAmount className={readyClassName} display={field.text} exact={field.exact} />
    }
    case "loading":
    case "stale":
    case "unavailable":
    case "error": {
      const missingClassName = props.missingClassName
      return (
        <span
          data-key={field.key}
          data-field-kind={field.kind}
          className={missingClassName === undefined ? "hud-unavailable" : missingClassName}
        >
          {field.text}
        </span>
      )
    }
    default: {
      const miss: never = field.kind
      void miss
      const missingClassName = props.missingClassName
      return (
        <span data-key={field.key} className={missingClassName === undefined ? "hud-unavailable" : missingClassName}>
          {field.text}
        </span>
      )
    }
  }
}

export function ValueRow(props: {
  readonly label: string
  readonly labelKey: string
  readonly field: FieldView
  readonly tone?: "ok" | "bad" | "warn"
}): ReactElement {
  const tone = props.tone === undefined || props.tone === "ok" ? "" : ` hud-row--${props.tone}`
  return (
    <div data-key={props.labelKey} data-field-kind={props.field.kind} className={`hud-row${tone}`}>
      <span className="hud-muted">{props.label}</span>
      <FieldValue field={props.field} readyClassName="hud-metric__v" />
    </div>
  )
}

export function MetricRow(props: {
  readonly id?: string
  readonly label: string
  readonly labelKey: string
  readonly field: FieldView
  readonly glyph?: HudGlyph
  readonly tone?: "ok" | "bad" | "warn"
  readonly supporting?: ReactNode
}): ReactElement {
  const tone = props.tone === undefined || props.tone === "ok" ? "" : ` hud-row--${props.tone}`
  const glyph = props.glyph
  return (
    <div
      data-key={props.labelKey}
      data-field-kind={props.field.kind}
      {...(props.id === undefined ? {} : { "data-stat": props.id })}
      className={`hud-stat hud-row${tone}${glyph === undefined ? " hud-stat--plain" : ""}`}
    >
      {glyph === undefined ? (
        <span className="hud-stat__icon" aria-hidden="true" />
      ) : (
        <span className="hud-stat__icon">
          <HudIcon glyph={glyph} />
        </span>
      )}
      <span className="hud-stat__k hud-muted">{props.label}</span>
      <span className="hud-stat__value">
        <FieldValue
          field={props.field}
          readyClassName="hud-stat__v hud-metric__v"
          missingClassName="hud-stat__v hud-unavailable"
        />
        {props.supporting === undefined ? null : <span className="hud-stat__supporting">{props.supporting}</span>}
      </span>
    </div>
  )
}
