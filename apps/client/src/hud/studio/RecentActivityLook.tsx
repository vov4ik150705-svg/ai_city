import type { ReactElement } from "react"
import { lookup, type StringTable } from "../../strings.js"
import type { EventRowView } from "../fields.js"
import type { HudView } from "../model.js"
import { EmptyState, ErrorState, UnavailableState } from "../parts/Empty.js"
import { BuildingThumbnail } from "../parts/BuildingThumbnail.js"
import { HudIcon } from "../parts/HudIcon.js"
import { Loading } from "../parts/Loading.js"
import { RECENT_ACTIVITY_DEFAULT_ROWS } from "../selection.js"
import { cityClockParts } from "../../clock.js"
import { clockFaceText } from "../fields.js"
import type { ClientPack } from "../../packview.js"

/** Attest log ids are `cityId:cityTime`; the city clock of that tick is the row time. */
export function logRowTime(id: string, pack: ClientPack): string | undefined {
  const colon = id.lastIndexOf(":")
  if (colon < 0) return undefined
  const raw = id.slice(colon + 1)
  if (!/^\d+$/.test(raw)) return undefined
  const parts = cityClockParts({
    cityTime: BigInt(raw),
    ticksDay: pack.ticksDay,
    anchorDay: pack.anchorDay,
    anchorWeekday: pack.anchorWeekday,
    weekDays: pack.weekDays,
  })
  return clockFaceText(parts.hour)
}

export function RecentActivityLook(props: {
  readonly view: HudView
  readonly strings: StringTable
  readonly extra: readonly { readonly id: string; readonly key: string; readonly text: string }[]
  readonly onViewAll?: () => void
  readonly pack?: ClientPack
  readonly previewTimes?: readonly (string | undefined)[]
  readonly previewBuildingByKey?: Readonly<Record<string, string>>
}): ReactElement {
  const events = props.view.shell.events
  const used = new Set<string>()
  const unavailable = lookup(props.strings, "UI_UNAVAILABLE", used)
  const tickLabel = lookup(props.strings, "UI_LOG_TICK", used)
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
  // Newest tick first; the server appends in tick order.
  const ordered = props.pack === undefined ? rows : [...rows].reverse()
  const visible = kind === "ready" ? ordered.slice(0, RECENT_ACTIVITY_DEFAULT_ROWS) : []
  const viewAll = props.onViewAll
  const previewTimes = props.previewTimes
  const previewBuildingByKey = props.previewBuildingByKey
  const pack = props.pack
  return (
    <section data-id="events" className="hud-panel hud-card hud-activity hud-economy hud-recent-activity" aria-label={events.title}>
      <header className="hud-economy__h">
        <span className="hud-economy__h-ico" aria-hidden="true">
          <HudIcon glyph="time" size="md" />
        </span>
        <h2 data-key={events.key} className="hud-economy__title">
          {events.title}
        </h2>
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
              tickLabel={tickLabel}
              time={previewTimes === undefined ? (pack === undefined ? undefined : logRowTime(row.id, pack)) : previewTimes[index]}
              buildingId={previewBuildingByKey === undefined ? "" : (previewBuildingByKey[row.key] ?? "")}
            />
          ))}
        </div>
      ) : null}
      {viewAll === undefined ? (
        <span data-key={props.view.shell.viewAllKey} className="hud-recent-activity__view">
          {props.view.shell.viewAll}
          <HudIcon glyph="go" size="sm" />
        </span>
      ) : (
        <button type="button" data-key={props.view.shell.viewAllKey} className="hud-recent-activity__view hud-linkbtn" onClick={viewAll}>
          {props.view.shell.viewAll}
          <HudIcon glyph="go" size="sm" />
        </button>
      )}
    </section>
  )
}

function ActivityRow(props: {
  readonly row: EventRowView
  readonly unavailable: string
  readonly tickLabel: string
  readonly time: string | undefined
  readonly buildingId: string
}): ReactElement {
  const time = props.time
  const buildingId = props.buildingId
  // Attestation rows carry no subject of their own: the subject is the tick,
  // the badge (recorded / verified / degraded) is the detail line.
  const attestRow = props.row.key.startsWith("UI_ATTEST_")
  const name = attestRow ? props.tickLabel : props.row.text
  const detail = attestRow ? props.row.badgeText : props.row.badgeText.length > 0 ? props.row.badgeText : props.row.key
  const tone = props.row.badgeKey === "UI_ATTEST_DEGRADED" ? "warn" : props.row.badgeKey.length > 0 ? "ok" : "muted"
  return (
    <article className="hud-event hud-recent-activity__row" data-key={props.row.key} data-event-id={props.row.id}>
      {time === undefined ? (
        <span
          className="hud-recent-activity__time hud-unavailable"
          data-key="UI_UNAVAILABLE"
          data-state="unavailable"
          title={props.unavailable}
          aria-label={props.unavailable}
        >
          {"—"}
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
      <span className="hud-recent-activity__dot hud-dot" data-tone={tone} />
      <span className="hud-recent-activity__copy">
        <span className="hud-recent-activity__name">{name}</span>
        <span className="hud-recent-activity__text" data-key={props.row.badgeKey}>
          {detail}
        </span>
      </span>
    </article>
  )
}
