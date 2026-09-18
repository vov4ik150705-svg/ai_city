import type { CSSProperties, ReactElement, ReactNode } from "react"
import { islandChromeVisible } from "./selection.js"

export function HudShell(props: {
  readonly style: CSSProperties
  readonly sceneRoute: string
  readonly sceneMode: "live" | "stub"
  readonly narrow: boolean
  readonly drawer: string
  readonly selected: string
  readonly transactionHold: boolean
  readonly adapterStatus: string
  readonly adapterCode: string
  readonly scene: ReactNode
  readonly chrome: ReactNode
  readonly selection: ReactNode
  readonly workspace: ReactNode
  readonly feedback: ReactNode
}): ReactElement {
  return (
    <div
      data-app="corporator"
      className="hud-root"
      tabIndex={-1}
      style={props.style}
      data-scene-route={props.sceneRoute}
      data-island-chrome={islandChromeVisible(props.sceneRoute.length > 0) ? "1" : "0"}
      data-scene-mode={props.sceneMode}
      data-narrow={props.narrow ? "1" : "0"}
      data-drawer={props.drawer}
      data-selected={props.selected}
      data-txn-hold={props.transactionHold ? "1" : "0"}
      data-adapter-status={props.adapterStatus}
      data-adapter-code={props.adapterCode}
    >
      {props.scene}
      <div className="hud-overlay" data-layer="chrome">
        {props.chrome}
      </div>
      <div className="hud-layer hud-layer--selection" data-layer="selection">
        {props.selection}
      </div>
      <div className="hud-layer hud-layer--workspace" data-layer="workspace">
        {props.workspace}
      </div>
      <div className="hud-layer hud-layer--feedback" data-layer="feedback">
        {props.feedback}
      </div>
    </div>
  )
}
