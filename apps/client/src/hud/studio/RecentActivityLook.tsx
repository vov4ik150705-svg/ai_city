import type { ReactElement } from "react"
import { lookup, type StringTable } from "../../strings.js"
import type { EventRowView } from "../fields.js"
import type { HudView } from "../model.js"
import { EmptyState, ErrorState, UnavailableState } from "../parts/Empty.js"
import { BuildingThumbnail } from "../parts/BuildingThumbnail.js"
import { HudIcon } from "../parts/HudIcon.js"
import { Loading } from "../parts/Loading.js"
import { RECENT_ACTIVITY_DEFAULT_ROWS } from "../selection.js"

export function RecentActivityLook(props: {
  readonly view: HudView
  readonly strings: StringTable
  readonly extra: readonly { readonly id: string; readonly key: string; readonly text: string }[]
  readonly onViewAll?: () => void
  readonly previewTimes?: readonly (string | undefined)[]
  readonly previewBuildingByKey?: Readonly<Record<string, string>>
}): ReactElement {
  const events = props.view.shell.events
  const used = new Set<string>()
  const unavailable = lookup(props.strings, "UI_UNAVAILABLE", used)
  const extraRows: EventRowView[] = props.extra.map((row) => ({
    id: row.id,
    key: row.key,
    text: row.text,
    badgeKey: "UI_ATTEST_LOGGED",
    badgeText: "",
    root: "",
    cid: "",
  }))
  const rows = events.kind === "ready" ? [...events.rows, ...extraRows] : events.rows
  const kind = events.kind === "ready" && rows.length === 0 ? "empty" : events.kind
  const visible = kind === "ready" ? rows.slice(0, RECENT_ACTIVITY_DEFAULT_ROWS) : []
  const viewAll = props.onViewAll
  const previewTimes = props.previewTimes
  const previewBuildingByKey = props.previewBuildingByKey
  return (
    <section data-id="events" className="hud-panel hud-card hud-activity hud-economy hud-recent-activity" aria-label={events.title}>
      <header className="hud-economy__h">
        <span className="hud-economy__h-ico" aria-hidden="true">
          <HudIcon glyph="time" size="md" />
        </span>
        <h2 data-key={events.key} className="hud-economy__title">
          {events.title}
        </h2>
        {viewAll === undefined ? (
          <span data-key={props.view.shell.viewAllKey} className="hud-recent-activity__view">
            {props.view.shell.viewAll}
          </span>
        ) : (
          <button type="button" data-key={props.view.shell.viewAllKey} className="hud-recent-activity__view hud-linkbtn" onClick={viewAll}>
            {props.view.shell.viewAll}
          </button>
        )}
        <HudIcon glyph="go" size="md" />
      </header>
      {kind === "loading" ? <Loading kind="events" text={events.message} textKey={events.messageKey} /> : null}
      {kind === "error" ? <ErrorState textKey={events.messageKey} text={events.message} /> : null}
      {kind === "unavailable" ? <UnavailableState textKey={events.messageKey} text={events.message} /> : null}
      {kind === "empty" ? <EmptyState textKey={events.messageKey} text={events.message} /> : null}
      {kind === "ready" ? (
        <div className="hud-recent-activity__list" role="feed">
          {visible.map((row, index) => (
            <ActivityRow
              key={row.id}
              row={row}
              unavailable={unavailable}
              time={previewTimes === undefined ? undefined : previewTimes[index]}
              buildingId={previewBuildingByKey === undefined ? "" : (previewBuildingByKey[row.key] ?? "")}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function ActivityRow(props: {
  readonly row: EventRowView
  readonly unavailable: string
  readonly time: string | undefined
  readonly buildingId: string
}): ReactElement {
  const time = props.time
  const buildingId = props.buildingId
  return (
    <article className="hud-event hud-recent-activity__row" data-key={props.row.key} data-event-id={props.row.id}>
      {time === undefined ? (
        <span className="hud-recent-activity__time hud-unavailable" data-key="UI_UNAVAILABLE" data-state="unavailable">
          {props.unavailable}
        </span>
      ) : (
        <span className="hud-recent-activity__time">{time}</span>
      )}
      <span className="hud-recent-activity__building" aria-hidden="true">
        {buildingId.length === 0 ? (
          <HudIcon glyph="building" size="lg" />
        ) : (
          <BuildingThumbnail
            buildingId={buildingId}
            unavailable={props.unavailable}
            compact={true}
            className="hud-recent-activity__thumb"
          />
        )}
      </span>
      <span className={`hud-recent-activity__dot${props.row.badgeKey.length > 0 ? "" : " hud-recent-activity__dot--muted"}`} />
      <span className="hud-recent-activity__copy">
        <span className="hud-recent-activity__name">{props.row.badgeText || props.row.key}</span>
        <span className="hud-recent-activity__text">{props.row.text}</span>
      </span>
    </article>
  )
}
