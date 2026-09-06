import type { ReactElement } from "react"
import { ActionButton } from "../parts/ActionButton.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

export function AgentsScreen(props: ScreenProps): ReactElement {
  return (
    <ScreenFrame id="agents" view={props.view} loading={props.loading} empty={props.view.agents.length === 0} onClose={props.onClose}>
      <ActionButton {...props} actionId="agents_hire" />
      <ul className="hud-list">
        {props.view.agents.map((row) => (
          <li key={row.id}>
            <button type="button" data-agent={row.id} onClick={() => props.onNavigate("agent_card")}>
              <span data-key={row.idleKey}>{row.idleText}</span>
            </button>
          </li>
        ))}
      </ul>
    </ScreenFrame>
  )
}
