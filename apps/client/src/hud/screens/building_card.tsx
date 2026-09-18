import { useState, type ReactElement } from "react"
import { lookup } from "../../strings.js"
import { ActionButton } from "../parts/ActionButton.js"
import { BuildingCard, missingBuildingFacts } from "../parts/BuildingCard.js"
import { UnavailableState } from "../parts/Empty.js"
import { districtForBuilding } from "../parts/HudIcon.js"
import { buildingCardKind } from "../parts/hudArt.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"
import { WorkspaceTabs } from "../parts/WorkspaceTabs.js"
import { buildingLabelKey } from "../selection.js"

type BuildingTab = "overview" | "staffing" | "upgrades" | "activity"

export function BuildingCardScreen(props: ScreenProps): ReactElement {
  const [tab, setTab] = useState<BuildingTab>("overview")
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const objectId = props.selectedObjectId ?? ""
  const kind = objectId.length === 0 ? "unavailable" : buildingCardKind(objectId)
  const unavailable = t("UI_UNAVAILABLE")
  const district = objectId.length === 0 ? undefined : districtForBuilding(props.pack, objectId)
  const fn = liveFunction(props.view, objectId)
  const tabs = [
    { id: "overview" as const, key: "UI_OVERVIEW", label: t("UI_OVERVIEW") },
    { id: "staffing" as const, key: "UI_BUILDING_WORKER", label: t("UI_BUILDING_WORKER") },
    { id: "upgrades" as const, key: "UI_UPGRADE", label: t("UI_UPGRADE") },
    { id: "activity" as const, key: "UI_RECENT_EVENTS", label: t("UI_RECENT_EVENTS") },
  ]
  return (
    <ScreenFrame id="building_card" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <WorkspaceTabs
        label={t("UI_OVERVIEW")}
        tabPrefix="hud-tab-building-"
        panelId={(id) => `hud-panel-building-${id}`}
        tabs={tabs}
        active={tab}
        onPick={setTab}
      />
      {tab === "overview" ? (
        <div role="tabpanel" id="hud-panel-building-overview" aria-labelledby="hud-tab-building-overview">
          {kind !== "functional" || objectId.length === 0 ? (
            <UnavailableState
              textKey={kind === "decorative" ? "UI_DECORATIVE" : "UI_UNAVAILABLE"}
              text={kind === "decorative" ? t("UI_DECORATIVE") : unavailable}
            />
          ) : (
            <BuildingCard
              buildingId={objectId}
              title={t(buildingLabelKey(objectId))}
              titleKey={buildingLabelKey(objectId)}
              ticker={district?.ticker}
              districtId={district?.id}
              mapped={true}
              decorative={t("UI_DECORATIVE")}
              statusLabel={t("UI_BUILDING_STATUS")}
              statusText={fn === undefined ? unavailable : fn.status}
              statusKey={fn === undefined ? "UI_UNAVAILABLE" : fn.statusKey}
              missingStatus={fn === undefined}
              manageLabel={t("UI_MANAGE")}
              unmapped={t("UI_UNMAPPED_BUILDING")}
              unavailable={unavailable}
              facts={missingBuildingFacts({
                level: t("UI_BUILDING_LEVEL"),
                worker: t("UI_BUILDING_WORKER"),
                task: t("UI_BUILDING_TASK"),
                unavailable,
              })}
              onManage={() => {}}
            />
          )}
        </div>
      ) : null}
      {tab === "staffing" ? (
        <div role="tabpanel" id="hud-panel-building-staffing" aria-labelledby="hud-tab-building-staffing" className="hud-card">
          <div className="hud-card__body" data-staffing="unavailable">
            <UnavailableState textKey="UI_UNAVAILABLE" text={unavailable} />
          </div>
        </div>
      ) : null}
      {tab === "upgrades" ? (
        <div role="tabpanel" id="hud-panel-building-upgrades" aria-labelledby="hud-tab-building-upgrades" className="hud-card">
          <div className="hud-card__body" data-upgrades="unavailable">
            <UnavailableState textKey="UI_UNAVAILABLE" text={unavailable} />
            <ActionButton {...props} actionId="building_upgrade" />
          </div>
        </div>
      ) : null}
      {tab === "activity" ? (
        <div role="tabpanel" id="hud-panel-building-activity" aria-labelledby="hud-tab-building-activity" className="hud-card">
          <div className="hud-card__body" data-building-activity="unavailable">
            <UnavailableState textKey="UI_UNAVAILABLE" text={unavailable} />
          </div>
        </div>
      ) : null}
    </ScreenFrame>
  )
}

function liveFunction(view: ScreenProps["view"], objectId: string): ScreenProps["view"]["shell"]["functions"]["rows"][number] | undefined {
  for (const row of view.shell.functions.rows) {
    if (row.id === objectId) return row
  }
  return undefined
}
