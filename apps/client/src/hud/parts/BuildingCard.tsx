import type { ReactElement, ReactNode } from "react"
import { UnavailableState } from "./Empty.js"
import { FactLine, Facts } from "./Facts.js"
import { CompanyBadge } from "./CompanyBadge.js"
import { StatusBadge } from "./StatusBadge.js"
import { BuildingThumbnail } from "./BuildingThumbnail.js"
import { buildingCardKind } from "./hudArt.js"
import { Button } from "./Button.js"
import { HudIcon, type HudGlyph } from "./HudIcon.js"

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

function factGlyph(key: string): HudGlyph {
  switch (key) {
    case "UI_BUILDING_WORKER":
      return "people"
    case "UI_BUILDING_TASK":
      return "gear"
    default:
      return "building"
  }
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
        onManage={props.onManage}
        end={end}
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
  readonly onManage: () => void
  readonly end: ReactNode
}): ReactElement {
  const level = props.facts.find((fact) => fact.labelKey === "UI_BUILDING_LEVEL")
  const rest = props.facts.filter((fact) => fact.labelKey !== "UI_BUILDING_LEVEL")
  const end = props.end
  return (
    <div
      className="hud-card hud-bcard hud-bcard--popover hud-economy hud-building-detail"
      data-card={props.cardKind}
      data-building={props.buildingId}
      data-building-state={props.missingStatus ? "unavailable" : props.statusKey}
    >
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
        {end === undefined ? null : <div className="hud-building-detail__close">{end}</div>}
        <header className="hud-building-detail__header">
          <span data-key={props.titleKey} className="hud-building-detail__title">
            {props.title}
          </span>
          {level === undefined ? null : (
            <span data-key={level.valueKey} className={`hud-building-detail__level${level.missing ? " hud-unavailable" : ""}`}>
              {level.missing ? level.value : level.value}
            </span>
          )}
        </header>
        {props.functional ? (
          <div className={`hud-building-detail__status${props.missingStatus ? " hud-unavailable" : ""}`} data-key={props.statusKey}>
            <span className="hud-building-detail__dot" />
            {props.statusText}
          </div>
        ) : (
          <div className="hud-building-detail__status hud-unavailable" data-key={props.cardKind === "decorative" ? "UI_DECORATIVE" : "UI_UNAVAILABLE"}>
            <span className="hud-building-detail__dot" />
            {props.cardKind === "decorative" ? props.decorative : props.unavailable}
          </div>
        )}
        {props.functional
          ? rest.map((fact) => (
              <div
                key={fact.labelKey}
                data-key={fact.labelKey}
                className={`hud-building-detail__fact${fact.missing ? " hud-unavailable" : ""}`}
              >
                <HudIcon glyph={factGlyph(fact.labelKey)} size="sm" />
                <span data-key={fact.valueKey}>{fact.value}</span>
              </div>
            ))
          : null}
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
            {props.manageLabel} <HudIcon glyph="go" size="sm" />
          </button>
        ) : (
          <UnavailableState
            textKey={props.functional ? "UI_UNMAPPED_BUILDING" : props.cardKind === "decorative" ? "UI_DECORATIVE" : "UI_UNAVAILABLE"}
            text={props.functional ? props.unmapped : props.cardKind === "decorative" ? props.decorative : props.unavailable}
          />
        )}
      </div>
    </div>
  )
}
