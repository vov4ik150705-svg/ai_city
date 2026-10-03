import { useState, type ReactElement } from "react"
import { codes } from "@corporator/protocol"
import { marketWindowOpen } from "../../clock.js"
import { format, lookup } from "../../strings.js"
import { clockFaceText, exactBigint, type FieldView } from "../fields.js"
import { evaluateActionGate } from "../gates.js"
import { displayDistrictRole } from "../parts/IndustryCard.js"
import { ActionButton } from "../parts/ActionButton.js"
import { BRAND_TOKEN_URL } from "../parts/hudArtUrls.js"
import { TickerMark } from "../parts/TickerMark.js"
import { HudIcon } from "../parts/HudIcon.js"
import { Refusal } from "../parts/refusal.js"
import { amountFieldText, amountInsertAllowed, formatCorp, formatCorpField, groupDigits, moneyAtoms } from "../parts/si.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"
import { TransactionStepper } from "../parts/TransactionStepper.js"
import { isLocalReview, isTxnInFlight, reviewTxn } from "../uiState.js"
import type { Json } from "@corporator/contentpack"
import { runCsCommand, type CsCommandResult } from "../walletTx.js"
import type { WalletRequest } from "../../walletLogin.js"
import { commitMoney } from "./bank.js"

export type LiveQuoteKind = "unavailable" | "stale" | "ready"

export type ExchangeLevelGate = "unavailable" | "locked" | "open"

/** Pack interval is never an executable live quote. Live means feed_live and a positive age. */
export function liveQuoteKind(live: boolean | undefined, ageMs: bigint | undefined): LiveQuoteKind {
  if (live === true && ageMs !== undefined && ageMs > 0n) return "ready"
  if (live === false) return "stale"
  if (live === true && ageMs === undefined) return "stale"
  return "unavailable"
}

export function liveQuoteExecutable(live: boolean | undefined, ageMs: bigint | undefined): boolean {
  if (liveQuoteKind(live, ageMs) !== "ready") return false
  return true
}

/** Prize-asset order. Object-key order of the districts section is not the canon row. */
export function orderedExchangeDistricts<T extends { readonly ticker: string }>(
  districts: readonly T[],
  prizeAssets: readonly string[],
): readonly T[] {
  const rank = new Map<string, number>()
  for (let i = 0; i < prizeAssets.length; i += 1) {
    const ticker = prizeAssets[i]
    if (ticker !== undefined && !rank.has(ticker)) rank.set(ticker, i)
  }
  return [...districts].sort((a, b) => {
    const left = rank.get(a.ticker)
    const right = rank.get(b.ticker)
    if (left === undefined && right === undefined) return 0
    if (left === undefined) return 1
    if (right === undefined) return -1
    return left - right
  })
}

/** Open when the city has reached the exchange building's pack level. Missing is not zero. */
export function exchangeLevelGate(level: FieldView, required: bigint): ExchangeLevelGate {
  const n = exactBigint(level)
  if (n === undefined) return "unavailable"
  if (n < required) return "locked"
  return "open"
}

/** Button code in the same order the closed market shows: hours, then level, then the quote. */
export function exchangeBlockCode(args: {
  readonly hoursKey: string
  readonly levelGate: ExchangeLevelGate
  readonly quoteReady: boolean
}): string {
  if (args.hoursKey === "BANK_SUNDAY") return codes.BANK_SUNDAY
  if (args.hoursKey === "BANK_CLOSED") return codes.BANK_CLOSED
  if (args.levelGate !== "open") return codes.CITY_LEVEL_TOO_LOW
  if (!args.quoteReady) return codes.EXCHANGE_HOP_UNAVAILABLE
  return ""
}

/**
 * Live hop buys through the CS recipe. A dark hop returns the refusal and does not sign.
 */
export async function beginExchangeBuy(args: {
  readonly hopLive: boolean
  readonly post: (fields: { readonly [key: string]: Json }) => Promise<unknown>
  readonly wallet: WalletRequest | undefined
  readonly from: string
  readonly expectedChainId: bigint
  readonly rpcUrl: string
  readonly chainName: string
  readonly nativeSymbol: string
  readonly nativeDecimals: number
  readonly pollMs: bigint
  readonly timeoutMs: bigint
  readonly now: () => bigint
  readonly sleep: (ms: bigint) => Promise<void>
  readonly onStep?: (step: "sign" | "wait") => void
  readonly beforeConfirm?: () => Promise<void>
}): Promise<CsCommandResult> {
  if (!args.hopLive) return { kind: "failed", code: codes.EXCHANGE_HOP_UNAVAILABLE }
  return runCsCommand({
    post: args.post,
    wallet: args.wallet,
    from: args.from,
    expectedChainId: args.expectedChainId,
    rpcUrl: args.rpcUrl,
    chainName: args.chainName,
    nativeSymbol: args.nativeSymbol,
    nativeDecimals: args.nativeDecimals,
    pollMs: args.pollMs,
    timeoutMs: args.timeoutMs,
    now: args.now,
    sleep: args.sleep,
    ...(args.onStep === undefined ? {} : { onStep: args.onStep }),
    ...(args.beforeConfirm === undefined ? {} : { beforeConfirm: args.beforeConfirm }),
  })
}

export function ExchangeScreen(props: ScreenProps): ReactElement {
  const districts = orderedExchangeDistricts(props.pack.districts, props.pack.prizeAssets)
  const first = districts[0]
  const [ticker, setTicker] = useState(first === undefined ? "" : first.ticker)
  const [amount, setAmount] = useState("")
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const quoteKind = liveQuoteKind(props.view.quoteLive, props.view.quoteAgeMs)
  const executable = liveQuoteExecutable(props.view.quoteLive, props.view.quoteAgeMs)
  const hoursOpen = marketWindowOpen(props.view.plaque.key)
  const hoursKey = props.view.plaque.key
  const exchangeMeta = props.pack.buildingMeta["exchange"]
  const levelNeed = exchangeMeta === undefined ? 1n : exchangeMeta.cityLevelReq
  const levelGate = exchangeLevelGate(props.view.shell.cityLevel, levelNeed)
  const marketOpen = hoursOpen && levelGate === "open"
  const txn = props.moneyTxn
  const screen: ScreenProps = {
    ...props,
    onIntent: (intent, extra) => commitMoney(txn, props.onMoneyTxn, () => props.onIntent(intent, extra)),
    onCommit: (effect, extra) => commitMoney(txn, props.onMoneyTxn, () => props.onCommit(effect, extra)),
  }
  const buyAction = props.pack.actions["exchange_buy"]
  const buyGate =
    buyAction === undefined
      ? undefined
      : evaluateActionGate({
          pack: props.pack,
          action: buyAction,
          view: props.view,
          demo: props.demo,
          extraFailed: props.failed,
        })
  const walletCorp = props.view.accountKind === "wallet" ? props.view.corp : undefined
  const corpText = walletCorp === undefined ? undefined : formatCorp(walletCorp, props.pack.weiDecimals)
  const maxField = walletCorp === undefined ? undefined : formatCorpField(walletCorp, props.pack.weiDecimals)
  const quick = [props.pack.corpQuickSmall, props.pack.corpQuickMid, props.pack.corpQuickLarge]
  const buyAtoms = moneyAtoms(amount, "corp", props.pack.weiDecimals)
  const level = props.view.shell.cityLevel
  const hoursLabel = `${clockFaceText(props.pack.bankOpenHour)} – ${clockFaceText(props.pack.bankCloseHour)}`
  const statusKey = !hoursOpen ? "UI_CLOSED" : levelGate === "open" ? "UI_OPEN" : "UI_LOCKED"
  const statusTone = statusKey === "UI_OPEN" ? "ok" : "closed"
  const fieldsLive = marketOpen && !isTxnInFlight(txn)
  const blockCode = exchangeBlockCode({ hoursKey, levelGate, quoteReady: executable })
  const hopText = format(t(codes.EXCHANGE_HOP_UNAVAILABLE), {
    ticker: ticker.length === 0 ? t("UI_TICKER") : ticker,
  })
  const buttonRefusal = buyButtonRefusal(buyGate, props.view.accountKind, props.view.gate?.chainWrong, hopText, t)
  function setAmountLive(next: string): void {
    if (!fieldsLive) return
    setAmount(amountFieldText(next, "decimal", props.pack.weiDecimals))
  }
  function pickTicker(next: string): void {
    if (!fieldsLive) return
    setTicker(next)
  }
  return (
    <ScreenFrame id="exchange" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <section
        className="hud-exchange"
        data-hours-open={hoursOpen ? "1" : "0"}
        data-hours-reason={hoursKey}
        data-city-level-gate={levelGate}
        data-quote-kind={quoteKind}
        data-live={executable ? "1" : "0"}
        data-state={quoteKind}
        data-buy-stock={executable && marketOpen ? "live" : "blocked"}
        data-hop-priced={executable ? "1" : "0"}
      >
        <header className="hud-exchange__head">
          <span className="hud-exchange__mark" aria-hidden="true">
            <HudIcon glyph="tier" size="sm" />
          </span>
          <h2 data-key="UI_EXCHANGE" className="hud-exchange__name">
            {t("UI_EXCHANGE")}
          </h2>
          <span className="hud-bcard__status" data-key={statusKey} data-tone={statusTone}>
            <span className="hud-dot" data-tone={statusTone} />
            {t(statusKey)}
          </span>
          <p className="hud-exchange__meta">
            <span>{hoursLabel}</span>
            {" · "}
            <span data-key="UI_CITY_LEVEL" data-exact={level.exact}>
              {t("UI_CITY_LEVEL")} {level.kind === "unavailable" ? t("UI_UNAVAILABLE") : level.text}
            </span>
          </p>
        </header>
        {marketOpen ? (
          <>
            <div className="hud-exchange__tickers" data-key="UI_TICKER" data-unit="UI_TICKER">
              {districts.map((row) => {
                const on = row.ticker === ticker
                return (
                  <button
                    key={row.id}
                    type="button"
                    data-ticker={row.ticker}
                    data-stock-token={row.ticker}
                    {...(on ? { "data-receive-unit": row.ticker } : {})}
                    className={on ? "hud-exchange__ticker is-on" : "hud-exchange__ticker"}
                    aria-pressed={on}
                    disabled={!fieldsLive}
                    onClick={() => {
                      pickTicker(row.ticker)
                    }}
                  >
                    <span className="hud-exchange__pair">
                      <TickerMark ticker={row.ticker} className="hud-exchange__logo" />
                      <span className="hud-exchange__ticker-k">{row.ticker}</span>
                    </span>
                    <span className="hud-exchange__ticker-role">{displayDistrictRole(row.role)}</span>
                  </button>
                )
              })}
            </div>
            <div className="hud-exchange__trade">
              <div className="hud-exchange__amount">
                <label data-key="UI_AMOUNT" className="hud-exchange__k" htmlFor="hud-ex-amount">
                  {t("UI_AMOUNT")} {t("UI_CORP")}
                </label>
                <div className="hud-exchange__field">
                  <img className="hud-token" src={BRAND_TOKEN_URL} alt="" />
                  <input
                    id="hud-ex-amount"
                    type="text"
                    name="hud-ex-qty"
                    inputMode="decimal"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-form-type="other"
                    data-unit="UI_CORP"
                    data-exact={amount}
                    value={amount}
                    aria-label={`${t("UI_AMOUNT")} ${t("UI_CORP")}`}
                    disabled={!fieldsLive}
                    onBeforeInput={(event) => {
                      const native = event.nativeEvent
                      if (!(native instanceof InputEvent)) return
                      if (native.inputType === "insertFromPaste" || native.inputType === "insertFromDrop") return
                      const data = native.data
                      if (data === null) return
                      if (!amountInsertAllowed(data, "decimal", props.pack.weiDecimals)) event.preventDefault()
                    }}
                    onChange={(e) => {
                      setAmountLive(e.target.value)
                    }}
                  />
                </div>
              </div>
              <div className="hud-exchange__wallet" data-key="UI_WALLET_CORP">
                <span className="hud-exchange__k">{t("UI_WALLET_CORP")}</span>
                <span className="hud-exchange__wallet-v">
                  <img className="hud-token" src={BRAND_TOKEN_URL} alt="" />
                  {corpText === undefined || walletCorp === undefined ? (
                    <span data-key="UI_UNAVAILABLE">{"—"}</span>
                  ) : (
                    <span data-exact={walletCorp.toString()}>{corpText}</span>
                  )}
                </span>
              </div>
              <div className="hud-exchange__quick" data-key="UI_QUICK_AMOUNT">
                {quick.map((preset) => {
                  const exact = preset.toString()
                  return (
                    <button
                      key={exact}
                      type="button"
                      data-preset={exact}
                      className={amount === exact ? "hud-chip is-on" : "hud-chip"}
                      disabled={!fieldsLive}
                      onClick={() => {
                        setAmountLive(exact)
                      }}
                    >
                      {groupDigits(preset)}
                    </button>
                  )
                })}
                <button
                  type="button"
                  data-key="UI_MAX"
                  className={maxField !== undefined && amount === maxField ? "hud-chip is-on" : "hud-chip"}
                  disabled={!fieldsLive || maxField === undefined}
                  onClick={() => {
                    if (maxField === undefined) return
                    setAmountLive(maxField)
                  }}
                >
                  {t("UI_MAX")}
                </button>
              </div>
            </div>
            {executable ? (
              <p data-key="UI_LIVE_QUOTE" data-quote-source="live" data-live="1" className="hud-exchange__quote-line">
                {props.view.quoteCorpEth === undefined ? t("UI_LIVE_QUOTE") : props.view.quoteCorpEth.toString()}
              </p>
            ) : (
              <div className="hud-exchange__quote">
                <span className="hud-exchange__quote-ico" aria-hidden="true">
                  <HudIcon glyph="pulse" size="sm" />
                </span>
                <div>
                  <h3 data-key="UI_QUOTE_UNAVAILABLE" className="hud-exchange__quote-title">
                    {t("UI_QUOTE_UNAVAILABLE")}
                  </h3>
                  <p data-key={codes.EXCHANGE_HOP_UNAVAILABLE} data-stock-token={ticker} className="hud-exchange__quote-line">
                    {hopText}
                  </p>
                </div>
              </div>
            )}
            {executable ? (
              <>
                <TransactionStepper state={txn} t={t} />
                {isLocalReview(txn) ? (
                  <ActionButton
                    {...screen}
                    actionId="exchange_buy"
                    labelKey="UI_CONFIRM"
                    locked={isTxnInFlight(txn) || buyAtoms === undefined}
                    {...(buyAtoms === undefined ? { extra: { ticker } } : { extra: { ticker, amount: buyAtoms.toString() } })}
                  />
                ) : (
                  <button
                    type="button"
                    data-key="UI_REVIEW_TXN"
                    className="hud-linkbtn"
                    disabled={isTxnInFlight(txn) || buyAtoms === undefined}
                    onClick={() => {
                      if (isTxnInFlight(txn) || buyAtoms === undefined) return
                      props.onMoneyTxn(reviewTxn())
                    }}
                  >
                    {t("UI_REVIEW_TXN")}
                  </button>
                )}
              </>
            ) : (
                <button
                  type="button"
                  data-key="UI_BUY_STOCK"
                  data-intent="buy_stock"
                  data-blocked="1"
                  data-blocked-code={buttonRefusal.code === codes.EXCHANGE_HOP_UNAVAILABLE ? blockCode : buttonRefusal.code}
                  className="hud-btn hud-exchange__buy"
                  disabled
                  onClick={() => {
                    return
                  }}
                >
                <span className="hud-exchange__buy-label">
                  <HudIcon glyph="locked" size="sm" />
                  {t("UI_BUY_STOCK")}
                </span>
                {buttonRefusal.code.length > 0 ? (
                  <Refusal code={buttonRefusal.code} text={buttonRefusal.text} rest={buttonRefusal.rest} />
                ) : null}
              </button>
            )}
            {executable ? null : (
              <p className="hud-exchange__note" data-key="UI_EXCHANGE_NO_TRADE">
                <span className="hud-exchange__note-ico" aria-hidden="true">
                  <HudIcon glyph="info" size="xs" />
                </span>
                <span>{t("UI_EXCHANGE_NO_TRADE")}</span>
              </p>
            )}
          </>
        ) : (
          <>
            <p className="hud-exchange__gate" data-blocked-code={blockCode}>
              {!hoursOpen ? props.view.plaque.text : `${t("UI_CITY_LEVEL")} ${level.kind === "unavailable" ? t("UI_UNAVAILABLE") : level.text}. ${t("UI_LOCKED")}`}
            </p>
            <button type="button" className="hud-btn hud-exchange__buy" data-key="UI_LOCKED" data-intent="buy_stock" data-blocked="1" data-blocked-code={blockCode} disabled>
              {t("UI_LOCKED")}
              {blockCode.length > 0 ? <Refusal code={blockCode} text={shortRefusal(t(blockCode))} rest={[]} /> : null}
            </button>
          </>
        )}
        {props.stockOut === undefined ? null : (
          <p className="hud-exchange__note" data-key="UI_TOKENS_IN_WALLET" data-stock-out={props.stockOut}>
            <span data-key="UI_TOKENS_IN_WALLET">{t("UI_TOKENS_IN_WALLET")}</span>
            <span data-exact={props.stockOut}>{props.stockOut}</span>
          </p>
        )}
      </section>
    </ScreenFrame>
  )
}

function buyButtonRefusal(
  gate: ReturnType<typeof evaluateActionGate> | undefined,
  accountKind: string,
  chainWrong: boolean | undefined,
  hopText: string,
  t: (key: string) => string,
): { readonly code: string; readonly text: string; readonly rest: readonly string[] } {
  if (accountKind === "wallet" && chainWrong === true) {
    return { code: codes.WALLET_WRONG_CHAIN, text: t("UI_CHAIN_WRONG"), rest: [] }
  }
  if (gate?.kind === "blocked" && gate.refusal.code !== undefined && gate.refusal.code !== codes.EXCHANGE_HOP_UNAVAILABLE) {
    return { code: gate.refusal.code, text: shortRefusal(t(gate.refusal.code)), rest: gate.refusal.rest }
  }
  if (gate?.kind === "missing" && gate.token !== "hop_priced") {
    return { code: "UI_UNAVAILABLE", text: t("UI_UNAVAILABLE"), rest: [] }
  }
  return { code: codes.EXCHANGE_HOP_UNAVAILABLE, text: t("UI_QUOTE_BLOCKED"), rest: [hopText] }
}

function shortRefusal(raw: string): string {
  const colon = raw.indexOf(":")
  if (colon > 0) return raw.slice(0, colon).trim()
  return raw
}
