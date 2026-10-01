import type { ReactElement } from "react"
import type { HudView } from "../model.js"

export function BankPlaque(props: { readonly plaque: HudView["plaque"] }): ReactElement {
  const closed = props.plaque.key === "BANK_CLOSED" || props.plaque.key === "BANK_SUNDAY"
  const tone = closed ? "hud-plaque--warn" : "hud-plaque--ok"
  return (
    <span
      data-key={props.plaque.key}
      data-bank={closed ? "closed" : "open"}
      title={props.plaque.text}
      className={`hud-plaque ${tone}`}
    >
      {props.plaque.text}
    </span>
  )
}
