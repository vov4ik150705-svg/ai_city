import type { ReactElement } from "react"
import { UnavailableState } from "./Empty.js"
import { FactLine, Facts } from "./Facts.js"
import { HudIcon } from "./HudIcon.js"

export function ResearchCard(props: {
  readonly axisId: string
  readonly name: string
  readonly nameKey: string
  readonly cost: bigint | undefined
  readonly timeTicks: bigint | undefined
  readonly costLabel: string
  readonly durationLabel: string
  readonly unavailable: string
}): ReactElement {
  const costMissing = props.cost === undefined
  const timeMissing = props.timeTicks === undefined
  return (
    <li data-axis={props.axisId} className="hud-card hud-rcard">
      <header className="hud-card__h">
        <span className="hud-card__h-ico" aria-hidden="true">
          <HudIcon glyph="research" size="sm" />
        </span>
        <span data-key={props.nameKey} className="hud-panel-h__t">
          {props.name}
        </span>
        <span className="hud-rcard__art" data-art="unavailable">
          <UnavailableState textKey="UI_UNAVAILABLE" text={props.unavailable} />
        </span>
      </header>
      <Facts>
        <FactLine
          label={props.costLabel}
          labelKey="UI_RESEARCH_COST"
          valueKey={costMissing || props.cost === undefined ? "UI_UNAVAILABLE" : "UI_RESEARCH_COST"}
          missing={costMissing || props.cost === undefined}
        >
          {costMissing || props.cost === undefined ? (
            <UnavailableState textKey="UI_UNAVAILABLE" text={props.unavailable} />
          ) : (
            <span data-exact={props.cost.toString()}>{props.cost.toString()}</span>
          )}
        </FactLine>
        <FactLine
          label={props.durationLabel}
          labelKey="UI_RESEARCH_DURATION"
          valueKey={timeMissing || props.timeTicks === undefined ? "UI_UNAVAILABLE" : "UI_RESEARCH_DURATION"}
          missing={timeMissing || props.timeTicks === undefined}
        >
          {timeMissing || props.timeTicks === undefined ? (
            <UnavailableState textKey="UI_UNAVAILABLE" text={props.unavailable} />
          ) : (
            <span data-exact={props.timeTicks.toString()}>{props.timeTicks.toString()}</span>
          )}
        </FactLine>
      </Facts>
      <div className="hud-card__body">
        <div data-research-art="unavailable" data-research-start="unavailable" data-research-detail="unavailable">
          <UnavailableState textKey="UI_UNAVAILABLE" text={props.unavailable} />
        </div>
      </div>
    </li>
  )
}
