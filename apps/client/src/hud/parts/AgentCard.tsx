import type { ReactElement } from "react"
import { FactLine, Facts } from "./Facts.js"
import { AgentPortrait } from "./AgentPortrait.js"
import { StatusChip, statusKindFromKey } from "./StatusChip.js"

export function AgentCard(props: {
  readonly agentId: string
  readonly idleKey: string
  readonly idleText: string
  readonly unavailable: string
  readonly manageLabel: string
  readonly workerLabel: string
  readonly taskLabel: string
  readonly variant?: "roster" | "detail"
  readonly roleId?: string
  readonly buildingId?: string
  readonly objective?: string
  readonly onManage?: () => void
}): ReactElement {
  const variant = props.variant ?? "detail"
  const onManage = props.onManage
  const roleId = props.roleId
  const buildingId = props.buildingId
  const objective = props.objective
  const roleMissing = roleId === undefined || roleId.length === 0
  const taskMissing = objective === undefined || objective.length === 0
  const idleLabel = props.idleText.length === 0 ? props.unavailable : props.idleText
  const roleLabel = roleMissing ? props.unavailable : titleCase(roleId ?? "")
  const taskLabel = taskMissing ? props.unavailable : titleCase(objective ?? "")
  return (
    <div className={variant === "roster" ? "hud-card hud-acard hud-acard--roster" : "hud-card hud-acard"} data-agent={props.agentId}>
      <AgentPortrait
        unavailable={props.unavailable}
        title={props.agentId}
        variant="portrait"
        {...(roleId === undefined || roleId.length === 0 ? {} : { roleId })}
      />
      <div className="hud-acard__who">
        <span className="hud-agent__id">{props.agentId}</span>
        {variant === "roster" ? (
          <>
            <span
              data-agent-role={roleMissing ? "unavailable" : roleId}
              data-state={roleMissing ? "unavailable" : "ready"}
              className="hud-acard__role"
            >
              {roleLabel}
            </span>
            <span
              data-agent-task={taskMissing ? "unavailable" : objective}
              data-state={taskMissing ? "unavailable" : "ready"}
              className="hud-acard__task"
            >
              {taskLabel}
            </span>
          </>
        ) : (
          <span data-key={props.idleKey} className="hud-muted">
            {idleLabel}
          </span>
        )}
      </div>
      {variant === "detail" ? (
        <>
          <StatusChip
            label={idleLabel}
            labelKey={props.idleKey}
            kind={statusKindFromKey(props.idleKey)}
            surface="badge"
          />
          <Facts>
            <FactLine
              label={props.workerLabel}
              labelKey="UI_BUILDING_WORKER"
              valueKey={roleMissing ? "UI_UNAVAILABLE" : roleId}
              missing={roleMissing}
            >
              <span data-agent-role={roleMissing ? "unavailable" : roleId} data-state={roleMissing ? "unavailable" : "ready"}>
                {roleMissing ? props.unavailable : roleId}
              </span>
            </FactLine>
            <FactLine
              label={props.taskLabel}
              labelKey="UI_BUILDING_TASK"
              valueKey={taskMissing ? "UI_UNAVAILABLE" : objective}
              missing={taskMissing}
            >
              <span data-agent-task={taskMissing ? "unavailable" : objective} data-state={taskMissing ? "unavailable" : "ready"}>
                {taskMissing ? props.unavailable : objective}
              </span>
            </FactLine>
            {buildingId === undefined || buildingId.length === 0 ? null : (
              <FactLine label={props.manageLabel} labelKey="UI_ASSIGNMENT" valueKey={buildingId} missing={false}>
                <span data-agent-building={buildingId}>{buildingId}</span>
              </FactLine>
            )}
          </Facts>
        </>
      ) : (
        <StatusChip
          label={idleLabel}
          labelKey={props.idleKey}
          kind={statusKindFromKey(props.idleKey)}
          surface="badge"
        />
      )}
      {onManage === undefined ? null : (
        <button type="button" data-key="UI_MANAGE" className="hud-linkbtn hud-btn hud-btn--ghost" onClick={onManage}>
          {props.manageLabel}
        </button>
      )}
    </div>
  )
}

function titleCase(id: string): string {
  return id.replace(/_/g, " ").replace(/^\p{L}/u, (c) => c.toUpperCase())
}
