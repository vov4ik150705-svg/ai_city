import type { ReactElement } from "react"
import { lookup } from "../../strings.js"
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
            unavailable={t("UI_UNAVAILABLE")}
          />
        )
      })}
    </ul>
  )
}

export function ResearchScreen(props: ScreenProps): ReactElement {
  return (
    <ScreenFrame id="research" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <ResearchCatalog {...props} />
    </ScreenFrame>
  )
}
