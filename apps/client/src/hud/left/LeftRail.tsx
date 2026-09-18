import type { ReactElement } from "react"
import type { StringTable } from "../../strings.js"
import type { HudView } from "../model.js"
import { CapitalPanel } from "./CapitalPanel.js"

export function LeftRail(props: {
  readonly view: HudView
  readonly strings: StringTable
  readonly onManageFunds: () => void
  readonly onPayroll: () => void
  readonly onResource: (id: "energy" | "compute") => void
}): ReactElement {
  return (
    <aside data-surface="left_panel" className="hud-col hud-col--left">
      <CapitalPanel
        view={props.view}
        strings={props.strings}
        onManageFunds={props.onManageFunds}
        onPayroll={props.onPayroll}
        onResource={props.onResource}
      />
    </aside>
  )
}
