import type { ReactElement } from "react"
import type { StringTable } from "../../strings.js"
import { lookup } from "../../strings.js"
import type { HudView } from "../model.js"
import { BuildingThumbnail } from "../parts/BuildingThumbnail.js"
import { HudIcon } from "../parts/HudIcon.js"

export function BuildingDetailLook(props: { readonly view: HudView; readonly strings: StringTable }): ReactElement {
  const used = new Set<string>()
  const unavailable = lookup(props.strings, "UI_UNAVAILABLE", used)
  const row = props.view.shell.functions.rows.find((item) => item.id === "workshop") ?? props.view.shell.functions.rows[0]
  if (row === undefined) {
    return <section className="hud-economy hud-building-detail" aria-label={unavailable}>{unavailable}</section>
  }
  const buildingId = "workshop"
  const title = lookup(props.strings, "UI_BLD_WORKSHOP", used)
  return (
    <section className="hud-economy hud-building-detail" aria-label={title}>
      <div className="hud-building-detail__art">
        <BuildingThumbnail buildingId={buildingId} unavailable={unavailable} compact={true} className="hud-building-detail__thumb" />
      </div>
      <div className="hud-building-detail__body">
        <header className="hud-building-detail__header">
          <span className="hud-building-detail__title">{title}</span>
          <span className="hud-building-detail__level">LV 2</span>
        </header>
        <div className="hud-building-detail__status">
          <span className="hud-building-detail__dot" />
          RUNNING
        </div>
        <div className="hud-building-detail__fact"><HudIcon glyph="people" size="sm" /> Engineer · Alex R.</div>
        <div className="hud-building-detail__fact"><HudIcon glyph="gear" size="sm" /> Produce</div>
        <div className="hud-building-detail__fact hud-building-detail__fact--accent"><HudIcon glyph="coin" size="sm" /> +24 / tick</div>
        <button type="button" className="hud-building-detail__manage">Manage <HudIcon glyph="go" size="sm" /></button>
      </div>
    </section>
  )
}
