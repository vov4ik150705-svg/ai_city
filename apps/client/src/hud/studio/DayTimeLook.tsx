import type { ReactElement } from "react"
import type { HudView } from "../model.js"
import { TimeWidget } from "../topbar/TimeWidget.js"

export function DayTimeLook(props: { readonly view: HudView }): ReactElement {
  const shell = props.view.shell
  return (
    <section className="hud-economy hud-day-time" aria-label={shell.cityTimeLabel}>
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
    </section>
  )
}
