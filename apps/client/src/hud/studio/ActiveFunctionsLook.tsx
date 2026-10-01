import type { ReactElement } from "react"
import type { ClientPack } from "../../packview.js"
import type { HudView } from "../model.js"
import { EmptyState, UnavailableState } from "../parts/Empty.js"
import { BuildingThumbnail } from "../parts/BuildingThumbnail.js"
import { HudIcon } from "../parts/HudIcon.js"
import { ACTIVE_FUNCTIONS_DEFAULT_ROWS } from "../selection.js"
import { statusTone } from "../parts/StatusChip.js"

function functionTone(statusKey: string): "ok" | "warn" | "muted" {
  const tone = statusTone(statusKey)
  return tone === "dim" ? "muted" : tone
}

export function ActiveFunctionsLook(props: {
  readonly view: HudView
  readonly pack: ClientPack
  readonly unavailable: string
  readonly idleCaption?: string
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
                  <span
                    data-key={row.statusKey}
                    data-tone={functionTone(row.statusKey)}
                    className="hud-dot hud-active-functions__status"
                    title={row.status}
                    role="img"
                    aria-label={row.status}
                  />
                </div>
                <div className="hud-active-functions__label">
                  <span data-key={row.nameKey} className="hud-functions__name hud-active-functions__name">
                    {row.name}
                  </span>
                  <span
                    data-key={row.statusKey}
                    data-tone={functionTone(row.statusKey)}
                    className="hud-active-functions__run"
                    title={row.status}
                  >
                    {row.statusKey.startsWith("IDLE_") && (props.idleCaption ?? "").length > 0 ? props.idleCaption : row.status}
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
      {viewAll === undefined ? (
        <span data-key={functions.viewAllKey} className="hud-active-functions__view">
          {functions.viewAll}
          <HudIcon glyph="go" size="sm" />
        </span>
      ) : (
        <button type="button" data-key={functions.viewAllKey} className="hud-active-functions__view hud-linkbtn" onClick={viewAll}>
          {functions.viewAll}
          <HudIcon glyph="go" size="sm" />
        </button>
      )}
    </section>
  )
}
