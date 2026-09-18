import { useState, type ReactElement } from "react"
import { codes } from "@corporator/protocol"
import { marketWindowOpen } from "../../clock.js"
import { lookup } from "../../strings.js"
import { isMoneyReviewIntent, transportOf, type LiveAdapterResult } from "../liveAdapter.js"
import { ActionButton } from "../parts/ActionButton.js"
import { UnavailableState } from "../parts/Empty.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"
import { TransactionStepper } from "../parts/TransactionStepper.js"
import { WorkspaceTabs } from "../parts/WorkspaceTabs.js"
import { confirmTxn, failTxn, isLocalReview, isTxnInFlight, reviewTxn, submitTxn, type UiTxnState } from "../uiState.js"

type BankTab = "deposit" | "withdraw"

/** Live remaining daily limit only. Missing and zero are not executable. */
export function withdrawLiveEnabled(liveLimit: bigint | undefined): boolean {
  return liveLimit !== undefined && liveLimit > 0n
}

export function BankScreen(props: ScreenProps): ReactElement {
  const [tab, setTab] = useState<BankTab>("deposit")
  const [amount, setAmount] = useState("")
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const liveLimit = props.view.bankLimitLive
  const withdrawOpen = withdrawLiveEnabled(liveLimit)
  const hoursOpen = marketWindowOpen(props.view.plaque.key)
  const hoursKey = props.view.plaque.key
  const txn = props.moneyTxn
  const screen: ScreenProps = {
    ...props,
    onIntent: (intent, extra) => commitMoney(txn, props.onMoneyTxn, () => props.onIntent(intent, extra)),
    onCommit: (effect, extra) => commitMoney(txn, props.onMoneyTxn, () => props.onCommit(effect, extra)),
  }
  const amountUnitKey = tab === "deposit" ? "UI_CORP" : "UI_CAPITAL"
  const receiveUnitKey = tab === "deposit" ? "UI_CAPITAL" : "UI_CORP"
  const amountUnit = t(amountUnitKey)
  const receiveUnit = t(receiveUnitKey)
  const withdrawLocked = tab === "withdraw" && (!withdrawOpen || !hoursOpen)
  const amountField = (
    <>
      <label data-key="UI_AMOUNT" className="hud-row" htmlFor="hud-bank-amount">
        {t("UI_AMOUNT")} · {amountUnit}
      </label>
      <input
        id="hud-bank-amount"
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        data-unit={amountUnitKey}
        data-receive-unit={receiveUnitKey}
        data-exact={amount}
        value={amount}
        aria-label={`${t("UI_AMOUNT")} ${amountUnit}`}
        disabled={isTxnInFlight(txn) || withdrawLocked}
        onChange={(e) => {
          setAmount(e.target.value)
          if (isTxnInFlight(txn) || withdrawLocked) return
          props.onMoneyTxn({ kind: "preparing", messageKey: "UI_TXN_PREPARING" })
        }}
      />
      <p data-key={receiveUnitKey} className="hud-muted">
        {receiveUnit}
      </p>
    </>
  )
  return (
    <ScreenFrame id="bank" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <section
        className="hud-card"
        data-withdraw-open={withdrawOpen ? "1" : "0"}
        data-hours-open={hoursOpen ? "1" : "0"}
        data-hours-reason={hoursKey}
      >
      <div className="hud-journal__filters">
      <WorkspaceTabs
        label={t("UI_BANK")}
        tabPrefix="hud-tab-"
        panelId={(id) => `hud-bank-${id}`}
        tabs={[
          { id: "deposit", key: "UI_DEPOSIT", label: t("UI_DEPOSIT") },
          { id: "withdraw", key: "UI_WITHDRAW", label: t("UI_WITHDRAW") },
        ]}
        active={tab}
        onPick={setTab}
      />
      </div>
      {tab === "deposit" ? (
        <div role="tabpanel" id="hud-bank-deposit" aria-labelledby="hud-tab-deposit" className="hud-form hud-card__body">
          <p data-key="UI_BANK_DEPOSIT_HOURS" className="hud-muted">
            {t("UI_BANK_DEPOSIT_HOURS")}
          </p>
          {amountField}
        </div>
      ) : (
        <div role="tabpanel" id="hud-bank-withdraw" aria-labelledby="hud-tab-withdraw" className="hud-form hud-card__body">
          <p data-key="UI_BANK_HOURS" className="hud-muted">
            {props.view.plaque.text}
          </p>
          {!hoursOpen ? (
            <UnavailableState textKey={hoursKey} text={props.view.plaque.text} />
          ) : null}
          {amountField}
          <div data-key="UI_BANK_LIMIT_LIVE" className="hud-row">
            <span className="hud-muted">{t("UI_BANK_LIMIT_LIVE")}</span>
            {liveLimit === undefined ? (
              <UnavailableState textKey="UI_UNAVAILABLE" text={t("UI_UNAVAILABLE")} />
            ) : (
              <span data-exact={liveLimit.toString()}>{liveLimit.toString()}</span>
            )}
          </div>
          <div data-key="UI_LIVE_QUOTE" className="hud-row">
            <span className="hud-muted">{t("UI_LIVE_QUOTE")}</span>
            <UnavailableState textKey="UI_UNAVAILABLE" text={t("UI_UNAVAILABLE")} />
          </div>
          <div data-key="UI_RESERVATION" className="hud-row">
            <span className="hud-muted">{t("UI_RESERVATION")}</span>
            <UnavailableState textKey="UI_UNAVAILABLE" text={t("UI_UNAVAILABLE")} />
          </div>
        </div>
      )}
      <TransactionStepper state={txn} t={t} />
      <footer className="hud-card__foot">
      {isLocalReview(txn) ? (
        tab === "deposit" ? (
          <ActionButton {...screen} actionId="bank_deposit" labelKey="UI_CONFIRM" locked={isTxnInFlight(txn)} extra={{ amount }} />
        ) : (
          <ActionButton
            {...screen}
            actionId="bank_withdraw"
            labelKey="UI_CONFIRM"
            locked={isTxnInFlight(txn) || withdrawLocked}
            extra={{ amount }}
          />
        )
      ) : (
        <button
          type="button"
          data-key="UI_REVIEW_TXN"
          className="hud-linkbtn"
          disabled={isTxnInFlight(txn) || withdrawLocked}
          onClick={() => {
            if (isTxnInFlight(txn) || withdrawLocked) return
            props.onMoneyTxn(reviewTxn())
          }}
        >
          {t("UI_REVIEW_TXN")}
        </button>
      )}
      </footer>
      </section>
    </ScreenFrame>
  )
}

let moneySubmitLock = false

export async function commitMoney(
  txn: UiTxnState | undefined,
  setTxn: (state: UiTxnState | undefined) => void,
  commit: () => void | Promise<void | LiveAdapterResult>,
): Promise<void> {
  if (moneySubmitLock || isTxnInFlight(txn)) return
  moneySubmitLock = true
  const next = submitTxn(txn)
  if (next === txn || next.kind !== "submitted") {
    moneySubmitLock = false
    return
  }
  setTxn(next)
  try {
    const result = await commit()
    if (
      result !== undefined &&
      result.kind === "applied" &&
      transportOf(result.intent) === "live" &&
      !isMoneyReviewIntent(result.intent)
    ) {
      setTxn(confirmTxn())
      return
    }
    if (result !== undefined && (result.kind === "failed" || result.kind === "unavailable")) {
      setTxn(failTxn(result.code))
      return
    }
    setTxn(failTxn(codes.FEATURE_NOT_IN_V1))
  } catch (err) {
    const message = err instanceof Error ? err.message : ""
    setTxn(failTxn(message.length > 0 ? message : codes.API_PACK_STALE))
  } finally {
    moneySubmitLock = false
  }
}
