import type { ReactElement, ReactNode } from "react"
import { HudIcon } from "./HudIcon.js"
import { IconButton } from "./IconButton.js"

export function Dialog(props: {
  readonly title: string
  readonly titleKey: string
  readonly children: ReactNode
  readonly onClose?: () => void
  readonly closeLabel?: string
  readonly closeKey?: string
}): ReactElement {
  return (
    <section className="hud-dialog" role="dialog" aria-labelledby={`hud-dialog-${props.titleKey}`}>
      <header className="hud-dialog__header">
        <h2 id={`hud-dialog-${props.titleKey}`} data-key={props.titleKey} className="hud-dialog__title">
          {props.title}
        </h2>
        {props.onClose === undefined || props.closeLabel === undefined || props.closeKey === undefined ? null : (
          <IconButton label={props.closeLabel} labelKey={props.closeKey} onClick={props.onClose}>
            <HudIcon glyph="close" />
          </IconButton>
        )}
      </header>
      <div className="hud-dialog__body">{props.children}</div>
    </section>
  )
}
