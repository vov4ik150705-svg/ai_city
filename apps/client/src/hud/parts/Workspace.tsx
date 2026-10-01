import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react"
import type { HudPaneMotion } from "../navigation.js"
import { isHudFocusShell } from "../keys.js"
import { HudIcon, type HudGlyph } from "./HudIcon.js"
import { IconButton } from "./IconButton.js"

export type WorkspaceProps = {
  readonly title: string
  readonly titleKey: string
  readonly closeLabel: string
  readonly closeKey: string
  readonly onClose: () => void
  readonly wide?: boolean
  readonly workspaceId?: string
  readonly mark?: HudGlyph
  readonly motion?: "in" | "out"
  readonly pane?: HudPaneMotion
  readonly paneKey?: string
  readonly onExited?: () => void
  readonly onBack?: () => void
  readonly backLabel?: string
  readonly backKey?: string
  readonly children: ReactNode
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

type ShellPhase = "prep" | "in" | "out"

export function Workspace(props: WorkspaceProps): ReactElement {
  const wide = props.wide === true
  const rootRef = useRef<HTMLElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const onExitedRef = useRef(props.onExited)
  onExitedRef.current = props.onExited
  const motion = props.motion ?? "in"
  const pane = props.pane ?? "in"
  const [phase, setPhase] = useState<ShellPhase>(() => (motion === "out" || reducedMotion() ? motion : "prep"))

  useEffect(() => {
    if (motion === "out") {
      setPhase("out")
      return
    }
    if (reducedMotion()) {
      setPhase("in")
      return
    }
    const id = window.requestAnimationFrame(() => setPhase("in"))
    return () => window.cancelAnimationFrame(id)
  }, [motion])

  useEffect(() => {
    if (motion !== "out") return
    const element = rootRef.current
    if (element === null) return
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      onExitedRef.current?.()
    }
    if (reducedMotion()) {
      finish()
      return
    }
    const onEnd = (event: TransitionEvent): void => {
      if (event.target !== element) return
      if (event.propertyName !== "opacity") return
      finish()
    }
    element.addEventListener("transitionend", onEnd)
    const timer = window.setTimeout(finish, 320)
    return () => {
      element.removeEventListener("transitionend", onEnd)
      window.clearTimeout(timer)
    }
  }, [motion])

  useEffect(() => {
    const body = bodyRef.current
    if (body === null) return
    const previous = body.style.scrollBehavior
    body.style.scrollBehavior = "auto"
    body.scrollTop = 0
    body.style.scrollBehavior = previous
  }, [props.paneKey])

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
      {...(props.workspaceId === undefined || props.workspaceId.length === 0 ? {} : { "data-workspace": props.workspaceId })}
      {...(props.onBack === undefined ? {} : { "data-back": "1" })}
      className={wide ? "hud-workspace hud-workspace--wide" : "hud-workspace"}
      data-motion={phase}
      role="complementary"
      aria-labelledby="hud-workspace-title"
    >
      <header className="hud-workspace__header">
        {props.onBack === undefined ? null : (
          <IconButton label={props.backLabel ?? ""} labelKey={props.backKey ?? "UI_BACK"} onClick={props.onBack}>
            <HudIcon glyph="back" />
          </IconButton>
        )}
        <h2 id="hud-workspace-title" data-key={props.titleKey} className="hud-workspace__title">
          {props.mark === undefined ? null : <HudIcon glyph={props.mark} />}
          {props.title}
        </h2>
        <IconButton label={props.closeLabel} labelKey={props.closeKey} onClick={props.onClose}>
          <HudIcon glyph="close" />
        </IconButton>
      </header>
      <div ref={bodyRef} className="hud-workspace__body">
        <div className="hud-workspace__pane" data-pane={pane}>
          {props.children}
        </div>
      </div>
    </aside>
  )
}
