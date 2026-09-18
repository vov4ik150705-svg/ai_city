import type { ReactElement } from "react"
import { screens } from "@corporator/protocol"
import type { HudView } from "../model.js"
import { BankPlaque } from "./BankPlaque.js"
import { TimeWidget } from "./TimeWidget.js"
import { IconButton } from "../parts/IconButton.js"
import { StatusChip } from "../parts/StatusChip.js"
import { ExactAmount } from "../parts/ValueRow.js"
import { HudIcon } from "../parts/HudIcon.js"

export function Topbar(props: {
  readonly view: HudView
  readonly onNavigate: (id: string) => void
}): ReactElement {
  const shell = props.view.shell
  const unread = shell.notifications.kind === "ready" ? shell.notifications.text : ""
  const notifyLabel = shell.notifications.kind === "unavailable" ? shell.notifications.text : shell.notificationsLabel
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
        <TimeWidget
          value={`${shell.clockDayLine} ${shell.clockHourFace}`}
          valueKey="UI_CLOCK"
          label={shell.cityTimeLabel}
          labelKey={shell.cityTimeLabelKey}
          dayLine={shell.clockDayLine}
          hourFace={shell.clockHourFace}
          hourValue={shell.clockHourValue}
          openHour={shell.clockOpenHour}
          closeHour={shell.clockCloseHour}
          progressStart={shell.clockProgressStart}
          progressEnd={shell.clockProgressEnd}
        />
      </div>
      <div className="hud-header__tools">
        <BankPlaque plaque={props.view.plaque} />
        <StatusChip
          label={shell.season.text}
          labelKey={shell.season.key}
          kind={shell.season.kind}
          disabled={shell.season.kind === "unavailable"}
          onClick={() => {
            props.onNavigate("leaderboard")
          }}
        />
        <StatusChip
          label={shell.connection.text}
          labelKey={shell.connection.key}
          kind={shell.connection.kind}
        />
        <IconButton
          label={notifyLabel}
          labelKey={shell.notifications.key}
          onClick={() => {
            props.onNavigate("journal")
          }}
        >
          <HudIcon glyph="bell" />
          {unread.length > 0 && unread !== "0" ? <span className="hud-header__dot">{unread}</span> : null}
        </IconButton>
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
