import type { CSSProperties, ReactElement } from "react"
import "./agents-stage.css"

/** Full-body portraits served as-is from /assets/agents. Only Engineer is wired. */
export const AGENT_STAGE_ROLES = ["engineer", "logistician", "scientist", "trader", "manager"] as const

export type AgentStageRole = (typeof AGENT_STAGE_ROLES)[number]

const STAGE_BACKGROUND = "/assets/agents/agent-stage.jpg"

const STAGE_CHARACTERS: { readonly [K in AgentStageRole]?: string } = {
  engineer: "/assets/agents/Engineer.png",
  logistician: "/assets/agents/roster/logistician.png",
  trader: "/assets/agents/roster/trader.png",
  scientist: "/assets/agents/roster/scientist.png",
  manager: "/assets/agents/roster/manager.png",
}

const STAGE_LABEL: { readonly [K in AgentStageRole]: string } = {
  engineer: "Engineer",
  logistician: "Logistician",
  scientist: "Scientist",
  trader: "Trader",
  manager: "Manager",
}

export function AgentsStage(props: {
  readonly role?: AgentStageRole
  readonly className?: string
  readonly style?: CSSProperties
}): ReactElement {
  const role = props.role ?? "engineer"
  const character = STAGE_CHARACTERS[role]
  const className = props.className === undefined ? "agents-stage" : `agents-stage ${props.className}`
  return (
    <section
      className={className}
      style={props.style}
      data-agent-stage={role}
      data-agent-active={character === undefined ? "no" : "yes"}
      aria-label={STAGE_LABEL[role]}
    >
      <img className="agents-stage__bg" src={STAGE_BACKGROUND} alt="" draggable={false} />
      {character === undefined ? null : (
        <div className="agents-stage__figure">
          <div className="agents-stage__glow" aria-hidden="true" />
          <img className="agents-stage__reflection" src={character} alt="" draggable={false} />
          <div className="agents-stage__shadow" aria-hidden="true" />
          <img className="agents-stage__character" src={character} alt={STAGE_LABEL[role]} draggable={false} />
        </div>
      )}
    </section>
  )
}
