import { useState, type ReactElement, type ReactNode } from "react"
import type { Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { format, lookup } from "../../strings.js"
import { nextHireCost } from "../../packview.js"
import { ActionButton } from "../parts/ActionButton.js"
import { AgentPortrait } from "../parts/AgentPortrait.js"
import { UnavailableState } from "../parts/Empty.js"
import { FilterSelect } from "../parts/FilterSelect.js"
import { glyphForBuilding, HudIcon, type HudGlyph } from "../parts/HudIcon.js"
import { Refusal, refusalFromIntent, shownRefusalText } from "../parts/refusal.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"
import { agentCallsign } from "../callsign.js"
import { buildingLabelKey } from "../selection.js"
import "./agents-workspace.css"

type AgentRow = ScreenProps["view"]["agents"][number]
type RosterState = "unassigned" | "idle" | "running"
type StateFilter = "all" | RosterState
type ObjectiveExtra = { readonly [key: string]: Json }
type Tone = "ok" | "warn" | "dim"

export function AgentsScreen(props: ScreenProps): ReactElement {
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const kind = props.view.agentsKind
  const empty = kind === "empty"
  const roster = props.view.agents
  const [selectedId, setSelectedId] = useState("")
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [stateFilter, setStateFilter] = useState<StateFilter>("all")
  const [assignId, setAssignId] = useState("")
  const level = props.view.cityLevelValue
  const cap = level === undefined ? undefined : props.pack.slotsAtCityLevel[level.toString()]
  const usedSlots = BigInt(roster.length)
  const pool = props.pack.hirePoolRoles
  const poolSet = new Set(pool)
  const explicitRoles = props.pack.agentRoles.filter((role) => !poolSet.has(role))
  const hireCost = nextHireCost(props.pack, roster.length)
  const hireFailed = hireGateFailed(props, hireCost)
  const hireBlocked = hireFailed.has("capital")
  const filtered = roster.filter((row) => matchesRoster(row, query, roleFilter, stateFilter, roster, props.pack.agentCallsigns, t))
  const selected = filtered.find((row) => row.id === selectedId) ?? filtered[0]
  const hint = format(t("UI_HIRE_HINT"), {
    pool: joinSlash(pool),
    explicit: joinAnd(explicitRoles),
  })
  const roleOptions = [{ id: "", label: t("UI_ALL_ROLES") }, ...props.pack.agentRoles.map((role) => ({ id: role, label: titleCase(role) }))]
  const stateOptions = [
    { id: "all", label: t("UI_ALL_STATES") },
    { id: "running", label: t("UI_RUNNING") },
    { id: "idle", label: t("UI_IDLE") },
    { id: "unassigned", label: t("UI_UNASSIGNED") },
  ]
  return (
    <ScreenFrame id="agents" view={props.view} loading={props.loading} empty={empty} onClose={props.onClose}>
      <section data-id="roster" className="hud-agents-workspace" aria-label={t("UI_AGENTS")}>
        <header className="hud-agents-workspace__head">
          <div className="hud-agents-workspace__titleline">
            <h2 data-key="UI_AGENTS" className="hud-agents-workspace__title">
              {t("UI_AGENTS")}
            </h2>
            <span
              data-slots={cap === undefined ? "unavailable" : `${usedSlots.toString()}/${cap.toString()}`}
              className="hud-agents-workspace__slots"
            >
              {cap === undefined ? (
                <span data-key="UI_UNAVAILABLE">{t("UI_UNAVAILABLE")}</span>
              ) : (
                <>
                  {usedSlots.toString()} / {cap.toString()}
                </>
              )}
            </span>
            <div
              className="hud-agents-workspace__hire"
              {...(hireCost === undefined ? {} : { "data-exact": hireCost.toString() })}
            >
              <ActionButton
                {...props}
                failed={hireFailed}
                actionId="agents_hire"
                labelKey="UI_HIRE"
                keepLabel={true}
              />
            </div>
          </div>
          <div className="hud-agents-workspace__sub">
            <p data-key="UI_HIRE_HINT" className="hud-agents-workspace__hint">
              {hint}
            </p>
            {explicitRoles.length === 0 ? null : (
              <div className={hireBlocked ? "hud-agents-hire hud-sr" : "hud-agents-hire"} data-id="hire-roles">
                {explicitRoles.map((role) => (
                  <ActionButton
                    key={role}
                    {...props}
                    failed={hireFailed}
                    actionId="agents_hire"
                    labelText={titleCase(role)}
                    extra={{ role }}
                    tone="ghost"
                    keepLabel={true}
                  />
                ))}
              </div>
            )}
          </div>
        </header>
        {kind === "unavailable" ? <UnavailableState textKey="UI_AGENTS_UNAVAILABLE" text={t("UI_AGENTS_UNAVAILABLE")} /> : null}
        {kind === "ready" ? (
          <div className="hud-agents-workspace__body">
            <div className="hud-agents-workspace__main">
              <div className="hud-agents-workspace__toolbar">
                <label className="hud-agents-workspace__search">
                  <HudIcon glyph="search" size="sm" semantic="muted" />
                  <input
                    type="text"
                    value={query}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={t("UI_SEARCH_AGENT")}
                    aria-label={t("UI_SEARCH_AGENT")}
                    onChange={(ev) => setQuery(ev.target.value)}
                  />
                </label>
                <FilterSelect label={t("UI_ALL_ROLES")} value={roleFilter} options={roleOptions} onPick={setRoleFilter} />
                <FilterSelect
                  label={t("UI_ALL_STATES")}
                  value={stateFilter}
                  options={stateOptions}
                  onPick={(id) => setStateFilter(parseStateFilter(id))}
                />
              </div>
              <div className="hud-agents-workspace__list">
                <ul className="hud-agents" data-roster-density="compact">
                  {filtered.map((row) => (
                    <li key={row.id} className={row.id === selected?.id ? "hud-agent is-on" : "hud-agent"}>
                      <RosterRow
                        row={row}
                        name={shownAgent(row, roster, props.pack.agentCallsigns, row.role.length === 0 ? t("UI_UNAVAILABLE") : titleCase(row.role))}
                        selected={row.id === selected?.id}
                        t={t}
                        onSelect={() => setSelectedId(row.id)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <aside
              className="hud-agents-workspace__detail"
              aria-label={
                selected === undefined
                  ? t("UI_UNAVAILABLE")
                  : shownAgent(selected, roster, props.pack.agentCallsigns, selected.role.length === 0 ? t("UI_UNAVAILABLE") : titleCase(selected.role))
              }
            >
              {selected === undefined ? (
                <UnavailableState textKey="UI_UNAVAILABLE" text={t("UI_UNAVAILABLE")} />
              ) : (
                <AgentDetail
                  props={props}
                  selected={selected}
                  assignId={assignId}
                  onAssignId={setAssignId}
                  t={t}
                />
              )}
            </aside>
          </div>
        ) : null}
      </section>
    </ScreenFrame>
  )
}

function RosterRow(props: {
  readonly row: AgentRow
  readonly name: string
  readonly selected: boolean
  readonly t: (key: string) => string
  readonly onSelect: () => void
}): ReactElement {
  const row = props.row
  const t = props.t
  const state = rosterState(row)
  const seated = seatedCopy(row, t)
  const chip = statusCopy(state, t)
  const roleMissing = row.role.length === 0
  const taskMissing = row.objective.length === 0
  const idle = state === "idle"
  return (
    <button
      type="button"
      data-agent={row.id}
      data-key={row.idleKey}
      className="hud-agents-workspace__row"
      aria-label={props.name}
      aria-pressed={props.selected}
      onClick={props.onSelect}
    >
      <span className="hud-agents-workspace__face">
        <AgentPortrait
          unavailable={t("UI_UNAVAILABLE")}
          title={props.name}
          variant="portrait"
          {...(roleMissing ? {} : { roleId: row.role })}
        />
        <span className="hud-dot" data-tone={chip.kind} aria-hidden="true" />
      </span>
      <span className="hud-agents-workspace__who">
        <span className="hud-agent__id">{props.name}</span>
        <span data-agent-role={roleMissing ? "unavailable" : row.role} className="hud-acard__role">
          {roleMissing ? t("UI_UNAVAILABLE") : titleCase(row.role)}
          {row.level > 0n ? ` · ${t("UI_LV")} ${row.level.toString()}` : ""}
        </span>
      </span>
      <span className="hud-agents-workspace__seat">
        <span data-key={seated.key} className="hud-agents-workspace__building">
          <HudIcon glyph={row.buildingId.length === 0 ? "building" : glyphForBuilding(row.buildingId)} size="sm" />
          {seated.text}
        </span>
        <span data-agent-task={taskMissing ? "unavailable" : row.objective} className="hud-acard__task">
          <HudIcon glyph="task" size="sm" />
          {taskMissing ? t("UI_UNASSIGNED") : titleCase(row.objective)}
        </span>
      </span>
      <span className="hud-agents-workspace__status">
        <span data-key={chip.key} data-tone={chip.kind} className="hud-agents-workspace__state">
          {chip.label}
        </span>
        {idle ? (
          <span data-key={row.idleKey} className="hud-agents-workspace__idle">
            {row.idleText}
          </span>
        ) : null}
      </span>
    </button>
  )
}

export function AgentDetail(props: {
  readonly props: ScreenProps
  readonly selected: AgentRow
  readonly assignId: string
  readonly onAssignId: (id: string) => void
  readonly t: (key: string) => string
}): ReactElement {
  const screen = props.props
  const selected = props.selected
  const t = props.t
  const state = rosterState(selected)
  const seated = seatedCopy(selected, t)
  const chip = statusCopy(state, t)
  const roleMissing = selected.role.length === 0
  const name = shownAgent(selected, screen.view.agents, screen.pack.agentCallsigns, roleMissing ? t("UI_UNAVAILABLE") : titleCase(selected.role))
  const idle = state === "idle"
  const functions = assignableFunctions(screen.view.functions)
  const assignChoice =
    functions.some((fn) => fn.id === props.assignId)
      ? props.assignId
      : functions.some((fn) => fn.id === selected.buildingId)
        ? selected.buildingId
        : (functions[0]?.id ?? "")
  const hoursWarn =
    selected.idleKey === "IDLE_OUT_OF_HOURS"
      ? { warningKey: selected.idleKey, warningText: selected.idleText }
      : undefined
  const objectives = screen.pack.agentObjectives
    .filter((obj) => obj.role === selected.role)
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
  const objectiveChoice = pickObjectiveId(objectives, selected)
  const objectiveOptions = objectives.flatMap((obj) => {
    if (objectiveExtra(screen, selected, obj.id) === undefined) return []
    return [{ id: obj.id, label: titleCase(obj.id) }]
  })
  const assignOptions = functions.map((fn) => ({ id: fn.id, label: t(fn.nameKey) }))
  const seeded = screen.commandRefusal
  const [assignCode, setAssignCode] = useState(seeded?.action === "assign" ? seeded.code : "")
  const [objectiveCode, setObjectiveCode] = useState(seeded?.action === "set_objective" ? seeded.code : "")
  return (
    <>
      <div className="hud-agents-workspace__pane" data-agent={selected.id}>
      <div className="hud-agents-workspace__hero">
        <AgentPortrait
          unavailable={t("UI_UNAVAILABLE")}
          title={name}
          variant="portrait"
          {...(roleMissing ? {} : { roleId: selected.role })}
        />
        <div className="hud-agents-workspace__who">
          <span className="hud-agent__id">{name}</span>
          <span data-agent-role={roleMissing ? "unavailable" : selected.role} className="hud-acard__role">
            {roleMissing ? t("UI_UNAVAILABLE") : titleCase(selected.role)}
          </span>
          {selected.traits.length > 0 ? (
            <span data-agent-traits={selected.id} className="hud-agents-workspace__traits">
              {selected.traits.map((trait) => (
                <span key={trait} className="hud-chip hud-chip--dim">
                  {trait}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      </div>
      {selected.level > 0n ? (
        <p data-agent-level={selected.level.toString()} className="hud-agents-workspace__level">
          {t("UI_LEVEL")} {selected.level.toString()}
        </p>
      ) : null}
      <div className="hud-agents-workspace__facts">
        <AgentFact glyph="building" label={t("UI_BUILDING")} labelKey="UI_BUILDING" valueKey={seated.key} missing={selected.buildingId.length === 0}>
          <span data-agent-assignment={selected.id}>{seated.text}</span>
        </AgentFact>
        <AgentFact
          glyph="task"
          label={t("UI_OBJECTIVE")}
          labelKey="UI_OBJECTIVE"
          valueKey={selected.objective.length === 0 ? "UI_UNASSIGNED" : selected.objective}
          missing={selected.objective.length === 0}
        >
          <span data-agent-objective={selected.id}>
            {selected.objective.length === 0 ? t("UI_UNASSIGNED") : titleCase(selected.objective)}
          </span>
        </AgentFact>
        <AgentFact glyph="pulse" label={t("UI_BUILDING_STATUS")} labelKey="UI_BUILDING_STATUS" valueKey={chip.key} missing={false}>
          <span data-tone={chip.kind} className="hud-agents-workspace__state">
            <span className="hud-dot" data-tone={chip.kind} aria-hidden="true" />
            {chip.label}
          </span>
        </AgentFact>
        {idle ? (
          <AgentFact glyph="warning" label={t("UI_IDLE_REASON")} labelKey="UI_IDLE_REASON" valueKey={selected.idleKey} missing={false}>
            <span data-key={selected.idleKey}>{selected.idleText}</span>
          </AgentFact>
        ) : null}
      </div>
      </div>
      <div className="hud-agents-workspace__acts">
        {assignChoice.length === 0 ? (
          <span data-key="UI_UNAVAILABLE" className="hud-unavailable">
            {t("UI_UNAVAILABLE")}
          </span>
        ) : (
          <div data-assign-ids={functions.map((fn) => fn.id).join(" ")}>
            <FilterSelect
              label={t("UI_CHANGE_ASSIGNMENT")}
              value={assignChoice}
              options={assignOptions}
              onPick={(id) => {
                props.onAssignId(id)
                void commitAssignment(() =>
                  screen.onIntent(
                    { kind: "assign", agentId: selected.id, buildingId: id },
                    { agent_id: selected.id, building_id: id },
                  ),
                ).then((code) => {
                  setAssignCode(code)
                })
              }}
              menuAlign="up"
              tone="action"
              actionId="agent_assign"
              labelKey="UI_CHANGE_ASSIGNMENT"
              icon="assignment"
            />
            {assignCode.length === 0 ? null : (
              <Refusal code={assignCode} text={shownRefusalText(t(assignCode), assignCode)} rest={[]} />
            )}
          </div>
        )}
        {objectiveOptions.length === 0 ? null : (
          <>
            <FilterSelect
              label={t("UI_SET_OBJECTIVE")}
              value={objectiveChoice}
              options={objectiveOptions}
              onPick={(id) => commitObjective(screen, selected, id, setObjectiveCode)}
              menuAlign="up"
              tone="primary"
              actionId="agent_set_objective"
              labelKey="UI_SET_OBJECTIVE"
              icon="task"
            />
            {objectiveCode.length === 0 ? null : (
              <Refusal code={objectiveCode} text={shownRefusalText(t(objectiveCode), objectiveCode)} rest={[]} />
            )}
            {hoursWarn === undefined ? null : (
              <span data-key={hoursWarn.warningKey} data-tone="warn" className="hud-action__warn">
                {hoursWarn.warningText}
              </span>
            )}
            <ul className="hud-agents-workspace__objectives">
              {objectives.flatMap((obj) => objectiveButtons(screen, selected, obj.id, hoursWarn))}
            </ul>
          </>
        )}
      </div>
    </>
  )
}

function AgentFact(props: {
  readonly glyph: HudGlyph
  readonly label: string
  readonly labelKey: string
  readonly valueKey: string
  readonly missing: boolean
  readonly children: ReactNode
}): ReactElement {
  return (
    <div className="hud-agents-workspace__fact" data-key={props.labelKey}>
      <span className="hud-agents-workspace__fact-k">
        <HudIcon glyph={props.glyph} size="sm" semantic="muted" />
        <span>{titleCase(props.label)}</span>
      </span>
      <span
        data-key={props.valueKey}
        className={props.missing ? "hud-agents-workspace__fact-v hud-unavailable" : "hud-agents-workspace__fact-v"}
      >
        {props.children}
      </span>
    </div>
  )
}

/** A building still in construction is not a seat. Status and remaining ticks both count. */
export function buildingAssignable(fn: { readonly statusKey: string; readonly construction?: bigint }): boolean {
  if (fn.statusKey === codes.IDLE_UNDER_CONSTRUCTION) return false
  return fn.construction === undefined || fn.construction <= 0n
}

export function assignableFunctions(
  functions: ScreenProps["view"]["functions"],
): ScreenProps["view"]["functions"] {
  return functions.filter((fn) => buildingAssignable(fn))
}

/** Server refusal stays on the control. A rejected command resolves to its code. */
export async function commitAssignment(send: () => void | Promise<unknown>): Promise<string> {
  try {
    return await refusalFromIntent(Promise.resolve().then(send))
  } catch (err) {
    if (err instanceof Error && err.message.length > 0) return err.message
    return ""
  }
}

function commitObjective(
  screen: ScreenProps,
  selected: AgentRow,
  objectiveId: string,
  onCode: (code: string) => void,
): void {
  const extra = objectiveExtra(screen, selected, objectiveId)
  if (extra === undefined) return
  const train = extra["train_target"]
  const focus = extra["focus"]
  void commitAssignment(() =>
    screen.onIntent(
      {
        kind: "set_objective",
        agentId: selected.id,
        objective: objectiveId,
        trainTarget: typeof train === "string" ? train : "",
        ...(typeof focus === "string" && focus.length > 0 ? { focus } : {}),
      },
      extra,
    ),
  ).then((code) => {
    onCode(code)
  })
}

function pickObjectiveId(
  objectives: readonly { readonly id: string; readonly isDefault: boolean }[],
  selected: AgentRow,
): string {
  if (objectives.some((obj) => obj.id === selected.objective)) return selected.objective
  const fallback = objectives.find((obj) => obj.isDefault) ?? objectives[0]
  return fallback === undefined ? "" : fallback.id
}

function objectiveExtra(screen: ScreenProps, selected: AgentRow, objectiveId: string): ObjectiveExtra | undefined {
  if (objectiveId === "train") {
    const other = screen.view.agents.find((row) => row.id !== selected.id)
    if (other === undefined) return undefined
    return { agent_id: selected.id, objective: objectiveId, train_target: other.id }
  }
  if (objectiveId === "focus") {
    const contour = screen.pack.agentContours[0]
    if (contour === undefined) return undefined
    return { agent_id: selected.id, objective: objectiveId, focus: contour }
  }
  return { agent_id: selected.id, objective: objectiveId }
}

function objectiveButtons(
  screen: ScreenProps,
  selected: AgentRow,
  objectiveId: string,
  hoursWarn: { readonly warningKey: string; readonly warningText: string } | undefined,
): readonly ReactElement[] {
  const extra = objectiveExtra(screen, selected, objectiveId)
  if (extra === undefined) return []
  const warn = hoursWarn === undefined ? {} : hoursWarn
  return [
    <li key={objectiveId}>
      <ActionButton
        {...screen}
        {...warn}
        actionId="agent_set_objective"
        labelKey="UI_SET_OBJECTIVE"
        labelText={titleCase(objectiveId)}
        icon={objectiveGlyph(objectiveId)}
        extra={extra}
        tone="ghost"
      />
    </li>,
  ]
}

function hireGateFailed(props: ScreenProps, cost: bigint | undefined): ReadonlySet<string> {
  const failed = new Set(props.failed)
  if (cost === undefined || props.view.treasury.kind !== "ready") return failed
  const have = BigInt(props.view.treasury.exact)
  if (have < cost) failed.add("capital")
  return failed
}

function matchesRoster(
  row: AgentRow,
  query: string,
  roleFilter: string,
  stateFilter: StateFilter,
  agents: readonly AgentRow[],
  lists: { readonly [role: string]: readonly string[] },
  t: (key: string) => string,
): boolean {
  if (roleFilter.length > 0 && row.role !== roleFilter) return false
  if (stateFilter !== "all" && rosterState(row) !== stateFilter) return false
  const q = query.trim().toLowerCase()
  if (q.length === 0) return true
  const seated = seatedCopy(row, t)
  const name = shownAgent(row, agents, lists, "")
  const hay = `${name} ${row.id} ${row.role} ${row.objective} ${seated.text}`.toLowerCase()
  return hay.includes(q)
}

function rosterState(row: AgentRow): RosterState {
  if (row.buildingId.length === 0) return "unassigned"
  if (row.idleKey.startsWith("IDLE")) return "idle"
  return "running"
}

function seatedCopy(row: AgentRow, t: (key: string) => string): { readonly key: string; readonly text: string } {
  if (row.buildingId.length === 0) return { key: "UI_UNASSIGNED", text: t("UI_UNASSIGNED") }
  const key = buildingLabelKey(row.buildingId)
  return { key, text: t(key) }
}

function statusCopy(state: RosterState, t: (key: string) => string): { readonly key: string; readonly label: string; readonly kind: Tone } {
  if (state === "unassigned") return { key: "UI_UNASSIGNED", label: t("UI_UNASSIGNED"), kind: "dim" }
  if (state === "idle") return { key: "UI_IDLE", label: t("UI_IDLE"), kind: "warn" }
  return { key: "UI_RUNNING", label: t("UI_RUNNING"), kind: "ok" }
}

function parseStateFilter(raw: string): StateFilter {
  if (raw === "idle" || raw === "running" || raw === "unassigned") return raw
  return "all"
}

function objectiveGlyph(id: string): HudGlyph {
  switch (id) {
    case "overclock":
      return "bolt"
    case "produce":
      return "factory"
    case "train":
      return "training"
    default:
      return "task"
  }
}

function joinSlash(roles: readonly string[]): string {
  return roles.map(titleCase).join(" / ")
}

function joinAnd(roles: readonly string[]): string {
  if (roles.length === 0) return ""
  if (roles.length === 1) return titleCase(roles[0] ?? "")
  const last = roles[roles.length - 1] ?? ""
  return `${roles.slice(0, -1).map(titleCase).join(", ")} and ${titleCase(last)}`
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

function titleCase(raw: string): string {
  return raw.replace(/_/g, " ").replace(/^\p{L}/u, (c) => c.toUpperCase())
}
