import type { ReactElement } from "react"
import { lookup } from "../../strings.js"
import { ActionButton } from "../parts/ActionButton.js"
import { UnavailableState } from "../parts/Empty.js"
import { IndustryCard } from "../parts/IndustryCard.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

export function DistrictCardScreen(props: ScreenProps): ReactElement {
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const lookId = props.lookId ?? ""
  const selected = lookId.length === 0 ? undefined : props.view.districts.find((d) => d.id === lookId)
  const empty = props.view.districts.length === 0
  return (
    <ScreenFrame id="district_card" view={props.view} loading={props.loading} empty={empty} onClose={props.onClose}>
      {selected === undefined ? (
        <div className="hud-card" data-industry-detail="unavailable">
          <div className="hud-card__body">
            <UnavailableState textKey="UI_UNAVAILABLE" text={t("UI_UNAVAILABLE")} />
          </div>
        </div>
      ) : (
        <IndustryDetailCard props={props} district={selected} t={t} />
      )}
      <ActionButton {...props} actionId="district_claim_fragment" />
      <ActionButton {...props} actionId="district_unlock_tier" />
      <ActionButton {...props} actionId="district_stake_more" />
    </ScreenFrame>
  )
}

function IndustryDetailCard(args: {
  readonly props: ScreenProps
  readonly district: ScreenProps["view"]["districts"][number]
  readonly t: (key: string) => string
}): ReactElement {
  const d = args.district
  const t = args.t
  const stock = stockOf(args.props.view, d.ticker)
  const marketMissing = stock === undefined || stock.price.length === 0
  const beacon = beaconOf(args.props.pack, d.id)
  return (
    <div data-industry-detail="ready">
      <IndustryCard
        districtId={d.id}
        ticker={d.ticker}
        role={d.role}
        market={marketMissing || stock === undefined ? t("UI_UNAVAILABLE") : stock.price}
        marketMissing={marketMissing}
        effectLabel={t("UI_STOCK_EFFECT")}
        marketLabel={t("UI_STOCK_MARKET")}
        stakeLabel={t("UI_STAKE")}
        tierLabel={t("UI_TIER")}
        graceLabel={t("UI_GRACE")}
        frozenLabel={t("UI_FROZEN")}
        unavailable={t("UI_UNAVAILABLE")}
        {...(beacon === undefined ? {} : { beaconId: beacon })}
        onLook={() => args.props.onNavigate("industries")}
      />
      <div className="hud-card" data-progression="unavailable" data-merges="unavailable">
        <div className="hud-card__body">
          <UnavailableState textKey="UI_UNAVAILABLE" text={t("UI_UNAVAILABLE")} />
        </div>
      </div>
    </div>
  )
}

function stockOf(view: ScreenProps["view"], ticker: string): ScreenProps["view"]["stocks"][number] | undefined {
  for (const row of view.stocks) {
    if (row.ticker === ticker) return row
  }
  return undefined
}

function beaconOf(pack: ScreenProps["pack"], districtId: string): string | undefined {
  for (const row of pack.districts) {
    if (row.id === districtId && row.beacon.length > 0) return row.beacon
  }
  return undefined
}
