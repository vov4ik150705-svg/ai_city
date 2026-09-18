import type { ReactElement } from "react"
import { UnavailableState } from "./Empty.js"
import { CompanyBadge } from "./CompanyBadge.js"
import { FactLine, Facts } from "./Facts.js"
import { BuildingThumbnail } from "./BuildingThumbnail.js"

export function IndustryCard(props: {
  readonly districtId: string
  readonly ticker: string
  readonly role: string
  readonly market: string
  readonly marketMissing: boolean
  readonly effectLabel: string
  readonly marketLabel: string
  readonly stakeLabel: string
  readonly tierLabel: string
  readonly graceLabel: string
  readonly frozenLabel: string
  readonly unavailable: string
  readonly beaconId?: string
  readonly onLook: () => void
}): ReactElement {
  const beaconId = props.beaconId
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
        <button type="button" className="hud-linkbtn hud-btn hud-btn--ghost" onClick={props.onLook}>
          <CompanyBadge ticker={props.ticker} districtId={props.districtId} />
        </button>
        <span className="hud-card__label">{props.role}</span>
      </header>
      <Facts>
        <FactLine
          label={props.effectLabel}
          labelKey="UI_STOCK_EFFECT"
          valueKey="UI_UNAVAILABLE"
          missing={true}
        >
          <span data-stock-effect data-efficiency="unavailable" data-state="unavailable">
            {props.unavailable}
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
        <FactLine label={props.stakeLabel} labelKey="UI_STAKE" valueKey="UI_UNAVAILABLE" missing={true}>
          <span data-stake="unavailable" data-state="unavailable">
            {props.unavailable}
          </span>
        </FactLine>
        <FactLine label={props.tierLabel} labelKey="UI_TIER" valueKey="UI_UNAVAILABLE" missing={true}>
          <span data-tier="unavailable" data-state="unavailable">
            {props.unavailable}
          </span>
        </FactLine>
        <FactLine label={props.graceLabel} labelKey="UI_GRACE" valueKey="UI_UNAVAILABLE" missing={true}>
          {props.unavailable}
        </FactLine>
        <FactLine label={props.frozenLabel} labelKey="UI_FROZEN" valueKey="UI_UNAVAILABLE" missing={true}>
          {props.unavailable}
        </FactLine>
      </Facts>
    </section>
  )
}
