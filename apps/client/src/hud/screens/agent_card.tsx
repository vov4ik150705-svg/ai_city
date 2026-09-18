import type { ReactElement } from "react"
import { lookup } from "../../strings.js"
import { ActionButton } from "../parts/ActionButton.js"
import { AgentCard } from "../parts/AgentCard.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

export function AgentCardScreen(props: ScreenProps): ReactElement {
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const empty = props.view.agents.length === 0
  return (
    <ScreenFrame id="agent_card" view={props.view} loading={props.loading} empty={empty} onClose={props.onClose}>
      <ul className="hud-list">
        {props.view.agents.map((row) => (
          <li key={row.id} data-key={row.idleKey}>
            <AgentCard
              agentId={row.id}
              idleKey={row.idleKey}
              idleText={row.idleText}
              unavailable={t("UI_UNAVAILABLE")}
              manageLabel={t("UI_MANAGE")}
              workerLabel={t("UI_BUILDING_WORKER")}
              taskLabel={t("UI_BUILDING_TASK")}
              variant="detail"
            />
          </li>
        ))}
      </ul>
      <ActionButton {...props} actionId="agent_set_objective" />
    </ScreenFrame>
  )
}
