import { memo, type ReactElement } from "react"
import { journalBucket } from "../journalBuckets.js"
import type { HudView } from "../model.js"
import { glyphForJournal, HudIcon } from "./HudIcon.js"

export type JournalEventRow = HudView["log"][number]

export type EventKicker = {
  readonly key: string
  readonly text: string
}

export type EventRowProps = {
  readonly row: JournalEventRow
  readonly open: boolean
  readonly variant?: "compact" | "detail"
  readonly kicker: EventKicker
  readonly unavailable: string
  readonly timeLabel: string
  readonly entityLabel: string
  readonly unreadLabel: string
  readonly onProof: (id: string) => void
}

export const EventRow = memo(function EventRow(props: EventRowProps): ReactElement {
  const row = props.row
  const variant = props.variant ?? "detail"
  const bucket = journalBucket(row.key)
  const hasProof = row.root.length > 0 && row.cid.length > 0
  return (
    <article
      data-key={row.key}
      data-journal-bucket={bucket}
      data-event-id={row.id}
      data-event-variant={variant}
      className={variant === "compact" ? "hud-event hud-event--compact" : "hud-event"}
    >
      <span className="hud-event__icon" aria-hidden="true">
        <HudIcon glyph={glyphForJournal(bucket)} />
      </span>
      <div className="hud-event__body">
        <header className="hud-event__h">
          <span data-key={props.kicker.key} className="hud-event__title">
            {props.kicker.text}
          </span>
          {row.badgeText.length > 0 && (variant === "detail" || hasProof) ? (
            <button
              type="button"
              data-attest={row.badgeKey}
              className="hud-attest"
              disabled={!hasProof}
              onClick={() => {
                if (!hasProof) return
                props.onProof(row.id)
              }}
            >
              {row.badgeText}
            </button>
          ) : null}
        </header>
        <p className="hud-event__text">{row.text}</p>
        {variant === "detail" ? (
          <dl className="hud-event__meta" data-event-missing="timestamp-entity-unread">
            <div className="hud-event__meta-row" data-field="timestamp">
              <dt data-key="UI_CITY_TIME">{props.timeLabel}</dt>
              <dd data-state="unavailable" data-key="UI_UNAVAILABLE">
                {props.unavailable}
              </dd>
            </div>
            <div className="hud-event__meta-row" data-field="entity">
              <dt data-key="UI_SELECTED_BUILDING">{props.entityLabel}</dt>
              <dd data-state="unavailable" data-key="UI_UNAVAILABLE">
                {props.unavailable}
              </dd>
            </div>
            <div className="hud-event__meta-row" data-field="unread">
              <dt data-key="UI_NOTIFICATIONS">{props.unreadLabel}</dt>
              <dd data-state="unavailable" data-key="UI_UNAVAILABLE">
                {props.unavailable}
              </dd>
            </div>
          </dl>
        ) : null}
        {variant === "detail" && props.open && hasProof ? (
          <div data-key="UI_ATTEST_PROOF" className="hud-event__proof">
            <span data-field="root">{row.root}</span>
            <span data-field="cid">{row.cid}</span>
          </div>
        ) : null}
      </div>
    </article>
  )
})

export const EventItem = EventRow
