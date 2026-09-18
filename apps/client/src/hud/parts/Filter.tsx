import type { ChangeEvent, ReactElement } from "react"

export type HudFilterOption = {
  readonly id: string
  readonly label: string
}

export function Filter(props: {
  readonly label: string
  readonly labelKey: string
  readonly value: string
  readonly options: readonly HudFilterOption[]
  readonly onChange: (value: string) => void
}): ReactElement {
  function change(event: ChangeEvent<HTMLSelectElement>): void {
    props.onChange(event.currentTarget.value)
  }
  return (
    <label className="hud-filter">
      <span data-key={props.labelKey} className="hud-filter__label">
        {props.label}
      </span>
      <select value={props.value} onChange={change} aria-label={props.label}>
        {props.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
