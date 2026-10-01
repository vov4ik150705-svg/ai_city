import type { ReactElement } from "react"
import type { ClientPack } from "../../packview.js"
import { lookup, type StringTable } from "../../strings.js"
import { exactBigint } from "../fields.js"
import type { HudView } from "../model.js"
import { cityLevelSteps, nextCityLevelStep } from "../cityLevel.js"
import { HudIcon } from "../parts/HudIcon.js"
import { Progress } from "../parts/ProgressMeter.js"
import { groupThousands } from "../parts/groupThousands.js"
import { FieldValue } from "../parts/ValueRow.js"

export function CityLevelPanel(props: {
  readonly view: HudView
  readonly strings: StringTable
  readonly pack: ClientPack
  readonly onOpen?: () => void
}): ReactElement {
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const title = t("UI_LEVEL")
  const viewAll = t("UI_VIEW_ALL")
  const shell = props.view.shell
  const level = shell.cityLevel
  const popRow = shell.cityStatus.find((row) => row.id === "population")
  const pop = popRow === undefined ? undefined : exactBigint(popRow.field)
  const current = exactBigint(level)
  const steps = cityLevelSteps(props.pack.populationThresholdByLevel, props.pack.slotsAtCityLevel)
  const next = nextCityLevelStep(current, steps)
  const need = next === undefined ? undefined : next.population
  const open = props.onOpen
  const body = (
    <>
      <header className="hud-economy__h">
        <h2 data-key="UI_LEVEL" className="hud-economy__title">
          {title}
        </h2>
      </header>
      {level.kind === "unavailable" ? (
        <span data-key="UI_UNAVAILABLE" className="hud-economy__hero hud-unavailable" data-level="unavailable">
          {level.text}
        </span>
      ) : (
        <span className="hud-economy__hero" data-level="ready" title={level.exact}>
          {level.text}
        </span>
      )}
      <span className="hud-lvl__next">
        <span data-key="UI_POPULATION" className="hud-lvl__k">
          {t("UI_POPULATION")}
        </span>
        <span className="hud-lvl__ratio">
          {popRow === undefined ? (
            <span data-key="UI_UNAVAILABLE" className="hud-unavailable" data-population="unavailable">
              {t("UI_UNAVAILABLE")}
            </span>
          ) : (
            <FieldValue field={popRow.field} readyClassName="hud-lvl__num" />
          )}
          <span aria-hidden="true" className="hud-economy__slash">
            /
          </span>
          <NextNeed need={need} ceiling={current !== undefined && next === undefined} unavailable={t("UI_UNAVAILABLE")} />
        </span>
      </span>
      {pop !== undefined && need !== undefined && need > 0n ? (
        <span className="hud-economy__meter">
          <Progress label={t("UI_POPULATION")} labelKey="UI_POPULATION" valueBps={pop} maxBps={need} compact={true} />
        </span>
      ) : null}
      <span data-key="UI_VIEW_ALL" className="hud-economy__hint hud-economy__city-go">
        {viewAll}
        <HudIcon glyph="go" size="md" />
      </span>
    </>
  )
  return (
    <section data-id="city-level" className="hud-economy hud-lvl" aria-label={title}>
      {open === undefined ? (
        <div className="hud-lvl__hit" data-city-level-entry="static">
          {body}
        </div>
      ) : (
        <button type="button" className="hud-lvl__hit" data-city-level-entry="live" onClick={open}>
          {body}
        </button>
      )}
    </section>
  )
}

function NextNeed(props: { readonly need: bigint | undefined; readonly ceiling: boolean; readonly unavailable: string }): ReactElement {
  if (props.ceiling) {
    return (
      <span className="hud-lvl__num" data-next="ceiling">
        {"—"}
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
    <span className="hud-lvl__num" data-next="ready" title={props.need.toString()}>
      {groupThousands(props.need.toString())}
    </span>
  )
}
