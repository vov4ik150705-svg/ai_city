import type { ReactElement } from "react"
import type { ClientPack } from "../../packview.js"
import { lookup, type StringTable } from "../../strings.js"
import { exactBigint, type FieldView, type StatusRowView } from "../fields.js"
import type { HudView } from "../model.js"
import { HudIcon, glyphForStatus, type HudGlyph } from "../parts/HudIcon.js"
import { groupThousands } from "../parts/groupThousands.js"
import { Progress } from "../parts/ProgressMeter.js"
import { FieldValue } from "../parts/ValueRow.js"

function statusGlyph(id: string): HudGlyph {
  switch (id) {
    case "city_level":
      return "city"
    case "productivity":
      return "gear"
    default:
      return glyphForStatus(id)
  }
}

function nextPopulationThreshold(pack: ClientPack, level: bigint | undefined): bigint | undefined {
  if (level === undefined) return undefined
  return pack.populationThresholdByLevel[(level + 1n).toString()]
}

export function CityStatusLook(props: {
  readonly view: HudView
  readonly strings: StringTable
  readonly pack: ClientPack
  readonly onDetails?: () => void
}): ReactElement {
  const used = new Set<string>()
  const nextLabel = lookup(props.strings, "UI_NEXT", used)
  const shell = props.view.shell
  const popRow = shell.cityStatus.find((row) => row.id === "population")
  const levelRow = shell.cityStatus.find((row) => row.id === "city_level")
  const rest = shell.cityStatus.filter((row) => row.id !== "population")
  const pop = popRow === undefined ? undefined : exactBigint(popRow.field)
  const level = levelRow === undefined ? undefined : exactBigint(levelRow.field)
  const next = nextPopulationThreshold(props.pack, level)
  const details = props.onDetails
  return (
    <section
      data-id="city"
      data-surface="right_panel"
      className="hud-economy hud-economy--city"
      aria-label={shell.cityStatusTitle}
    >
      <header className="hud-economy__h">
        <span className="hud-economy__h-ico" aria-hidden="true">
          <HudIcon glyph="bank" size="md" />
        </span>
        <h2 data-key={shell.cityStatusTitleKey} className="hud-economy__title">
          {shell.cityStatusTitle}
        </h2>
      </header>
      <div className="hud-economy__res">
        {popRow === undefined ? null : <PopulationBlock row={popRow} pop={pop} next={next} nextLabel={nextLabel} />}
        {rest.map((row) => (
          <StatusLine key={row.id} row={row} />
        ))}
      </div>
      {details === undefined ? (
        <span data-key={shell.viewAllKey} className="hud-economy__hint hud-economy__city-go">
          {shell.viewAll}
          <HudIcon glyph="go" size="md" />
        </span>
      ) : (
        <button type="button" data-key={shell.viewAllKey} className="hud-economy__hint hud-economy__city-go" onClick={details}>
          {shell.viewAll}
          <HudIcon glyph="go" size="md" />
        </button>
      )}
    </section>
  )
}

function PopulationBlock(props: {
  readonly row: StatusRowView
  readonly pop: bigint | undefined
  readonly next: bigint | undefined
  readonly nextLabel: string
}): ReactElement {
  const row = props.row
  const next = props.next
  const pop = props.pop
  return (
    <div className="hud-economy__pop">
      <StatusLine row={row} grouped={true} />
      {next === undefined || next <= 0n ? null : (
        <div className="hud-economy__pop-track">
          <div className="hud-economy__meter">
            <Progress
              label={row.label}
              labelKey={row.key}
              valueBps={pop === undefined ? 0n : pop}
              maxBps={next}
              compact={true}
            />
          </div>
          <span data-key="UI_NEXT" className="hud-economy__pop-next">
            {props.nextLabel}: {groupThousands(next.toString())}
          </span>
        </div>
      )}
    </div>
  )
}

function StatusLine(props: { readonly row: StatusRowView; readonly grouped?: boolean }): ReactElement {
  const row = props.row
  return (
    <div data-key={row.key} className="hud-economy__res-row">
      <span className="hud-economy__row-l">
        <HudIcon glyph={statusGlyph(row.id)} size="md" />
        <span data-key={row.key}>{row.label}</span>
      </span>
      <span className="hud-economy__qty">
        {props.grouped === true ? (
          <GroupedOrField field={row.field} />
        ) : (
          <FieldValue field={row.field} readyClassName="hud-economy__row-v" />
        )}
      </span>
    </div>
  )
}

function GroupedOrField(props: { readonly field: FieldView }): ReactElement {
  const amount = exactBigint(props.field)
  if (amount === undefined) {
    return <FieldValue field={props.field} readyClassName="hud-economy__row-v" />
  }
  return (
    <span className="hud-economy__row-v" title={props.field.exact}>
      {groupThousands(props.field.exact)}
    </span>
  )
}
