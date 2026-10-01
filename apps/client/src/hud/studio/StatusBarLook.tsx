import type { ReactElement } from "react"
import type { HudView } from "../model.js"
import { HudIcon } from "../parts/HudIcon.js"

function compactPlaque(text: string): string {
  const parts = text.split(" · ")
  const first = parts[0]
  return first === undefined ? text : first
}

export function StatusBarLook(props: {
  readonly view: HudView
  readonly onNotify?: () => void
  readonly onWallet?: () => void
  readonly onSeason?: () => void
}): ReactElement {
  const shell = props.view.shell
  const unread = shell.notifications.kind === "ready" ? shell.notifications.text : ""
  const notifyLabel = shell.notifications.kind === "unavailable" ? shell.notifications.text : shell.notificationsLabel
  const showBadge = unread.length > 0 && unread !== "0"
  const onNotify = props.onNotify
  const onWallet = props.onWallet
  const onSeason = props.onSeason
  return (
    <section className="hud-economy hud-status-bar" aria-label={shell.season.text}>
      <span data-key={props.view.plaque.key} title={props.view.plaque.text} className="hud-status-bar__bank">
        <span className="hud-status-bar__dot" aria-hidden="true" />
        {compactPlaque(props.view.plaque.text)}
      </span>
      {onSeason === undefined ? (
        <span data-key={shell.season.key} className="hud-status-bar__season">
          {shell.season.text}
        </span>
      ) : (
        <button
          type="button"
          data-key={shell.season.key}
          data-leaderboard-entry="live"
          className="hud-status-bar__season"
          onClick={onSeason}
        >
          {shell.season.text}
        </button>
      )}
      {onNotify === undefined ? (
        <span className="hud-status-bar__notification" aria-label={notifyLabel}>
          <HudIcon glyph="bell" size="md" />
          {showBadge ? <span className="hud-status-bar__badge">{unread}</span> : null}
        </span>
      ) : (
        <button
          type="button"
          data-key={shell.notifications.key}
          className="hud-status-bar__notification"
          aria-label={notifyLabel}
          onClick={onNotify}
        >
          <HudIcon glyph="bell" size="md" />
          {showBadge ? <span className="hud-status-bar__badge">{unread}</span> : null}
        </button>
      )}
      {onWallet === undefined ? (
        <HudIcon glyph="wallet" size="md" />
      ) : (
        <button type="button" data-key={shell.manageFundsKey} className="hud-status-bar__wallet" aria-label={shell.manageFunds} onClick={onWallet}>
          <HudIcon glyph="wallet" size="md" />
        </button>
      )}
    </section>
  )
}
