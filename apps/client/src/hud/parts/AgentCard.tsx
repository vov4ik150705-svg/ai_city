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
  readonly onManage?: () => void
}): ReactElement {
  const variant = props.variant ?? "detail"
  const onManage = props.onManage
  const roleId = props.roleId
  return (
    <div className={variant === "roster" ? "hud-card hud-acard hud-acard--roster" : "hud-card hud-acard"} data-agent={props.agentId}>
      <AgentPortrait
        unavailable={props.unavailable}
        title={props.agentId}
        variant={variant === "roster" ? "icon" : "portrait"}
        fallbackIcon={variant === "roster"}
        {...(roleId === undefined ? {} : { roleId })}
      />
      <div className="hud-acard__who">
        <span className="hud-agent__id">{props.agentId}</span>
        {variant === "roster" ? (
          <span data-key={props.idleKey} className="hud-muted hud-acard__partial">
            {props.unavailable}
          </span>
        ) : (
          <span data-key={props.idleKey} className="hud-muted">
            {props.idleText}
          </span>
        )}
      </div>
      {variant === "detail" ? (
        <>
          <StatusChip
            label={props.idleText}
            labelKey={props.idleKey}
            kind={statusKindFromKey(props.idleKey)}
            surface="badge"
          />
          <Facts>
            <FactLine label={props.workerLabel} labelKey="UI_BUILDING_WORKER" valueKey="UI_UNAVAILABLE" missing={true}>
              <span data-agent-role="unavailable" data-state="unavailable">
                {props.unavailable}
              </span>
            </FactLine>
            <FactLine label={props.taskLabel} labelKey="UI_BUILDING_TASK" valueKey="UI_UNAVAILABLE" missing={true}>
              <span data-agent-task="unavailable" data-state="unavailable">
                {props.unavailable}
              </span>
            </FactLine>
          </Facts>
        </>
      ) : (
        <StatusChip
          label={props.idleText}
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
