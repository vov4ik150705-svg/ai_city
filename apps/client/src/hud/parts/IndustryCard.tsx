import { useState, type ReactElement } from "react"
import { codes } from "@corporator/protocol"
import { format, lookup } from "../../strings.js"
import { UnavailableState } from "./Empty.js"
import { CompanyBadge } from "./CompanyBadge.js"
import { FactLine, Facts } from "./Facts.js"
import { BuildingThumbnail } from "./BuildingThumbnail.js"
import { ActionButton } from "./ActionButton.js"
import { HudIcon } from "./HudIcon.js"
import { Refusal, refusalFromIntent } from "./refusal.js"
import { StatusChip, type StatusChipKind } from "./StatusChip.js"
import type { ScreenProps } from "./ScreenFrame.js"
import { wholeAtoms } from "./si.js"
/** Gap between oracle stake and oracle stake_min. The client does not recompute S_min. */
export function stakeShortfall(stake: bigint | undefined, stakeMin: bigint | undefined): bigint | undefined {
  if (stake === undefined || stakeMin === undefined) return undefined
  if (stakeMin <= stake) return 0n
  return stakeMin - stake
}

export function stakeCommand(
  districtId: string,
  text: string,
): { readonly district_id: string; readonly amount: string; readonly source: "wallet" } | undefined {
  if (districtId.length === 0) return undefined
  const amount = wholeAtoms(text)
  if (amount === undefined) return undefined
  return { district_id: districtId, amount: amount.toString(), source: "wallet" }
}

/** Claim signs only after the snapshot clock has reached the cooldown. */
export async function beginClaimUnstaked(args: {
  readonly chainTimeS: bigint | undefined
  readonly readyAtS: bigint
  readonly sign: () => Promise<void>
}): Promise<boolean> {
  if (args.chainTimeS === undefined || args.chainTimeS < args.readyAtS) return false
  await args.sign()
  return true
}

export function unstakeCommand(
  districtId: string,
  text: string,
  grace: boolean | undefined,
): { readonly district_id: string; readonly amount: string } | undefined {
  if (grace === true || districtId.length === 0) return undefined
  const amount = wholeAtoms(text)
  if (amount === undefined) return undefined
  return { district_id: districtId, amount: amount.toString() }
}

export function DistrictStakeBox(props: {
  readonly districtId: string
  readonly screen: ScreenProps
  readonly shortfall: bigint | undefined
  readonly open: boolean
  readonly grace: boolean | undefined
  readonly hint: string
}): ReactElement {
  const initial = props.shortfall !== undefined && props.shortfall > 0n ? props.shortfall.toString() : ""
  const [amount, setAmount] = useState(initial)
  const stake = stakeCommand(props.districtId, amount)
  const unstake = unstakeCommand(props.districtId, amount, props.grace)
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.screen.strings, key, used)
  const days = props.screen.pack.unstakeCooldownCityDays.toString()
  const district = props.screen.view.districts.find((row) => row.id === props.districtId)
  const ticker = district === undefined ? "" : district.ticker
  const cooling =
    ticker.length === 0 ? [] : (props.screen.view.unstakeCooldown ?? []).filter((row) => row.ticker === ticker)
  const restarts = cooling.some((row) => row.amount > 0n)
  const chainTimeS = props.screen.view.chainTimeS
  const [claimCode, setClaimCode] = useState("")
  return (
    <div className="hud-icard__stake" data-stake-form={props.open ? "open" : "fund"}>
      <label className="hud-card__label" htmlFor={`hud-stake-${props.districtId}`}>
        {props.hint}
      </label>
      <input
        id={`hud-stake-${props.districtId}`}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        data-stake-amount={props.districtId}
        data-shortfall={props.shortfall === undefined ? "" : props.shortfall.toString()}
        value={amount}
        onChange={(ev) => {
          setAmount(ev.target.value)
        }}
      />
      <ActionButton
        {...props.screen}
        actionId="district_stake_more"
        lookId={props.districtId}
        locked={stake === undefined}
        extra={stake === undefined ? { district_id: props.districtId, source: "wallet" } : stake}
      />
      {props.open ? (
        <>
          <ActionButton
            {...props.screen}
            actionId="district_unstake"
            lookId={props.districtId}
            labelKey="UI_UNSTAKE_HINT"
            labelText={props.hint}
            locked={unstake === undefined}
            extra={unstake === undefined ? { district_id: props.districtId } : unstake}
          />
          {unstake === undefined ? null : (
            <p data-key="UI_UNSTAKE_CONFIRM" data-unstake-days={days}>
              {format(t("UI_UNSTAKE_CONFIRM"), { days })}
            </p>
          )}
          {restarts ? (
            <p data-key="UI_UNSTAKE_RESTARTS">{t("UI_UNSTAKE_RESTARTS")}</p>
          ) : null}
          <p data-key="UI_UNSTAKE_HINT">{props.hint}</p>
          {cooling.map((row) => {
            const coolingNow = chainTimeS === undefined || chainTimeS < row.readyAtS
            return (
              <div key={row.ticker} data-cooldown={row.ticker} data-exact={row.amount.toString()} data-ready={row.readyAtS.toString()}>
                <p data-key="UI_UNSTAKE_COOLING">
                  {format(t("UNSTAKE_COOLING"), { ready_at_s: row.readyAtS.toString() })}
                </p>
                <button
                  type="button"
                  data-key="UI_CLAIM_UNSTAKED"
                  data-intent="claim_unstaked"
                  data-blocked={coolingNow ? "1" : "0"}
                  data-blocked-code={coolingNow ? codes.UNSTAKE_COOLING : ""}
                  disabled={coolingNow}
                  onClick={() => {
                    setClaimCode("")
                    void refusalFromIntent(
                      beginClaimUnstaked({
                        chainTimeS,
                        readyAtS: row.readyAtS,
                        sign: async () => {
                          await props.screen.onIntent({ kind: "claim_unstaked", districtId: props.districtId })
                        },
                      }),
                    ).then((code) => {
                      setClaimCode(code)
                    })
                  }}
                >
                  {t("UI_CLAIM_UNSTAKED")}
                </button>
                {claimCode.length === 0 ? null : (
                  <Refusal code={claimCode} text={t(claimCode)} rest={[]} />
                )}
              </div>
            )
          })}
        </>
      ) : null}
    </div>
  )
}

export type IndustryCardStatus = "open" | "available" | "locked" | "grace" | "frozen" | "unavailable"

const DASH = "—"

/** Pack role may be "AI / Compute"; the cabinet eyebrow is Compute. */
export function displayDistrictRole(role: string): string {
  const cut = role.lastIndexOf(" / ")
  if (cut < 0) return role
  return role.slice(cut + 3)
}

export function industryCardStatus(row: {
  readonly frozen: boolean | undefined
  readonly grace: boolean | undefined
  readonly opened: boolean | undefined
  readonly stakeThresholdMet: boolean | undefined
}): IndustryCardStatus {
  if (row.frozen === true) return "frozen"
  if (row.grace === true) return "grace"
  if (row.opened === true) return "open"
  if (row.opened === false && row.stakeThresholdMet === true) return "available"
  if (row.opened === false && row.stakeThresholdMet === false) return "locked"
  return "unavailable"
}

/** Preview stocks.effect is provides, not a percent. Live efficiency is a percent string. */
export function efficiencyMissing(effect: string): boolean {
  return effect.length === 0 || !effect.includes("%")
}

export function IndustryCard(props: {
  readonly districtId: string
  readonly ticker: string
  readonly role: string
  readonly market: string
  readonly marketMissing: boolean
  readonly effect: string
  readonly effectMissing: boolean
  readonly stake: string
  readonly stakeMissing: boolean
  readonly tier: string
  readonly tierMissing: boolean
  readonly grace: string
  readonly graceMissing: boolean
  readonly frozen: string
  readonly frozenMissing: boolean
  readonly effectLabel: string
  readonly marketLabel: string
  readonly stakeLabel: string
  readonly tierLabel: string
  readonly graceLabel: string
  readonly frozenLabel: string
  readonly unavailable: string
  readonly beaconId?: string
  readonly screen?: ScreenProps
  readonly onLook: () => void
  readonly variant?: "cabinet" | "detail"
  readonly status?: IndustryCardStatus
  readonly beaconName?: string
  readonly beaconNameKey?: string
  readonly openHint?: string
  readonly openHintKey?: string
  readonly frozenHint?: string
  readonly frozenHintKey?: string
  readonly lockedHint?: string
  readonly lockedHintKey?: string
  readonly openLabel?: string
  readonly lockedLabel?: string
  readonly availableLabel?: string
  readonly gracePeriodLabel?: string
  readonly shortfall?: bigint
}): ReactElement {
  const variant = props.variant ?? "detail"
  if (variant === "cabinet") return <CabinetCard {...props} />
  return <DetailCard {...props} />
}

function CabinetCard(props: {
  readonly districtId: string
  readonly ticker: string
  readonly role: string
  readonly effect: string
  readonly effectMissing: boolean
  readonly stake: string
  readonly stakeMissing: boolean
  readonly tier: string
  readonly tierMissing: boolean
  readonly grace: string
  readonly graceMissing: boolean
  readonly frozen: string
  readonly frozenMissing: boolean
  readonly effectLabel: string
  readonly stakeLabel: string
  readonly tierLabel: string
  readonly graceLabel: string
  readonly frozenLabel: string
  readonly unavailable: string
  readonly beaconId?: string
  readonly screen?: ScreenProps
  readonly onLook: () => void
  readonly status?: IndustryCardStatus
  readonly beaconName?: string
  readonly beaconNameKey?: string
  readonly openHint?: string
  readonly openHintKey?: string
  readonly frozenHint?: string
  readonly frozenHintKey?: string
  readonly openLabel?: string
  readonly lockedLabel?: string
  readonly availableLabel?: string
  readonly gracePeriodLabel?: string
  readonly lockedHint?: string
  readonly lockedHintKey?: string
  readonly shortfall?: bigint
}): ReactElement {
  const beaconId = props.beaconId
  const status = props.status ?? "unavailable"
  const chip = chipOf(status, props)
  const beaconName = props.beaconName
  const beaconNameKey = props.beaconNameKey
  const stakeShown = props.stakeMissing ? DASH : props.stake
  const effectShown = props.effectMissing ? DASH : props.effect
  const openedAttr = openedData(status)
  const roleShown = displayDistrictRole(props.role)
  return (
    <section
      data-district={props.districtId}
      data-ticker={props.ticker}
      data-status={status}
      data-opened={openedAttr}
      className="hud-district hud-card hud-icard hud-icard--cabinet"
    >
      <header className="hud-icard__h">
        {beaconId === undefined ? (
          <span className="hud-icard__beacon" data-beacon="unavailable">
            <UnavailableState textKey="UI_UNAVAILABLE" text={props.unavailable} />
          </span>
        ) : (
          <span className="hud-icard__beacon" data-beacon="ready">
            <BuildingThumbnail buildingId={beaconId} unavailable={props.unavailable} compact={true} fallbackIcon={true} />
          </span>
        )}
        <div className="hud-icard__id">
          <span className="hud-icard__role">{roleShown}</span>
          <button type="button" className="hud-icard__ticker" onClick={props.onLook}>
            <CompanyBadge ticker={props.ticker} districtId={props.districtId} />
          </button>
          {status === "unavailable" ? null : (
            <StatusChip
              label={chip.label}
              labelKey={chip.key}
              kind={chip.kind}
              icon={<span className="hud-icard__dot" aria-hidden="true" />}
            />
          )}
        </div>
      </header>
      {beaconName === undefined || beaconNameKey === undefined ? (
        <p className="hud-icard__name" data-beacon-name="unavailable">
          {DASH}
        </p>
      ) : (
        <p data-key={beaconNameKey} data-beacon-name="ready" className="hud-icard__name">
          {beaconName}
        </p>
      )}
      <p className="hud-icard__meta">
        {props.tierMissing ? null : (
          <>
            <span className="hud-icard__meta-item">
              <span data-key="UI_TIER">{props.tierLabel}</span>{" "}
              <span data-tier="ready" data-state="ready">
                {props.tier}
              </span>
            </span>
            <span className="hud-icard__sep" aria-hidden="true">
              |
            </span>
          </>
        )}
        <span className="hud-icard__meta-item">
          <span data-key="UI_STAKE">{props.stakeLabel}</span>{" "}
          <span data-stake={props.stakeMissing ? "unavailable" : "ready"} data-state={props.stakeMissing ? "unavailable" : "ready"}>
            {stakeShown}
          </span>
        </span>
      </p>
      <p className="hud-icard__meta">
        <span className="hud-icard__meta-item">
          <HudIcon glyph="chart" size="sm" semantic="muted" />
          <span data-key="UI_STOCK_EFFECT">{props.effectLabel}</span>{" "}
          <span data-stock-effect data-efficiency={props.effectMissing ? "unavailable" : "ready"} data-state={props.effectMissing ? "unavailable" : "ready"}>
            {effectShown}
          </span>
        </span>
        {status === "grace" ? (
          <span className="hud-icard__meta-item" data-grace-remaining="unavailable">
            <span data-key="UI_GRACE">{props.graceLabel}</span> {DASH}
          </span>
        ) : null}
      </p>
      {status === "available" && props.openHint !== undefined && props.openHintKey !== undefined ? (
        <p data-key={props.openHintKey} className="hud-icard__hint">
          {props.openHint}
        </p>
      ) : null}
      {status === "locked" && props.lockedHint !== undefined && props.lockedHintKey !== undefined ? (
        <p data-key={props.lockedHintKey} className="hud-icard__hint">
          {props.lockedHint}
        </p>
      ) : null}
      {status === "frozen" && props.frozenHint !== undefined && props.frozenHintKey !== undefined ? (
        <p data-key={props.frozenHintKey} className="hud-icard__hint">
          {props.frozenHint}
        </p>
      ) : null}
      <span hidden={true} data-grace={props.graceMissing ? "unavailable" : "ready"}>
        {props.graceMissing ? props.unavailable : props.grace}
      </span>
      <span hidden={true} data-frozen={props.frozenMissing ? "unavailable" : "ready"}>
        {props.frozenMissing ? props.unavailable : props.frozen}
      </span>
      {props.tierMissing ? (
        <span hidden={true} data-tier="unavailable" data-state="unavailable">
          {props.unavailable}
        </span>
      ) : null}
      {props.screen === undefined ? null : (
        <div className="hud-icard__cta" data-icard-cta={status}>
          <CabinetCta
            status={status}
            districtId={props.districtId}
            screen={props.screen}
            onLook={props.onLook}
            gracePeriodLabel={props.gracePeriodLabel ?? props.graceLabel}
            frozenLabel={props.frozenLabel}
            shortfall={props.shortfall}
            lockedHint={props.lockedHint}
            stakeLabel={props.stakeLabel}
          />
        </div>
      )}
    </section>
  )
}

function DetailCard(props: {
  readonly districtId: string
  readonly ticker: string
  readonly role: string
  readonly market: string
  readonly marketMissing: boolean
  readonly effect: string
  readonly effectMissing: boolean
  readonly stake: string
  readonly stakeMissing: boolean
  readonly tier: string
  readonly tierMissing: boolean
  readonly grace: string
  readonly graceMissing: boolean
  readonly frozen: string
  readonly frozenMissing: boolean
  readonly effectLabel: string
  readonly marketLabel: string
  readonly stakeLabel: string
  readonly tierLabel: string
  readonly graceLabel: string
  readonly frozenLabel: string
  readonly unavailable: string
  readonly beaconId?: string
  readonly screen?: ScreenProps
  readonly onLook: () => void
}): ReactElement {
  const beaconId = props.beaconId
  const screen = props.screen
  return (
    <section data-district={props.districtId} data-ticker={props.ticker} className="hud-district hud-card hud-icard">
      <header className="hud-card__h">
        {beaconId === undefined ? (
          <span className="hud-icard__beacon" data-beacon="unavailable">
            <UnavailableState textKey="UI_UNAVAILABLE" text={props.unavailable} />
          </span>
        ) : (
          <span className="hud-icard__beacon" data-beacon="ready">
            <BuildingThumbnail buildingId={beaconId} unavailable={props.unavailable} compact={true} fallbackIcon={true} />
          </span>
        )}
        <span className="hud-card__label">{props.role}</span>
        <button type="button" className="hud-linkbtn hud-btn hud-btn--ghost" onClick={props.onLook}>
          <CompanyBadge ticker={props.ticker} districtId={props.districtId} />
        </button>
      </header>
      <Facts>
        <FactLine
          label={props.effectLabel}
          labelKey="UI_STOCK_EFFECT"
          valueKey={props.effectMissing ? "UI_UNAVAILABLE" : "UI_STOCK_EFFECT"}
          missing={props.effectMissing}
        >
          <span data-stock-effect data-efficiency={props.effectMissing ? "unavailable" : "ready"} data-state={props.effectMissing ? "unavailable" : "ready"}>
            {props.effectMissing ? props.unavailable : props.effect}
          </span>
        </FactLine>
        <FactLine
          label={props.marketLabel}
          labelKey="UI_STOCK_MARKET"
          valueKey={props.marketMissing ? "UI_UNAVAILABLE" : "UI_STOCK_MARKET"}
          missing={props.marketMissing}
        >
          <span data-stock-market>{props.market}</span>
        </FactLine>
        <FactLine label={props.stakeLabel} labelKey="UI_STAKE" valueKey={props.stakeMissing ? "UI_UNAVAILABLE" : "UI_STAKE"} missing={props.stakeMissing}>
          <span data-stake={props.stakeMissing ? "unavailable" : "ready"} data-state={props.stakeMissing ? "unavailable" : "ready"}>
            {props.stakeMissing ? props.unavailable : props.stake}
          </span>
        </FactLine>
        <FactLine label={props.tierLabel} labelKey="UI_TIER" valueKey={props.tierMissing ? "UI_UNAVAILABLE" : "UI_TIER"} missing={props.tierMissing}>
          <span data-tier={props.tierMissing ? "unavailable" : "ready"} data-state={props.tierMissing ? "unavailable" : "ready"}>
            {props.tierMissing ? props.unavailable : props.tier}
          </span>
        </FactLine>
        <FactLine label={props.graceLabel} labelKey="UI_GRACE" valueKey={props.graceMissing ? "UI_UNAVAILABLE" : "UI_GRACE"} missing={props.graceMissing}>
          {props.graceMissing ? props.unavailable : props.grace}
        </FactLine>
        <FactLine label={props.frozenLabel} labelKey="UI_FROZEN" valueKey={props.frozenMissing ? "UI_UNAVAILABLE" : "UI_FROZEN"} missing={props.frozenMissing}>
          {props.frozenMissing ? props.unavailable : props.frozen}
        </FactLine>
      </Facts>
      {screen === undefined ? null : (
        <div className="hud-icard__cta">
          <ActionButton {...screen} actionId="districts_open" lookId={props.districtId} extra={{ district_id: props.districtId }} />
          <ActionButton
            {...screen}
            actionId="districts_open_card"
            onNavigate={(id) => {
              if (id === "district_card") props.onLook()
              else screen.onNavigate(id)
            }}
          />
        </div>
      )}
    </section>
  )
}

function CabinetCta(props: {
  readonly status: IndustryCardStatus
  readonly districtId: string
  readonly screen: ScreenProps
  readonly onLook: () => void
  readonly gracePeriodLabel: string
  readonly frozenLabel: string
  readonly shortfall: bigint | undefined
  readonly lockedHint: string | undefined
  readonly stakeLabel: string
}): ReactElement {
  const screen = props.screen
  if (props.status === "open") {
    return (
      <ActionButton
        {...screen}
        actionId="districts_open_card"
        labelKey="UI_VIEW_INDUSTRY"
        keepLabel={true}
        onNavigate={(id) => {
          if (id === "district_card") props.onLook()
          else screen.onNavigate(id)
        }}
      />
    )
  }
  if (props.status === "grace") {
    return (
      <button type="button" className="hud-btn hud-btn--primary is-refused" disabled={true} data-blocked="1" data-blocked-code="UI_GRACE_PERIOD">
        <span data-key="UI_GRACE_PERIOD" className="hud-action__label">
          {props.gracePeriodLabel}
        </span>
        <span data-grace-remaining="unavailable">{DASH}</span>
      </button>
    )
  }
  if (props.status === "frozen") {
    return (
      <button type="button" className="hud-btn hud-btn--primary is-refused" disabled={true} data-blocked="1" data-blocked-code="UI_FROZEN">
        <span data-key="UI_FROZEN" className="hud-action__label">
          {props.frozenLabel}
        </span>
      </button>
    )
  }
  if (props.status === "locked") {
    return (
      <DistrictStakeBox
        districtId={props.districtId}
        screen={screen}
        shortfall={props.shortfall}
        open={false}
        grace={false}
        hint={props.lockedHint ?? props.stakeLabel}
      />
    )
  }
  return (
    <ActionButton
      {...screen}
      actionId="districts_open"
      lookId={props.districtId}
      extra={{ district_id: props.districtId }}
      labelKey="UI_OPEN_DISTRICT"
      keepLabel={true}
    />
  )
}

function chipOf(
  status: IndustryCardStatus,
  labels: {
    readonly availableLabel?: string
    readonly lockedLabel?: string
    readonly openLabel?: string
    readonly gracePeriodLabel?: string
    readonly frozenLabel: string
    readonly unavailable: string
  },
): { readonly key: string; readonly label: string; readonly kind: StatusChipKind } {
  switch (status) {
    case "open":
      return { key: "UI_OPEN", label: labels.openLabel ?? "Open", kind: "ok" }
    case "available":
      return { key: "UI_AVAILABLE", label: labels.availableLabel ?? "Available", kind: "ready" }
    case "locked":
      return { key: "UI_LOCKED", label: labels.lockedLabel ?? "Locked", kind: "warn" }
    case "grace":
      return { key: "UI_GRACE_PERIOD", label: labels.gracePeriodLabel ?? "Grace period", kind: "warn" }
    case "frozen":
      return { key: "UI_FROZEN", label: labels.frozenLabel, kind: "bad" }
    case "unavailable":
      return { key: "UI_UNAVAILABLE", label: labels.unavailable, kind: "dim" }
    default: {
      const miss: never = status
      return miss
    }
  }
}

function openedData(status: IndustryCardStatus): string {
  if (status === "open" || status === "grace" || status === "frozen") return "1"
  if (status === "available" || status === "locked") return "0"
  return "unavailable"
}
