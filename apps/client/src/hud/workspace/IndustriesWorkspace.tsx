import { useState, type ReactElement } from "react"
import { format, lookup, type StringTable } from "../../strings.js"
import { nextTierCost, type ClientPack, type DistrictRow } from "../../packview.js"
import type { HudView } from "../model.js"
import { HudIcon } from "../parts/HudIcon.js"
import {
  displayDistrictRole,
  efficiencyMissing,
  industryCardStatus,
  IndustryCard,
  stakeShortfall,
  type IndustryCardStatus,
} from "../parts/IndustryCard.js"
import { formatStakeTimesSmin, groupDigits } from "../parts/si.js"
import { WorkspaceTabs } from "../parts/WorkspaceTabs.js"
import { DistrictsCatalog } from "../screens/districts.js"
import type { ScreenProps } from "../parts/ScreenFrame.js"
import { ActionButton } from "../parts/ActionButton.js"
import { StatusChip, type StatusChipKind } from "../parts/StatusChip.js"
import { BuildingThumbnail } from "../parts/BuildingThumbnail.js"
import { CompanyBadge } from "../parts/CompanyBadge.js"
import { UnavailableState } from "../parts/Empty.js"
import { buildingLabelKey } from "../selection.js"

type IndustriesTab = "industries" | "progression" | "merges"

const DASH = "—"

export function IndustriesWorkspace(props: {
  readonly view: HudView
  readonly pack: ClientPack
  readonly strings: StringTable
  readonly onLook: (id: string) => void
  readonly screen: ScreenProps
  readonly startTab?: IndustriesTab
}): ReactElement {
  const start = props.startTab
  const [tab, setTab] = useState<IndustriesTab>(start === undefined ? "industries" : start)
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const tabs = [
    { id: "industries" as const, key: "UI_TAB_DISTRICTS", label: t("UI_TAB_DISTRICTS") },
    { id: "progression" as const, key: "UI_PROGRESSION", label: t("UI_PROGRESSION") },
    { id: "merges" as const, key: "UI_MERGES", label: t("UI_MERGES") },
  ]
  return (
    <div className="hud-industries">
      <header className="hud-industries__head">
        <span className="hud-industries__mark" aria-hidden="true">
          <HudIcon glyph="industry" size="md" />
        </span>
        <h2 data-key="UI_DISTRICTS" className="hud-industries__name">
          {t("UI_DISTRICTS")}
        </h2>
      </header>
      <WorkspaceTabs
        label={t("UI_DISTRICTS")}
        tabPrefix="hud-tab-industries-"
        panelId={(id) => `hud-panel-industries-${id}`}
        tabs={tabs}
        active={tab}
        onPick={setTab}
      />
      {tab === "industries" ? (
        <div
          role="tabpanel"
          id="hud-panel-industries-industries"
          aria-labelledby="hud-tab-industries-industries"
          className="hud-industries__panel"
        >
          <p data-key="UI_MARKET_VS_EFFICIENCY" className="hud-industries__note">
            {t("UI_MARKET_VS_EFFICIENCY")}
          </p>
          <div className="hud-industries__list">
            {districtsForCabinet(props.view.districts, props.pack.prizeAssets).map((d) => {
              const status = industryCardStatus(d)
              const stock = stockOf(props.view, d.ticker)
              const marketMissing = stock === undefined || stock.price.length === 0
              const effectMissing = efficiencyMissing(d.effect)
              const stake = stakeCopy(d, props.pack, t)
              const beacon = beaconOf(props.pack, d.id)
              const nameKey = beacon === undefined ? undefined : buildingLabelKey(beacon)
              const gap = stakeShortfall(d.stake, d.stakeMin)
              return (
                <IndustryCard
                  key={d.id}
                  variant="cabinet"
                  status={status}
                  districtId={d.id}
                  ticker={d.ticker}
                  role={d.role}
                  market={marketMissing || stock === undefined ? t("UI_UNAVAILABLE") : stock.price}
                  marketMissing={marketMissing}
                  effect={d.effect}
                  effectMissing={effectMissing}
                  stake={stake.text}
                  stakeMissing={stake.missing}
                  tier={d.tier === undefined ? t("UI_UNAVAILABLE") : d.tier.toString()}
                  tierMissing={d.tier === undefined}
                  grace={d.grace === true ? "1" : "0"}
                  graceMissing={d.grace === undefined}
                  frozen={d.frozen === true ? "1" : "0"}
                  frozenMissing={d.frozen === undefined}
                  effectLabel={t("UI_STOCK_EFFECT")}
                  marketLabel={t("UI_STOCK_MARKET")}
                  stakeLabel={t("UI_STAKE")}
                  tierLabel={t("UI_TIER")}
                  graceLabel={t("UI_GRACE")}
                  frozenLabel={t("UI_FROZEN")}
                  unavailable={t("UI_UNAVAILABLE")}
                  openLabel={t("UI_OPEN")}
                  availableLabel={t("UI_AVAILABLE")}
                  lockedLabel={t("UI_LOCKED")}
                  gracePeriodLabel={t("UI_GRACE_PERIOD")}
                  openHint={t("UI_OPEN_SPENDS_CORP")}
                  openHintKey="UI_OPEN_SPENDS_CORP"
                  lockedHint={t("UI_STAKE_BELOW_REQ")}
                  lockedHintKey="UI_STAKE_BELOW_REQ"
                  {...(gap === undefined ? {} : { shortfall: gap })}
                  frozenHint={t("UI_FROZEN_HINT")}
                  frozenHintKey="UI_FROZEN_HINT"
                  screen={props.screen}
                  {...(beacon === undefined ? {} : { beaconId: beacon })}
                  {...(nameKey === undefined ? {} : { beaconNameKey: nameKey, beaconName: t(nameKey) })}
                  onLook={() => lookOf(status, d.id, props)}
                />
              )
            })}
          </div>
          <div className="hud-sr">
            <DistrictsCatalog {...props.screen} onOpenDistrict={props.onLook} />
          </div>
        </div>
      ) : null}
      {tab === "progression" ? <ProgressionCatalog t={t} workspace={props} /> : null}
      {tab === "merges" ? <MergesCatalog t={t} workspace={props} /> : null}
    </div>
  )
}

function ProgressionCatalog(props: {
  readonly t: (key: string) => string
  readonly workspace: {
    readonly view: HudView
    readonly pack: ClientPack
    readonly strings: StringTable
    readonly onLook: (id: string) => void
    readonly screen: ScreenProps
  }
}): ReactElement {
  const t = props.t
  const workspace = props.workspace
  const rows = districtsForCabinet(workspace.view.districts, workspace.pack.prizeAssets)
  const ready = workspace.pack.progressionAxes.length > 0 && rows.length > 0
  return (
    <div
      role="tabpanel"
      id="hud-panel-industries-progression"
      aria-labelledby="hud-tab-industries-progression"
      className="hud-industries__panel"
      data-progression={ready ? "ready" : "unavailable"}
    >
      {ready ? (
        <>
          <p data-key="UI_NO_RESPEC" data-no-respec="1" className="hud-industries__note">
            {t("UI_NO_RESPEC")}
          </p>
          <div className="hud-industries__list">
            {rows.map((d) => (
              <ProgressionCard key={d.id} row={d} t={t} workspace={workspace} />
            ))}
          </div>
        </>
      ) : (
        <UnavailableState textKey="UI_UNAVAILABLE" text={t("UI_UNAVAILABLE")} />
      )}
    </div>
  )
}

function ProgressionCard(props: {
  readonly row: HudView["districts"][number]
  readonly t: (key: string) => string
  readonly workspace: {
    readonly view: HudView
    readonly pack: ClientPack
    readonly strings: StringTable
    readonly onLook: (id: string) => void
    readonly screen: ScreenProps
  }
}): ReactElement {
  const d = props.row
  const t = props.t
  const workspace = props.workspace
  const status = industryCardStatus(d)
  const chip = progressionChip(status, t)
  const beacon = beaconOf(workspace.pack, d.id)
  const nameKey = beacon === undefined ? undefined : buildingLabelKey(beacon)
  const next = nextTierCost(workspace.pack, d.tier)
  return (
    <section
      data-district={d.id}
      data-ticker={d.ticker}
      data-status={status}
      className="hud-district hud-card hud-icard hud-icard--cabinet hud-icard--progression"
    >
      <header className="hud-icard__h">
        {beacon === undefined ? (
          <span className="hud-icard__beacon" data-beacon="unavailable">
            <UnavailableState textKey="UI_UNAVAILABLE" text={t("UI_UNAVAILABLE")} />
          </span>
        ) : (
          <span className="hud-icard__beacon" data-beacon="ready">
            <BuildingThumbnail buildingId={beacon} unavailable={t("UI_UNAVAILABLE")} compact={true} fallbackIcon={true} />
          </span>
        )}
        <div className="hud-icard__id">
          <span className="hud-icard__role">{displayDistrictRole(d.role)}</span>
          <button type="button" className="hud-icard__ticker" onClick={() => lookOf(status, d.id, workspace)}>
            <CompanyBadge ticker={d.ticker} districtId={d.id} />
          </button>
          {chip === undefined ? null : (
            <StatusChip
              label={chip.label}
              labelKey={chip.key}
              kind={chip.kind}
              icon={<span className="hud-icard__dot" aria-hidden="true" />}
            />
          )}
        </div>
      </header>
      {nameKey === undefined ? (
        <p className="hud-icard__name" data-beacon-name="unavailable">
          {DASH}
        </p>
      ) : (
        <p data-key={nameKey} data-beacon-name="ready" className="hud-icard__name">
          {t(nameKey)}
        </p>
      )}
      <div className="hud-prog__facts">
        <p className="hud-icard__meta">
          <span className="hud-icard__meta-item">
            <span data-key="UI_TIER">{t("UI_TIER")}</span>
            {d.tier === undefined ? (
              <span data-tier="unavailable" data-state="unavailable">
                {DASH}
              </span>
            ) : (
              <span className="hud-industries__num" data-tier="ready" data-state="ready">
                {d.tier.toString()}
              </span>
            )}
          </span>
        </p>
        <p className="hud-icard__meta">
          <span className="hud-icard__meta-item">
            <span data-key="UI_NEXT">{t("UI_NEXT")}</span>
            {next === undefined ? (
              <span data-key="UI_UNAVAILABLE" data-state="unavailable">
                {DASH}
              </span>
            ) : (
              <span className="hud-industries__num" data-key="UI_CAPITAL_COST" data-exact={next.toString()}>
                {groupDigits(next)}
              </span>
            )}
          </span>
        </p>
      </div>
      <div className="hud-icard__cta" data-icard-cta="unlock">
        {next !== undefined && next > 0n ? (
          <ActionButton
            {...workspace.screen}
            actionId="district_unlock_tier"
            extra={{ district_id: d.id }}
            lookId={d.id}
            keepLabel={true}
          />
        ) : status === "open" ? (
          <span data-tier-open="1" data-key="UI_OPEN">
            {t("UI_OPEN")}
          </span>
        ) : null}
      </div>
    </section>
  )
}

function progressionChip(
  status: IndustryCardStatus,
  t: (key: string) => string,
): { readonly key: string; readonly label: string; readonly kind: StatusChipKind } | undefined {
  switch (status) {
    case "open":
      return { key: "UI_OPEN", label: t("UI_OPEN"), kind: "ok" }
    case "available":
      return { key: "UI_AVAILABLE", label: t("UI_AVAILABLE"), kind: "ready" }
    case "locked":
      return { key: "UI_LOCKED", label: t("UI_LOCKED"), kind: "warn" }
    case "grace":
      return { key: "UI_GRACE_PERIOD", label: t("UI_GRACE_PERIOD"), kind: "warn" }
    case "frozen":
      return { key: "UI_FROZEN", label: t("UI_FROZEN"), kind: "bad" }
    case "unavailable":
      return undefined
    default: {
      const miss: never = status
      return miss
    }
  }
}

function MergesCatalog(props: {
  readonly t: (key: string) => string
  readonly workspace: {
    readonly view: HudView
    readonly pack: ClientPack
    readonly strings: StringTable
    readonly onLook: (id: string) => void
    readonly screen: ScreenProps
  }
}): ReactElement {
  const t = props.t
  const workspace = props.workspace
  const pairs = workspace.pack.mergePairs
  const ready = pairs.length > 0
  const cap = workspace.pack.mergeActiveCap
  return (
    <div
      role="tabpanel"
      id="hud-panel-industries-merges"
      aria-labelledby="hud-tab-industries-merges"
      className="hud-industries__panel"
      data-merges={ready ? "ready" : "unavailable"}
    >
      {ready ? (
        <>
          <div className="hud-industries__notes hud-industries__notes--merge">
            <p data-key="UI_NO_RESPEC" data-no-respec="1" className="hud-industries__note">
              {t("UI_NO_RESPEC")}
            </p>
            <div className="hud-merge__meta">
              {cap === undefined ? null : (
                <p data-key="UI_MERGE_ACTIVE_CAP" data-merge-cap={cap.toString()} className="hud-industries__note">
                  {format(t("UI_MERGE_ACTIVE_CAP"), { n: cap.toString() })}
                </p>
              )}
              <p className="hud-industries__cost hud-industries__cost--head">
                <span data-key="UI_CAPITAL_COST">{t("UI_CAPITAL_COST")}</span>
                <span data-exact={workspace.pack.mergeCost.toString()}>{groupDigits(workspace.pack.mergeCost)}</span>
              </p>
            </div>
          </div>
          <div className="hud-industries__merges">
            {pairs.map((pair) => {
              const leftId = pair.districts[0]
              const rightId = pair.districts[1]
              const left = leftId === undefined ? undefined : packDistrictOf(workspace.pack, leftId)
              const right = rightId === undefined ? undefined : packDistrictOf(workspace.pack, rightId)
              const leftLook = leftId === undefined ? undefined : viewDistrictOf(workspace.view, leftId)
              const status = leftLook === undefined ? "unavailable" : industryCardStatus(leftLook)
              return (
                <section key={pair.id} data-merge={pair.id} className="hud-card hud-icard hud-icard--cabinet hud-icard--merge">
                  <div className="hud-merge__pair">
                    <MergeSide
                      row={left}
                      unavailable={t("UI_UNAVAILABLE")}
                      t={t}
                      onLook={leftId === undefined ? undefined : () => lookOf(status, leftId, workspace)}
                    />
                    <span className="hud-industries__pair-dot" aria-hidden="true">
                      ·
                    </span>
                    <MergeSide
                      row={right}
                      unavailable={t("UI_UNAVAILABLE")}
                      t={t}
                      onLook={
                        rightId === undefined
                          ? undefined
                          : () => {
                              const other = viewDistrictOf(workspace.view, rightId)
                              const otherStatus = other === undefined ? "unavailable" : industryCardStatus(other)
                              lookOf(otherStatus, rightId, workspace)
                            }
                      }
                    />
                  </div>
                  <div className="hud-icard__cta" data-icard-cta="merge">
                    <ActionButton
                      {...workspace.screen}
                      actionId="district_merge"
                      extra={{ merge_id: pair.id, district_id: leftId ?? "" }}
                      {...(leftId === undefined ? {} : { lookId: leftId })}
                      keepLabel={true}
                    />
                  </div>
                </section>
              )
            })}
          </div>
        </>
      ) : (
        <UnavailableState textKey="UI_UNAVAILABLE" text={t("UI_UNAVAILABLE")} />
      )}
    </div>
  )
}

function MergeSide(props: {
  readonly row: DistrictRow | undefined
  readonly unavailable: string
  readonly t: (key: string) => string
  readonly onLook: (() => void) | undefined
}): ReactElement {
  const row = props.row
  if (row === undefined) {
    return (
      <span className="hud-industries__side" data-ticker="unavailable">
        {DASH}
      </span>
    )
  }
  const nameKey = row.beacon.length === 0 ? undefined : buildingLabelKey(row.beacon)
  const inner = (
    <>
      {row.beacon.length === 0 ? (
        <span data-beacon="unavailable" className="hud-industries__beacon-miss">
          {DASH}
        </span>
      ) : (
        <span data-beacon="ready">
          <BuildingThumbnail
            buildingId={row.beacon}
            unavailable={props.unavailable}
            compact={true}
            fallbackIcon={true}
          />
        </span>
      )}
      <span className="hud-industries__side-copy">
        <span className="hud-industries__id-row">
          <span className="hud-industries__role">{displayDistrictRole(row.role)}</span>
          <CompanyBadge ticker={row.ticker} districtId={row.id} />
        </span>
        {nameKey === undefined ? (
          <span data-beacon-name="unavailable" className="hud-industries__who-name">
            {DASH}
          </span>
        ) : (
          <span data-key={nameKey} data-beacon-name="ready" className="hud-industries__who-name">
            {props.t(nameKey)}
          </span>
        )}
      </span>
    </>
  )
  if (props.onLook === undefined) {
    return (
      <span className="hud-industries__side" data-ticker={row.ticker}>
        {inner}
      </span>
    )
  }
  return (
    <button type="button" className="hud-industries__side hud-industries__who-btn" data-ticker={row.ticker} onClick={props.onLook}>
      {inner}
    </button>
  )
}

function lookOf(
  status: IndustryCardStatus,
  id: string,
  props: { readonly onLook: (id: string) => void; readonly screen: ScreenProps },
): void {
  void status
  void props.screen
  props.onLook(id)
}

function districtsForCabinet(
  rows: HudView["districts"],
  prizeAssets: readonly string[],
): HudView["districts"] {
  const byTicker = new Map<string, HudView["districts"][number]>()
  for (const row of rows) byTicker.set(row.ticker, row)
  const out: HudView["districts"][number][] = []
  const seen = new Set<string>()
  for (const ticker of prizeAssets) {
    const row = byTicker.get(ticker)
    if (row === undefined) continue
    out.push(row)
    seen.add(row.id)
  }
  for (const row of rows) {
    if (!seen.has(row.id)) out.push(row)
  }
  return out
}

function stakeCopy(
  row: HudView["districts"][number],
  pack: ClientPack,
  t: (key: string) => string,
): { readonly text: string; readonly missing: boolean } {
  if (row.stake === undefined) return { text: t("UI_UNAVAILABLE"), missing: true }
  const sMin = pack.sMinByTicker[row.ticker]
  if (sMin === undefined || sMin <= 0n) return { text: t("UI_UNAVAILABLE"), missing: true }
  if (row.stake === 0n) return { text: t("UI_STAKE_ZERO_SMIN"), missing: false }
  const n = formatStakeTimesSmin(row.stake, sMin)
  if (n === undefined) return { text: t("UI_UNAVAILABLE"), missing: true }
  return { text: format(t("UI_STAKE_TIMES"), { n }), missing: false }
}

function beaconOf(pack: ClientPack, districtId: string): string | undefined {
  for (const row of pack.districts) {
    if (row.id === districtId && row.beacon.length > 0) return row.beacon
  }
  return undefined
}

function packDistrictOf(pack: ClientPack, id: string): DistrictRow | undefined {
  for (const row of pack.districts) {
    if (row.id === id) return row
  }
  return undefined
}

function viewDistrictOf(view: HudView, id: string): HudView["districts"][number] | undefined {
  for (const row of view.districts) {
    if (row.id === id) return row
  }
  return undefined
}

function stockOf(view: HudView, ticker: string): HudView["stocks"][number] | undefined {
  for (const row of view.stocks) {
    if (row.ticker === ticker) return row
  }
  return undefined
}
