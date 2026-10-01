import type { ReactElement } from "react"
import type { ClientPack } from "../../packview.js"
import { lookup, type StringTable } from "../../strings.js"
import { cityLevelSteps, nextCityLevelStep, slotsAtCityStep, type CityLevelStep } from "../cityLevel.js"
import { exactBigint } from "../fields.js"
import type { HudView } from "../model.js"
import { HudIcon, type HudGlyph } from "../parts/HudIcon.js"
import { Progress } from "../parts/ProgressMeter.js"
import { groupThousands } from "../parts/groupThousands.js"
import { FieldValue } from "../parts/ValueRow.js"

const DASH = "—"

export function CityLevelWorkspace(props: {
  readonly view: HudView
  readonly pack: ClientPack
  readonly strings: StringTable
}): ReactElement {
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const shell = props.view.shell
  const levelField = shell.cityLevel
  const popRow = shell.cityStatus.find((row) => row.id === "population")
  const current = exactBigint(levelField)
  const pop = popRow === undefined ? undefined : exactBigint(popRow.field)
  const steps = cityLevelSteps(props.pack.populationThresholdByLevel, props.pack.slotsAtCityLevel)
  const next = nextCityLevelStep(current, steps)
  const need = next === undefined ? undefined : next.population
  const slots = slotsAtCityStep(current, steps)
  const showMeter = pop !== undefined && need !== undefined && need > 0n
  return (
    <section className="hud-city-level" data-id="city-level-ladder">
      <div className="hud-city-level__now">
        <div className="hud-city-level__hero">
          <span className="hud-city-level__mark" aria-hidden="true">
            <HudIcon glyph="city" size="lg" />
          </span>
          <div className="hud-city-level__hero-copy">
            <span data-key="UI_LEVEL" className="hud-city-level__k">
              {t("UI_LEVEL")}
            </span>
            {levelField.kind === "unavailable" ? (
              <span data-key="UI_UNAVAILABLE" className="hud-unavailable" data-level="unavailable">
                {levelField.text}
              </span>
            ) : (
              <span className="hud-city-level__level" data-level="ready" title={levelField.exact}>
                {levelField.text}
              </span>
            )}
          </div>
        </div>
        <div className="hud-city-level__stats">
          <Stat glyph="people" label={t("UI_POPULATION")} labelKey="UI_POPULATION">
            {popRow === undefined ? (
              <span data-key="UI_UNAVAILABLE" className="hud-unavailable" data-population="unavailable">
                {t("UI_UNAVAILABLE")}
              </span>
            ) : (
              <FieldValue field={popRow.field} readyClassName="hud-city-level__num" />
            )}
          </Stat>
          <Stat glyph="forward" label={t("UI_NEXT")} labelKey="UI_NEXT">
            <NextNeed need={need} knownLevel={current !== undefined} hasStep={next !== undefined} unavailable={t("UI_UNAVAILABLE")} />
          </Stat>
          <Stat glyph="agents" label={t("UI_SLOTS")} labelKey="UI_SLOTS">
            {current === undefined || slots === undefined ? (
              <span data-key="UI_UNAVAILABLE" className="hud-unavailable" data-slots="unavailable">
                {t("UI_UNAVAILABLE")}
              </span>
            ) : (
              <span className="hud-city-level__num" data-slots="ready" title={slots.toString()}>
                {groupThousands(slots.toString())}
              </span>
            )}
          </Stat>
        </div>
        {showMeter ? (
          <div className="hud-city-level__meter">
            <span className="hud-city-level__num">{groupThousands(pop.toString())}</span>
            <Progress label={t("UI_POPULATION")} labelKey="UI_POPULATION" valueBps={pop} maxBps={need} compact={true} />
            <span className="hud-city-level__num">{groupThousands(need.toString())}</span>
          </div>
        ) : null}
      </div>
      {steps.length === 0 ? (
        <p className="hud-city-level__ladder hud-empty" data-ladder="empty">
          <span data-key="UI_UNAVAILABLE" className="hud-unavailable">
            {t("UI_UNAVAILABLE")}
          </span>
        </p>
      ) : (
        <ol className="hud-city-level__ladder" data-ladder="ready">
          <li className="hud-city-level__head">
            <HeadCell glyph="city" label={t("UI_LEVEL")} labelKey="UI_LEVEL" />
            <HeadCell glyph="people" label={t("UI_POPULATION")} labelKey="UI_POPULATION" />
            <HeadCell glyph="agents" label={t("UI_SLOTS")} labelKey="UI_SLOTS" />
          </li>
          {steps.map((step) => (
            <LevelRow key={step.level.toString()} step={step} current={current} population={pop} />
          ))}
        </ol>
      )}
    </section>
  )
}

function Stat(props: {
  readonly glyph: HudGlyph
  readonly label: string
  readonly labelKey: string
  readonly children: ReactElement
}): ReactElement {
  return (
    <div className="hud-city-level__stat">
      <span className="hud-city-level__tile" aria-hidden="true">
        <HudIcon glyph={props.glyph} size="md" />
      </span>
      <span className="hud-city-level__stat-copy">
        <span data-key={props.labelKey} className="hud-city-level__k">
          {props.label}
        </span>
        {props.children}
      </span>
    </div>
  )
}

function HeadCell(props: { readonly glyph: HudGlyph; readonly label: string; readonly labelKey: string }): ReactElement {
  return (
    <span className="hud-city-level__cell">
      <span className="hud-city-level__mini" aria-hidden="true">
        <HudIcon glyph={props.glyph} size="sm" />
      </span>
      <span data-key={props.labelKey} className="hud-city-level__k">
        {props.label}
      </span>
    </span>
  )
}

function NextNeed(props: {
  readonly need: bigint | undefined
  readonly knownLevel: boolean
  readonly hasStep: boolean
  readonly unavailable: string
}): ReactElement {
  if (props.knownLevel && !props.hasStep) {
    return (
      <span className="hud-city-level__num" data-next="ceiling">
        {DASH}
      </span>
    )
  }
  if (props.need === undefined) {
    return (
      <span data-key="UI_UNAVAILABLE" className="hud-unavailable" data-next="unavailable">
        {props.unavailable}
      </span>
    )
  }
  return (
    <span className="hud-city-level__num" data-next="ready" title={props.need.toString()}>
      {groupThousands(props.need.toString())}
    </span>
  )
}

function LevelRow(props: {
  readonly step: CityLevelStep
  readonly current: bigint | undefined
  readonly population: bigint | undefined
}): ReactElement {
  const step = props.step
  const met = props.population !== undefined && step.population !== undefined && props.population >= step.population
  const current = props.current !== undefined && props.current === step.level
  return (
    <li data-level={step.level.toString()} data-current={current ? "1" : "0"} data-met={met ? "1" : "0"}>
      <span className="hud-city-level__cell">
        <span className="hud-city-level__badge">{step.level.toString()}</span>
      </span>
      <span className="hud-city-level__cell">
        <span className="hud-city-level__mini" aria-hidden="true">
          <HudIcon glyph="people" size="sm" />
        </span>
        <span className="hud-city-level__num hud-city-level__pop">
          {step.population === undefined ? DASH : groupThousands(step.population.toString())}
        </span>
      </span>
      <span className="hud-city-level__cell">
        <span className="hud-city-level__mini" aria-hidden="true">
          <HudIcon glyph="agents" size="sm" />
        </span>
        <span className="hud-city-level__num">{step.slots === undefined ? DASH : groupThousands(step.slots.toString())}</span>
      </span>
    </li>
  )
}
