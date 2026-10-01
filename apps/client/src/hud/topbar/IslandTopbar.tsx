import { useState, type ReactElement } from "react"
import { screens } from "@corporator/protocol"
import type { HudView } from "../model.js"
import { lookup, type StringTable } from "../../strings.js"
import { CorpMark } from "../parts/CorpMark.js"
import { HudIcon } from "../parts/HudIcon.js"
import { BRAND_MARK_URL } from "../parts/hudArtUrls.js"
import { formatCorp } from "../parts/si.js"
import { TimeWidget } from "./TimeWidget.js"
import { WalletFlyout, type WalletFlyoutState } from "./WalletFlyout.js"

export type TopbarWallet = {
  readonly address: string
  readonly connect: () => Promise<string>
  readonly disconnect: () => void
}

function compactPlaque(text: string): string {
  const parts = text.split(" · ")
  const first = parts[0]
  const head = first === undefined ? text : first
  const cut = head.indexOf(",")
  return cut > 0 ? head.slice(0, cut).trim() : head
}

/** Design-reference 00 topbar: brand · city/level · day/time slider · bank plaque ·
 * season · bell · connection chip · $CORP chip (flyout 16/17). */
export function IslandTopbar(props: {
  readonly view: HudView
  readonly onNavigate: (id: string) => void
  readonly strings?: StringTable
  readonly wallet?: TopbarWallet
  readonly linkStale?: boolean
  readonly demo?: boolean
  readonly chainId?: bigint
  readonly weiDecimals?: bigint
}): ReactElement {
  const shell = props.view.shell
  const [flyout, setFlyout] = useState(false)
  const used = new Set<string>()
  const strings = props.strings
  const t = (key: string, fallback: string): string => (strings === undefined ? fallback : lookup(strings, key, used))
  const unread = shell.notifications.kind === "ready" ? shell.notifications.text : ""
  const showBadge = unread.length > 0 && unread !== "0"
  const notifyLabel = shell.notifications.kind === "unavailable" ? shell.notifications.text : shell.notificationsLabel
  const bankOpen = props.view.plaque.key === "UI_BANK"
  const linkStale = props.linkStale === true
  const demo = props.demo === true
  const connectionKey = linkStale ? "UI_CONNECTION_STALE" : shell.connection.key
  const connectionText = linkStale ? t("UI_CONNECTION_STALE", shell.connection.text) : shell.connection.text
  const connectionTone = linkStale ? "warn" : demo ? "muted" : "ok"
  const wallet = props.wallet
  const walletConnected = wallet !== undefined && wallet.address.length > 0
  const corp = props.view.corp
  const corpDisplay =
    walletConnected && corp !== undefined && props.weiDecimals !== undefined
      ? formatCorp(corp, props.weiDecimals)
      : undefined
  const flyoutState: WalletFlyoutState = {
    address: wallet === undefined ? "" : wallet.address,
    chainWrong: props.view.gate?.chainWrong,
    corpDisplay,
    stocks: props.view.stocks.map((row) => ({
      ticker: row.ticker,
      display:
        walletConnected && row.held !== undefined && props.weiDecimals !== undefined
          ? formatCorp(row.held, props.weiDecimals)
          : undefined,
    })),
    chainId: props.chainId ?? 0n,
  }
  return (
    <header data-surface={screens.topbar} className="hud-topbar" role="banner">
      <div className="hud-topbar__brand">
        <img className="hud-brand__mark" src={BRAND_MARK_URL} alt="" />
        <h1 className="hud-brand" data-key={shell.brandKey}>
          {shell.brand}
        </h1>
      </div>
      <div className="hud-topbar__identity">
        <span data-key={shell.cityLabelKey} className="hud-topbar__city">
          {shell.cityLabel}
        </span>
        <span className="hud-topbar__sep" aria-hidden="true" />
        <button
          type="button"
          className="hud-topbar__level"
          data-city-level-entry="topbar"
          onClick={() => {
            props.onNavigate("city_level")
          }}
        >
          <span data-key="UI_LEVEL" className="hud-topbar__level-label">
            {t("UI_LEVEL", shell.cityLevelLabel)}
          </span>{" "}
          {shell.cityLevel.kind === "unavailable" ? (
            <span data-key="UI_UNAVAILABLE" className="hud-unavailable">
              {shell.cityLevel.text}
            </span>
          ) : (
            <span data-key={shell.cityLevel.key} className="hud-topbar__level-value">
              {shell.cityLevel.text}
            </span>
          )}
        </button>
      </div>
      <div className="hud-topbar__clock">
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
          showDaySun={true}
        />
      </div>
      <div className="hud-topbar__tools">
        <button
          type="button"
          data-key={props.view.plaque.key}
          data-bank={bankOpen ? "open" : "closed"}
          title={props.view.plaque.text}
          className="hud-plaque"
          onClick={() => {
            props.onNavigate("bank")
          }}
        >
          {compactPlaque(props.view.plaque.text)}
        </button>
        <button
          type="button"
          data-key={shell.season.key}
          data-leaderboard-entry="live"
          className={`hud-chip hud-chip--season${shell.season.kind === "unavailable" ? " hud-chip--muted" : ""}`}
          onClick={() => {
            props.onNavigate("leaderboard")
          }}
        >
          {shell.season.text}
        </button>
        <button
          type="button"
          data-key={shell.notifications.key}
          className="hud-bell"
          aria-label={notifyLabel}
          onClick={() => {
            props.onNavigate("journal")
          }}
        >
          <HudIcon glyph="bell" size="md" />
          {showBadge ? <span className="hud-bell__badge">{unread}</span> : null}
        </button>
        <span data-key={connectionKey} data-id="connection" data-tone={connectionTone} className="hud-chip hud-chip--link" role="status">
          <span className="hud-dot" data-tone={connectionTone} aria-hidden="true" />
          {connectionText}
        </span>
        <div className="hud-topbar__wallet">
          <button
            type="button"
            data-id="corp-chip"
            data-key="UI_CORP"
            data-wallet={walletConnected ? "connected" : "disconnected"}
            aria-expanded={flyout}
            aria-haspopup="dialog"
            className={`hud-chip hud-chip--corp${walletConnected ? "" : " hud-chip--muted"}`}
            onClick={() => {
              setFlyout((cur) => !cur)
            }}
          >
            <CorpMark kind="chip" />
            <span className="hud-chip__unit">{t("UI_CORP", "$CORP")}</span>
            {corpDisplay === undefined ? (
              <span className="hud-chip__dash" aria-hidden="true">
                {"—"}
              </span>
            ) : (
              <span className="hud-chip__value">{corpDisplay}</span>
            )}
          </button>
          {flyout && strings !== undefined ? (
            <WalletFlyout
              strings={strings}
              state={flyoutState}
              onConnect={wallet === undefined ? async () => "" : wallet.connect}
              onDisconnect={() => {
                setFlyout(false)
                if (wallet !== undefined) wallet.disconnect()
              }}
              onOpenBank={() => {
                setFlyout(false)
                props.onNavigate("bank")
              }}
              onClose={() => {
                setFlyout(false)
              }}
            />
          ) : null}
        </div>
      </div>
    </header>
  )
}
