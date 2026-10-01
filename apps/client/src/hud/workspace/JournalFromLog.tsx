import { useState, type ReactElement } from "react"
import type { ClientPack } from "../../packview.js"
import { lookup, type StringTable } from "../../strings.js"
import type { EventRowView } from "../fields.js"
import type { HudView } from "../model.js"
import { journalBucket, journalMatchesBucket, type JournalBucket } from "../journalBuckets.js"
import { EmptyState, ErrorState, UnavailableState } from "../parts/Empty.js"
import { glyphForJournal, HudIcon } from "../parts/HudIcon.js"
import { Loading } from "../parts/Loading.js"
import { PanelHeader } from "../parts/PanelHeader.js"
import { WorkspaceTabs } from "../parts/WorkspaceTabs.js"
import { logRowTime } from "../studio/RecentActivityLook.js"

type JournalFilter = "all" | JournalBucket

export function JournalFromLog(props: {
  readonly view: HudView
  readonly strings: StringTable
  readonly pack?: ClientPack
  readonly extra: readonly { readonly id: string; readonly key: string; readonly text: string }[]
  readonly openId: string
  readonly onBadge: (id: string) => void
}): ReactElement {
  const [bucket, setBucket] = useState<JournalFilter>("all")
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const titleRow = props.view.right.find((row) => row.id === "log")
  const title = titleRow === undefined ? navLabel(props.view, "journal") : titleRow.title
  const titleKey = titleRow === undefined ? "UI_LOG" : titleRow.key
  const notify = props.view.shell.notifications
  const logKind = props.view.shell.events.kind
  if (logKind === "loading") {
    return (
      <section data-id="journal" className="hud-card">
        <div className="hud-card__body">
          <Loading kind="events" text={t("UI_EVENTS_LOADING")} textKey="UI_EVENTS_LOADING" />
        </div>
      </section>
    )
  }
  if (logKind === "error") {
    return (
      <section data-id="journal" className="hud-card">
        <div className="hud-card__body">
          <ErrorState textKey="UI_EVENTS_ERROR" text={t("UI_EVENTS_ERROR")} />
        </div>
      </section>
    )
  }
  if (logKind === "unavailable") {
    return (
      <section data-id="journal" data-log-kind="unavailable" className="hud-card">
        <section data-id="notifications" className="hud-card__block" data-notify-kind={notify.kind}>
          <PanelHeader title={t("UI_NOTIFICATIONS")} titleKey="UI_NOTIFICATIONS" glyph="log" />
          {notify.kind === "ready" ? (
            <p data-key={notify.key} className="hud-muted">
              {notify.text}
            </p>
          ) : (
            <UnavailableState textKey={notify.key} text={notify.text} />
          )}
        </section>
        <div className="hud-card__body">
          <UnavailableState textKey="UI_UNAVAILABLE" text={t("UI_UNAVAILABLE")} />
        </div>
      </section>
    )
  }
  const extras =
    logKind === "ready" || logKind === "empty"
      ? props.extra.map((a) => ({
          id: a.id,
          key: a.key,
          text: a.text,
          badgeKey: "UI_ATTEST_LOGGED",
          badgeText: "",
          root: "",
          cid: "",
        }))
      : []
  const rows = [...props.view.log, ...extras].filter((a) => journalMatchesBucket(a.key, bucket))
  const pack = props.pack
  const ordered = pack === undefined ? rows : [...rows].reverse()
  const unavailable = t("UI_UNAVAILABLE")
  const tabs = [
    { id: "all" as const, key: "UI_JOURNAL_ALL", label: t("UI_JOURNAL_ALL") },
    { id: "idle" as const, key: "UI_JOURNAL_IDLE", label: t("UI_JOURNAL_IDLE") },
    { id: "transport" as const, key: "UI_JOURNAL_TRANSPORT", label: t("UI_JOURNAL_TRANSPORT") },
  ]
  return (
    <section data-id="journal" data-key={titleKey} data-log-kind={logKind} className="hud-journal">
      <p className="hud-journal__unread" data-id="notifications" data-notify-kind={notify.kind}>
        <span data-key="UI_NOTIFICATIONS">{t("UI_NOTIFICATIONS")}</span>
        {notify.kind === "ready" ? (
          <span data-key={notify.key} data-exact={notify.exact}>
            {notify.text}
          </span>
        ) : (
          <UnavailableState textKey={notify.key} text={notify.text} />
        )}
      </p>
      <div className="hud-journal__filters">
        <WorkspaceTabs
          label={title}
          tabPrefix="hud-tab-journal-"
          panelId={() => "hud-panel-journal"}
          tabs={tabs}
          active={bucket}
          onPick={setBucket}
        />
      </div>
      <div key={bucket} role="tabpanel" id="hud-panel-journal" aria-labelledby={`hud-tab-journal-${bucket}`}>
        {ordered.length === 0 ? (
          <EmptyState textKey="UI_EMPTY_NO_ENTITIES" text={props.view.logEmpty} />
        ) : (
          <div className="hud-journal__list" role="feed">
            {ordered.map((row) => (
              <JournalEntry
                key={row.id}
                row={row}
                time={pack === undefined ? undefined : logRowTime(row.id, pack)}
                unavailable={unavailable}
                open={props.openId === row.id}
                onBadge={props.onBadge}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function JournalEntry(props: {
  readonly row: EventRowView
  readonly time: string | undefined
  readonly unavailable: string
  readonly open: boolean
  readonly onBadge: (id: string) => void
}): ReactElement {
  const row = props.row
  const hasProof = row.root.length > 0 && row.cid.length > 0
  const tone = row.badgeKey === "UI_ATTEST_VERIFIED" ? "ok" : row.badgeKey === "UI_ATTEST_DEGRADED" ? "warn" : "muted"
  const time = props.time
  return (
    <article data-key={row.key} data-journal-bucket={journalBucket(row.key)} data-event-id={row.id} className="hud-journal__row">
      {time === undefined ? (
        <span className="hud-journal__time" data-key="UI_UNAVAILABLE" data-state="unavailable" title={props.unavailable}>
          —
        </span>
      ) : (
        <span className="hud-journal__time">{time}</span>
      )}
      <span className="hud-journal__ico" aria-hidden="true">
        <HudIcon glyph={glyphForJournal(journalBucket(row.key))} />
      </span>
      <span className="hud-journal__copy">
        <span className="hud-journal__name">{row.text}</span>
        {props.open && hasProof ? (
          <span data-key="UI_ATTEST_PROOF" className="hud-journal__proof">
            <span data-field="root">{row.root}</span>
            <span data-field="cid">{row.cid}</span>
          </span>
        ) : null}
      </span>
      {row.badgeText.length === 0 ? null : hasProof ? (
        <button type="button" data-attest={row.badgeKey} data-tone={tone} className="hud-journal__badge" onClick={() => props.onBadge(row.id)}>
          {row.badgeText}
        </button>
      ) : (
        <span data-attest={row.badgeKey} data-tone={tone} className="hud-journal__badge">
          {row.badgeText}
        </span>
      )}
    </article>
  )
}

function navLabel(view: HudView, id: string): string {
  for (const row of view.shell.nav) {
    if (row.id === id) return row.label
  }
  return ""
}
