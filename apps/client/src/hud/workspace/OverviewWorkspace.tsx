import type { ReactElement } from "react"
import { lookup, type StringTable } from "../../strings.js"
import { exactBigint, type FieldView, type OverviewTabId, type ResourceView } from "../fields.js"
import type { HudView } from "../model.js"
import { HudIcon, type HudGlyph } from "../parts/HudIcon.js"
import { groupThousands } from "../parts/groupThousands.js"
import { ResearchCatalog } from "../screens/research.js"
import type { ScreenProps } from "../parts/ScreenFrame.js"
import { buildingCardKind } from "../parts/hudArt.js"
import { BuildingThumbnail } from "../parts/BuildingThumbnail.js"
import { EmptyState, UnavailableState } from "../parts/Empty.js"
import { statusTone } from "../parts/StatusChip.js"
import { Progress } from "../parts/ProgressMeter.js"
import { WorkspaceTabs } from "../parts/WorkspaceTabs.js"
import { ProtocolPlaque } from "./ProtocolPlaque.js"

export function OverviewWorkspace(props: {
  readonly view: HudView
  readonly tab: OverviewTabId
  readonly onTab: (id: OverviewTabId) => void
  readonly screen: ScreenProps
  readonly onSelectBuilding: (objectId: string) => void
}): ReactElement {
  const tabs = props.view.shell.overviewTabs
  const shell = props.view.shell
  const overviewNav = props.view.shell.nav.find((row) => row.id === "overview")
  const level = shell.cityLevel
  const levelWord = lookup(props.screen.strings, "UI_LEVEL", new Set())
  return (
    <div className="hud-overview">
      <p className="hud-overview__city">
        <span data-key={shell.cityLabelKey}>{shell.cityLabel}</span>
        {level.kind === "ready" ? (
          <>
            <span aria-hidden="true"> · </span>
            <span data-key="UI_LEVEL">{levelWord}</span>
            <span data-key={level.key} data-exact={level.exact}> {level.text}</span>
          </>
        ) : null}
      </p>
      <WorkspaceTabs
        label={overviewNav === undefined ? "" : overviewNav.label}
        tabPrefix="hud-tab-overview-"
        panelId={(id) => `hud-panel-overview-${id}`}
        tabs={tabs}
        active={props.tab}
        onPick={props.onTab}
      />
      {props.tab === "summary" ? (
        <div role="tabpanel" id="hud-panel-overview-summary" aria-labelledby="hud-tab-overview-summary">
          <CitySummary view={props.view} strings={props.screen.strings} tickers={props.screen.pack.prizeAssets} />
        </div>
      ) : null}
      {props.tab === "functions" ? (
        <div role="tabpanel" id="hud-panel-overview-functions" aria-labelledby="hud-tab-overview-functions">
          <FunctionList view={props.view} screen={props.screen} onSelectBuilding={props.onSelectBuilding} />
        </div>
      ) : null}
      {props.tab === "production" ? (
        <div role="tabpanel" id="hud-panel-overview-production" aria-labelledby="hud-tab-overview-production">
          <ProductionBoard view={props.view} screen={props.screen} onSelectBuilding={props.onSelectBuilding} />
        </div>
      ) : null}
      {props.tab === "research" ? (
        <div role="tabpanel" id="hud-panel-overview-research" aria-labelledby="hud-tab-overview-research">
          <ResearchCatalog {...props.screen} />
        </div>
      ) : null}
    </div>
  )
}

const DASH = "—"

function overviewLine(rows: HudView["overview"], id: string): HudView["overview"][number] | undefined {
  for (const row of rows) {
    if (row.id === id) return row
  }
  return undefined
}

function MetricCard(props: {
  readonly glyph: HudGlyph
  readonly label: string
  readonly labelKey: string
  readonly field: FieldView | undefined
  readonly unit?: string
  readonly unitKey?: string
  readonly plain?: boolean
}): ReactElement {
  const field = props.field
  const ready = field !== undefined && field.kind === "ready" && field.exact.length > 0
  const kicker = props.plain === true ? "hud-overview-summary__k hud-overview-summary__k--plain" : "hud-overview-summary__k"
  return (
    <article className="hud-overview-summary__card">
      <span data-key={props.labelKey} className={kicker}>
        <HudIcon glyph={props.glyph} size="md" />
        {props.label}
      </span>
      <p data-key={ready ? field.key : "UI_UNAVAILABLE"} data-exact={ready ? field.exact : ""} className="hud-overview-summary__v">
        {ready ? field.text : DASH}
      </p>
      {ready && props.unit !== undefined && props.unitKey !== undefined ? (
        <span data-key={props.unitKey} className="hud-overview-summary__u">
          {props.unit}
        </span>
      ) : null}
    </article>
  )
}

function CitySummary(props: {
  readonly view: HudView
  readonly strings: StringTable
  readonly tickers: readonly string[]
}): ReactElement {
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const rows = props.view.overview
  const gdp = overviewLine(rows, "gdp")
  const treasury = overviewLine(rows, "treasury")
  const happiness = overviewLine(rows, "happiness")
  const stability = overviewLine(rows, "stability")
  const pay = props.view.shell.payrollPanel
  const paidLive = pay.paid.kind === "ready" && pay.paid.exact.length > 0 && pay.paid.exact !== "0"
  const capital = t("UI_CAPITAL")
  return (
    <div className="hud-overview-summary">
      <div className="hud-overview-summary__grid">
        <MetricCard
          glyph="database"
          label={t("UI_GDP_PROTOCOL")}
          labelKey="UI_GDP_PROTOCOL"
          plain
          field={
            gdp === undefined
              ? undefined
              : { kind: "ready", key: gdp.key, text: groupThousands(gdp.exact), exact: gdp.exact }
          }
          unit={capital}
          unitKey="UI_CAPITAL"
        />
        <MetricCard
          glyph="database"
          label={t("UI_TREASURY_NAME")}
          labelKey="UI_TREASURY_NAME"
          field={
            treasury === undefined || treasury.exact.length === 0
              ? undefined
              : { kind: "ready", key: "UI_TREASURY", text: groupThousands(treasury.exact), exact: treasury.exact }
          }
          unit={capital}
          unitKey="UI_CAPITAL"
        />
        <MetricCard
          glyph="smile"
          label={t("UI_HAPPINESS")}
          labelKey="UI_HAPPINESS"
          field={happiness === undefined ? undefined : { kind: "ready", key: happiness.key, text: happiness.value, exact: happiness.exact }}
        />
        <MetricCard
          glyph="shieldPlus"
          label={t("UI_STABILITY")}
          labelKey="UI_STABILITY"
          field={stability === undefined ? undefined : { kind: "ready", key: stability.key, text: stability.value, exact: stability.exact }}
        />
      </div>
      <section className="hud-overview-summary__pay">
        <div className="hud-overview-summary__pay-h">
          <span data-key={pay.key} className="hud-overview-summary__k">
            <HudIcon glyph="people" size="md" />
            {pay.label}
          </span>
          {paidLive ? (
            <span data-key="UI_PAYROLL_PAID" className="hud-overview-summary__live">
              {pay.paidLabel}
            </span>
          ) : null}
        </div>
        <div className="hud-overview-summary__cols">
          <PayCell field={pay.paid} label={pay.paidLabel} labelKey="UI_PAYROLL_PAID" group />
          <PayCell field={pay.requested} label={pay.requestedLabel} labelKey="UI_PAYROLL_REQUESTED" group />
          <PayCell field={pay.coverage} label={t("UI_COVERAGE")} labelKey="UI_COVERAGE" />
        </div>
      </section>
      <ProtocolPlaque view={props.view} strings={props.strings} tickers={props.tickers} />
    </div>
  )
}

function PayCell(props: {
  readonly field: FieldView
  readonly label: string
  readonly labelKey: string
  readonly group?: boolean
}): ReactElement {
  const ready = props.field.kind === "ready" && props.field.text.length > 0
  const shown = ready && props.group === true ? groupThousands(props.field.exact) : props.field.text
  return (
    <div className="hud-overview-summary__col">
      <span data-key={ready ? props.field.key : "UI_UNAVAILABLE"} data-exact={props.field.exact} className="hud-overview-summary__v">
        {ready ? shown : DASH}
      </span>
      <span data-key={props.labelKey} className="hud-overview-summary__u">
        {props.label}
      </span>
    </div>
  )
}

function ProductionBoard(props: {
  readonly view: HudView
  readonly screen: ScreenProps
  readonly onSelectBuilding: (objectId: string) => void
}): ReactElement {
  return (
    <div className="hud-prod">
      <ResourceCard
        row={props.view.shell.energy}
        glyph="bolt"
        sources={resourceSources(props.view, props.screen, "energy")}
        onSelectBuilding={props.onSelectBuilding}
        unavailable={lookup(props.screen.strings, "UI_UNAVAILABLE", new Set())}
      />
      <ResourceCard
        row={props.view.shell.compute}
        glyph="chip"
        sources={resourceSources(props.view, props.screen, "compute")}
        onSelectBuilding={props.onSelectBuilding}
        unavailable={lookup(props.screen.strings, "UI_UNAVAILABLE", new Set())}
      />
    </div>
  )
}

function resourceSources(
  view: HudView,
  screen: ScreenProps,
  output: string,
): readonly HudView["shell"]["functions"]["rows"][number][] {
  if (view.shell.functions.kind !== "ready") return []
  const rows: HudView["shell"]["functions"]["rows"][number][] = []
  for (const row of view.shell.functions.rows) {
    if (buildingCardKind(row.id) !== "functional") continue
    const meta = screen.pack.buildingMeta[row.id]
    if (meta !== undefined && meta.output === output) rows.push(row)
  }
  return rows
}

function shownAmount(field: FieldView): string {
  if (field.kind !== "ready" || field.exact.length === 0) return field.text.length > 0 ? field.text : DASH
  return groupThousands(field.exact)
}

function ResourceCard(props: {
  readonly row: ResourceView
  readonly glyph: HudGlyph
  readonly sources: readonly HudView["shell"]["functions"]["rows"][number][]
  readonly onSelectBuilding: (objectId: string) => void
  readonly unavailable: string
}): ReactElement {
  const available = exactBigint(props.row.available)
  const demand = exactBigint(props.row.demand)
  return (
    <article data-id={props.row.id} className="hud-prod__card">
      <span data-key={props.row.key} className="hud-overview-summary__k">
        <HudIcon glyph={props.glyph} size="md" />
        {props.row.label}
      </span>
      <p className="hud-prod__qty">
        <span data-key={props.row.available.key} data-exact={props.row.available.exact}>
          {shownAmount(props.row.available)}
        </span>
        <span aria-hidden="true" className="hud-prod__slash">
          {" / "}
        </span>
        <span data-key={props.row.demand.key} data-exact={props.row.demand.exact}>
          {shownAmount(props.row.demand)}
        </span>
      </p>
      <span className="hud-prod__hint">
        <span data-key={props.row.availableLabelKey}>{props.row.availableLabel}</span>
        <span aria-hidden="true"> · </span>
        <span data-key={props.row.demandLabelKey}>{props.row.demandLabel}</span>
      </span>
      {available !== undefined && demand !== undefined && demand > 0n ? (
        <Progress label={props.row.label} labelKey={props.row.key} valueBps={available} maxBps={demand} compact={true} />
      ) : null}
      {props.sources.length === 0 ? null : (
        <ul className="hud-prod__sources">
          {props.sources.map((row) => {
            const tone = statusTone(row.statusKey)
            return (
              <li key={row.id}>
                <button
                  type="button"
                  data-building={row.id}
                  className="hud-prod__src"
                  aria-label={row.name}
                  onClick={() => props.onSelectBuilding(row.id)}
                >
                  <BuildingThumbnail
                    buildingId={row.id}
                    unavailable={props.unavailable}
                    compact={true}
                    className="hud-prod__src-thumb"
                  />
                  <span data-key={row.nameKey} className="hud-prod__src-name">
                    {row.name}
                  </span>
                  <span data-key={row.statusKey} data-tone={tone} className="hud-fn__status">
                    <span className="hud-fn__dot" aria-hidden="true" />
                    {row.status}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}

function FunctionList(props: {
  readonly view: HudView
  readonly screen: ScreenProps
  readonly onSelectBuilding: (objectId: string) => void
}): ReactElement {
  const functions = props.view.shell.functions
  if (functions.kind === "unavailable") {
    return <UnavailableState textKey={functions.messageKey} text={functions.message} />
  }
  if (functions.kind === "empty") {
    return <EmptyState textKey={functions.messageKey} text={functions.message} />
  }
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.screen.strings, key, used)
  const unavailable = t("UI_UNAVAILABLE")
  const rows = functions.rows.filter((row) => buildingCardKind(row.id) === "functional")
  return (
    <ul className="hud-fn" data-catalog="functional">
      {rows.map((row) => {
        const tone = statusTone(row.statusKey)
        const note = functionNote(row, t)
        return (
          <li key={row.id}>
            <button
              type="button"
              data-building={row.id}
              className="hud-fn__row"
              aria-label={row.name}
              onClick={() => props.onSelectBuilding(row.id)}
            >
              <BuildingThumbnail buildingId={row.id} unavailable={unavailable} compact={true} className="hud-fn__thumb" />
              <span className="hud-fn__copy">
                <span className="hud-fn__title">
                  <span data-key={row.nameKey} className="hud-fn__name">
                    {row.name}
                  </span>
                  {row.level === undefined ? null : (
                    <span data-key="UI_LV" data-exact={row.level.toString()} className="hud-fn__lv">
                      {t("UI_LV")} {row.level.toString()}
                    </span>
                  )}
                </span>
                {note === undefined ? null : (
                  <span data-key={note.key} data-exact={note.exact} className="hud-fn__sub">
                    {note.text}
                  </span>
                )}
              </span>
              <span data-key={row.statusKey} data-tone={tone} className="hud-fn__status">
                <span className="hud-fn__dot" aria-hidden="true" />
                {row.status}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function functionNote(
  row: HudView["shell"]["functions"]["rows"][number],
  t: (key: string) => string,
): { readonly key: string; readonly text: string; readonly exact: string } | undefined {
  const paid = row.paid
  const idle = row.statusKey.startsWith("IDLE_")
  if (idle && (paid === undefined || paid === 0n)) {
    return { key: "UI_LAST_TICK_UNPAID", text: t("UI_LAST_TICK_UNPAID"), exact: "" }
  }
  if (paid !== undefined && paid > 0n) {
    return { key: "UI_CAPITAL", text: `+${groupThousands(paid.toString())} ${t("UI_CAPITAL")}`, exact: paid.toString() }
  }
  return undefined
}
