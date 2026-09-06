import type { ReactElement } from "react"
import { ActionButton } from "../parts/ActionButton.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

export function AgentCardScreen(props: ScreenProps): ReactElement {
  const empty = props.view.agents.length === 0
  return (
    <ScreenFrame id="agent_card" view={props.view} loading={props.loading} empty={empty} onClose={props.onClose}>
      <ul className="hud-list">
        {props.view.agents.map((row) => (
          <li key={row.id} data-key={row.idleKey}>
            {row.idleText}
          </li>
        ))}
      </ul>
      <ActionButton {...props} actionId="agent_set_objective" />
    </ScreenFrame>
  )
}
