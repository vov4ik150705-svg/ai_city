import type { ReactElement } from "react"
import { exactBigint, type FieldView } from "../fields.js"

export function Progress(props: {
  readonly label: string
  readonly labelKey: string
  readonly valueBps: bigint
  readonly maxBps: bigint
  readonly compact?: boolean
  readonly field?: FieldView
}): ReactElement {
  const field = props.field
  let valueBps = props.valueBps
  if (field !== undefined) {
    const exact = exactBigint(field)
    if (exact === undefined) {
      const compact = props.compact === true
      return (
        <div
          data-key={props.labelKey}
          data-field-kind={field.kind}
          className={compact ? "hud-meter hud-meter--compact" : "hud-meter"}
        >
          {compact ? null : <span className="hud-meter__label">{props.label}</span>}
          <span data-key={field.key} className="hud-unavailable">
            {field.text}
          </span>
        </div>
      )
    }
    valueBps = exact
  }
  const max = props.maxBps <= 0n ? 1n : props.maxBps
  const filled = valueBps > max ? max : valueBps
  const hundred = 10n * 10n
  const pct = (filled * hundred) / max
  const width = `${pct.toString()}%`
  const compact = props.compact === true
  return (
    <div data-key={props.labelKey} className={compact ? "hud-meter hud-meter--compact" : "hud-meter"}>
      {compact ? null : <span className="hud-meter__label">{props.label}</span>}
      <span
        className="hud-meter__track"
        role="meter"
        aria-label={props.label}
        aria-valuemin={0}
        aria-valuemax={Number(max)}
        aria-valuenow={Number(filled)}
      >
        <span className="hud-meter__fill" style={{ width }} />
      </span>
    </div>
  )
}

export const ProgressMeter = Progress
