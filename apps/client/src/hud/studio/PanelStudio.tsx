import type { CSSProperties, ReactElement } from "react"
import type { StringTable } from "../../strings.js"
import type { ClientPack } from "../../packview.js"
import type { HudView } from "../model.js"
import { AgentsWorkspaceLook } from "./AgentsWorkspaceLook.js"
import "../hud.css"
import "./hud-studio.css"
import "./agents-workspace-look.css"

export function PanelStudio(props: { readonly view: HudView; readonly strings: StringTable; readonly pack: ClientPack; readonly style: CSSProperties }): ReactElement {
  return <div data-app="hud-panels" className="hud-root hud-studio" style={props.style}><AgentsWorkspaceLook view={props.view} strings={props.strings} /></div>
}
