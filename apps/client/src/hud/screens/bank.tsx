import { useState, type ReactElement, type ReactNode } from "react"
import { codes } from "@corporator/protocol"
import { marketWindowOpen } from "../../clock.js"
import { format, lookup } from "../../strings.js"
import { clockFaceText, formatShare, formatShareTenths } from "../fields.js"
import { evaluateActionGate } from "../gates.js"
import { transportOf, type LiveAdapterResult } from "../liveAdapter.js"
import { ActionButton } from "../parts/ActionButton.js"
import { Dialog } from "../parts/Dialog.js"
import { BRAND_TOKEN_URL } from "../parts/hudArtUrls.js"
import { HudIcon } from "../parts/HudIcon.js"
import { Refusal } from "../parts/refusal.js"
import { groupDigits, formatCorp, formatCorpField, moneyAtoms } from "../parts/si.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"
import { TransactionStepper } from "../parts/TransactionStepper.js"
import { WorkspaceTabs } from "../parts/WorkspaceTabs.js"
import { awaitingTxn, confirmTxn, failTxn, isLocalReview, isTxnInFlight, reviewTxn, type UiTxnState } from "../uiState.js"

type BankTab = "deposit" | "withdraw"

/** Live remaining daily limit only. Missing and zero are not executable. */
export function withdrawLiveEnabled(liveLimit: bigint | undefined): boolean {
  return liveLimit !== undefined && liveLimit > 0n
}

export type BankVoucherStatus = "signing" | "open" | "issued" | "presented" | "expired" | "rejected"

export type BankVoucher = {
  readonly id: string
  readonly status: BankVoucherStatus
  readonly corp: string
  readonly expiresAtS?: bigint
}

/** Withdraw review stays closed when the typed Capital is above the city balance. */
export function withdrawReviewAllowed(amount: bigint | undefined, held: bigint | undefined): boolean {
  if (amount === undefined || held === undefined) return false
  return amount <= held
}

/** Present signs only for an open voucher that the snapshot clock has not expired. */
export function voucherMayPresent(voucher: BankVoucher | undefined, chainTimeS?: bigint): boolean {
  if (voucher === undefined) return false
  if (voucher.status !== "open" && voucher.status !== "issued") return false
  if (voucher.expiresAtS !== undefined && chainTimeS !== undefined && chainTimeS >= voucher.expiresAtS) return false
  return true
}

export function presentBlockCode(voucher: BankVoucher | undefined, chainTimeS?: bigint): string {
  if (voucherMayPresent(voucher, chainTimeS)) return ""
  if (voucher === undefined) return "UI_NO_VOUCHER"
  if (voucher.status === "signing") return "UI_VOUCHER_SIGNING"
  if (voucher.status === "presented") return "UI_VOUCHER_IN_WALLET"
  if (voucher.status === "expired" || voucher.status === "rejected") return "UI_VOUCHER_RETURNED"
  return "UI_VOUCHER_WAIT"
}

export async function beginPresent(args: {
  readonly voucher: BankVoucher | undefined
  readonly chainTimeS?: bigint
  readonly sign: () => Promise<void>
}): Promise<boolean> {
  if (!voucherMayPresent(args.voucher, args.chainTimeS)) return false
  await args.sign()
  return true
}

export function readBankVoucher(body: unknown): BankVoucher | undefined {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return undefined
  const row = body as { readonly [key: string]: unknown }
  const nested = row["voucher"]
  if (nested !== null && typeof nested === "object" && !Array.isArray(nested)) {
    return voucherFrom(nested as { readonly [key: string]: unknown })
  }
  const id = textOf(row["voucher_id"])
  if (id.length === 0) return undefined
  const status = voucherStatus(row["voucher_status"]) ?? "open"
  return { id, status, corp: textOf(row["corp"]) }
}

function voucherFrom(row: { readonly [key: string]: unknown }): BankVoucher | undefined {
  const id = textOf(row["id"] ?? row["voucher_id"])
  if (id.length === 0) return undefined
  const status = voucherStatus(row["status"] ?? row["voucher_status"]) ?? "open"
  return { id, status, corp: textOf(row["corp"]) }
}

function voucherNoteKey(voucher: BankVoucher, chainTimeS: bigint | undefined): string {
  if (voucher.status === "signing") return "UI_VOUCHER_SIGNING"
  if (voucher.status === "presented") return "UI_VOUCHER_IN_WALLET"
  if (voucher.status === "expired" || voucher.status === "rejected") return "UI_VOUCHER_RETURNED"
  if (voucher.expiresAtS !== undefined && chainTimeS !== undefined && chainTimeS >= voucher.expiresAtS) {
    return "UI_VOUCHER_WAIT"
  }
  return "UI_VOUCHER_READY"
}

function voucherStatus(value: unknown): BankVoucherStatus | undefined {
  const text = textOf(value)
  if (
    text === "signing" ||
    text === "open" ||
    text === "issued" ||
    text === "presented" ||
    text === "expired" ||
    text === "rejected"
  ) {
    return text
  }
  return undefined
}

export function voucherFromSnapshot(rows: ScreenProps["view"]["vouchers"]): BankVoucher | undefined {
  if (rows === undefined || rows.length === 0) return undefined
  const row = rows[0]
  if (row === undefined) return undefined
  return voucherRow(row)
}

/** The voucher the player clicked. A different row in the snapshot is not a substitute. */
export function voucherById(rows: ScreenProps["view"]["vouchers"], id: string): BankVoucher | undefined {
  if (rows === undefined || id.length === 0) return undefined
  for (const row of rows) {
    if (row.id !== id) continue
    return voucherRow(row)
  }
  return undefined
}

function voucherRow(row: { readonly id: string; readonly status: string; readonly corp: bigint; readonly expiresAtS: bigint }): BankVoucher | undefined {
  const status = voucherStatus(row.status)
  if (status === undefined) return undefined
  return { id: row.id, status, corp: row.corp.toString(), expiresAtS: row.expiresAtS }
}

function voucherOnScreen(view: ScreenProps["view"], remembered: BankVoucher | undefined): BankVoucher | undefined {
  return voucherFromSnapshot(view.vouchers) ?? remembered
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value
  if (typeof value === "bigint" || typeof value === "number") return value.toString()
  return ""
}

export function BankScreen(props: ScreenProps & { readonly startTab?: BankTab; readonly startAmount?: string }): ReactElement {
  const [tab, setTab] = useState<BankTab>(props.startTab === "withdraw" ? "withdraw" : "deposit")
  const [amount, setAmount] = useState(props.startAmount ?? "")
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
  const bankFn = liveFunction(props.view, "bank") ?? liveFunction(props.view, "finance_tower")
  const bankOpen = props.view.plaque.key === "UI_BANK"
  const vaultFee = formatShareTenths(props.pack.vaultFeeBps, props.pack.bps)
  const markupShare = formatShareTenths(props.pack.bankMarkupBps, props.pack.bps)
  const floorShare = formatShareTenths(props.pack.bankMarkupFloorBps, props.pack.bps)
  const shareBps =
    bankFn?.level === undefined ? undefined : props.pack.bankLevelShareBps[bankFn.level.toString()]
  const shareText = shareBps === undefined ? undefined : formatShare(shareBps, props.pack.bps)
  const liveMint = props.view.mintRate.length > 0
  const mintShown = liveMint ? groupedMint(props.view.mintRate) : ""
  const mintCeiling = groupedMint(props.pack.capitalAnchor.toString())
  const mintEntry = liveMint ? `${mintShown} ${t("UI_CAPITAL")} / 1 ${t("UI_CORP")}` : "—"
  const mintCeilingCopy = format(t("UI_MINT_CEILING"), { ceiling: mintCeiling })
  const walletCorp = props.view.accountKind === "wallet" ? props.view.corp : undefined
  const corpText = walletCorp === undefined ? undefined : formatCorp(walletCorp, props.pack.weiDecimals)
  const capital = props.view.shell.capital
  const maxExact = tab === "deposit" ? walletCorp : exactCapital(capital.exact, capital.kind)
  const maxField =
    maxExact === undefined
      ? undefined
      : tab === "deposit"
        ? formatCorpField(maxExact, props.pack.weiDecimals)
        : maxExact.toString()
  const quick = tab === "deposit"
    ? [props.pack.corpQuickSmall, props.pack.corpQuickMid, props.pack.corpQuickLarge]
    : [props.pack.capitalQuickSmall, props.pack.capitalQuickMid, props.pack.capitalQuickLarge]
  const command = moneyAtoms(amount, tab === "deposit" ? "corp" : "capital", props.pack.weiDecimals)
  const heldCapital = exactCapital(capital.exact, capital.kind)
  const overCapital = tab === "withdraw" && command !== undefined && !withdrawReviewAllowed(command, heldCapital)
  const voucher = voucherOnScreen(props.view, props.bankVoucher)
  const chainTimeS = props.view.chainTimeS
  const mayPresent = voucherMayPresent(voucher, chainTimeS)
  const blockCode = presentBlockCode(voucher, chainTimeS)
  const noteKey = voucher === undefined ? "" : voucherNoteKey(voucher, chainTimeS)
  const depositAction = props.pack.actions["bank_deposit"]
  const withdrawAction = props.pack.actions["bank_withdraw"]
  const depositGate =
    depositAction === undefined
      ? undefined
      : evaluateActionGate({
          pack: props.pack,
          action: depositAction,
          view: props.view,
          demo: props.demo,
          extraFailed: props.failed,
        })
  const withdrawGate =
    withdrawAction === undefined
      ? undefined
      : evaluateActionGate({
          pack: props.pack,
          action: withdrawAction,
          view: props.view,
          demo: props.demo,
          extraFailed: props.failed,
        })
  const depositBlocked = tab === "deposit" && depositGate !== undefined && depositGate.kind !== "ok"
  const withdrawBlocked = tab === "withdraw" && withdrawGate !== undefined && withdrawGate.kind !== "ok"
  const depositRefusal =
    tab === "deposit" && depositGate?.kind === "blocked"
      ? depositGate.refusal
      : undefined
  const withdrawRefusal =
    tab !== "withdraw"
      ? undefined
      : withdrawGate?.kind === "blocked"
        ? withdrawGate.refusal
        : withdrawGate?.kind === "missing"
          ? { code: "UI_UNAVAILABLE", rest: [] }
          : undefined
  const tabRefusal = tab === "deposit" ? depositRefusal : withdrawRefusal
  const tabRefusalText =
    tabRefusal?.code === undefined ? "" : shortRefusal(lookup(props.strings, tabRefusal.code, used))
  function setAmountLive(next: string): void {
    if (isTxnInFlight(txn)) return
    setAmount(next)
  }
  function setMax(): void {
    if (maxField === undefined) return
    setAmountLive(maxField)
  }
  const amountField = (
    <div className="hud-bank__amount">
      <label data-key="UI_AMOUNT" className="hud-card__label" htmlFor="hud-bank-amount">
        {t("UI_AMOUNT")} {amountUnit}
      </label>
      <div className="hud-bank__input">
        {tab === "deposit" ? <img className="hud-token" src={BRAND_TOKEN_URL} alt="" /> : <HudIcon glyph="coin" size="sm" />}
        <input
          id="hud-bank-amount"
          type="text"
          name="hud-bank-qty"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="other"
          data-unit={amountUnitKey}
          data-receive-unit={receiveUnitKey}
          data-exact={amount}
          value={amount}
          aria-label={`${t("UI_AMOUNT")} ${amountUnit}`}
          disabled={isTxnInFlight(txn)}
          onChange={(e) => {
            setAmountLive(e.target.value)
          }}
        />
      </div>
      <div className="hud-bank__quick" data-key="UI_QUICK_AMOUNT">
        {quick.map((preset) => {
          const exact = preset.toString()
          return (
            <button
              key={exact}
              type="button"
              data-preset={exact}
              className={amount === exact ? "hud-chip is-on" : "hud-chip"}
              disabled={isTxnInFlight(txn)}
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
          disabled={maxField === undefined || isTxnInFlight(txn)}
          onClick={setMax}
        >
          {t("UI_MAX")}
        </button>
      </div>
    </div>
  )
  const receiveBlock = (
    <div className="hud-bank__receive" data-key="UI_YOU_RECEIVE">
      <span className="hud-bank__receive-copy">
        <span className="hud-bank__receive-k">{t("UI_YOU_RECEIVE")}</span>
        <span data-key={tab === "deposit" ? "UI_ESTIMATE_AFTER_FEE" : "UI_ESTIMATE_AFTER_QUOTE"} className="hud-muted">
          {t(tab === "deposit" ? "UI_ESTIMATE_AFTER_FEE" : "UI_ESTIMATE_AFTER_QUOTE")}
        </span>
      </span>
      <span className="hud-bank__receive-amt">
        <img className="hud-token" src={BRAND_TOKEN_URL} alt="" />
        <span data-key="UI_ESTIMATE_UNAVAILABLE" className="hud-unavailable">
          —
        </span>
        <span data-key={receiveUnitKey}>{receiveUnit}</span>
      </span>
    </div>
  )
  const reviewing = isLocalReview(txn)
  const ctaLocked = isTxnInFlight(txn) || depositBlocked || withdrawBlocked
  function closeReview(): void {
    props.onMoneyTxn(undefined)
  }
  function openReview(): void {
    if (ctaLocked || reviewing || command === undefined) return
    if (tab === "withdraw" && !withdrawReviewAllowed(command, heldCapital)) return
    props.onMoneyTxn(reviewTxn())
  }
  const confirmLocked = isTxnInFlight(txn) || command === undefined
  const paidText = command === undefined ? undefined : tab === "deposit" ? formatCorp(command, props.pack.weiDecimals) : groupDigits(command)
  const paidExact = command === undefined ? "" : command.toString()
  return (
    <ScreenFrame id="bank" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <section
        className="hud-bank"
        data-withdraw-open={withdrawOpen ? "1" : "0"}
        data-hours-open={hoursOpen ? "1" : "0"}
        data-hours-reason={hoursKey}
        data-bank={bankOpen ? "open" : "closed"}
        {...(reviewing ? { inert: true, "aria-hidden": true } : {})}
      >
        <header className="hud-bank__head">
          <h2 data-key="UI_BANK" className="hud-bank__name">
            {t("UI_BANK")}
          </h2>
          <span
            className="hud-bcard__status"
            data-key={props.view.plaque.key}
            data-tone={bankOpen ? "ok" : "closed"}
          >
            <span className="hud-dot" data-tone={bankOpen ? "ok" : "closed"} />
            {bankOpen ? t("UI_OPEN") : t("UI_CLOSED")}
          </span>
        </header>
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
        <div className="hud-bank__stats">
          <BankStat
            label={t("UI_WALLET_CORP")}
            labelKey="UI_WALLET_CORP"
            value={corpText}
            exact={walletCorp === undefined ? "" : walletCorp.toString()}
            icon={<img className="hud-token" src={BRAND_TOKEN_URL} alt="" />}
          />
          <BankStat
            label={t("UI_CITY_CAPITAL")}
            labelKey="UI_CITY_CAPITAL"
            value={capital.kind === "unavailable" ? undefined : groupedMint(capital.exact)}
            exact={capital.exact}
            icon={<HudIcon glyph="coin" size="md" />}
          />
          <BankStat
            label={t("UI_BANK_LEVEL")}
            labelKey="UI_BANK_LEVEL"
            value={bankFn?.level === undefined ? undefined : `L${bankFn.level.toString()}`}
            exact={bankFn?.level === undefined ? "" : bankFn.level.toString()}
            icon={<HudIcon glyph="bank" size="md" />}
          />
          <div className="hud-bank__stat hud-bank__stat--hours" data-key="UI_BANK_HOURS">
            <span className="hud-bank__stat-ico">
              <HudIcon glyph="time" size="md" />
            </span>
            <span className="hud-bank__hours-open" data-key={bankOpen ? "UI_OPEN" : "UI_CLOSED"} data-tone={bankOpen ? "ok" : "closed"}>
              {bankOpen ? t("UI_OPEN") : t("UI_CLOSED")}
            </span>
            <span
              className="hud-bank__stat-value hud-bank__hours-range"
              data-key={hoursOpen ? "UI_BANK_HOURS" : "UI_BANK_OPENS_AT"}
            >
              {hoursOpen
                ? `${clockFaceText(props.pack.bankOpenHour)} – ${clockFaceText(props.pack.bankCloseHour)}`
                : format(t("UI_BANK_OPENS_AT"), { hour: clockFaceText(props.pack.bankOpenHour) })}
            </span>
            <span className="hud-muted">{t("UI_BANK_HOURS_CITY")}</span>
          </div>
        </div>
        <div className="hud-bank__scroll">
        {tab === "deposit" ? (
          <div role="tabpanel" id="hud-bank-deposit" aria-labelledby="hud-tab-deposit" className="hud-bank__panel">
            <div className="hud-bank__section-h">
              <h3 data-key="UI_DEPOSIT" className="hud-bank__title">
                {t("UI_DEPOSIT")}
              </h3>
              <span data-key="UI_DEPOSIT_TITLE" className="hud-bank__pair">
                {t("UI_DEPOSIT_TITLE")}
              </span>
            </div>
            <p data-key="UI_DEPOSIT_HINT" className="hud-bank__hint">
              {t("UI_DEPOSIT_HINT")}
            </p>
            <div className="hud-bank__form">
              {amountField}
              <div className="hud-bank__facts">
                <p data-key="UI_BANK_MINT_RATE" className="hud-bank__fact">
                  <span className="hud-bank__fact-k">
                    {t("UI_BANK_MINT_RATE")}
                  </span>
                  <span {...(liveMint ? { "data-exact": props.view.mintRate } : {})} className="hud-bank__fact-v">
                    {mintEntry}
                  </span>
                  <span data-key="UI_MINT_CEILING" data-exact={props.pack.capitalAnchor.toString()} className="hud-muted">
                    {mintCeilingCopy}
                  </span>
                </p>
                <p data-key="UI_VAULT_FEE" className="hud-bank__fact hud-bank__fact--fee">
                  <span className="hud-bank__fact-k">
                    {t("UI_VAULT_FEE")}
                    <HudIcon glyph="info" size="xs" />
                  </span>
                  <span data-exact={props.pack.vaultFeeBps.toString()} className="hud-bank__fact-v">
                    {vaultFee}
                  </span>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div role="tabpanel" id="hud-bank-withdraw" aria-labelledby="hud-tab-withdraw" className="hud-bank__panel">
            <div className="hud-bank__form">
              <div className="hud-bank__lead">
                <div className="hud-bank__section-h">
                  <h3 data-key="UI_WITHDRAW" className="hud-bank__title">
                    {t("UI_WITHDRAW")}
                  </h3>
                  <span data-key="UI_WITHDRAW_TITLE" className="hud-bank__pair">
                    {t("UI_WITHDRAW_TITLE")}
                  </span>
                </div>
                <p data-key="UI_WITHDRAW_HINT" className="hud-bank__hint">
                  {t("UI_WITHDRAW_HINT")}
                </p>
                {amountField}
              </div>
              <div className="hud-bank__facts">
                <p data-key="UI_BANK_LIMIT_LIVE" className="hud-bank__fact hud-bank__fact--limit">
                  <span className="hud-bank__fact-k">
                    {t("UI_DAILY_LIMIT")}
                    <HudIcon glyph="info" size="xs" />
                  </span>
                  <span className="hud-bank__limit-track" data-empty={liveLimit === undefined ? "1" : "0"} aria-hidden="true" />
                  <span className="hud-bank__limit-row">
                    {liveLimit === undefined ? (
                      <span data-key="UI_UNAVAILABLE" className="hud-bank__fact-v">
                        {"—"}
                      </span>
                    ) : (
                      <span data-exact={liveLimit.toString()} className="hud-bank__fact-v">
                        {groupDigits(liveLimit)} {t("UI_CAPITAL")}
                      </span>
                    )}
                    <span data-key="UI_REMAINING_TODAY" className="hud-muted">
                      {t("UI_REMAINING_TODAY")}
                    </span>
                  </span>
                </p>
                <p data-key="UI_YOUR_SHARE" className="hud-bank__fact hud-bank__fact--fee">
                  <span className="hud-bank__fact-k">
                    {t("UI_YOUR_SHARE")}
                    {bankFn?.level === undefined ? null : ` (${t("UI_BANK_LEVEL")} ${bankFn.level.toString()})`}
                    <HudIcon glyph="info" size="xs" />
                  </span>
                  {shareText === undefined ? (
                    <span data-key="UI_UNAVAILABLE" className="hud-bank__fact-v">
                      {"—"}
                    </span>
                  ) : (
                    <span data-exact={shareBps?.toString() ?? ""} className="hud-bank__fact-v">
                      {shareText}
                    </span>
                  )}
                </p>
                <p data-key="UI_BANK_QUOTE" className="hud-bank__fact hud-bank__fact--fee">
                  <span className="hud-bank__fact-k">{t("UI_BANK_QUOTE")}</span>
                  <span data-exact={props.pack.bankMarkupBps.toString()} className="hud-bank__fact-v">
                    {`${markupShare} (floor ${floorShare})`}
                  </span>
                </p>
                {receiveBlock}
              </div>
            </div>
          </div>
        )}
        </div>
        <div className="hud-bank__foot">
        {tab === "deposit" ? receiveBlock : null}
        {reviewing ? null : <TransactionStepper state={txn} t={t} />}
        {tab === "deposit" ? (
          <>
          <button
            type="button"
            data-key="UI_REVIEW_TXN"
            data-intent="deposit"
            data-blocked={ctaLocked || (!reviewing && command === undefined) ? "1" : "0"}
            data-blocked-code={depositRefusal?.code ?? (ctaLocked || (!reviewing && command === undefined) ? "UI_UNAVAILABLE" : "")}
            className={`hud-btn hud-btn--primary hud-bank__cta${tabRefusal === undefined ? "" : " is-refused"}${reviewing ? " is-covered" : ""}`}
            disabled={ctaLocked || (!reviewing && command === undefined)}
            onClick={openReview}
          >
            <span className="hud-bank__cta-label">
              <HudIcon glyph="deposit" size="sm" />
              {t("UI_DEPOSIT")}
            </span>
            {tabRefusal?.code !== undefined ? (
              <Refusal code={tabRefusal.code} text={tabRefusalText} rest={tabRefusal.rest} />
            ) : null}
          </button>
          <p className="hud-bank__info-note" data-key="UI_ENTRY_CHEAPER">
            <HudIcon glyph="info" size="xs" />
            <span>{t("UI_ENTRY_CHEAPER")}</span>
          </p>
          </>
        ) : (
          <div className="hud-bank__acts">
            <button
              type="button"
              data-key="UI_REVIEW_TXN"
              data-withdraw="live"
              data-intent="withdraw"
              data-blocked={withdrawRefusal === undefined && !overCapital ? "0" : "1"}
              data-blocked-code={
                withdrawRefusal?.code ??
                (overCapital ? codes.NOT_ENOUGH_CAPITAL : command === undefined || isTxnInFlight(txn) ? "UI_UNAVAILABLE" : "")
              }
              data-gate={withdrawGate === undefined ? "missing" : withdrawGate.kind}
              className={`hud-btn hud-bank__cta hud-bank__act${withdrawRefusal === undefined ? " hud-btn--primary" : " is-refused"}`}
              disabled={isTxnInFlight(txn) || withdrawBlocked || reviewing || overCapital || command === undefined}
              onClick={openReview}
            >
              <span data-key="UI_AUTHORIZE_RESERVE" className="hud-bank__cta-label">
                <HudIcon glyph="shield" size="sm" />
                {t("UI_AUTHORIZE_RESERVE")}
              </span>
              {withdrawRefusal?.code !== undefined ? (
                <Refusal code={withdrawRefusal.code} text={tabRefusalText} rest={withdrawRefusal.rest} />
              ) : (
                <span data-key="UI_AUTHORIZE_HINT" className="hud-bank__act-hint">
                  {t("UI_AUTHORIZE_HINT")}
                </span>
              )}
            </button>
            {voucher !== undefined ? (
              <p className="hud-bank__info-note" data-voucher={voucher.status} data-voucher-id={voucher.id}>
                <HudIcon glyph="info" size="xs" />
                <span data-key={noteKey}>{t(noteKey)}</span>
                {noteKey === "UI_VOUCHER_READY" ? (
                  <span data-voucher-corp={voucher.corp}>{voucher.corp}</span>
                ) : null}
                <span
                  data-key="UI_VOUCHER_EXPIRES"
                  data-exact={(voucher.expiresAtS ?? props.pack.voucherTtlS).toString()}
                >
                  {t("UI_VOUCHER_EXPIRES")}
                </span>
              </p>
            ) : null}
            <p className="hud-bank__info-note" data-key="UI_PRESENT_GAS">
              <HudIcon glyph="info" size="xs" />
              <span data-key="UI_PRESENT_GAS">{t("UI_PRESENT_GAS")}</span>
            </p>
            <button
              type="button"
              data-key="UI_PRESENT_VOUCHER"
              data-intent="present_voucher"
              data-present={voucher === undefined ? "idle" : voucher.status}
              data-blocked={mayPresent ? "0" : "1"}
              data-blocked-code={blockCode}
              className={`hud-btn hud-bank__cta hud-bank__act${mayPresent ? " hud-btn--primary" : " is-refused"}`}
              disabled={!mayPresent || isTxnInFlight(txn)}
              onClick={() => {
                void beginPresent({
                  voucher,
                  ...(chainTimeS === undefined ? {} : { chainTimeS }),
                  sign: async () => {
                    await props.onIntent(
                      voucher === undefined
                        ? { kind: "present_voucher" }
                        : { kind: "present_voucher", voucherId: voucher.id },
                    )
                  },
                })
              }}
            >
              <span data-key="UI_PRESENT_VOUCHER" className="hud-bank__cta-label">
                <HudIcon glyph={mayPresent ? "shield" : "locked"} size="sm" />
                {t("UI_PRESENT_VOUCHER")}
              </span>
              {mayPresent ? null : (
                <Refusal code={blockCode} text={t(blockCode)} rest={[]} />
              )}
            </button>
          </div>
        )}
        {tab === "withdraw" && !bankOpen ? (
          <p className="hud-bank__hours-note" data-hours-note={hoursKey}>
            <HudIcon glyph="info" size="xs" />
            <span data-key={hoursKey === "BANK_SUNDAY" ? "BANK_SUNDAY" : "IDLE_BANK_CLOSED"}>
              {hoursKey === "BANK_SUNDAY" ? t("BANK_SUNDAY") : t("IDLE_BANK_CLOSED")}
              {". "}
              {clockFaceText(props.pack.bankOpenHour)} – {clockFaceText(props.pack.bankCloseHour)}{" "}
              {t("UI_BANK_HOURS_CITY")}
            </span>
          </p>
        ) : null}
        {tab === "withdraw" && bankOpen ? (
          <p className="hud-bank__info-note" data-key="UI_ENTRY_CHEAPER">
            <HudIcon glyph="info" size="xs" />
            <span>{t("UI_ENTRY_CHEAPER")}</span>
          </p>
        ) : null}
        </div>
      </section>
      {reviewing ? (
        <Dialog
          title={tab === "deposit" ? `${t("UI_CONFIRM")} ${t("UI_DEPOSIT")}` : t("UI_CONFIRM_TXN")}
          titleKey="UI_CONFIRM_TXN"
          closeLabel={t("UI_CLOSE")}
          closeKey="UI_CLOSE"
          onClose={closeReview}
          {...(tab === "deposit"
            ? { subtitle: t("UI_REVIEW_DETAILS"), subtitleKey: "UI_REVIEW_DETAILS" as const, glyph: "coin" as const }
            : {})}
        >
          {tab === "deposit" ? (
            <>
              <div className="hud-dialog__block">
              <div className="hud-dialog__item" data-key="UI_WHAT_CHANGES">
                <span className="hud-dialog__mark" aria-hidden="true">
                  <HudIcon glyph="market" size="md" />
                </span>
                <span className="hud-dialog__copy">
                  <span className="hud-dialog__k">{t("UI_WHAT_CHANGES")}</span>
                  <span data-key="UI_DEPOSIT_TITLE" className="hud-dialog__pair">
                    <span data-key="UI_CORP">{t("UI_CORP")}</span>
                    <span className="hud-dialog__arrow" aria-hidden="true">{"→"}</span>
                    <span data-key="UI_CAPITAL">{t("UI_CAPITAL")}</span>
                  </span>
                </span>
              </div>
              </div>
              <div className="hud-dialog__block">
              <div className="hud-dialog__split">
                <div className="hud-dialog__item" data-key="UI_WHAT_YOU_PAY">
                  <span className="hud-dialog__mark" aria-hidden="true">
                    <HudIcon glyph="coin" size="md" />
                  </span>
                  <span className="hud-dialog__copy">
                    <span className="hud-dialog__k">{t("UI_WHAT_YOU_PAY")}</span>
                    {paidText === undefined ? (
                      <span data-key="UI_UNAVAILABLE" className="hud-dialog__hero hud-unavailable">
                        {"—"}
                      </span>
                    ) : (
                      <span data-exact={paidExact} data-unit={amountUnitKey} className="hud-dialog__hero">
                        {paidText} {amountUnit}
                      </span>
                    )}
                    <span data-key="UI_FROM_WALLET" className="hud-dialog__cap">
                      {t("UI_FROM_WALLET")}
                    </span>
                  </span>
                </div>
                <div className="hud-dialog__item" data-key="UI_WALLET_BALANCE">
                  <span className="hud-dialog__mark" aria-hidden="true">
                    <HudIcon glyph="wallet" size="md" />
                  </span>
                  <span className="hud-dialog__copy">
                    <span className="hud-dialog__k hud-dialog__k--plain">{t("UI_WALLET_BALANCE")}</span>
                    {corpText === undefined || walletCorp === undefined ? (
                      <span data-key="UI_UNAVAILABLE" className="hud-dialog__hero">
                        {"—"}
                      </span>
                    ) : (
                      <span data-exact={walletCorp.toString()} className="hud-dialog__hero">
                        {corpText}
                      </span>
                    )}
                  </span>
                </div>
              </div>
              </div>
              <div className="hud-dialog__block">
              <div className="hud-dialog__split hud-dialog__split--3">
                <div className="hud-dialog__item" data-key="UI_WHAT_YOU_GET">
                  <span className="hud-dialog__mark" aria-hidden="true">
                    <HudIcon glyph="bank" size="md" />
                  </span>
                  <span className="hud-dialog__copy">
                    <span className="hud-dialog__k">{t("UI_WHAT_YOU_GET")}</span>
                    <span className="hud-dialog__hero hud-unavailable">
                      <span data-key="UI_ESTIMATE_UNAVAILABLE">—</span>
                      <span data-key={receiveUnitKey}>{` ${receiveUnit}`}</span>
                    </span>
                  </span>
                </div>
                <div className="hud-dialog__item" data-key="UI_VAULT_FEE">
                  <span className="hud-dialog__mark hud-dialog__mark--pct" aria-hidden="true">
                    %
                  </span>
                  <span className="hud-dialog__copy">
                    <span className="hud-dialog__k hud-dialog__k--plain">{t("UI_VAULT_FEE")}</span>
                    <span data-exact={props.pack.vaultFeeBps.toString()} className="hud-dialog__v">
                      {vaultFee}
                    </span>
                  </span>
                </div>
                <div className="hud-dialog__item" data-key="UI_MINT_RATE">
                  <span className="hud-dialog__mark" aria-hidden="true">
                    <HudIcon glyph="cycle" size="md" />
                  </span>
                  <span className="hud-dialog__copy">
                    <span className="hud-dialog__k hud-dialog__k--plain">{t("UI_MINT_RATE")}</span>
                    <span data-key="UI_MINT_CEILING" data-exact={props.pack.capitalAnchor.toString()} className="hud-dialog__v">
                      {`≤ ${props.pack.capitalAnchor.toString()}`}
                    </span>
                  </span>
                </div>
              </div>
              </div>
              <div className="hud-dialog__block">
              <div className="hud-dialog__item" data-key="UI_WALLET_AFTER">
                <span className="hud-dialog__mark" aria-hidden="true">
                  <HudIcon glyph="wallet" size="md" />
                </span>
                <span className="hud-dialog__copy">
                  <span className="hud-dialog__k">{t("UI_WALLET_AFTER")}</span>
                  <span className="hud-dialog__hero hud-unavailable">
                    <span data-key="UI_ESTIMATE_UNAVAILABLE">—</span>
                    <span data-key={amountUnitKey}>{` ${amountUnit}`}</span>
                  </span>
                  <span data-key="UI_AFTER_DEPOSIT" className="hud-dialog__cap">
                    {t("UI_AFTER_DEPOSIT")}
                  </span>
                </span>
              </div>
              </div>
            </>
          ) : (
            <>
              <p data-key="UI_AMOUNT">
                {paidText === undefined ? "—" : paidText} {amountUnit}
              </p>
              {receiveBlock}
              <p data-key="UI_ENTRY_CHEAPER" className="hud-muted">
                {t("UI_ENTRY_CHEAPER")}
              </p>
            </>
          )}
          <footer className="hud-dialog__actions">
            <button type="button" data-key="UI_CANCEL" className="hud-btn hud-btn--secondary" onClick={closeReview}>
              {t("UI_CANCEL")}
            </button>
            {tab === "deposit" ? (
              <div data-deposit="live">
                <ActionButton
                  {...screen}
                  actionId="bank_deposit"
                  labelKey="UI_CONFIRM"
                  keepLabel
                  locked={confirmLocked}
                  {...(command === undefined ? {} : { extra: { amount: command.toString() } })}
                />
              </div>
            ) : (
              <div data-withdraw="live">
                <ActionButton
                  {...screen}
                  actionId="bank_withdraw"
                  labelKey="UI_CONFIRM"
                  keepLabel
                  locked={confirmLocked}
                  {...(command === undefined ? {} : { extra: { amount: command.toString() } })}
                />
              </div>
            )}
          </footer>
        </Dialog>
      ) : null}
    </ScreenFrame>
  )
}

function BankStat(props: {
  readonly label: string
  readonly labelKey: string
  readonly value: string | undefined
  readonly exact: string
  readonly icon: ReactNode
}): ReactElement {
  return (
    <div className="hud-bank__stat" data-key={props.labelKey}>
      <span className="hud-bank__stat-ico">{props.icon}</span>
      {props.value === undefined ? (
        <span data-key="UI_UNAVAILABLE" className="hud-bank__stat-value">
          {"—"}
        </span>
      ) : (
        <span data-exact={props.exact} className="hud-bank__stat-value">
          {props.value}
        </span>
      )}
      <span className="hud-muted">{props.label}</span>
    </div>
  )
}

function shortRefusal(raw: string): string {
  const comma = raw.indexOf(",")
  if (comma > 0) return raw.slice(0, comma).trim()
  const colon = raw.indexOf(":")
  if (colon > 0) return raw.slice(0, colon).trim()
  return raw
}

function groupedMint(raw: string): string {
  try {
    return groupDigits(BigInt(raw))
  } catch {
    return raw
  }
}

function exactCapital(exact: string, kind: string): bigint | undefined {
  if (kind === "unavailable" || exact.length === 0) return undefined
  try {
    return BigInt(exact)
  } catch {
    return undefined
  }
}

function liveFunction(view: ScreenProps["view"], objectId: string): ScreenProps["view"]["shell"]["functions"]["rows"][number] | undefined {
  for (const row of view.shell.functions.rows) {
    if (row.id === objectId) return row
  }
  return undefined
}

let moneySubmitLock = false

export async function commitMoney(
  txn: UiTxnState | undefined,
  setTxn: (state: UiTxnState | undefined) => void,
  commit: () => void | Promise<void | LiveAdapterResult>,
): Promise<void> {
  if (moneySubmitLock || isTxnInFlight(txn)) return
  moneySubmitLock = true
  if (txn === undefined || txn.kind !== "review") {
    moneySubmitLock = false
    return
  }
  setTxn(awaitingTxn())
  try {
    const result = await commit()
    if (
      result !== undefined &&
      result.kind === "applied" &&
      transportOf(result.intent) === "live"
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
