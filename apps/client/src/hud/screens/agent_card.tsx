import { useState, type ReactElement } from "react"
import { lookup } from "../../strings.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"
import { AgentDetail } from "./agents.js"
import "./agents-workspace.css"

export function AgentCardScreen(props: ScreenProps): ReactElement {
  const [assignId, setAssignId] = useState("")
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const agent = agentOnCard(props)
  return (
    <ScreenFrame id="agent_card" view={props.view} loading={props.loading} empty={agent === undefined} onClose={props.onClose}>
      {agent === undefined ? null : (
        <div className="hud-agents-workspace hud-agent-card">
          <AgentDetail props={props} selected={agent} assignId={assignId} onAssignId={setAssignId} t={t} />
        </div>
      )}
    </ScreenFrame>
  )
}

function agentOnCard(props: ScreenProps): ScreenProps["view"]["agents"][number] | undefined {
  const focus = props.selectedObjectId ?? ""
  if (focus.length === 0) return props.view.agents[0]
  return props.view.agents.find((row) => row.id === focus)
}
