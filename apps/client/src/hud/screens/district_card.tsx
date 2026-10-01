import { useState, type ReactElement } from "react"
import { codes } from "@corporator/protocol"
import { format, lookup } from "../../strings.js"
import type { ClientMergePair, ClientProgressionNode } from "../../packview.js"
import { nextTierCost } from "../../packview.js"
import { ActionButton } from "../parts/ActionButton.js"
import { BuildingThumbnail } from "../parts/BuildingThumbnail.js"
import { CompanyBadge } from "../parts/CompanyBadge.js"
import { TickerMark } from "../parts/TickerMark.js"
import { UnavailableState } from "../parts/Empty.js"
import { HudIcon } from "../parts/HudIcon.js"
import {
  displayDistrictRole,
  DistrictStakeBox,
  efficiencyMissing,
  industryCardStatus,
  stakeShortfall,
  type IndustryCardStatus,
} from "../parts/IndustryCard.js"
import { PackCost } from "../parts/PackCost.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"
import { StatusChip, type StatusChipKind } from "../parts/StatusChip.js"
import { buildingLabelKey } from "../selection.js"
import { formatStakeTimesSmin, groupDigits } from "../parts/si.js"

const DASH = "—"

function BeaconPin(): ReactElement {
  return (
    <svg className="hud-fragment__pin" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function ClaimGem(): ReactElement {
  return (
    <svg className="hud-fragment__gem" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5 20 9.2 12 21.5 4 9.2 12 2.5z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 9.2h16M8.2 9.2 12 21.5 15.8 9.2M12 2.5 8.2 9.2M12 2.5 15.8 9.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

type FragmentTab = "fragments" | "progression" | "merges"

export function DistrictCardScreen(props: ScreenProps): ReactElement {
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const lookId = props.lookId ?? ""
  const selected = lookId.length === 0 ? undefined : props.view.districts.find((d) => d.id === lookId)
  const empty = props.view.districts.length === 0
  return (
    <ScreenFrame id="district_card" view={props.view} loading={props.loading} empty={empty} onClose={props.onClose}>
      {selected === undefined ? (
        <>
          <div className="hud-card" data-industry-detail="unavailable">
            <div className="hud-card__body">
              <UnavailableState textKey="UI_UNAVAILABLE" text={t("UI_UNAVAILABLE")} />
            </div>
          </div>
          <div data-claim-fragment="live">
            <ActionButton {...props} actionId="district_claim_fragment" />
          </div>
        </>
      ) : (
        <IndustryFragmentCard props={props} district={selected} t={t} lookId={lookId} />
      )}
    </ScreenFrame>
  )
}

function IndustryFragmentCard(args: {
  readonly props: ScreenProps
  readonly district: ScreenProps["view"]["districts"][number]
  readonly t: (key: string) => string
  readonly lookId: string
}): ReactElement {
  const [tab, setTab] = useState<FragmentTab>("fragments")
  const d = args.district
  const t = args.t
  const status = industryCardStatus(d)
  const chip = statusChip(status)
  const stake = stakeCopy(d, args.props, t)
  const effectGone = efficiencyMissing(d.effect)
  const beacon = beaconOf(args.props.pack, d.id)
  const beaconKey = beacon === undefined ? undefined : buildingLabelKey(beacon)
  const claim = claimOf(args.props.view.fragmentLedger, d.ticker)
  const tabs = [
    { id: "fragments" as const, key: "UI_FRAGMENTS", label: t("UI_FRAGMENTS") },
    { id: "progression" as const, key: "UI_PROGRESSION", label: t("UI_PROGRESSION") },
    { id: "merges" as const, key: "UI_MERGES", label: t("UI_MERGES") },
  ]
  return (
    <section className="hud-fragment" data-industry-detail="ready" data-district={d.id} data-ticker={d.ticker}>
      <header className="hud-fragment__head">
        <div className="hud-fragment__identity">
          <span className="hud-fragment__mark" aria-hidden="true">
            <TickerMark ticker={d.ticker} className="hud-fragment__logo" />
          </span>
          <h2 className="hud-fragment__role">{displayDistrictRole(d.role)}</h2>
          <span className="hud-fragment__ticker" data-status={status}>
            <CompanyBadge ticker={d.ticker} districtId={d.id} mark={false} />
          </span>
        </div>
        <div className="hud-fragment__status">
          <StatusChip label={t(chip.key)} labelKey={chip.key} kind={chip.kind} />
          <span
            className="hud-fragment__tier"
            data-tier={d.tier === undefined ? "unavailable" : "ready"}
            data-key={d.tier === undefined ? "UI_UNAVAILABLE" : "UI_TIER"}
            {...(d.tier === undefined ? { "data-state": "unavailable" } : {})}
          >
            {t("UI_TIER")} {d.tier === undefined ? DASH : d.tier.toString()}
          </span>
        </div>
      </header>
      {beacon === undefined || beaconKey === undefined ? null : (
        <div className="hud-fragment__beacon">
          <BuildingThumbnail buildingId={beacon} unavailable={t("UI_UNAVAILABLE")} title={t(beaconKey)} compact />
          <p className="hud-fragment__beacon-name" data-key={beaconKey}>
            <BeaconPin />
            {t(beaconKey)}
          </p>
        </div>
      )}
      <div className="hud-fragment__facts">
        <p className="hud-fragment__fact">
          <span className="hud-fragment__fact-ico" aria-hidden="true">
            <HudIcon glyph="tier" size="lg" />
          </span>
          <span className="hud-fragment__fact-copy">
            <span className="hud-fragment__fact-k" data-key="UI_STAKE">
              {t("UI_STAKE")}
            </span>
            <span
              className="hud-fragment__fact-v"
              data-stake={stake.missing ? "unavailable" : "ready"}
              data-key={stake.key}
              {...(stake.missing ? { "data-state": "unavailable" } : {})}
            >
              {stake.missing ? DASH : stake.text}
            </span>
          </span>
        </p>
        <p className="hud-fragment__fact">
          <span className="hud-fragment__fact-ico" aria-hidden="true">
            <HudIcon glyph="gauge" size="lg" />
          </span>
          <span className="hud-fragment__fact-copy">
            <span className="hud-fragment__fact-k" data-key="UI_STOCK_EFFECT">
              {t("UI_STOCK_EFFECT")}
            </span>
            <span
              className="hud-fragment__fact-v"
              data-efficiency={effectGone ? "unavailable" : "ready"}
              data-key={effectGone ? "UI_UNAVAILABLE" : "UI_STOCK_EFFECT"}
              {...(effectGone ? { "data-state": "unavailable" } : {})}
            >
              {effectGone ? DASH : d.effect}
            </span>
          </span>
        </p>
      </div>
      <div className="hud-tabs" role="tablist" aria-label={t("UI_VIEW_INDUSTRY")}>
        {tabs.map((item) => {
          const on = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`hud-tab-district-${item.id}`}
              data-key={item.key}
              aria-selected={on}
              aria-controls={`hud-panel-district-${item.id}`}
              className={on ? "hud-tabs__btn hud-tabs__btn--on" : "hud-tabs__btn"}
              onClick={() => {
                setTab(item.id)
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <div className="hud-fragment__panels">
        <div
          role="tabpanel"
          id="hud-panel-district-fragments"
          aria-labelledby="hud-tab-district-fragments"
          hidden={tab !== "fragments"}
          data-fragment-kind={claim.kind}
          data-claim-fragment="live"
        >
          <div className="hud-fragment__empty">
            <ClaimGem />
            {claim.kind === "ready" ? (
              <p className="hud-fragment__amount" data-key="UI_FRAGMENTS" data-exact={claim.amount.toString()}>
                {groupDigits(claim.amount)}
              </p>
            ) : (
              <h3 data-key="UI_EMPTY_NOTHING_TO_CLAIM">{t("UI_EMPTY_NOTHING_TO_CLAIM")}</h3>
            )}
            <p className="hud-fragment__hint" data-key="UI_FRAGMENTS_HINT">
              {t("UI_FRAGMENTS_HINT")}
            </p>
            <div className="hud-fragment__claim">
              <ActionButton {...args.props} actionId="district_claim_fragment" keepLabel={true} />
              {args.props.adapterCode === codes.FRAGMENT_SLICE_PENDING ? (
                <p data-key="FRAGMENT_SLICE_PENDING">{t("FRAGMENT_SLICE_PENDING")}</p>
              ) : null}
            </div>
          </div>
        </div>
        <div
          role="tabpanel"
          id="hud-panel-district-progression"
          aria-labelledby="hud-tab-district-progression"
          hidden={tab !== "progression"}
        >
          <NodePickList props={args.props} districtId={d.id} t={t} />
          <div className="hud-fragment__more">
            {showTierBuy(nextTierCost(args.props.pack, d.tier)) ? (
              <>
                <PackCost
                  amount={nextTierCost(args.props.pack, d.tier)}
                  label={t("UI_CAPITAL_COST")}
                  unavailable={t("UI_UNAVAILABLE")}
                />
                <ActionButton {...args.props} actionId="district_unlock_tier" extra={{ district_id: args.lookId }} />
              </>
            ) : d.opened === true ? (
              <span data-tier-open="1" data-key="UI_OPEN">
                {t("UI_OPEN")}
              </span>
            ) : null}
            {d.opened === false && d.stakeThresholdMet === true ? (
              <ActionButton {...args.props} actionId="districts_open" lookId={d.id} extra={{ district_id: d.id }} />
            ) : (
              <DistrictStakeBox
                districtId={d.id}
                screen={args.props}
                shortfall={stakeShortfall(d.stake, d.stakeMin)}
                open={d.opened === true}
                grace={d.grace}
                hint={d.opened === true ? t("UI_UNSTAKE_HINT") : t("UI_STAKE_MORE")}
              />
            )}
          </div>
        </div>
        <div role="tabpanel" id="hud-panel-district-merges" aria-labelledby="hud-tab-district-merges" hidden={tab !== "merges"}>
          <MergePairList props={args.props} districtId={d.id} t={t} />
        </div>
      </div>
    </section>
  )
}

export function showTierBuy(cost: bigint | undefined): boolean {
  return cost !== undefined && cost > 0n
}

function statusChip(status: IndustryCardStatus): { readonly key: string; readonly kind: StatusChipKind } {
  switch (status) {
    case "open":
      return { key: "UI_OPEN", kind: "ok" }
    case "available":
      return { key: "UI_AVAILABLE", kind: "ok" }
    case "locked":
      return { key: "UI_LOCKED", kind: "dim" }
    case "grace":
      return { key: "UI_GRACE", kind: "warn" }
    case "frozen":
      return { key: "UI_FROZEN", kind: "warn" }
    case "unavailable":
      return { key: "UI_UNAVAILABLE", kind: "dim" }
    default: {
      const miss: never = status
      return miss
    }
  }
}

function stakeCopy(
  row: ScreenProps["view"]["districts"][number],
  props: ScreenProps,
  t: (key: string) => string,
): { readonly text: string; readonly missing: boolean; readonly key: string } {
  if (row.stake === undefined) return { text: t("UI_UNAVAILABLE"), missing: true, key: "UI_UNAVAILABLE" }
  const sMin = props.pack.sMinByTicker[row.ticker]
  if (sMin === undefined || sMin <= 0n) return { text: t("UI_UNAVAILABLE"), missing: true, key: "UI_UNAVAILABLE" }
  if (row.stake === 0n) return { text: t("UI_STAKE_ZERO_SMIN"), missing: false, key: "UI_STAKE_ZERO_SMIN" }
  const n = formatStakeTimesSmin(row.stake, sMin)
  if (n === undefined) return { text: t("UI_UNAVAILABLE"), missing: true, key: "UI_UNAVAILABLE" }
  return { text: format(t("UI_STAKE_TIMES"), { n }), missing: false, key: "UI_STAKE_TIMES" }
}

function claimOf(
  ledger: ScreenProps["view"]["fragmentLedger"],
  ticker: string,
): { readonly kind: "unavailable" } | { readonly kind: "empty" } | { readonly kind: "ready"; readonly amount: bigint } {
  if (ledger === undefined) return { kind: "unavailable" }
  let amount = 0n
  for (const row of ledger) {
    if (row.ticker === ticker) amount = row.amount
  }
  if (amount <= 0n) return { kind: "empty" }
  return { kind: "ready", amount }
}

function NodePickList(args: {
  readonly props: ScreenProps
  readonly districtId: string
  readonly t: (key: string) => string
}): ReactElement {
  const nodes = nodesOfDistrict(args.props.pack.progressionNodes, args.districtId)
  if (nodes.length === 0) {
    return (
      <div className="hud-card" data-progression="unavailable">
        <div className="hud-card__body">
          <UnavailableState textKey="UI_UNAVAILABLE" text={args.t("UI_UNAVAILABLE")} />
        </div>
      </div>
    )
  }
  return (
    <div className="hud-fragment__sheet" data-progression="ready">
      <p className="hud-fragment__note" data-key="UI_NO_RESPEC" data-no-respec="1">
        {args.t("UI_NO_RESPEC")}
      </p>
      <ul className="hud-fragment__nodes" data-pick-node="live">
        {nodes.map((node) => {
          const nameKey = "UI_AXIS_" + node.axis.toUpperCase()
          return (
            <li key={node.id} className="hud-fragment__node" data-node={node.id} data-axis={node.axis} data-tier={node.tier.toString()}>
              <span className="hud-fragment__node-name" data-key={nameKey}>
                {args.t(nameKey)}
              </span>
              <ActionButton
                {...args.props}
                actionId="district_pick_node"
                extra={{ district_id: args.districtId, node_id: node.id }}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function MergePairList(args: {
  readonly props: ScreenProps
  readonly districtId: string
  readonly t: (key: string) => string
}): ReactElement {
  const pairs = mergesOfDistrict(args.props.pack.mergePairs, args.districtId)
  if (pairs.length === 0) {
    return (
      <div className="hud-card" data-merges="unavailable">
        <div className="hud-card__body">
          <UnavailableState textKey="UI_UNAVAILABLE" text={args.t("UI_UNAVAILABLE")} />
        </div>
      </div>
    )
  }
  return (
    <div className="hud-fragment__sheet" data-merges="ready">
      <p className="hud-fragment__note" data-key="UI_NO_RESPEC" data-no-respec="1">
        {args.t("UI_NO_RESPEC")}
      </p>
      <ul className="hud-fragment__pairs" data-merge="live">
        {pairs.map((pair) => (
          <li key={pair.id} className="hud-fragment__pair" data-merge={pair.id}>
            <div className="hud-fragment__pair-sides">
              {pair.districts.map((id) => (
                <MergeSide key={id} pack={args.props.pack} districtId={id} t={args.t} />
              ))}
            </div>
            <PackCost
              amount={args.props.pack.mergeCost}
              label={args.t("UI_CAPITAL_COST")}
              unavailable={args.t("UI_UNAVAILABLE")}
            />
            <ActionButton
              {...args.props}
              actionId="district_merge"
              extra={{ district_id: args.districtId, merge_id: pair.id }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function MergeSide(args: {
  readonly pack: ScreenProps["pack"]
  readonly districtId: string
  readonly t: (key: string) => string
}): ReactElement {
  const row = args.pack.districts.find((item) => item.id === args.districtId)
  if (row === undefined || row.beacon.length === 0) {
    return (
      <span className="hud-fragment__side" data-side="unavailable" data-key="UI_UNAVAILABLE">
        {args.t("UI_UNAVAILABLE")}
      </span>
    )
  }
  const nameKey = buildingLabelKey(row.beacon)
  return (
    <span className="hud-fragment__side" data-side={row.id} data-ticker={row.ticker}>
      <BuildingThumbnail buildingId={row.beacon} unavailable={args.t("UI_UNAVAILABLE")} title={args.t(nameKey)} compact />
      <span className="hud-fragment__side-copy">
        <span className="hud-fragment__side-role">{displayDistrictRole(row.role)}</span>
        <CompanyBadge ticker={row.ticker} districtId={row.id} />
      </span>
    </span>
  )
}

function mergesOfDistrict(rows: readonly ClientMergePair[], districtId: string): readonly ClientMergePair[] {
  const out: ClientMergePair[] = []
  for (const row of rows) {
    if (row.districts.includes(districtId)) out.push(row)
  }
  return out
}

function nodesOfDistrict(rows: readonly ClientProgressionNode[], districtId: string): readonly ClientProgressionNode[] {
  const out: ClientProgressionNode[] = []
  for (const row of rows) {
    if (row.district === districtId) out.push(row)
  }
  return out
}

function beaconOf(pack: ScreenProps["pack"], districtId: string): string | undefined {
  for (const row of pack.districts) {
    if (row.id === districtId && row.beacon.length > 0) return row.beacon
  }
  return undefined
}
