import { useLayoutEffect, useRef, useState, type ReactNode } from "react"

export type TabItem = {
  id: string
  label: string
  icon?: ReactNode
  panel: ReactNode
}

export function Tabs({
  label,
  tabs,
  variant = "underline",
  preload = false,
}: {
  label: string
  tabs: readonly TabItem[]
  variant?: "underline" | "underline-dark"
  preload?: boolean
}) {
  const first = tabs[0]
  const [active, setActive] = useState(first?.id ?? "")
  const [motion, setMotion] = useState(false)
  const [ink, setInk] = useState<{ x: number; w: number } | null>(null)
  const [inkReady, setInkReady] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const heightRef = useRef<number | null>(null)
  const scrollRef = useRef<number | null>(null)
  const selected = tabs.find((tab) => tab.id === active) ?? first

  useLayoutEffect(() => {
    if (!preload) return
    const list = listRef.current
    if (list === null) return
    const tab = list.querySelector<HTMLElement>('[aria-selected="true"]')
    if (tab === null) return
    const place = () => setInk({ x: tab.offsetLeft, w: tab.offsetWidth })
    place()
    const observer = new ResizeObserver(place)
    observer.observe(list)
    const frame = window.requestAnimationFrame(() => setInkReady(true))
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [active, preload])

  useLayoutEffect(() => {
    const stage = stageRef.current
    const y = scrollRef.current
    if (stage === null) return
    const current = stage.querySelector<HTMLElement>(".is-active")
    if (current === null) return
    const next = current.offsetHeight
    const previous = heightRef.current
    heightRef.current = next
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let finish: ((event: TransitionEvent) => void) | undefined
    if (!motion || reduce || previous === null || previous === next) {
      stage.style.height = ""
      stage.style.transition = ""
      stage.classList.remove("is-sizing")
    } else {
      stage.classList.add("is-sizing")
      stage.style.height = `${previous}px`
      stage.getBoundingClientRect()
      stage.style.transition = "height var(--site-dur-state) var(--site-ease)"
      stage.style.height = `${next}px`
      const onEnd = (event: TransitionEvent) => {
        if (event.propertyName !== "height") return
        stage.style.height = ""
        stage.style.transition = ""
        stage.classList.remove("is-sizing")
        stage.removeEventListener("transitionend", onEnd)
      }
      finish = onEnd
      stage.addEventListener("transitionend", onEnd)
    }
    if (y !== null) {
      scrollRef.current = null
      if (window.scrollY !== y) window.scrollTo(0, y)
    }
    return () => {
      if (finish !== undefined) stage.removeEventListener("transitionend", finish)
      stage.classList.remove("is-sizing")
    }
  }, [active, motion])

  if (selected === undefined) return null

  const activate = (id: string) => {
    if (id === active) return
    if (preload) {
      scrollRef.current = window.scrollY
      setMotion(true)
    }
    setActive(id)
  }

  return (
    <div className={variant === "underline-dark" ? "site-tabs--dark" : undefined}>
      <div ref={listRef} role="tablist" aria-label={label} className="site-tabs">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            className="site-tabs__tab type-label"
            aria-selected={tab.id === selected.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={tab.id === selected.id ? 0 : -1}
            onMouseDown={preload ? (event) => event.preventDefault() : undefined}
            onClick={() => activate(tab.id)}
            onKeyDown={(event) => {
              let nextIndex = index
              if (event.key === "ArrowRight") nextIndex = index + 1
              else if (event.key === "ArrowLeft") nextIndex = index - 1
              else if (event.key === "Home") nextIndex = 0
              else if (event.key === "End") nextIndex = tabs.length - 1
              else return
              event.preventDefault()
              const next = tabs[(nextIndex + tabs.length) % tabs.length]
              if (next === undefined) return
              activate(next.id)
              const button = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
                `#tab-${CSS.escape(next.id)}`,
              )
              button?.focus({ preventScroll: true })
            }}
          >
            {tab.icon !== undefined ? tab.icon : null}
            {tab.label}
          </button>
        ))}
        {preload ? (
          <span
            className={inkReady ? "site-tabs__marker is-ready" : "site-tabs__marker"}
            style={ink === null ? undefined : { transform: `translateX(${ink.x}px)`, width: ink.w }}
            aria-hidden="true"
          />
        ) : null}
      </div>
      {preload ? (
        <div ref={stageRef} className="site-tabs__stage" data-motion={motion ? "1" : "0"}>
          {tabs.map((tab) => {
            const on = tab.id === selected.id
            return (
              <div
                key={tab.id}
                role="tabpanel"
                id={`panel-${tab.id}`}
                aria-labelledby={`tab-${tab.id}`}
                aria-hidden={!on}
                inert={!on}
                className={on ? "site-tabs__panel is-active" : "site-tabs__panel is-inactive"}
              >
                {tab.panel}
              </div>
            )
          })}
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`panel-${selected.id}`}
          aria-labelledby={`tab-${selected.id}`}
          className="site-tabs__panel"
        >
          {selected.panel}
        </div>
      )}
    </div>
  )
}
