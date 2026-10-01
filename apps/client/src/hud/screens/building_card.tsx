import { useState, type ReactElement } from "react"
import { lookup } from "../../strings.js"
import { nextLevelCost } from "../../packview.js"
import { ActionButton } from "../parts/ActionButton.js"
import { AgentPortrait } from "../parts/AgentPortrait.js"
import { BuildingThumbnail } from "../parts/BuildingThumbnail.js"
import { EmptyState, UnavailableState } from "../parts/Empty.js"
import { Dialog } from "../parts/Dialog.js"
import { EventLog, eventKickers, eventLogCopy } from "../parts/EventLog.js"
import { HudIcon } from "../parts/HudIcon.js"
import { buildingCardKind } from "../parts/hudArt.js"
import { groupDigits } from "../parts/si.js"
import { statusTone } from "../parts/StatusChip.js"
import { Refusal, refusalFromIntent, shownRefusalText } from "../parts/refusal.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"
import { WorkspaceTabs } from "../parts/WorkspaceTabs.js"
import { agentCallsign } from "../callsign.js"
import { agentAtBuilding, buildingLabelKey } from "../selection.js"
import type { EventRowView } from "../fields.js"

type BuildingTab = "overview" | "staffing" | "upgrades" | "activity"

export function BuildingCardScreen(props: ScreenProps): ReactElement {
  const [tab, setTab] = useState<BuildingTab>("overview")
  const seeded = props.commandRefusal
  const [deactivateCode, setDeactivateCode] = useState(seeded?.action === "deactivate" ? seeded.code : "")
  const [confirmOff, setConfirmOff] = useState(false)
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const objectId = props.selectedObjectId ?? ""
  const kind = objectId.length === 0 ? "unavailable" : buildingCardKind(objectId)
  const unavailable = t("UI_UNAVAILABLE")
  const fn = liveFunction(props.view, objectId)
  const meta = props.pack.buildingMeta[objectId]
  const agentsKind = props.view.agentsKind
  const staff = agentsKind === "unavailable" ? [] : props.view.agents.filter((row) => row.buildingId === objectId)
  const staffingKind = agentsKind === "unavailable" ? "unavailable" : staff.length === 0 ? "empty" : "ready"
  const activity = activityForBuilding(
    props.view.log,
    objectId,
    objectId.length === 0 ? unavailable : t(buildingLabelKey(objectId)),
  )
  const activityCopy = eventLogCopy(props.strings)
  const functional = kind === "functional" && objectId.length > 0
  const built = fn !== undefined
  const deactivated = fn?.statusKey === "UI_DEACTIVATED"
  const district = meta?.district ?? ""
  const canDeactivate = built && !deactivated && functional && meta !== undefined && !meta.autonomous && !meta.prebuilt
  const nextCost = nextLevelCost(props.pack, objectId, fn?.level)
  const priced = functional && meta?.prebuilt !== true && nextCost !== undefined
  const canUpgrade = built && priced
  const showBuild = functional && !built && meta?.prebuilt !== true
  const statusKey = fn === undefined ? "UI_UNAVAILABLE" : fn.statusKey
  const statusText = fn === undefined ? unavailable : fn.status
  const tone = fn === undefined ? "muted" : statusTone(fn.statusKey)
  const seated = agentAtBuilding(props.view.agents, objectId)
  const staffRole = seated === undefined || seated.role.length === 0 ? "unavailable" : seated.role
  const staffTask = seated === undefined || seated.objective.length === 0 ? "unavailable" : seated.objective
  const worker = staffRole === "unavailable" ? unavailable : titleCase(staffRole)
  const task = staffTask === "unavailable" ? unavailable : titleCase(staffTask)
  const paid = paidLabel(fn, meta, t, unavailable)
  const tabs = [
    { id: "overview" as const, key: "UI_OVERVIEW", label: t("UI_OVERVIEW") },
    { id: "staffing" as const, key: "UI_STAFFING", label: t("UI_STAFFING") },
    { id: "upgrades" as const, key: "UI_UPGRADES", label: t("UI_UPGRADES") },
    { id: "activity" as const, key: "UI_ACTIVITY", label: t("UI_ACTIVITY") },
  ]
  return (
    <ScreenFrame id="building_card" view={props.view} loading={props.loading} empty={objectId.length === 0} onClose={props.onClose}>
      {objectId.length === 0 ? null : (
        <div className="hud-bcard hud-bcard--cabinet">
          <header className="hud-bcard__hero">
            <BuildingThumbnail buildingId={objectId} unavailable={unavailable} title={t(buildingLabelKey(objectId))} />
            <div className="hud-bcard__hero-copy">
              <h3 data-key={buildingLabelKey(objectId)} className="hud-bcard__name">
                {t(buildingLabelKey(objectId))}
              </h3>
              <p className="hud-bcard__meta">
                <span data-key="UI_BUILDING_LEVEL">
                  {t("UI_LEVEL")} {fn?.level === undefined ? unavailable : fn.level.toString()}
                </span>
                <span className="hud-bcard__status" data-key={statusKey} data-tone={tone}>
                  <span className="hud-dot" data-tone={tone} />
                  {statusText}
                </span>
              </p>
              <p className="hud-bcard__facts">
                <span className="hud-bcard__fact">
                  <HudIcon glyph="agent" size="sm" />
                  <span
                    data-key={staffRole === "unavailable" ? "UI_UNAVAILABLE" : "UI_BUILDING_WORKER"}
                    data-staff-role={staffRole}
                  >
                    {worker}
                  </span>
                </span>
                <span className="hud-bcard__sep" aria-hidden="true">
                  ·
                </span>
                <span className="hud-bcard__fact">
                  <HudIcon glyph="role" size="sm" />
                  <span
                    data-key={staffTask === "unavailable" ? "UI_UNAVAILABLE" : "UI_BUILDING_TASK"}
                    data-staff-task={staffTask}
                  >
                    {task}
                  </span>
                </span>
              </p>
              {paid === undefined ? null : (
                <p className="hud-bcard__paid">
                  <HudIcon glyph="coin" size="sm" />
                  <span data-key="UI_PAID_TICK">{paid}</span>
                </p>
              )}
            </div>
          </header>
          <WorkspaceTabs
            label={t("UI_OVERVIEW")}
            tabPrefix="hud-tab-building-"
            panelId={(id) => `hud-panel-building-${id}`}
            tabs={tabs}
            active={tab}
            onPick={setTab}
          />
          <div
            role="tabpanel"
            id="hud-panel-building-overview"
            aria-labelledby="hud-tab-building-overview"
            hidden={tab !== "overview"}
          >
            {!functional ? (
              <UnavailableState
                textKey={kind === "decorative" ? "UI_DECORATIVE" : "UI_UNAVAILABLE"}
                text={kind === "decorative" ? t("UI_DECORATIVE") : unavailable}
              />
            ) : (
              <dl className="hud-bcard__rows">
                <div className="hud-bcard__row">
                  <dt data-key="UI_FUNCTION">{t("UI_FUNCTION")}</dt>
                  <dd data-key={functionOutputKey(meta?.output)}>
                    <HudIcon glyph={outputGlyph(meta?.output)} size="sm" />
                    {functionBlurb(meta, t, unavailable)}
                  </dd>
                </div>
                <div className="hud-bcard__row">
                  <dt data-key="UI_SCHEDULE">{t("UI_SCHEDULE")}</dt>
                  <dd data-key={scheduleKey(meta?.schedule)}>{scheduleLabel(meta, t, unavailable)}</dd>
                </div>
                <div className="hud-bcard__row">
                  <dt data-key="UI_INPUT">{t("UI_INPUT")}</dt>
                  <dd data-key={meta?.drawsEnergy === true ? "UI_ENERGY" : "UI_UNAVAILABLE"}>
                    {meta?.drawsEnergy === true ? (
                      <>
                        <HudIcon glyph="bolt" size="sm" className="hud-bcard__bolt" />
                        {t("UI_ENERGY")}
                      </>
                    ) : (
                      unavailable
                    )}
                  </dd>
                </div>
                <div className="hud-bcard__row">
                  <dt data-key="UI_OUTPUT">{t("UI_OUTPUT")}</dt>
                  <dd data-key={functionOutputKey(meta?.output)}>
                    <HudIcon glyph={outputGlyph(meta?.output)} size="sm" />
                    {functionOutputLabel(meta, t, unavailable)}
                  </dd>
                </div>
                <div className="hud-bcard__row">
                  <dt data-key="UI_CURRENT_MODE">{t("UI_CURRENT_MODE")}</dt>
                  <dd data-key={statusKey} data-tone={tone}>
                    <span className="hud-dot" data-tone={tone} />
                    {statusText}
                  </dd>
                </div>
              </dl>
            )}
          </div>
          <div
            role="tabpanel"
            id="hud-panel-building-staffing"
            aria-labelledby="hud-tab-building-staffing"
            hidden={tab !== "staffing"}
          >
            <div className="hud-card__body" data-staffing={staffingKind}>
              {staffingKind === "unavailable" ? (
                <div className="hud-bcard__quiet">
                  <HudIcon glyph="role" size="sm" />
                  <UnavailableState textKey="UI_UNAVAILABLE" text={unavailable} />
                </div>
              ) : staffingKind === "empty" ? (
                <div className="hud-bcard__quiet">
                  <HudIcon glyph="role" size="sm" />
                  <EmptyState textKey="UI_EMPTY_NO_ENTITIES" text={props.view.agentsEmpty} />
                </div>
              ) : (
                <ul className="hud-list hud-bcard__staff">
                  {staff.map((agent) => {
                    const roleMissing = agent.role.length === 0
                    const taskMissing = agent.objective.length === 0
                    const tone = statusTone(agent.idleKey)
                    const idle = agent.idleText.length === 0 ? unavailable : agent.idleText
                    const name = shownAgent(agent, props.view.agents, props.pack.agentCallsigns, roleMissing ? unavailable : titleCase(agent.role))
                    return (
                      <li key={agent.id} className="hud-bcard__staff-row" data-agent={agent.id}>
                        <div className="hud-acard hud-acard--roster" data-agent={agent.id}>
                          <AgentPortrait
                            unavailable={unavailable}
                            title={name}
                            variant="portrait"
                            {...(roleMissing ? {} : { roleId: agent.role })}
                          />
                          <div className="hud-acard__who">
                            <span className="hud-agent__id">{name}</span>
                            <span className="hud-bcard__staff-meta">
                              <span
                                data-agent-role={roleMissing ? "unavailable" : agent.role}
                                data-state={roleMissing ? "unavailable" : "ready"}
                                className="hud-acard__role"
                              >
                                <HudIcon glyph="role" size="sm" />
                                {roleMissing ? unavailable : titleCase(agent.role)}
                                {agent.level > 0n ? ` · ${t("UI_LV")} ${agent.level.toString()}` : ""}
                              </span>
                              <span
                                data-agent-task={taskMissing ? "unavailable" : agent.objective}
                                data-state={taskMissing ? "unavailable" : "ready"}
                                className="hud-acard__task"
                              >
                                <HudIcon glyph="task" size="sm" />
                                {taskMissing ? unavailable : titleCase(agent.objective)}
                              </span>
                            </span>
                          </div>
                          <span className="hud-bcard__staff-status" data-key={agent.idleKey} data-tone={tone}>
                            <span className="hud-dot" data-tone={tone} />
                            {idle}
                          </span>
                        </div>
                        <ActionButton
                          {...props}
                          actionId="agents_open_card"
                          labelKey="UI_MANAGE"
                          extra={{ agent_id: agent.id }}
                        />
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
          <div
            role="tabpanel"
            id="hud-panel-building-upgrades"
            aria-labelledby="hud-tab-building-upgrades"
            hidden={tab !== "upgrades"}
          >
            <div className="hud-card__body" data-upgrades={priced ? "ready" : "unavailable"}>
              {priced && nextCost !== undefined ? (
                <dl className="hud-bcard__rows">
                  <div className="hud-bcard__row">
                    <dt data-key="UI_CURRENT_LEVEL">{t("UI_CURRENT_LEVEL")}</dt>
                    <dd
                      data-current-level={fn?.level === undefined ? "unavailable" : fn.level.toString()}
                      data-key={fn?.level === undefined ? "UI_UNAVAILABLE" : "UI_CURRENT_LEVEL"}
                    >
                      {fn?.level === undefined ? unavailable : fn.level.toString()}
                    </dd>
                  </div>
                  <div className="hud-bcard__row">
                    <dt data-key="UI_NEXT_LEVEL">{t("UI_NEXT_LEVEL")}</dt>
                    <dd data-next-level={nextLevelOf(fn?.level).toString()} data-key="UI_NEXT_LEVEL">
                      <HudIcon glyph="upgrade" size="sm" />
                      {nextLevelOf(fn?.level).toString()}
                    </dd>
                  </div>
                  <div className="hud-bcard__row">
                    <dt data-key="UI_CAPITAL_COST">{t("UI_CAPITAL_COST")}</dt>
                    <dd data-key="UI_CAPITAL_COST">
                      <HudIcon glyph="coin" size="sm" />
                      <span data-exact={nextCost.toString()}>
                        {groupDigits(nextCost)} {t("UI_CAPITAL")}
                      </span>
                    </dd>
                  </div>
                </dl>
              ) : (
                <div className="hud-bcard__quiet">
                  <HudIcon glyph="upgrade" size="sm" />
                  <UnavailableState textKey="UI_UNAVAILABLE" text={unavailable} />
                </div>
              )}
            </div>
          </div>
          <div
            role="tabpanel"
            id="hud-panel-building-activity"
            aria-labelledby="hud-tab-building-activity"
            hidden={tab !== "activity"}
          >
            <div className="hud-card__body" data-building-activity={activity.length === 0 ? "empty" : "ready"}>
              {activity.length === 0 ? (
                <div className="hud-bcard__quiet">
                  <HudIcon glyph="log" size="sm" />
                  <EmptyState textKey="UI_EMPTY_NO_EVENTS" text={props.view.eventsEmpty} />
                </div>
              ) : (
                <EventLog
                  kind="ready"
                  variant="compact"
                  messageKey="UI_EMPTY_NO_EVENTS"
                  message={props.view.eventsEmpty}
                  rows={activity}
                  bound={undefined}
                  openId=""
                  kickers={eventKickers(props.strings)}
                  unavailable={activityCopy.unavailable}
                  timeLabel={activityCopy.timeLabel}
                  entityLabel={activityCopy.entityLabel}
                  unreadLabel={activityCopy.unreadLabel}
                  onProof={() => undefined}
                />
              )}
            </div>
          </div>
          {functional ? (
            <footer className="hud-bcard__foot">
              {canDeactivate ? (
                <div className="hud-bcard__foot-deactivate">
                  <button
                    type="button"
                    className="hud-btn hud-btn--danger hud-btn--deactivate"
                    data-key="UI_DEACTIVATE"
                    data-intent="deactivate"
                    onClick={() => {
                      setConfirmOff(true)
                    }}
                  >
                    <HudIcon glyph="shutdown" size="sm" />
                    {t("UI_DEACTIVATE")}
                  </button>
                  {deactivateCode.length === 0 ? null : (
                    <Refusal code={deactivateCode} text={shownRefusalText(t(deactivateCode), deactivateCode)} rest={[]} />
                  )}
                </div>
              ) : null}
              {deactivated ? (
                <ActionButton
                  {...props}
                  actionId="building_activate"
                  icon="upgrade"
                  extra={{ building_id: objectId, active: true }}
                />
              ) : null}
              {showBuild ? (
                <ActionButton
                  {...props}
                  actionId="building_build"
                  {...(district.length > 0 ? { lookId: district } : {})}
                  icon="upgrade"
                  extra={{ building_id: objectId }}
                />
              ) : null}
              {built ? (
                <ActionButton
                  {...props}
                  actionId="building_upgrade"
                  locked={!canUpgrade}
                  icon="upgrade"
                  {...(canUpgrade ? { extra: { building_id: objectId } } : {})}
                />
              ) : null}
              <p className="hud-bcard__hint" data-key="UI_DEACTIVATE_HINT">
                {t("UI_DEACTIVATE_HINT")}
              </p>
            </footer>
          ) : null}
        </div>
      )}
      {confirmOff ? (
        <Dialog
          title={t("UI_DEACTIVATE")}
          titleKey="UI_DEACTIVATE"
          closeLabel={t("UI_CLOSE")}
          closeKey="UI_CLOSE"
          subtitle={t("UI_DEACTIVATE_HINT")}
          subtitleKey="UI_DEACTIVATE_HINT"
          glyph="shutdown"
          onClose={() => {
            setConfirmOff(false)
          }}
        >
          <footer className="hud-dialog__actions">
            <button
              type="button"
              data-key="UI_CANCEL"
              className="hud-btn hud-btn--secondary"
              onClick={() => {
                setConfirmOff(false)
              }}
            >
              {t("UI_CANCEL")}
            </button>
            <button
              type="button"
              data-key="UI_CONFIRM"
              data-intent="deactivate"
              className="hud-btn hud-btn--danger"
              onClick={() => {
                sendDeactivate(true, () => {
                  setConfirmOff(false)
                  const pending = props.onIntent(
                    { kind: "deactivate", buildingId: objectId },
                    { building_id: objectId, deactivate: true },
                  )
                  void refusalFromIntent(pending).then((code) => {
                    setDeactivateCode(code)
                  })
                })
              }}
            >
              {t("UI_CONFIRM")}
            </button>
          </footer>
        </Dialog>
      ) : null}
    </ScreenFrame>
  )
}

export function sendDeactivate(confirmed: boolean, send: () => void): boolean {
  if (!confirmed) return false
  send()
  return true
}

function activityForBuilding(
  log: readonly EventRowView[],
  buildingId: string,
  buildingName: string,
): readonly EventRowView[] {
  const id = buildingId.trim().toLowerCase()
  if (id.length === 0) return []
  const name = buildingName.trim().toLowerCase()
  return log.filter((row) => {
    const hay = `${row.id} ${row.key} ${row.text}`.toLowerCase()
    if (hay.includes(id)) return true
    return name.length > 0 && name !== id && hay.includes(name)
  })
}

function liveFunction(view: ScreenProps["view"], objectId: string): ScreenProps["view"]["shell"]["functions"]["rows"][number] | undefined {
  for (const row of view.shell.functions.rows) {
    if (row.id === objectId) return row
  }
  return undefined
}

function paidLabel(
  fn: ScreenProps["view"]["shell"]["functions"]["rows"][number] | undefined,
  meta: { readonly output: string } | undefined,
  t: (key: string) => string,
  unavailable: string,
): string | undefined {
  const outKey = functionOutputKey(meta?.output)
  if (outKey === "UI_UNAVAILABLE") return undefined
  const paid = fn?.paid
  if (typeof paid !== "bigint") return undefined
  void unavailable
  return `+${groupDigits(paid)} ${t(outKey)} / ${t("UI_PAID_TICK")}`
}

function functionOutputKey(output: string | undefined): string {
  if (output === "capital" || output === "capital_from_population") return "UI_CAPITAL"
  if (output === "energy") return "UI_ENERGY"
  if (output === "compute") return "UI_COMPUTE"
  return "UI_UNAVAILABLE"
}

function functionOutputLabel(
  meta: { readonly output: string } | undefined,
  t: (key: string) => string,
  unavailable: string,
): string {
  const key = functionOutputKey(meta?.output)
  return key === "UI_UNAVAILABLE" ? unavailable : t(key)
}

function functionBlurb(
  meta: { readonly output: string } | undefined,
  t: (key: string) => string,
  unavailable: string,
): string {
  const out = functionOutputLabel(meta, t, unavailable)
  if (out === unavailable) return unavailable
  return `${t("UI_PRODUCES")} ${out}.`
}

function outputGlyph(output: string | undefined): "coin" | "bolt" | "chip" {
  if (output === "energy") return "bolt"
  if (output === "compute") return "chip"
  return "coin"
}

function scheduleKey(schedule: string | undefined): string {
  if (schedule === undefined || schedule.length === 0) return "UI_UNAVAILABLE"
  return `UI_SCHEDULE_${schedule.toUpperCase()}`
}

function scheduleLabel(
  meta: { readonly schedule: string } | undefined,
  t: (key: string) => string,
  unavailable: string,
): string {
  const key = scheduleKey(meta?.schedule)
  return key === "UI_UNAVAILABLE" ? unavailable : t(key)
}

function nextLevelOf(current: bigint | undefined): bigint {
  return current === undefined ? 1n : current + 1n
}

function shownAgent(
  row: { readonly id: string; readonly role: string },
  agents: readonly { readonly id: string; readonly role: string }[],
  lists: { readonly [role: string]: readonly string[] },
  fallback: string,
): string {
  const name = agentCallsign(row.id, row.role, agents, lists)
  return name.length > 0 ? name : fallback
}

function titleCase(id: string): string {
  return id.replace(/_/g, " ").replace(/^\p{L}/u, (c) => c.toUpperCase())
}
