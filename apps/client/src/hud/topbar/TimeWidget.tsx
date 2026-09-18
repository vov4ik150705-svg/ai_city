import type { ReactElement } from "react"
import { clockAxisAlong, clockAxisSpan } from "../fields.js"
import { HudIcon } from "../parts/HudIcon.js"

export function TimeWidget(props: {
  readonly value: string
  readonly valueKey: string
  readonly label: string
  readonly labelKey: string
  readonly dayLine: string
  readonly hourFace: string
  readonly hourValue: bigint
  readonly openHour: bigint
  readonly closeHour: bigint
  readonly progressStart: string
  readonly progressEnd: string
  readonly showDaySun?: boolean
}): ReactElement {
  const span = clockAxisSpan(props.openHour, props.closeHour)
  const along = clockAxisAlong(props.hourValue, props.openHour, props.closeHour)
  const now = props.openHour + along
  const pct = `${((along * 100n) / span).toString()}%`
  return (
    <div data-key={props.valueKey} data-id="clock" className="hud-clock" title={props.value}>
      <div className="hud-clock__pair">
        <span className="hud-clock__day">
          {props.showDaySun === true ? <HudIcon glyph="sun" className="hud-clock__day-sun" size="sm" /> : null}
          {props.dayLine}
        </span>
        <time className="hud-clock__v" dateTime={props.hourFace}>
          {props.hourFace}
        </time>
      </div>
      <span className="hud-clock__bound hud-clock__bound--start">{props.progressStart}</span>
      <span
        data-key={props.labelKey}
        className="hud-cycle"
        role="meter"
        aria-label={props.label}
        aria-valuemin={Number(props.openHour)}
        aria-valuemax={Number(props.closeHour)}
        aria-valuenow={Number(now)}
      >
        <span className="hud-cycle__on" style={{ width: pct }} />
        <span className="hud-clock__sun" style={{ left: pct }}>
          <HudIcon glyph="sun" className="hud-clock__sun-ico" size="md" />
        </span>
      </span>
      <span className="hud-clock__bound hud-clock__bound--end">{props.progressEnd}</span>
    </div>
  )
}
