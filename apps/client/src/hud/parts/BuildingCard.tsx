import type { ReactElement, ReactNode } from "react"
import type { FieldView, ResourceView } from "../fields.js"
import { UnavailableState } from "./Empty.js"
import { FactLine, Facts } from "./Facts.js"
import { CompanyBadge } from "./CompanyBadge.js"
import { StatusBadge } from "./StatusBadge.js"
import { BuildingThumbnail } from "./BuildingThumbnail.js"
import { buildingCardKind } from "./hudArt.js"
import { Button } from "./Button.js"
import { HudIcon } from "./HudIcon.js"
import { groupDigits } from "./si.js"

export type BuildingCardFact = {
  readonly label: string
  readonly labelKey: string
  readonly value: string
  readonly valueKey: string
  readonly missing: boolean
}

export function missingBuildingFacts(args: {
  readonly level: string
  readonly worker: string
  readonly task: string
  readonly unavailable: string
}): readonly BuildingCardFact[] {
  return [
    { label: args.level, labelKey: "UI_BUILDING_LEVEL", value: args.unavailable, valueKey: "UI_UNAVAILABLE", missing: true },
    { label: args.worker, labelKey: "UI_BUILDING_WORKER", value: args.unavailable, valueKey: "UI_UNAVAILABLE", missing: true },
    { label: args.task, labelKey: "UI_BUILDING_TASK", value: args.unavailable, valueKey: "UI_UNAVAILABLE", missing: true },
  ]
}

export function BuildingCard(props: {
  readonly buildingId: string
  readonly title: string
  readonly titleKey: string
  readonly ticker: string | undefined
  readonly districtId: string | undefined
  readonly mapped: boolean
  readonly decorative: string
  readonly statusLabel: string
  readonly statusText: string
  readonly statusKey: string
  readonly missingStatus: boolean
  readonly manageLabel: string
  readonly unmapped: string
  readonly unavailable: string
  readonly facts: readonly BuildingCardFact[]
  readonly onManage: () => void
  readonly end?: ReactNode
  readonly variant?: "default" | "compact" | "popover"
  readonly idle?: boolean
  readonly idleLabel?: string
  readonly reasonText?: string
  readonly reasonKey?: string
  readonly energy?: ResourceView
  readonly tickText?: string
  readonly tickKey?: string
  readonly closeLabel?: string
  readonly closeKey?: string
  readonly onClose?: () => void
}): ReactElement {
  const districtId = props.districtId
  const end = props.end
  const variant = props.variant ?? "default"
  const cardKind = buildingCardKind(props.buildingId)
  const functional = cardKind === "functional"
  if (variant === "popover") {
    return (
      <PopoverLook
        buildingId={props.buildingId}
        title={props.title}
        titleKey={props.titleKey}
        mapped={props.mapped}
        decorative={props.decorative}
        statusText={props.statusText}
        statusKey={props.statusKey}
        missingStatus={props.missingStatus}
        manageLabel={props.manageLabel}
        unmapped={props.unmapped}
        unavailable={props.unavailable}
        facts={props.facts}
        cardKind={cardKind}
        functional={functional}
        idle={props.idle === true}
        idleLabel={props.idleLabel ?? ""}
        reasonText={props.reasonText ?? props.statusText}
        reasonKey={props.reasonKey ?? props.statusKey}
        energy={props.energy}
        tickText={props.tickText ?? ""}
        tickKey={props.tickKey ?? ""}
        closeLabel={props.closeLabel ?? ""}
        closeKey={props.closeKey ?? ""}
        onManage={props.onManage}
        onClose={props.onClose}
      />
    )
  }
  return (
    <div
      className={`hud-card hud-bcard hud-bcard--${variant}`}
      data-card={cardKind}
      data-building={props.buildingId}
      data-building-state={props.missingStatus ? "unavailable" : props.statusKey}
    >
      <header className="hud-bcard__id">
        <BuildingThumbnail
          buildingId={props.buildingId}
          unavailable={props.unavailable}
          decorative={props.decorative}
          title={props.title}
        />
        <div className="hud-bcard__who">
          <span data-key={props.titleKey} className="hud-bcard__name">
            {props.title}
          </span>
          {functional && props.ticker !== undefined ? (
            <CompanyBadge ticker={props.ticker} {...(districtId === undefined ? {} : { districtId })} />
          ) : null}
        </div>
        <div className="hud-bcard__end">
          {functional && !props.missingStatus ? (
            <StatusBadge text={props.statusText} textKey={props.statusKey} />
          ) : (
            <span data-key={functional ? props.statusKey : cardKind === "decorative" ? "UI_DECORATIVE" : "UI_UNAVAILABLE"} className="hud-unavailable">
              {functional ? props.statusText : cardKind === "decorative" ? props.decorative : props.unavailable}
            </span>
          )}
          {end === undefined ? null : end}
        </div>
      </header>
      {cardKind === "decorative" ? (
        <p data-key="UI_DECORATIVE" className="hud-muted hud-bcard__note">
          {props.decorative}
        </p>
      ) : null}
      {cardKind === "unavailable" ? (
        <p data-key="UI_UNAVAILABLE" className="hud-muted hud-bcard__note">
          {props.unavailable}
        </p>
      ) : null}
      {functional ? (
        <>
          <dl className="hud-facts">
            <div className="hud-facts__row" data-key="UI_BUILDING_STATUS">
              <dt className="hud-card__label">{props.statusLabel}</dt>
              <dd data-key={props.statusKey} className={props.missingStatus ? "hud-unavailable" : undefined}>
                {props.missingStatus ? props.statusText : <StatusBadge text={props.statusText} textKey={props.statusKey} />}
              </dd>
            </div>
          </dl>
          <Facts>
            {props.facts.map((fact) => (
              <FactLine key={fact.labelKey} label={fact.label} labelKey={fact.labelKey} valueKey={fact.valueKey} missing={fact.missing}>
                {fact.value}
              </FactLine>
            ))}
          </Facts>
          <footer className="hud-card__foot hud-bcard__foot">
            {props.mapped ? (
              <Button
                variant="ghost"
                labelKey="UI_MANAGE"
                onClick={(event) => {
                  event.currentTarget.focus()
                  props.onManage()
                }}
              >
                {props.manageLabel}
              </Button>
            ) : (
              <UnavailableState textKey="UI_UNMAPPED_BUILDING" text={props.unmapped} />
            )}
          </footer>
        </>
      ) : (
        <footer className="hud-card__foot hud-bcard__foot">
          <UnavailableState
            textKey={cardKind === "decorative" ? "UI_DECORATIVE" : "UI_UNAVAILABLE"}
            text={cardKind === "decorative" ? props.decorative : props.unavailable}
          />
        </footer>
      )}
    </div>
  )
}

function PopoverLook(props: {
  readonly buildingId: string
  readonly title: string
  readonly titleKey: string
  readonly mapped: boolean
  readonly decorative: string
  readonly statusText: string
  readonly statusKey: string
  readonly missingStatus: boolean
  readonly manageLabel: string
  readonly unmapped: string
  readonly unavailable: string
  readonly facts: readonly BuildingCardFact[]
  readonly cardKind: ReturnType<typeof buildingCardKind>
  readonly functional: boolean
  readonly idle: boolean
  readonly idleLabel: string
  readonly reasonText: string
  readonly reasonKey: string
  readonly energy: ResourceView | undefined
  readonly tickText: string
  readonly tickKey: string
  readonly closeLabel: string
  readonly closeKey: string
  readonly onManage: () => void
  readonly onClose: (() => void) | undefined
}): ReactElement {
  const statusKey = props.functional
    ? props.statusKey
    : props.cardKind === "decorative"
      ? "UI_DECORATIVE"
      : "UI_UNAVAILABLE"
  const statusText = props.functional
    ? props.statusText
    : props.cardKind === "decorative"
      ? props.decorative
      : props.unavailable
  const showIdle = props.functional && !props.missingStatus && props.idle && props.idleLabel.length > 0
  const close = props.onClose
  return (
    <div
      className="hud-card hud-bcard hud-bcard--popover hud-building-detail"
      data-card={props.cardKind}
      data-building={props.buildingId}
      data-building-state={props.missingStatus ? "unavailable" : props.statusKey}
    >
      {close === undefined ? null : (
        <button type="button" className="hud-building-detail__close" data-key={props.closeKey} aria-label={props.closeLabel} onClick={close}>
          <HudIcon glyph="close" size="sm" />
        </button>
      )}
      <div className="hud-building-detail__art">
        <BuildingThumbnail
          buildingId={props.buildingId}
          unavailable={props.unavailable}
          decorative={props.decorative}
          title={props.title}
          compact={true}
          className="hud-building-detail__thumb"
        />
      </div>
      <div className="hud-building-detail__body">
        <div className="hud-building-detail__title-row">
          <span data-key={props.titleKey} className="hud-building-detail__title">
            {props.title}
          </span>
        </div>
        {showIdle ? (
          <>
            <div className="hud-building-detail__status hud-building-detail__status--idle" data-key="UI_IDLE">
              <span className="hud-building-detail__dot hud-building-detail__dot--idle" />
              {props.idleLabel}
            </div>
            {props.reasonText.length > 0 && props.reasonKey.length > 0 ? (
              <div className="hud-building-detail__status hud-building-detail__status--reason" data-key={props.reasonKey}>
                <span className="hud-building-detail__dot hud-building-detail__dot--reason" />
                <span className="hud-building-detail__status-copy">{props.reasonText}</span>
              </div>
            ) : null}
          </>
        ) : (
          <div className={`hud-building-detail__status${props.functional && !props.missingStatus ? "" : " hud-unavailable"}`} data-key={statusKey}>
            <span className="hud-building-detail__dot" />
            {statusText}
          </div>
        )}
        {props.functional ? (
          <div className="hud-building-detail__meter">
            <EnergyLine energy={props.energy} unavailable={props.unavailable} />
            {props.tickText.length > 0 && props.tickKey.length > 0 ? (
              <div
                className={`hud-building-detail__fact hud-building-detail__fact--paid${props.tickKey === "UI_LAST_TICK_UNPAID" ? " hud-building-detail__fact--unpaid" : ""}`}
                data-key={props.tickKey}
              >
                {props.tickText}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {props.mapped && props.functional ? (
        <button
          type="button"
          data-key="UI_MANAGE"
          className="hud-building-detail__manage"
          onClick={(event) => {
            event.currentTarget.focus()
            props.onManage()
          }}
        >
          <HudIcon glyph="gear" size="sm" />
          {props.manageLabel}
        </button>
      ) : (
        <UnavailableState
          textKey={props.functional ? "UI_UNMAPPED_BUILDING" : props.cardKind === "decorative" ? "UI_DECORATIVE" : "UI_UNAVAILABLE"}
          text={props.functional ? props.unmapped : props.cardKind === "decorative" ? props.decorative : props.unavailable}
        />
      )}
    </div>
  )
}

function groupedField(field: FieldView): string {
  if (field.exact.length === 0) return field.text
  try {
    return groupDigits(BigInt(field.exact))
  } catch {
    return field.text
  }
}

function EnergyLine(props: { readonly energy: ResourceView | undefined; readonly unavailable: string }): ReactElement {
  const energy = props.energy
  const have = energy === undefined ? undefined : energy.available
  const demand = energy === undefined ? undefined : energy.demand
  const haveReady = have !== undefined && have.kind === "ready"
  const demandReady = demand !== undefined && demand.kind === "ready"
  const haveZero = haveReady && have.exact === "0"
  return (
    <div className="hud-building-detail__fact hud-building-detail__energy" data-key={energy === undefined ? "UI_UNAVAILABLE" : energy.key}>
      <HudIcon glyph="bolt" size="sm" />
      <span className="hud-building-detail__energy-label" data-key={energy === undefined ? "UI_ENERGY" : energy.key}>
        {energy === undefined ? props.unavailable : energy.label}
      </span>
      <span className="hud-building-detail__energy-nums">
        <span
          data-key={have === undefined ? "UI_UNAVAILABLE" : have.key}
          data-exact={haveReady ? have.exact : ""}
          className={haveZero ? "hud-building-detail__energy-have hud-building-detail__energy-have--zero" : "hud-building-detail__energy-have"}
        >
          {haveReady ? groupedField(have) : props.unavailable}
        </span>
        <span className="hud-building-detail__energy-sep" aria-hidden="true">/</span>
        <span
          className="hud-building-detail__energy-demand"
          data-key={demand === undefined ? "UI_UNAVAILABLE" : demand.key}
          data-exact={demandReady ? demand.exact : ""}
        >
          {demandReady ? groupedField(demand) : props.unavailable}
        </span>
      </span>
    </div>
  )
}
