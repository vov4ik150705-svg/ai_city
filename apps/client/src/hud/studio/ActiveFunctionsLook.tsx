import type { ReactElement } from "react"
import type { ClientPack } from "../../packview.js"
import type { HudView } from "../model.js"
import { EmptyState, UnavailableState } from "../parts/Empty.js"
import { BuildingThumbnail } from "../parts/BuildingThumbnail.js"
import { HudIcon } from "../parts/HudIcon.js"
import { ACTIVE_FUNCTIONS_DEFAULT_ROWS } from "../selection.js"

export function ActiveFunctionsLook(props: {
  readonly view: HudView
  readonly pack: ClientPack
  readonly unavailable: string
  readonly selectedId?: string
  readonly onViewAll?: () => void
  readonly onSelectBuilding?: (objectId: string) => void
}): ReactElement {
  const functions = props.view.shell.functions
  const pick = props.onSelectBuilding
  const viewAll = props.onViewAll
  const selectedId = props.selectedId
  void props.pack
  return (
    <section data-surface="active_functions" className="hud-panel hud-functions hud-economy hud-active-functions" aria-label={functions.title}>
      <header className="hud-economy__h">
        <span className="hud-economy__h-ico" aria-hidden="true">
          <HudIcon glyph="bolt" size="md" />
        </span>
        <h2 data-key={functions.key} className="hud-economy__title">
          {functions.title}
        </h2>
        {viewAll === undefined ? (
          <span data-key={functions.viewAllKey} className="hud-active-functions__view">
            {functions.viewAll}
          </span>
        ) : (
          <button type="button" data-key={functions.viewAllKey} className="hud-active-functions__view hud-linkbtn" onClick={viewAll}>
            {functions.viewAll}
          </button>
        )}
        <HudIcon glyph="go" size="md" />
      </header>
      {functions.kind === "unavailable" ? <UnavailableState textKey={functions.messageKey} text={functions.message} /> : null}
      {functions.kind === "empty" ? <EmptyState textKey={functions.messageKey} text={functions.message} /> : null}
      {functions.kind === "ready" ? (
        <div className="hud-functions__list hud-active-functions__list">
          {functions.rows.slice(0, ACTIVE_FUNCTIONS_DEFAULT_ROWS).map((row) => {
            const selected = selectedId === row.id
            const body = (
              <>
                <div className="hud-active-functions__art">
                  <BuildingThumbnail
                    buildingId={row.id}
                    unavailable={props.unavailable}
                    compact={true}
                    className="hud-active-functions__thumb"
                  />
                </div>
                <div className="hud-active-functions__label">
                  <span className="hud-active-functions__status" aria-hidden="true" />
                  <span data-key={row.nameKey} className="hud-functions__name hud-active-functions__name">
                    {row.name}
                  </span>
                </div>
              </>
            )
            return (
              <div key={row.id} data-function={row.id} className="hud-functions__item hud-active-functions__item">
                {pick === undefined ? (
                  <div className={`hud-tile hud-active-functions__card${selected ? " hud-active-functions__card--selected" : ""}`}>
                    {body}
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`hud-tile hud-active-functions__card${selected ? " hud-active-functions__card--selected" : ""}`}
                    title={row.name}
                    aria-label={row.name}
                    aria-pressed={selected}
                    onClick={() => {
                      pick(row.id)
                    }}
                  >
                    {body}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
