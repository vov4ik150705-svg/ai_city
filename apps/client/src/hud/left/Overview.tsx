import type { ReactElement } from "react"
import type { HudView } from "../model.js"
import { Empty } from "../parts/Empty.js"
import { Panel } from "../parts/Panel.js"
import { FactLine, Facts } from "../parts/Facts.js"
import { Value } from "../parts/Value.js"

export function Overview(props: {
  readonly title: string
  readonly titleKey: string
  readonly rows: HudView["overview"]
  readonly payroll: HudView["payroll"]
}): ReactElement {
  return (
    <Panel id="overview" title={props.title} titleKey={props.titleKey}>
      <Facts>
        {props.rows.map((line) => (
          <FactLine key={line.id} label={line.caption} labelKey={line.key} valueKey={line.key}>
            <Value display={line.value} exact={line.exact} />
          </FactLine>
        ))}
      </Facts>
      {props.payroll ? (
        <p data-key={props.payroll.key} className="hud-row hud-row--trim">
          {props.payroll.text}
        </p>
      ) : null}
    </Panel>
  )
}

export function ActiveEvents(props: {
  readonly title: string
  readonly titleKey: string
  readonly empty: string
}): ReactElement {
  return (
    <Panel id="events" title={props.title} titleKey={props.titleKey}>
      <Empty textKey="UI_EMPTY_NO_EVENTS" text={props.empty} />
    </Panel>
  )
}

export function DistrictsPanel(props: {
  readonly title: string
  readonly titleKey: string
  readonly rows: HudView["districts"]
  readonly onLook: (id: string) => void
}): ReactElement {
  return (
    <Panel id="districts" title={props.title} titleKey={props.titleKey}>
      {props.rows.map((d) => (
        <div
          key={d.id}
          data-district={d.id}
          data-ticker={d.ticker}
          className={d.tone === "ok" ? "hud-district" : `hud-district hud-district--${d.tone}`}
          onClick={() => {
            props.onLook(d.id)
          }}
        >
          <span className="hud-district__t">{d.ticker}</span>
          <span className="hud-muted">{d.role}</span>
          <span className="hud-district__fx">{d.effect}</span>
        </div>
      ))}
    </Panel>
  )
}
