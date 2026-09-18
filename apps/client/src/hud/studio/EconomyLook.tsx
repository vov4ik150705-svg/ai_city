import type { ReactElement } from "react"
import { lookup, type StringTable } from "../../strings.js"
import { exactBigint, type FieldView, type ResourceView } from "../fields.js"
import type { HudView } from "../model.js"
import { UnavailableState } from "../parts/Empty.js"
import { groupThousands } from "../parts/groupThousands.js"
import { HudIcon, type HudGlyph } from "../parts/HudIcon.js"
import { Progress } from "../parts/ProgressMeter.js"
import "../hud-look.css"

export { groupThousands } from "../parts/groupThousands.js"

function ReadyGrouped(props: {
  readonly field: FieldView
  readonly className: string
  readonly prefix?: string
}): ReactElement {
  const amount = exactBigint(props.field)
  if (amount === undefined) {
    return (
      <span data-key={props.field.key} data-field-kind={props.field.kind} className="hud-unavailable">
        {props.field.text}
      </span>
    )
  }
  const prefix = props.prefix === undefined ? "" : amount > 0n ? props.prefix : ""
  return (
    <span className={props.className} title={props.field.exact}>
      {prefix}
      {groupThousands(props.field.exact)}
    </span>
  )
}

export function EconomyLook(props: {
  readonly view: HudView
  readonly strings: StringTable
  readonly onManageFunds: () => void
  readonly onPayroll: () => void
  readonly onResource: (id: "energy" | "compute") => void
}): ReactElement {
  const used = new Set<string>()
  const title = lookup(props.strings, "UI_ECONOMY", used)
  const shell = props.view.shell
  const pay = shell.payrollPanel
  const capital = shell.capital
  return (
    <section data-id="capital" data-surface="left_panel" className="hud-economy" aria-label={title}>
      <header className="hud-economy__h">
        <span className="hud-economy__h-ico" aria-hidden="true">
          <HudIcon glyph="wallet" size="md" />
        </span>
        <h2 data-key="UI_ECONOMY" className="hud-economy__title">
          {title}
        </h2>
        <button
          type="button"
          data-key={shell.manageFundsKey}
          className="hud-economy__go"
          aria-label={shell.manageFunds}
          onClick={props.onManageFunds}
        >
          <HudIcon glyph="go" size="md" />
        </button>
      </header>
      <div className="hud-economy__capital">
        <div className="hud-economy__capital-top">
          <span className="hud-economy__plus" aria-hidden="true">
            <HudIcon glyph="coin" size="md" />
          </span>
          <div className="hud-economy__capital-copy">
            <span data-key={capital.key} className="hud-economy__k">
              {capital.label}
            </span>
            {capital.kind === "unavailable" ? (
              <span data-key="UI_UNAVAILABLE" className="hud-economy__hero hud-unavailable">
                {capital.display}
              </span>
            ) : (
              <span className="hud-economy__hero" title={capital.exact}>
                {groupThousands(capital.exact)}
              </span>
            )}
          </div>
        </div>
        {pay.kind === "unavailable" ? (
          <UnavailableState textKey="UI_UNAVAILABLE" text={pay.text} />
        ) : (
          <p className="hud-economy__paid">
            <ReadyGrouped field={pay.paid} className="hud-economy__paid-amt" prefix="+" />
            <span aria-hidden="true" className="hud-economy__dot">
              ·
            </span>
            <span data-key="UI_PAYROLL_PAID" className="hud-economy__paid-lbl">
              {pay.paidLabel}
            </span>
          </p>
        )}
      </div>
      <div className="hud-economy__rule" />
      {pay.kind === "unavailable" ? null : (
        <button type="button" className="hud-economy__payroll" aria-label={pay.label} onClick={props.onPayroll}>
          <span className="hud-economy__row">
            <span className="hud-economy__row-l">
              <HudIcon glyph="people" size="md" />
              <span data-key={pay.key}>{pay.label}</span>
            </span>
            <span className="hud-economy__row-v">
              {pay.coverage.kind === "ready" ? (
                pay.coverage.text
              ) : (
                <span data-key={pay.coverage.key} data-field-kind={pay.coverage.kind} className="hud-unavailable">
                  {pay.coverage.text}
                </span>
              )}
            </span>
          </span>
          <div className="hud-economy__meter">
            <Progress
              label={pay.coverageLabel}
              labelKey="UI_PAYROLL_COVERAGE"
              valueBps={0n}
              maxBps={shell.bps}
              compact={true}
              field={pay.coverage}
            />
          </div>
          <span data-key="UI_PAYROLL_COVERAGE" className="hud-economy__hint">
            {pay.coverageLabel}
          </span>
        </button>
      )}
      <div className="hud-economy__rule" />
      <div className="hud-economy__res">
        <ResourceLine row={shell.energy} glyph="bolt" onClick={() => props.onResource("energy")} />
        <ResourceLine row={shell.compute} glyph="chip" onClick={() => props.onResource("compute")} />
      </div>
    </section>
  )
}

function ResourceLine(props: {
  readonly row: ResourceView
  readonly glyph: HudGlyph
  readonly onClick: () => void
}): ReactElement {
  const row = props.row
  return (
    <button type="button" className="hud-economy__res-row" aria-label={row.label} onClick={props.onClick}>
      <span className="hud-economy__row-l">
        <HudIcon glyph={props.glyph} size="md" />
        <span data-key={row.key}>{row.label}</span>
      </span>
      <span className="hud-economy__qty">
        <ReadyGrouped field={row.available} className="hud-economy__row-v" />
        <span aria-hidden="true" className="hud-economy__slash">
          /
        </span>
        <ReadyGrouped field={row.demand} className="hud-economy__row-v" />
      </span>
    </button>
  )
}
