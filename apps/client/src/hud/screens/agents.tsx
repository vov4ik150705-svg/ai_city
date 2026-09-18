import { useState, type ReactElement } from "react"
import { lookup } from "../../strings.js"
import { ActionButton } from "../parts/ActionButton.js"
import { AgentCard } from "../parts/AgentCard.js"
import { EmptyState, UnavailableState } from "../parts/Empty.js"
import { PanelHeader } from "../parts/PanelHeader.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"
import "./agents-workspace.css"

export function AgentsScreen(props: ScreenProps): ReactElement {
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const kind = props.view.agentsKind
  const empty = kind === "empty"
  const [selectedId, setSelectedId] = useState(props.view.agents[0]?.id)
  const selected = props.view.agents.find((row) => row.id === selectedId) ?? props.view.agents[0]
  return (
    <ScreenFrame id="agents" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <section data-id="roster" className="hud-card hud-agents-workspace" aria-label={t("UI_AGENTS_ROSTER")}>
        <PanelHeader title={t("UI_AGENTS_ROSTER")} titleKey="UI_AGENTS_ROSTER" glyph="agents" />
        <div className="hud-card__body hud-agents-workspace__body">
          <div className="hud-agents-workspace__toolbar" aria-label={t("UI_AGENTS_ROSTER")}>
            <label className="hud-agents-workspace__search"><span className="hud-sr">{t("UI_SEARCH")}</span><input type="search" placeholder={t("UI_SEARCH")} disabled /></label>
            <select aria-label={t("UI_FILTER")} disabled defaultValue="all"><option value="all">{t("UI_ALL")}</option></select>
            <select aria-label={t("UI_STATUS")} disabled defaultValue="all"><option value="all">{t("UI_STATUS")}</option></select>
          </div>
          {kind === "unavailable" ? <UnavailableState textKey="UI_AGENTS_UNAVAILABLE" text={t("UI_AGENTS_UNAVAILABLE")} /> : null}
          {empty ? <EmptyState textKey="UI_EMPTY_NO_ENTITIES" text={props.view.agentsEmpty} /> : null}
          {kind === "ready" ? (
            <div className="hud-agents-workspace__columns">
            <ul className="hud-card__list hud-agents" data-roster-density="compact">
              {props.view.agents.map((row) => (
                <li key={row.id} className="hud-agent">
                  <button
                    type="button"
                    data-agent={row.id}
                    className="hud-agent__btn"
                    aria-label={row.id}
                    aria-pressed={row.id === selected?.id}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <AgentCard
                      agentId={row.id}
                      idleKey={row.idleKey}
                      idleText={row.idleText}
                      unavailable={t("UI_UNAVAILABLE")}
                      manageLabel={t("UI_MANAGE")}
                      workerLabel={t("UI_BUILDING_WORKER")}
                      taskLabel={t("UI_BUILDING_TASK")}
                      variant="roster"
                    />
                  </button>
                </li>
              ))}
            </ul>
            <aside className="hud-agents-workspace__detail" aria-label={selected?.id ?? t("UI_UNAVAILABLE")}>
              {selected === undefined ? <UnavailableState textKey="UI_UNAVAILABLE" text={t("UI_UNAVAILABLE")} /> : (
                <>
                  <AgentCard agentId={selected.id} idleKey={selected.idleKey} idleText={selected.idleText} unavailable={t("UI_UNAVAILABLE")} manageLabel={t("UI_MANAGE")} workerLabel={t("UI_BUILDING_WORKER")} taskLabel={t("UI_BUILDING_TASK")} variant="detail" />
                  <div className="hud-agents-workspace__facts">
                    {["UI_XP", "UI_TRAITS", "UI_ASSIGNMENT", "UI_BUILDING_TASK", "UI_RECENT_EVENTS"].map((key) => <section key={key} className="hud-agents-workspace__fact"><h2>{t(key)}</h2><span>{t("UI_UNAVAILABLE")}</span></section>)}
                  </div>
                </>
              )}
            </aside>
            </div>
          ) : null}
        </div>
      </section>
      <ActionButton {...props} actionId="agents_hire" />
    </ScreenFrame>
  )
}
