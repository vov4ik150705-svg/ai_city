import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react"
import { createPortal } from "react-dom"
import type { HudFilterOption } from "./Filter.js"
import { HudIcon, type HudGlyph } from "./HudIcon.js"
import "./filter-select.css"

type MenuMotion = "closed" | "prep" | "in" | "out"

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function FilterSelect(props: {
  readonly label: string
  readonly value: string
  readonly options: readonly HudFilterOption[]
  readonly onPick: (id: string) => void
  readonly menuAlign?: "up"
  readonly tone?: "action" | "primary"
  readonly actionId?: string
  readonly labelKey?: string
  readonly icon?: HudGlyph
}): ReactElement {
  const [motion, setMotion] = useState<MenuMotion>("closed")
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const shown = props.tone === "action" || props.tone === "primary" ? props.label : (props.options.find((option) => option.id === props.value)?.label ?? props.label)
  const pickClass = props.tone === "primary" ? "hud-pick hud-pick--primary" : props.tone === "action" ? "hud-pick hud-pick--action" : "hud-pick"
  const host = menuHost()
  const expanded = motion === "prep" || motion === "in"
  function showMenu(): void {
    if (reducedMotion()) {
      setMotion("in")
      return
    }
    setMotion("prep")
  }
  function hideMenu(): void {
    setMotion((cur) => (cur === "closed" ? "closed" : "out"))
  }
  useEffect(() => {
    if (motion !== "prep") return
    const id = window.requestAnimationFrame(() => setMotion("in"))
    return () => window.cancelAnimationFrame(id)
  }, [motion])
  useEffect(() => {
    if (motion !== "out") return
    const element = menuRef.current
    if (element === null || reducedMotion()) {
      setMotion("closed")
      return
    }
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      setMotion("closed")
    }
    const onEnd = (event: TransitionEvent): void => {
      if (event.target !== element) return
      if (event.propertyName !== "opacity") return
      finish()
    }
    element.addEventListener("transitionend", onEnd)
    const timer = window.setTimeout(finish, 240)
    return () => {
      element.removeEventListener("transitionend", onEnd)
      window.clearTimeout(timer)
    }
  }, [motion])
  useEffect(() => {
    if (motion === "closed") return
    function close(): void {
      setMotion((cur) => (cur === "closed" || cur === "out" ? cur : "out"))
    }
    function down(ev: MouseEvent): void {
      const node = ev.target
      if (!(node instanceof Node)) return
      if (wrapRef.current?.contains(node) === true) return
      if (menuRef.current?.contains(node) === true) return
      close()
    }
    function key(ev: KeyboardEvent): void {
      if (ev.key !== "Escape") return
      ev.stopPropagation()
      ev.preventDefault()
      close()
    }
    document.addEventListener("mousedown", down)
    document.addEventListener("keydown", key, true)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      document.removeEventListener("mousedown", down)
      document.removeEventListener("keydown", key, true)
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [motion])
  const menu = motion === "closed" ? null : (
    <ul
      ref={menuRef}
      role="listbox"
      aria-label={props.label}
      className="hud-pick__menu"
      data-motion={motion}
      style={menuBox(wrapRef.current, props.menuAlign === "up")}
    >
      {props.options.map((option) => {
        const on = option.id === props.value
        return (
          <li key={option.id.length === 0 ? "all" : option.id} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={on}
              className={on ? "hud-pick__opt is-on" : "hud-pick__opt"}
              onClick={() => {
                props.onPick(option.id)
                hideMenu()
              }}
            >
              {option.label}
            </button>
          </li>
        )
      })}
    </ul>
  )
  return (
    <div ref={wrapRef} className="hud-pick-wrap">
      <button
        type="button"
        className={pickClass}
        aria-label={props.label}
        aria-haspopup="listbox"
        aria-expanded={expanded}
        {...(props.actionId === undefined ? {} : { "data-action": props.actionId })}
        {...(props.labelKey === undefined ? {} : { "data-key": props.labelKey })}
        onClick={() => {
          if (expanded) hideMenu()
          else showMenu()
        }}
      >
        {props.icon === undefined ? null : <HudIcon glyph={props.icon} size="sm" />}
        <span className="hud-pick__value">{shown}</span>
        <HudIcon className="hud-pick__chevron" glyph="collapse" size="sm" semantic={props.tone === "action" || props.tone === "primary" ? "default" : "muted"} />
      </button>
      {menu === null ? null : host === null ? menu : createPortal(menu, host)}
    </div>
  )
}

function menuHost(): HTMLElement | null {
  if (typeof document === "undefined") return null
  const root = document.querySelector(".hud-root")
  return root instanceof HTMLElement ? root : null
}

function menuBox(trigger: HTMLDivElement | null, up: boolean): CSSProperties {
  if (trigger === null) return {}
  const rect = trigger.getBoundingClientRect()
  const width = Math.max(rect.width, 12 * 16)
  const gap = 4
  if (up) {
    return {
      position: "fixed",
      left: `${rect.left.toString()}px`,
      width: `${width.toString()}px`,
      bottom: `${(window.innerHeight - rect.top + gap).toString()}px`,
    }
  }
  return {
    position: "fixed",
    left: `${rect.left.toString()}px`,
    width: `${width.toString()}px`,
    top: `${(rect.bottom + gap).toString()}px`,
  }
}
