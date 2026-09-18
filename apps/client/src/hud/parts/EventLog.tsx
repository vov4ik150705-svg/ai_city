import type { ReactElement } from "react"
import { lookup, type StringTable } from "../../strings.js"
import { journalBucket, journalBucketTitleKey, type JournalBucket } from "../journalBuckets.js"
import { EmptyState, ErrorState, UnavailableState } from "./Empty.js"
import { EventRow, type EventKicker, type JournalEventRow } from "./EventRow.js"
import { Loading } from "./Loading.js"

export function eventKickers(strings: StringTable): Readonly<Record<JournalBucket, EventKicker>> {
  const used = new Set<string>()
  const t = (key: string): string => lookup(strings, key, used)
  const idleKey = journalBucketTitleKey("idle")
  const transportKey = journalBucketTitleKey("transport")
  const otherKey = journalBucketTitleKey("other")
  return {
    idle: { key: idleKey, text: t(idleKey) },
    transport: { key: transportKey, text: t(transportKey) },
    other: { key: otherKey, text: t(otherKey) },
  }
}

export function eventLogCopy(strings: StringTable): {
  readonly unavailable: string
  readonly timeLabel: string
  readonly entityLabel: string
  readonly unreadLabel: string
} {
  const used = new Set<string>()
  const t = (key: string): string => lookup(strings, key, used)
  return {
    unavailable: t("UI_UNAVAILABLE"),
    timeLabel: t("UI_CITY_TIME"),
    entityLabel: t("UI_SELECTED_BUILDING"),
    unreadLabel: t("UI_NOTIFICATIONS"),
  }
}

export function EventLog(props: {
  readonly kind: "loading" | "error" | "empty" | "ready" | "unavailable"
  readonly variant?: "compact" | "detail"
  readonly messageKey: string
  readonly message: string
  readonly rows: readonly JournalEventRow[]
  readonly bound: number | undefined
  readonly openId: string
  readonly kickers: Readonly<Record<JournalBucket, EventKicker>>
  readonly unavailable: string
  readonly timeLabel: string
  readonly entityLabel: string
  readonly unreadLabel: string
  readonly onProof: (id: string) => void
}): ReactElement {
  if (props.kind === "loading") {
    return <Loading kind="events" text={props.message} textKey={props.messageKey} />
  }
  if (props.kind === "error") return <ErrorState textKey={props.messageKey} text={props.message} />
  if (props.kind === "unavailable") return <UnavailableState textKey={props.messageKey} text={props.message} />
  if (props.kind === "empty") return <EmptyState textKey={props.messageKey} text={props.message} />
  const cap = props.bound
  const rows = cap === undefined ? props.rows : props.rows.slice(0, cap)
  return (
    <div className="hud-eventlog" role="feed">
      {rows.map((row) => {
        const kicker = props.kickers[journalBucket(row.key)] ?? props.kickers.other
        return (
          <EventRow
            key={row.id}
            row={row}
            open={props.openId === row.id}
            {...(props.variant === undefined ? {} : { variant: props.variant })}
            kicker={kicker}
            unavailable={props.unavailable}
            timeLabel={props.timeLabel}
            entityLabel={props.entityLabel}
            unreadLabel={props.unreadLabel}
            onProof={props.onProof}
          />
        )
      })}
    </div>
  )
}
