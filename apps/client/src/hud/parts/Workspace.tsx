import { useEffect, useRef, type ReactElement, type ReactNode } from "react"
import { isHudFocusShell } from "../keys.js"
import { HudIcon } from "./HudIcon.js"
import { IconButton } from "./IconButton.js"

export type WorkspaceProps = {
  readonly title: string
  readonly titleKey: string
  readonly closeLabel: string
  readonly closeKey: string
  readonly onClose: () => void
  readonly wide?: boolean
  readonly children: ReactNode
}

export function Workspace(props: WorkspaceProps): ReactElement {
  const wide = props.wide === true
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = rootRef.current
    if (element === null) return
    const previous = document.activeElement
    element.focus()
    return () => {
      if (!(previous instanceof HTMLElement)) return
      if (previous === document.body) return
      if (isHudFocusShell(previous)) return
      if (!document.contains(previous)) return
      previous.focus()
    }
  }, [])

  return (
    <aside
      ref={rootRef}
      tabIndex={-1}
      data-surface="workspace"
      data-key={props.titleKey}
      className={wide ? "hud-workspace hud-workspace--wide" : "hud-workspace"}
      role="complementary"
      aria-labelledby="hud-workspace-title"
    >
      <header className="hud-workspace__header">
        <h2 id="hud-workspace-title" data-key={props.titleKey} className="hud-workspace__title">
          {props.title}
        </h2>
        <IconButton label={props.closeLabel} labelKey={props.closeKey} onClick={props.onClose}>
          <HudIcon glyph="close" />
        </IconButton>
      </header>
      <div className="hud-workspace__body">{props.children}</div>
    </aside>
  )
}
