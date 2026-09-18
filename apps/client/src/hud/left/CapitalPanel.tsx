import type { ReactElement } from "react"
import type { StringTable } from "../../strings.js"
import type { HudView } from "../model.js"
import { EconomyLook } from "../studio/EconomyLook.js"

export function CapitalPanel(props: {
  readonly view: HudView
  readonly strings: StringTable
  readonly onManageFunds: () => void
  readonly onPayroll: () => void
  readonly onResource: (id: "energy" | "compute") => void
}): ReactElement {
  return (
    <EconomyLook
      view={props.view}
      strings={props.strings}
      onManageFunds={props.onManageFunds}
      onPayroll={props.onPayroll}
      onResource={props.onResource}
    />
  )
}
