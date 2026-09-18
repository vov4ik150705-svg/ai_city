import { useState, type ReactElement } from "react"
import { lookup } from "../../strings.js"
import { ActionButton } from "../parts/ActionButton.js"
import { EmptyState, UnavailableState } from "../parts/Empty.js"
import { FactLine, Facts } from "../parts/Facts.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"
import { WorkspaceTabs } from "../parts/WorkspaceTabs.js"

type SeasonTab = "season" | "farm" | "claims"

export function LeaderboardScreen(props: ScreenProps): ReactElement {
  const [tab, setTab] = useState<SeasonTab>("season")
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const empty = props.view.basket.length === 0
  const tabs = [
    { id: "season" as const, key: "UI_SEASON_PERIOD", label: t("UI_SEASON_PERIOD") },
    { id: "farm" as const, key: "UI_CLAIM_FRAGMENT", label: t("UI_CLAIM_FRAGMENT") },
    { id: "claims" as const, key: "UI_CLAIM_PRIZE", label: t("UI_CLAIM_PRIZE") },
  ]
  return (
    <ScreenFrame id="leaderboard" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <WorkspaceTabs
        label={t("UI_SEASON_PERIOD")}
        tabPrefix="hud-tab-season-"
        panelId={(id) => `hud-panel-season-${id}`}
        tabs={tabs}
        active={tab}
        onPick={setTab}
      />
      {tab === "season" ? (
        <div role="tabpanel" id="hud-panel-season-season" aria-labelledby="hud-tab-season-season" className="hud-card">
          <p data-period={props.view.periodHours}>{props.view.periodHours}</p>
          {props.view.shell.season.kind === "ready" ? (
            <p data-key={props.view.shell.season.key}>{props.view.shell.season.text}</p>
          ) : (
            <UnavailableState textKey={props.view.shell.season.key} text={props.view.shell.season.text} />
          )}
          {empty ? <EmptyState textKey="UI_EMPTY_NO_ENTITIES" text={props.view.agentsEmpty} /> : null}
          <ul className="hud-list">
            {props.view.basket.map((row) => (
              <li key={row.ticker} data-ticker={row.ticker}>
                {row.ticker}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {tab === "farm" ? (
        <div role="tabpanel" id="hud-panel-season-farm" aria-labelledby="hud-tab-season-farm" className="hud-card">
          {empty ? <EmptyState textKey="UI_EMPTY_NO_ENTITIES" text={props.view.agentsEmpty} /> : null}
          <Facts>
            {props.view.basket.map((row) => (
              <FactLine key={row.ticker} label={row.ticker} labelKey="UI_CLAIM_FRAGMENT" valueKey="UI_CLAIM_FRAGMENT">
                <span data-farm={row.ticker} data-exact={row.farm}>
                  {row.farm}
                </span>
              </FactLine>
            ))}
          </Facts>
          <ActionButton {...props} actionId="district_claim_fragment" />
        </div>
      ) : null}
      {tab === "claims" ? (
        <div role="tabpanel" id="hud-panel-season-claims" aria-labelledby="hud-tab-season-claims" className="hud-card">
          {empty ? <EmptyState textKey="UI_EMPTY_NO_ENTITIES" text={props.view.agentsEmpty} /> : null}
          <Facts>
            {props.view.basket.map((row) => (
              <FactLine key={row.ticker} label={row.ticker} labelKey="UI_CLAIM_PRIZE" valueKey="UI_CLAIM_PRIZE">
                <span data-month={row.ticker} data-exact={row.month}>
                  {row.month}
                </span>
              </FactLine>
            ))}
          </Facts>
          <ActionButton {...props} actionId="leaderboard_claim" />
        </div>
      ) : null}
    </ScreenFrame>
  )
}
