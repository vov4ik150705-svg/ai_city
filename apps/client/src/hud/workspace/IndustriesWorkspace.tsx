import { useState, type ReactElement } from "react"
import { lookup, type StringTable } from "../../strings.js"
import type { ClientPack } from "../../packview.js"
import type { HudView } from "../model.js"
import { UnavailableState } from "../parts/Empty.js"
import { IndustryCard } from "../parts/IndustryCard.js"
import { WorkspaceTabs } from "../parts/WorkspaceTabs.js"

type IndustriesTab = "industries" | "progression" | "merges"

export function IndustriesWorkspace(props: {
  readonly view: HudView
  readonly pack: ClientPack
  readonly strings: StringTable
  readonly onLook: (id: string) => void
}): ReactElement {
  const [tab, setTab] = useState<IndustriesTab>("industries")
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const tabs = [
    { id: "industries" as const, key: "UI_DISTRICTS", label: t("UI_DISTRICTS") },
    { id: "progression" as const, key: "UI_PROGRESSION", label: t("UI_PROGRESSION") },
    { id: "merges" as const, key: "UI_MERGES", label: t("UI_MERGES") },
  ]
  return (
    <div className="hud-industries">
      <WorkspaceTabs
        label={t("UI_DISTRICTS")}
        tabPrefix="hud-tab-industries-"
        panelId={(id) => `hud-panel-industries-${id}`}
        tabs={tabs}
        active={tab}
        onPick={setTab}
      />
      {tab === "industries" ? (
        <div role="tabpanel" id="hud-panel-industries-industries" aria-labelledby="hud-tab-industries-industries" className="hud-industries__list">
          <p data-key="UI_MARKET_VS_EFFICIENCY" className="hud-muted">
            {t("UI_MARKET_VS_EFFICIENCY")}
          </p>
          {props.view.districts.map((d) => {
            const stock = stockOf(props.view, d.ticker)
            const marketMissing = stock === undefined || stock.price.length === 0
            return (
              <IndustryCard
                key={d.id}
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
                {...beaconProp(props.pack, d.id)}
                onLook={() => props.onLook(d.id)}
              />
            )
          })}
        </div>
      ) : null}
      {tab === "progression" ? (
        <ul role="tabpanel" id="hud-panel-industries-progression" aria-labelledby="hud-tab-industries-progression" className="hud-list" data-progression="unavailable">
          {props.pack.progressionAxes.map((id) => (
            <li key={id} data-axis={id} className="hud-card">
              <header className="hud-card__h">
                <span data-key={axisKey(id)} className="hud-panel-h__t">
                  {t(axisKey(id))}
                </span>
              </header>
              <div className="hud-card__body">
                <UnavailableState textKey="UI_UNAVAILABLE" text={t("UI_UNAVAILABLE")} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {tab === "merges" ? (
        <ul role="tabpanel" id="hud-panel-industries-merges" aria-labelledby="hud-tab-industries-merges" className="hud-list" data-merges="unavailable">
          {props.pack.mergePairIds.map((id) => (
            <li key={id} data-merge={id} className="hud-card">
              <header className="hud-card__h">
                <span className="hud-panel-h__t">{id}</span>
              </header>
              <div className="hud-card__body">
                <UnavailableState textKey="UI_UNAVAILABLE" text={t("UI_UNAVAILABLE")} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function axisKey(id: string): string {
  return `UI_AXIS_${id.toUpperCase()}`
}

function beaconProp(pack: ClientPack, districtId: string): { readonly beaconId?: string } {
  for (const row of pack.districts) {
    if (row.id === districtId && row.beacon.length > 0) return { beaconId: row.beacon }
  }
  return {}
}

function stockOf(view: HudView, ticker: string): HudView["stocks"][number] | undefined {
  for (const row of view.stocks) {
    if (row.ticker === ticker) return row
  }
  return undefined
}
