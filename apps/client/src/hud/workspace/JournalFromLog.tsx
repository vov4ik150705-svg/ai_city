import { useState, type ReactElement } from "react"
import { lookup, type StringTable } from "../../strings.js"
import type { HudView } from "../model.js"
import { ErrorState, UnavailableState } from "../parts/Empty.js"
import { Loading } from "../parts/Loading.js"
import { EventLog, eventKickers, eventLogCopy } from "../parts/EventLog.js"
import { journalMatchesBucket, type JournalBucket } from "../journalBuckets.js"
import { WorkspaceTabs } from "../parts/WorkspaceTabs.js"
import { PanelHeader } from "../parts/PanelHeader.js"

type JournalFilter = "all" | JournalBucket

export function JournalFromLog(props: {
  readonly view: HudView
  readonly strings: StringTable
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
  const copy = eventLogCopy(props.strings)
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
  const tabs = [
    { id: "all" as const, key: "UI_JOURNAL_ALL", label: t("UI_JOURNAL_ALL") },
    { id: "idle" as const, key: "UI_JOURNAL_IDLE", label: t("UI_JOURNAL_IDLE") },
    { id: "transport" as const, key: "UI_JOURNAL_TRANSPORT", label: t("UI_JOURNAL_TRANSPORT") },
  ]
  return (
    <section data-id="journal" data-key={titleKey} data-log-kind={logKind} className="hud-card hud-journal">
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
      <div role="tabpanel" id="hud-panel-journal" aria-labelledby={`hud-tab-journal-${bucket}`} className="hud-card__body">
        <EventLog
          kind={rows.length === 0 ? "empty" : "ready"}
          messageKey="UI_EMPTY_NO_ENTITIES"
          message={props.view.logEmpty}
          rows={rows}
          bound={undefined}
          openId={props.openId}
          kickers={eventKickers(props.strings)}
          unavailable={copy.unavailable}
          timeLabel={copy.timeLabel}
          entityLabel={copy.entityLabel}
          unreadLabel={copy.unreadLabel}
          onProof={props.onBadge}
        />
      </div>
    </section>
  )
}

function navLabel(view: HudView, id: string): string {
  for (const row of view.shell.nav) {
    if (row.id === id) return row.label
  }
  return ""
}
