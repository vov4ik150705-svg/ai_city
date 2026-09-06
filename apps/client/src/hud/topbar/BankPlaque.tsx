import type { ReactElement } from "react"
import type { HudView } from "../model.js"

export function BankPlaque(props: { readonly plaque: HudView["plaque"] }): ReactElement {
  const warn = props.plaque.key === "BANK_CLOSED" || props.plaque.key === "BANK_SUNDAY"
  const tone = warn ? "hud-plaque--warn" : "hud-plaque--ok"
  return (
    <span data-key={props.plaque.key} className={`hud-plaque ${tone}`}>
      {props.plaque.text}
    </span>
  )
}
