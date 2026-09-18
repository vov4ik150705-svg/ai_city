import { useState, type ReactElement } from "react"
import type { HudView } from "../model.js"
import type { StringTable } from "../../strings.js"
import { lookup } from "../../strings.js"
import { AgentCard } from "../parts/AgentCard.js"
import { UnavailableState } from "../parts/Empty.js"

export function AgentsWorkspaceLook(props: { readonly view: HudView; readonly strings: StringTable }): ReactElement {
  const used = new Set<string>()
  const t = (key: string): string => {
    try { return lookup(props.strings, key, used) }
    catch { return key.replace(/^UI_/, "").replaceAll("_", " ") }
  }
  const [selectedId, setSelectedId] = useState(props.view.agents[0]?.id)
  const selected = props.view.agents.find((agent) => agent.id === selectedId) ?? props.view.agents[0]
  return <main className="hud-agents-look" data-surface="agents-workspace">
    <header className="hud-agents-look__header"><h1>{t("UI_AGENTS_ROSTER")}</h1><span>{props.view.agents.length} / {t("UI_UNAVAILABLE")} SLOTS</span><button type="button" disabled>{t("UI_HIRE")}</button></header>
    <div className="hud-agents-look__filters"><input type="search" placeholder={t("UI_SEARCH")} disabled /><select disabled defaultValue="all"><option value="all">{t("UI_ALL")}</option></select><select disabled defaultValue="all"><option value="all">{t("UI_STATUS")}</option></select></div>
    {props.view.agentsKind !== "ready" ? <UnavailableState textKey="UI_AGENTS_UNAVAILABLE" text={t("UI_AGENTS_UNAVAILABLE")} /> : <div className="hud-agents-look__columns">
      <ul className="hud-agents-look__list">{props.view.agents.map((agent) => <li key={agent.id}><button type="button" aria-pressed={agent.id === selected?.id} onClick={() => setSelectedId(agent.id)}><AgentCard agentId={agent.id} idleKey={agent.idleKey} idleText={agent.idleText} unavailable={t("UI_UNAVAILABLE")} manageLabel={t("UI_MANAGE")} workerLabel={t("UI_BUILDING_WORKER")} taskLabel={t("UI_BUILDING_TASK")} variant="roster" /></button></li>)}</ul>
      <section className="hud-agents-look__detail" aria-label={selected?.id ?? t("UI_UNAVAILABLE")}>{selected === undefined ? <UnavailableState textKey="UI_UNAVAILABLE" text={t("UI_UNAVAILABLE")} /> : <><AgentCard agentId={selected.id} idleKey={selected.idleKey} idleText={selected.idleText} unavailable={t("UI_UNAVAILABLE")} manageLabel={t("UI_MANAGE")} workerLabel={t("UI_BUILDING_WORKER")} taskLabel={t("UI_BUILDING_TASK")} variant="detail" /><div className="hud-agents-look__sections">{["UI_XP", "UI_TRAITS", "UI_ASSIGNMENT", "UI_BUILDING_TASK", "UI_RECENT_EVENTS"].map((key) => <div key={key}><h2>{t(key)}</h2><span>{t("UI_UNAVAILABLE")}</span></div>)}</div></>}</section>
    </div>}</main>
}
