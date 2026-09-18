import type { ReactElement } from "react"
import { screens } from "@corporator/protocol"
import type { HudView } from "../model.js"
import { ExactAmount } from "../parts/ValueRow.js"
import { DayTimeLook } from "../studio/DayTimeLook.js"
import { StatusBarLook } from "../studio/StatusBarLook.js"

export function IslandTopbar(props: {
  readonly view: HudView
  readonly onNavigate: (id: string) => void
}): ReactElement {
  const shell = props.view.shell
  return (
    <header data-surface={screens.topbar} className="hud-panel hud-topbar" role="banner">
      <div className="hud-header__brand">
        <h1 className="hud-brand" data-key={shell.brandKey}>
          {shell.brand}
        </h1>
        <div className="hud-header__identity">
          <p data-key={shell.cityLabelKey} className="hud-header__city">
            {shell.cityLabel}
          </p>
          <span className="hud-header__level">
            <span data-key={shell.cityLevelLabelKey} className="hud-header__level-label">
              {shell.cityLevelLabel}
            </span>
            {shell.cityLevel.kind === "unavailable" ? (
              <span data-key="UI_UNAVAILABLE" className="hud-unavailable">
                {shell.cityLevel.text}
              </span>
            ) : (
              <span data-key={shell.cityLevel.key} className="hud-header__level-value">
                {shell.cityLevel.text}
              </span>
            )}
          </span>
        </div>
      </div>
      <div className="hud-header__clock">
        <DayTimeLook view={props.view} />
      </div>
      <div className="hud-header__tools">
        <StatusBarLook
          view={props.view}
          onNotify={() => {
            props.onNavigate("journal")
          }}
          onWallet={() => {
            props.onNavigate("bank")
          }}
        />
        <div className="hud-header__capital" data-id="capital">
          <span data-key={shell.capital.key} className="hud-metric__k">
            {shell.capital.label}
          </span>
          {shell.capital.kind === "unavailable" ? (
            <span data-key="UI_UNAVAILABLE" className="hud-unavailable">
              {shell.capital.display}
            </span>
          ) : (
            <ExactAmount className="hud-metric__v" display={shell.capital.display} exact={shell.capital.exact} />
          )}
        </div>
      </div>
    </header>
  )
}
