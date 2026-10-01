import { createPortal } from "react-dom"
import type { MouseEvent, ReactElement, ReactNode } from "react"
import { HudIcon, type HudGlyph } from "./HudIcon.js"
import { IconButton } from "./IconButton.js"

export function Dialog(props: {
  readonly title: string
  readonly titleKey: string
  readonly children: ReactNode
  readonly onClose?: () => void
  readonly closeLabel?: string
  readonly closeKey?: string
  readonly subtitle?: string
  readonly subtitleKey?: string
  readonly glyph?: HudGlyph
}): ReactElement {
  function onScrim(ev: MouseEvent<HTMLDivElement>): void {
    if (ev.target !== ev.currentTarget) return
    props.onClose?.()
  }
  const titleId = `hud-dialog-${props.titleKey}`
  const close =
    props.onClose === undefined || props.closeLabel === undefined || props.closeKey === undefined ? null : (
      <IconButton label={props.closeLabel} labelKey={props.closeKey} onClick={props.onClose}>
        <HudIcon glyph="close" />
      </IconButton>
    )
  const lede =
    props.subtitle === undefined || props.subtitleKey === undefined ? null : (
      <p data-key={props.subtitleKey} className="hud-dialog__lede">
        {props.subtitle}
      </p>
    )
  const tree = (
    <div className="hud-dialog-scrim" data-dialog="review" data-txn="review" onClick={onScrim}>
      <section className="hud-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="hud-dialog__header">
          <div className="hud-dialog__heading">
            {props.glyph === undefined ? null : (
              <span className="hud-dialog__glyph" aria-hidden="true">
                <HudIcon glyph={props.glyph} size="sm" />
              </span>
            )}
            <div className="hud-dialog__titles">
              <h2 id={titleId} data-key={props.titleKey} className="hud-dialog__title">
                {props.title}
              </h2>
              {lede}
            </div>
          </div>
          {close}
        </header>
        <div className="hud-dialog__body">{props.children}</div>
      </section>
    </div>
  )
  const host = dialogHost()
  return host === null ? tree : createPortal(tree, host)
}

function dialogHost(): HTMLElement | null {
  if (typeof document === "undefined") return null
  const layer = document.querySelector("[data-app='corporator'] > [data-layer='feedback']")
  return layer instanceof HTMLElement ? layer : null
}
