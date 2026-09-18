import type { ReactElement } from "react"
import { lookup } from "../../strings.js"
import type { OverviewTabId } from "../fields.js"
import type { HudView } from "../model.js"
import { Overview } from "../left/Overview.js"
import { FactRow, Facts } from "../parts/Facts.js"
import { PanelHeader } from "../parts/PanelHeader.js"
import { ResearchCatalog } from "../screens/research.js"
import type { ScreenProps } from "../parts/ScreenFrame.js"
import { buildingLabelKey } from "../selection.js"
import { BuildingIcon } from "../parts/BuildingIcon.js"
import { CompanyBadge } from "../parts/CompanyBadge.js"
import { StatusBadge } from "../parts/StatusBadge.js"
import { districtForBuilding } from "../parts/HudIcon.js"
import { buildingCardKind } from "../parts/hudArt.js"
import { WorkspaceTabs } from "../parts/WorkspaceTabs.js"

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
  return (
    <div className="hud-overview">
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
          <Overview title={shell.cityStatusTitle} titleKey={shell.cityStatusTitleKey} rows={props.view.overview} payroll={props.view.payroll} />
        </div>
      ) : null}
      {props.tab === "functions" ? (
        <div role="tabpanel" id="hud-panel-overview-functions" aria-labelledby="hud-tab-overview-functions">
          <BuildingCatalog view={props.view} screen={props.screen} onSelectBuilding={props.onSelectBuilding} />
        </div>
      ) : null}
      {props.tab === "production" ? (
        <section role="tabpanel" id="hud-panel-overview-production" aria-labelledby="hud-tab-overview-production" className="hud-card">
          <div className="hud-card__stack">
            <section className="hud-card__block">
              <span data-key={shell.energy.key} className="hud-card__label">
                {shell.energy.label}
              </span>
              <Facts>
                <FactRow label={shell.energy.availableLabel} labelKey={shell.energy.availableLabelKey} field={shell.energy.available} />
                <FactRow label={shell.energy.demandLabel} labelKey={shell.energy.demandLabelKey} field={shell.energy.demand} />
              </Facts>
            </section>
            <section className="hud-card__block">
              <span data-key={shell.compute.key} className="hud-card__label">
                {shell.compute.label}
              </span>
              <Facts>
                <FactRow label={shell.compute.availableLabel} labelKey={shell.compute.availableLabelKey} field={shell.compute.available} />
                <FactRow label={shell.compute.demandLabel} labelKey={shell.compute.demandLabelKey} field={shell.compute.demand} />
              </Facts>
            </section>
          </div>
        </section>
      ) : null}
      {props.tab === "research" ? (
        <div role="tabpanel" id="hud-panel-overview-research" aria-labelledby="hud-tab-overview-research">
          <ResearchCatalog {...props.screen} />
        </div>
      ) : null}
    </div>
  )
}

function BuildingCatalog(props: {
  readonly view: HudView
  readonly screen: ScreenProps
  readonly onSelectBuilding: (objectId: string) => void
}): ReactElement {
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.screen.strings, key, used)
  const ids = props.screen.pack.buildingIds.filter((id) => buildingCardKind(id) === "functional")
  return (
    <section className="hud-card" aria-label={t("UI_BUILDING_CATALOG")} data-catalog="functional">
      <PanelHeader title={t("UI_BUILDING_CATALOG")} titleKey="UI_BUILDING_CATALOG" glyph="building" />
      <ul className="hud-card__list hud-catalog">
        {ids.map((id) => {
          const fn = liveFunction(props.view, id)
          const district = districtForBuilding(props.screen.pack, id)
          const statusText = fn === undefined ? t("UI_UNAVAILABLE") : fn.status
          const statusKey = fn === undefined ? "UI_UNAVAILABLE" : fn.statusKey
          return (
            <li key={id}>
              <button type="button" data-building={id} className="hud-catalog__row" aria-label={t(buildingLabelKey(id))} onClick={() => props.onSelectBuilding(id)}>
                <BuildingIcon buildingId={id} />
                <span data-key={buildingLabelKey(id)} className="hud-bcard__name">
                  {t(buildingLabelKey(id))}
                </span>
                {district === undefined ? null : <CompanyBadge ticker={district.ticker} districtId={district.id} />}
                {fn === undefined ? (
                  <span data-key="UI_UNAVAILABLE" className="hud-unavailable">
                    {statusText}
                  </span>
                ) : (
                  <StatusBadge text={statusText} textKey={statusKey} />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function liveFunction(view: HudView, objectId: string): HudView["shell"]["functions"]["rows"][number] | undefined {
  for (const row of view.shell.functions.rows) {
    if (row.id === objectId) return row
  }
  return undefined
}
