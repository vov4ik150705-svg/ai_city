import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { ChevronLeft, ChevronRight, Eye } from "lucide-react"
import {
  autonomousTip,
  buildingFilters,
  buildings,
  buildingsHeading,
  buildingsIn,
  buildingsLead,
  homeRoleTip,
  layerLabel,
  prebuiltTip,
  type Building,
  type BuildingFilter,
  type BuildingImage,
} from "../data/buildings"
import { BuildingStudio } from "./BuildingStudio"
import "../styles/buildings.css"

const facts = [
  { key: "role", label: "Role" },
  { key: "levels", label: "Levels" },
  { key: "tip", label: "Tip" },
] as const

function TipChip({ label, tip }: { label: string; tip: string }) {
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  const tipId = useId()
  const open = hover || pinned

  useEffect(() => {
    if (!pinned) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && root.current?.contains(target) === false) setPinned(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinned(false)
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [pinned])

  return (
    <span
      ref={root}
      className={`buildings__tip${open ? " is-open" : ""}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className="buildings__chip type-metadata"
        aria-describedby={tipId}
        aria-expanded={open}
        onClick={() => setPinned((value) => !value)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        {label}
      </button>
      <span id={tipId} role="tooltip" className="buildings__tip-bubble type-tooltip">
        {tip}
      </span>
    </span>
  )
}

function BuildingChips({ building }: { building: Building }) {
  return (
    <ul className="buildings__chips">
      <li>
        <span className="buildings__chip type-metadata">{layerLabel(building.category)}</span>
      </li>
      {building.homeRole !== null ? (
        <li>
          <TipChip label={building.homeRole} tip={homeRoleTip} />
        </li>
      ) : null}
      {building.autonomous ? (
        <li>
          <TipChip label="Autonomous" tip={autonomousTip} />
        </li>
      ) : null}
      {building.prebuilt ? (
        <li>
          <TipChip label="Prebuilt" tip={prebuiltTip} />
        </li>
      ) : null}
      <li>
        <span className="buildings__chip type-metadata">{building.schedule}</span>
      </li>
    </ul>
  )
}

function modelFrame(image: BuildingImage): CSSProperties {
  const { left, top, right, bottom } = image.model
  const spanX = right - left
  const spanY = bottom - top
  const contentAspect = (spanX * image.width) / (spanY * image.height)
  const contentW = contentAspect >= 1 ? 1 : contentAspect
  const contentH = contentAspect >= 1 ? 1 / contentAspect : 1
  return {
    "--image-w": contentW / spanX,
    "--image-h": contentH / spanY,
    "--hang": (1 - bottom) * (contentH / spanY),
    "--shift": 0.5 - (left + right) / 2,
  } as CSSProperties
}

function PreviewImage({ building, leaving }: { building: Building; leaving: boolean }) {
  const image = building.image
  if (image === null) return null
  return (
    <img
      className={leaving ? "buildings__preview is-leaving" : "buildings__preview"}
      src={image.src}
      alt={leaving ? "" : building.name}
      width={image.width}
      height={image.height}
      loading="lazy"
      decoding="async"
      style={modelFrame(image)}
    />
  )
}

function BuildingPicture({ building }: { building: Building }) {
  const [shown, setShown] = useState(building)
  const [leaving, setLeaving] = useState<Building | null>(null)

  useEffect(() => {
    if (building.id === shown.id) return
    let cancelled = false
    const commit = () => {
      if (cancelled) return
      setLeaving(shown)
      setShown(building)
    }
    if (building.image === null) {
      commit()
      return
    }
    const img = new Image()
    img.src = building.image.src
    void img.decode().then(commit, commit)
    return () => {
      cancelled = true
    }
  }, [building, shown])

  useEffect(() => {
    if (leaving === null) return
    const id = window.setTimeout(() => setLeaving(null), BUILDINGS_MOTION_MS)
    return () => window.clearTimeout(id)
  }, [leaving])

  return (
    <div className="buildings__stage">
      {leaving !== null && leaving.id !== shown.id ? <PreviewImage building={leaving} leaving /> : null}
      <PreviewImage key={shown.id} building={shown} leaving={false} />
    </div>
  )
}

const BUILDINGS_MOTION_MS = 150
const RAIL_SMOOTH_MS = 200
const RAIL_MAX_FRAME_MS = 48

type RailGlide = {
  frame: number
  last: number
  x: number
  y: number
  targetX: number
  targetY: number
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function glideRail(list: HTMLElement, glide: RailGlide, nextX: number, nextY: number) {
  const maxX = Math.max(0, list.scrollWidth - list.clientWidth)
  const maxY = Math.max(0, list.scrollHeight - list.clientHeight)
  glide.targetX = Math.min(maxX, Math.max(0, nextX))
  glide.targetY = Math.min(maxY, Math.max(0, nextY))
  if (prefersReducedMotion()) {
    if (glide.frame !== 0) cancelAnimationFrame(glide.frame)
    glide.frame = 0
    glide.last = 0
    glide.x = glide.targetX
    glide.y = glide.targetY
    list.scrollLeft = glide.x
    list.scrollTop = glide.y
    return
  }
  if (glide.frame !== 0) return
  glide.x = list.scrollLeft
  glide.y = list.scrollTop
  const tick = (now: number) => {
    const dt = glide.last === 0 ? 16 : Math.min(RAIL_MAX_FRAME_MS, now - glide.last)
    glide.last = now
    const blend = 1 - Math.exp(-dt / RAIL_SMOOTH_MS)
    glide.x += (glide.targetX - glide.x) * blend
    glide.y += (glide.targetY - glide.y) * blend
    const doneX = Math.abs(glide.targetX - glide.x) < 0.5
    const doneY = Math.abs(glide.targetY - glide.y) < 0.5
    if (doneX) glide.x = glide.targetX
    if (doneY) glide.y = glide.targetY
    list.scrollLeft = glide.x
    list.scrollTop = glide.y
    if (doneX && doneY) {
      glide.frame = 0
      glide.last = 0
      return
    }
    glide.frame = requestAnimationFrame(tick)
  }
  glide.frame = requestAnimationFrame(tick)
}

function revealInRail(list: HTMLElement, option: HTMLElement, glide: RailGlide) {
  const listRect = list.getBoundingClientRect()
  const optionRect = option.getBoundingClientRect()
  glideRail(
    list,
    glide,
    list.scrollLeft + (optionRect.left - listRect.left),
    list.scrollTop + (optionRect.top - listRect.top),
  )
}

function wheelPixels(event: WheelEvent, span: number, axis: "x" | "y"): number {
  const delta = axis === "x" ? event.deltaX : event.deltaY
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * 16
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return delta * span
  return delta
}

export function Buildings() {
  const [filter, setFilter] = useState<BuildingFilter>("all")
  const [selectedId, setSelectedId] = useState("city_hall")
  const [horizontal, setHorizontal] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const glideRef = useRef<RailGlide>({ frame: 0, last: 0, x: 0, y: 0, targetX: 0, targetY: 0 })
  const viewRef = useRef<HTMLButtonElement>(null)
  const [studioOpen, setStudioOpen] = useState(false)
  const [ink, setInk] = useState<{ x: number; w: number } | null>(null)
  const [inkReady, setInkReady] = useState(false)
  const optionRefs = useRef<Partial<Record<string, HTMLButtonElement | null>>>({})
  const pool = buildingsIn(filter)
  const selected = buildings.find((row) => row.id === selectedId)
  const activeTab = buildingFilters.find((row) => row.id === filter) ?? buildingFilters[0]

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1150px)")
    const apply = () => setHorizontal(query.matches)
    apply()
    query.addEventListener("change", apply)
    return () => query.removeEventListener("change", apply)
  }, [])

  useLayoutEffect(() => {
    const list = tabsRef.current
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
  }, [filter])

  useEffect(() => {
    const list = listRef.current
    const option = optionRefs.current[selectedId]
    if (list === null || option === null || option === undefined) return
    revealInRail(list, option, glideRef.current)
  }, [selectedId, filter, horizontal])

  useEffect(() => {
    const list = listRef.current
    if (list === null) return
    const glide = glideRef.current
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return
      const horizontalRail = list.scrollWidth > list.clientWidth + 1 && list.scrollHeight <= list.clientHeight + 1
      const axis = horizontalRail ? "x" : "y"
      const span = axis === "x" ? list.clientWidth : list.clientHeight
      const delta = wheelPixels(event, span, axis)
      if (delta === 0) return
      const max = axis === "x" ? list.scrollWidth - list.clientWidth : list.scrollHeight - list.clientHeight
      const pos = glide.frame !== 0 ? (axis === "x" ? glide.targetX : glide.targetY) : axis === "x" ? list.scrollLeft : list.scrollTop
      const next = Math.min(Math.max(0, max), Math.max(0, pos + delta))
      if (Math.abs(next - pos) < 0.5) return
      event.preventDefault()
      if (axis === "x") glideRail(list, glide, next, list.scrollTop)
      else glideRail(list, glide, list.scrollLeft, next)
    }
    list.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      list.removeEventListener("wheel", onWheel)
      if (glide.frame !== 0) cancelAnimationFrame(glide.frame)
      glide.frame = 0
      glide.last = 0
    }
  }, [filter, horizontal])

  function selectFilter(next: BuildingFilter) {
    setFilter(next)
    setSelectedId((current) => {
      const rows = buildingsIn(next)
      if (rows.some((row) => row.id === current)) return current
      return rows[0]?.id ?? current
    })
  }

  function selectBuilding(id: string, focus = false) {
    setSelectedId(id)
    if (focus) optionRefs.current[id]?.focus()
  }

  function step(delta: number) {
    const index = pool.findIndex((row) => row.id === selectedId)
    const start = index < 0 ? 0 : index
    const next = pool[(start + delta + pool.length) % pool.length]
    if (next !== undefined) setSelectedId(next.id)
  }

  function onTabKey(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index
    if (event.key === "ArrowRight") nextIndex = index + 1
    else if (event.key === "ArrowLeft") nextIndex = index - 1
    else if (event.key === "Home") nextIndex = 0
    else if (event.key === "End") nextIndex = buildingFilters.length - 1
    else return
    event.preventDefault()
    const next = buildingFilters[(nextIndex + buildingFilters.length) % buildingFilters.length]
    if (next === undefined) return
    selectFilter(next.id)
    const button = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#buildings-tab-${next.id}`)
    button?.focus()
  }

  function onOptionKey(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index
    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = index + 1
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = index - 1
    else if (event.key === "Home") nextIndex = 0
    else if (event.key === "End") nextIndex = pool.length - 1
    else return
    event.preventDefault()
    const next = pool[(nextIndex + pool.length) % pool.length]
    if (next === undefined) return
    selectBuilding(next.id, true)
  }

  if (selected === undefined || activeTab === undefined) return null

  return (
    <section id="buildings" className="site-section buildings" data-theme="dark">
      <div className="site-container buildings__layout">
        <div className="buildings__copy">
          <h2 className="type-display-1">{buildingsHeading}</h2>
          <p className="buildings__lead type-body-lg">{buildingsLead}</p>
          <div className="buildings__tabs site-tabs--dark">
            <div ref={tabsRef} role="tablist" aria-label="Building categories" className="site-tabs">
              {buildingFilters.map((tab, index) => {
                const pressed = tab.id === filter
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`buildings-tab-${tab.id}`}
                    className="site-tabs__tab type-label"
                    aria-selected={pressed}
                    aria-controls="buildings-rail"
                    tabIndex={pressed ? 0 : -1}
                    onClick={() => selectFilter(tab.id)}
                    onKeyDown={(event) => onTabKey(event, index)}
                  >
                    {tab.label}
                  </button>
                )
              })}
              <span
                className={inkReady ? "buildings__tabs-ink is-ready" : "buildings__tabs-ink"}
                style={ink === null ? undefined : { transform: `translateX(${ink.x}px)`, width: ink.w }}
              />
            </div>
          </div>
        </div>
        <BuildingPicture building={selected} />
        <div className="buildings__details">
          <div key={selected.id} className="buildings__details-body">
          <BuildingChips building={selected} />
          <h3 className="type-heading-3">{selected.name}</h3>
          <p className="buildings__detail type-label">{selected.detail}</p>
          {selected.lock !== null ? <p className="buildings__lock type-body-sm">{selected.lock}</p> : null}
          {facts.map((fact) => (
            <div key={fact.key} className="buildings__fact">
              <p className="type-label">{fact.label}</p>
              <p className="type-body-sm">{selected[fact.key]}</p>
            </div>
          ))}
          <button ref={viewRef} type="button" className="buildings__view" onClick={() => setStudioOpen(true)}>
            <span className="buildings__view-mark" aria-hidden="true">
              <Eye size={20} />
            </span>
            <span className="type-button">View 3D</span>
          </button>
          </div>
        </div>
        <div
          id="buildings-rail"
          className="buildings__rail"
          role="tabpanel"
          aria-labelledby={`buildings-tab-${activeTab.id}`}
        >
          <div className="buildings__arrows">
            <button type="button" className="site-icon-button" aria-label="Previous building" onClick={() => step(-1)}>
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button type="button" className="site-icon-button" aria-label="Next building" onClick={() => step(1)}>
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
          <div
            key={filter}
            ref={listRef}
            role="listbox"
            aria-label="Buildings"
            aria-orientation={horizontal ? "horizontal" : "vertical"}
            className="buildings__rail-list"
          >
            {pool.map((row, index) => {
              const pressed = row.id === selected.id
              return (
                <button
                  key={row.id}
                  ref={(node) => {
                    optionRefs.current[row.id] = node
                  }}
                  type="button"
                  role="option"
                  className="buildings__thumb"
                  aria-label={row.name}
                  aria-selected={pressed}
                  tabIndex={pressed ? 0 : -1}
                  onClick={() => selectBuilding(row.id)}
                  onKeyDown={(event) => onOptionKey(event, index)}
                >
                  {row.image !== null ? (
                    <img
                      src={row.image.src}
                      alt=""
                      width={row.image.width}
                      height={row.image.height}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      {studioOpen ? (
        <BuildingStudio building={selected} returnFocus={viewRef.current} onClose={() => setStudioOpen(false)} />
      ) : null}
    </section>
  )
}
