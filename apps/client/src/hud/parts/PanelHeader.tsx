import type { ReactElement, ReactNode } from "react"
import { HudIcon, type HudGlyph } from "./HudIcon.js"

export function PanelHeader(props: {
  readonly title: string
  readonly titleKey: string
  readonly extra?: ReactNode
  readonly glyph?: HudGlyph
}): ReactElement {
  const glyph = props.glyph
  const extra = props.extra
  return (
    <header className="hud-card__h hud-panel-h">
      {glyph === undefined ? null : (
        <span className="hud-card__h-ico" aria-hidden="true">
          <HudIcon glyph={glyph} />
        </span>
      )}
      <h2 data-key={props.titleKey} className="hud-panel-h__t">
        {props.title}
      </h2>
      {extra === undefined ? null : <div className="hud-card__h-extra">{extra}</div>}
    </header>
  )
}
