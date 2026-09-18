import { useState, type ReactElement } from "react"
import { marketWindowOpen } from "../../clock.js"
import { lookup } from "../../strings.js"
import { exactBigint, type FieldView } from "../fields.js"
import { ActionButton } from "../parts/ActionButton.js"
import { StaleState, UnavailableState } from "../parts/Empty.js"
import { FactLine, Facts } from "../parts/Facts.js"
import { PanelHeader } from "../parts/PanelHeader.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"
import { TransactionStepper } from "../parts/TransactionStepper.js"
import { isLocalReview, isTxnInFlight, reviewTxn } from "../uiState.js"
import { commitMoney } from "./bank.js"

export type LiveQuoteKind = "unavailable" | "stale"

export type ExchangeLevelGate = "unavailable" | "locked" | "open"

/** Pack interval is never an executable live quote. */
export function liveQuoteKind(live: boolean | undefined, ageMs: bigint | undefined): LiveQuoteKind {
  if (live === false) return "stale"
  if (live === true && ageMs === undefined) return "stale"
  return "unavailable"
}

export function liveQuoteExecutable(live: boolean | undefined, ageMs: bigint | undefined): boolean {
  void live
  void ageMs
  return false
}

/** City Level 2 is `level > 1`. Missing is not zero. */
export function exchangeLevelGate(level: FieldView): ExchangeLevelGate {
  const n = exactBigint(level)
  if (n === undefined) return "unavailable"
  if (n <= 1n) return "locked"
  return "open"
}

export function ExchangeScreen(props: ScreenProps): ReactElement {
  const first = props.pack.districts[0]
  const [ticker, setTicker] = useState(first === undefined ? "" : first.ticker)
  const [amount, setAmount] = useState("")
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const quoteKind = liveQuoteKind(props.view.quoteLive, props.view.quoteAgeMs)
  const executable = liveQuoteExecutable(props.view.quoteLive, props.view.quoteAgeMs)
  const hoursOpen = marketWindowOpen(props.view.plaque.key)
  const hoursKey = props.view.plaque.key
  const levelGate = exchangeLevelGate(props.view.shell.cityLevel)
  const txn = props.moneyTxn
  const screen: ScreenProps = {
    ...props,
    onIntent: (intent, extra) => commitMoney(txn, props.onMoneyTxn, () => props.onIntent(intent, extra)),
    onCommit: (effect, extra) => commitMoney(txn, props.onMoneyTxn, () => props.onCommit(effect, extra)),
  }
  const quoteLocked = !executable
  const marketLocked = !hoursOpen || levelGate !== "open"
  const locked = quoteLocked || marketLocked
  return (
    <ScreenFrame id="exchange" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <form
        className="hud-card hud-form"
        data-hours-open={hoursOpen ? "1" : "0"}
        data-hours-reason={hoursKey}
        data-city-level-gate={levelGate}
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <PanelHeader title={t("UI_TICKER")} titleKey="UI_TICKER" glyph="market" />
        <div className="hud-card__body">
          <label data-key="UI_TICKER" className="hud-card__label" htmlFor="hud-ex-ticker">
            {t("UI_TICKER")}
          </label>
          <select
            id="hud-ex-ticker"
            name="ticker"
            value={ticker}
            data-unit="UI_TICKER"
            data-stock-token={ticker}
            aria-label={t("UI_TICKER")}
            disabled={isTxnInFlight(txn) || marketLocked}
            onChange={(e) => {
              setTicker(e.target.value)
              if (isTxnInFlight(txn) || marketLocked) return
              props.onMoneyTxn({ kind: "preparing", messageKey: "UI_TXN_PREPARING" })
            }}
          >
            {props.pack.districts.map((d) => (
              <option key={d.id} value={d.ticker}>
                {d.ticker}
              </option>
            ))}
          </select>
          <label data-key="UI_AMOUNT" className="hud-card__label" htmlFor="hud-ex-amount">
            {t("UI_AMOUNT")} · {t("UI_CORP")}
          </label>
          <input
            id="hud-ex-amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            data-unit="UI_CORP"
            data-receive-unit={ticker}
            data-exact={amount}
            value={amount}
            aria-label={`${t("UI_AMOUNT")} ${t("UI_CORP")}`}
            disabled={isTxnInFlight(txn) || marketLocked}
            onChange={(e) => {
              setAmount(e.target.value)
              if (isTxnInFlight(txn) || marketLocked) return
              props.onMoneyTxn({ kind: "preparing", messageKey: "UI_TXN_PREPARING" })
            }}
          />
          <p data-stock-token={ticker} className="hud-muted">
            {ticker}
          </p>
          <div data-key="UI_CITY_LEVEL" className="hud-row">
            <span className="hud-muted">{t("UI_CITY_LEVEL")}</span>
            {levelGate === "open" ? (
              <span data-exact={props.view.shell.cityLevel.exact}>{props.view.shell.cityLevel.text}</span>
            ) : (
              <UnavailableState textKey="UI_UNAVAILABLE" text={t("UI_UNAVAILABLE")} />
            )}
          </div>
          {!hoursOpen ? <UnavailableState textKey={hoursKey} text={props.view.plaque.text} /> : null}
        </div>
      </form>
      <section data-quote-kind={quoteKind} className="hud-card">
        <PanelHeader title={t("UI_QUOTE")} titleKey="UI_QUOTE" glyph="market" />
        <Facts>
          <FactLine label={t("UI_QUOTE")} labelKey="UI_QUOTE" valueKey="UI_QUOTE">
            <span data-quote-source="pack" data-live="0" data-exact={`${props.view.quoteLo}:${props.view.quoteHi}`}>
              {props.view.quoteLo}–{props.view.quoteHi}
            </span>
          </FactLine>
          <FactLine
            label={t("UI_LIVE_QUOTE")}
            labelKey="UI_LIVE_QUOTE"
            valueKey={quoteKind === "stale" ? "UI_QUOTE_STALE" : "UI_QUOTE_UNAVAILABLE"}
            missing={true}
          >
            {quoteKind === "stale" ? (
              <StaleState textKey="UI_QUOTE_STALE" text={t("UI_QUOTE_STALE")} />
            ) : (
              <UnavailableState textKey="UI_QUOTE_UNAVAILABLE" text={t("UI_QUOTE_UNAVAILABLE")} />
            )}
          </FactLine>
        </Facts>
        <p data-key="UI_MARKET_VS_EFFICIENCY" className="hud-muted hud-card__caption">
          {t("UI_MARKET_VS_EFFICIENCY")}
        </p>
      </section>
      <TransactionStepper state={txn} t={t} />
      {isLocalReview(txn) ? (
        <ActionButton
          {...screen}
          actionId="exchange_buy"
          labelKey="UI_CONFIRM"
          locked={isTxnInFlight(txn) || locked}
          extra={{ ticker, amount }}
        />
      ) : (
        <button
          type="button"
          data-key="UI_REVIEW_TXN"
          className="hud-linkbtn"
          disabled={isTxnInFlight(txn) || locked}
          onClick={() => {
            if (isTxnInFlight(txn) || locked) return
            props.onMoneyTxn(reviewTxn())
          }}
        >
          {t("UI_REVIEW_TXN")}
        </button>
      )}
    </ScreenFrame>
  )
}
