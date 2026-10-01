import type { ReactElement } from "react"
import { lookup } from "../../strings.js"
import { ActionButton } from "../parts/ActionButton.js"
import type { ScreenProps } from "../parts/ScreenFrame.js"
import { ScreenFrame } from "../parts/ScreenFrame.js"
import { ResearchCard } from "../parts/ResearchCard.js"

export function ResearchCatalog(props: ScreenProps): ReactElement {
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  return (
    <ul className="hud-list" data-research="1">
      {props.pack.researchAxes.map((axis) => {
        const nameKey = `UI_AXIS_${axis.id.toUpperCase()}`
        const actionId = `research_unlock_${axis.id}`
        const action = props.pack.actions[actionId]
        const started = props.view.researchFocus === axis.id
        return (
          <ResearchCard
            key={axis.id}
            axisId={axis.id}
            name={t(nameKey)}
            nameKey={nameKey}
            cost={axis.cost}
            timeTicks={axis.timeTicks}
            costLabel={t("UI_RESEARCH_COST")}
            durationLabel={t("UI_RESEARCH_DURATION")}
            capitalLabel={t("UI_CAPITAL")}
            unavailable={t("UI_UNAVAILABLE")}
            start={
              started ? (
                <span data-key="UI_RUNNING" data-research-focus={axis.id}>
                  {t("UI_RUNNING")}
                </span>
              ) : action === undefined ? undefined : (
                <ActionButton {...props} actionId={actionId} extra={{ axis_id: axis.id }} />
              )
            }
          />
        )
      })}
    </ul>
  )
}

export function ResearchScreen(props: ScreenProps): ReactElement {
  return (
    <ScreenFrame id="research" view={props.view} loading={props.loading} empty={props.pack.researchAxes.length === 0} onClose={props.onClose}>
      <ResearchCatalog {...props} />
    </ScreenFrame>
  )
}
