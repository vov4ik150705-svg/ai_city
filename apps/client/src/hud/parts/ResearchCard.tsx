import type { ReactElement } from "react"
import { UnavailableState } from "./Empty.js"
import { FactLine, Facts } from "./Facts.js"
import { groupThousands } from "./groupThousands.js"
import { HudIcon } from "./HudIcon.js"

export function ResearchCard(props: {
  readonly axisId: string
  readonly name: string
  readonly nameKey: string
  readonly cost: bigint | undefined
  readonly timeTicks: bigint | undefined
  readonly costLabel: string
  readonly durationLabel: string
  readonly capitalLabel?: string
  readonly unavailable: string
  readonly start?: ReactElement | undefined
}): ReactElement {
  const costMissing = props.cost === undefined
  const timeMissing = props.timeTicks === undefined
  const startLive = props.start !== undefined
  const cost = props.cost
  const timeTicks = props.timeTicks
  return (
    <li data-axis={props.axisId} className="hud-card hud-rcard">
      <header className="hud-card__h">
        <span className="hud-card__h-ico" aria-hidden="true">
          <HudIcon glyph="research" size="md" />
        </span>
        <span data-key={props.nameKey} className="hud-rcard__name">
          {props.name}
        </span>
        <span className="hud-rcard__art" data-art="unavailable" aria-hidden="true">
          <UnavailableState textKey="UI_UNAVAILABLE" text={props.unavailable} />
        </span>
      </header>
      <Facts>
        <FactLine
          label={props.costLabel}
          labelKey="UI_RESEARCH_COST"
          valueKey={costMissing || cost === undefined ? "UI_UNAVAILABLE" : "UI_RESEARCH_COST"}
          missing={costMissing || cost === undefined}
        >
          {costMissing || cost === undefined ? (
            <UnavailableState textKey="UI_UNAVAILABLE" text={props.unavailable} />
          ) : (
            <span className="hud-rcard__v">
              <span data-exact={cost.toString()}>{groupThousands(cost.toString())}</span>
              {props.capitalLabel === undefined ? null : (
                <span data-key="UI_CAPITAL" className="hud-rcard__u">
                  {" "}
                  {props.capitalLabel}
                </span>
              )}
            </span>
          )}
        </FactLine>
        <FactLine
          label={props.durationLabel}
          labelKey="UI_RESEARCH_DURATION"
          valueKey={timeMissing || timeTicks === undefined ? "UI_UNAVAILABLE" : "UI_RESEARCH_DURATION"}
          missing={timeMissing || timeTicks === undefined}
        >
          {timeMissing || timeTicks === undefined ? (
            <UnavailableState textKey="UI_UNAVAILABLE" text={props.unavailable} />
          ) : (
            <span className="hud-rcard__v" data-exact={timeTicks.toString()}>
              {groupThousands(timeTicks.toString())}
            </span>
          )}
        </FactLine>
      </Facts>
      <div className="hud-card__body">
        <div
          data-research-art="unavailable"
          data-research-start={startLive ? "live" : "unavailable"}
          data-research-detail="unavailable"
        >
          {props.start ?? <UnavailableState textKey="UI_UNAVAILABLE" text={props.unavailable} />}
        </div>
      </div>
    </li>
  )
}
