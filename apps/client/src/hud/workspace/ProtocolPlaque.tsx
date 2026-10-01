import type { ReactElement } from "react"
import { lookup, type StringTable } from "../../strings.js"
import type { HudView } from "../model.js"
import { HudIcon, type HudGlyph } from "../parts/HudIcon.js"
import { TickerMark } from "../parts/TickerMark.js"
import { groupThousands } from "../parts/groupThousands.js"

const DASH = "—"

function unsignedGrouped(exact: string): string {
  const digits = exact.startsWith("-") ? exact.slice(1) : exact
  return groupThousands(digits)
}

function ProtocolStat(props: {
  readonly glyph: HudGlyph
  readonly label: string
  readonly labelKey: string
  readonly field: HudView["protocol"][number] | undefined
  readonly unit: string
  readonly unitKey: string
  readonly hint: string
  readonly hintKey: string
}): ReactElement {
  const field = props.field
  const ready = field !== undefined && field.kind === "ready"
  return (
    <div className="hud-protocol__stat">
      <HudIcon glyph={props.glyph} size={22} />
      <span data-key={props.labelKey} className="hud-protocol__k">
        {props.label}
      </span>
      <p data-key={ready ? field.key : "UI_UNAVAILABLE"} data-exact={ready ? field.value : ""} className="hud-protocol__v">
        {ready ? groupThousands(field.value) : DASH}
        {ready ? (
          <span data-key={props.unitKey} className="hud-protocol__u">
            {props.unit}
          </span>
        ) : null}
      </p>
      <p data-key={props.hintKey} className="hud-protocol__hint">
        {props.hint}
      </p>
    </div>
  )
}

export function ProtocolPlaque(props: {
  readonly view: HudView
  readonly strings: StringTable
  readonly tickers: readonly string[]
}): ReactElement {
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const eth = props.view.protocol.find((row) => row.id === "eth_in_flight")
  const vault = props.view.protocol.find((row) => row.id === "vault_corp")
  const studio = props.view.protocol.find((row) => row.id === "studio_eth")
  const studioReady = studio !== undefined && studio.kind === "ready"
  const unitEth = t("UI_UNIT_ETH")
  return (
    <section className="hud-protocol" data-key="UI_PROTOCOL">
      <span data-key="UI_PROTOCOL" className="hud-overview-summary__k">
        <HudIcon glyph="hex" size="md" />
        {t("UI_PROTOCOL")}
      </span>
      <div className="hud-protocol__pair">
        <ProtocolStat
          glyph="gem"
          label={t("UI_ETH_IN_FLIGHT")}
          labelKey="UI_ETH_IN_FLIGHT"
          field={eth}
          unit={unitEth}
          unitKey="UI_UNIT_ETH"
          hint={t("UI_ETH_FLIGHT_HINT")}
          hintKey="UI_ETH_FLIGHT_HINT"
        />
        <ProtocolStat
          glyph="coin"
          label={t("UI_VAULT_CORP")}
          labelKey="UI_VAULT_CORP"
          field={vault}
          unit={t("UI_UNIT_CORP")}
          unitKey="UI_UNIT_CORP"
          hint={t("UI_VAULT_HINT")}
          hintKey="UI_VAULT_HINT"
        />
      </div>
      <div className="hud-protocol__kettles" data-key="UI_PRIZE_KETTLES">
        <span className="hud-protocol__k hud-protocol__k--row">
          <HudIcon glyph="gift" size="sm" />
          {t("UI_PRIZE_KETTLES")}
        </span>
        <ul className="hud-protocol__marks">
          {props.tickers.map((ticker) => {
            const row = props.view.basket.find((item) => item.ticker === ticker)
            const amount = row === undefined ? DASH : `${unsignedGrouped(row.farm)} / ${unsignedGrouped(row.month)}`
            return (
              <li key={ticker} className="hud-protocol__mark" data-ticker={ticker} data-ready={row === undefined ? "0" : "1"}>
                <span className="hud-protocol__who">
                  <TickerMark ticker={ticker} className="hud-protocol__logo" />
                  <span className="hud-protocol__sym">{ticker}</span>
                </span>
                <span className="hud-protocol__amt">{amount}</span>
              </li>
            )
          })}
        </ul>
      </div>
      <div className="hud-protocol__studio">
        <HudIcon glyph="database" size={22} />
        <span data-key="UI_STUDIO_ETH" className="hud-protocol__k">
          {t("UI_STUDIO_ETH")}
          <span className="hud-protocol__dot" aria-hidden="true">
            {" "}
            ·
          </span>
        </span>
        <p data-key={studioReady ? studio.key : "UI_UNAVAILABLE"} data-exact={studioReady ? studio.value : ""} className="hud-protocol__studio-v">
          {studioReady ? groupThousands(studio.value) : DASH}
          {studioReady ? (
            <span data-key="UI_UNIT_ETH" className="hud-protocol__u">
              {unitEth}
            </span>
          ) : null}
        </p>
      </div>
      <p className="hud-protocol__note" data-key="UI_PROTOCOL_NOTE">
        <span className="hud-protocol__info">
          <HudIcon glyph="info" size="sm" />
        </span>
        <span>{t("UI_PROTOCOL_NOTE")}</span>
      </p>
    </section>
  )
}
