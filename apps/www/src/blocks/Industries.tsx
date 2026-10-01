import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react"
import { ChevronRight } from "lucide-react"
import { Card } from "../components/Card"
import { Tabs } from "../components/Tabs"
import {
  defaultIndustryId,
  industries,
  industriesExamplesKicker,
  industriesHeadingLines,
  industriesInfoTabs,
  industriesLeadLines,
  industriesMapBody,
  industriesMapKicker,
  industriesMapTitle,
  industriesSky,
  industriesTierNodesTip,
  industriesWorksKicker,
  industryById,
  partnersOf,
  synergiesOf,
  type Industry,
  type IndustryId,
  type InfoColumn,
  type InfoRun,
  type Synergy,
} from "../data/industries"
import "../styles/industries.css"

const agentTextTone = {
  "--site-ind-compute": { light: "0.735", chroma: "0.161" },
  "--site-ind-energy": { light: "0.628", chroma: "0.23" },
  "--site-ind-logistics": { light: "0.735", chroma: "0.161" },
  "--site-ind-consumer": { light: "0.628", chroma: "0.23" },
  "--site-ind-automation": { light: "0.756", chroma: "0.125" },
  "--site-ind-finance": { light: "0.556", chroma: "0.176" },
} as const

type AccentToken = keyof typeof agentTextTone

const industryInk: Record<AccentToken, string> = {
  "--site-ind-compute": "oklch(0.735 0.161 141.8344)",
  "--site-ind-energy": "oklch(0.628 0.23 27.9768)",
  "--site-ind-logistics": "oklch(0.735 0.161 66.1935)",
  "--site-ind-consumer": "oklch(0.628 0.23 287.2982)",
  "--site-ind-automation": "oklch(0.756 0.125 219.6114)",
  "--site-ind-finance": "oklch(0.556 0.176 259.397)",
}

function accentStyle(accent: string): CSSProperties {
  const token = accent as AccentToken
  const tone = agentTextTone[token]
  return {
    "--tile-accent": `var(${accent})`,
    "--ind-light": tone.light,
    "--ind-chroma": tone.chroma,
    "--ind-ink": industryInk[token],
  } as CSSProperties
}

function IndustryMark({ industry }: { industry: Industry }) {
  return (
    <>
      <img
        className="ind-mark__logo"
        src={industry.logo}
        alt=""
        width={industry.logoWidth}
        height={industry.logoHeight}
        decoding="async"
        style={{ "--logo-view": industry.logoView } as CSSProperties}
      />
      <span className="ind-mark__name type-label">{industry.name}</span>
    </>
  )
}

function IndTerm({ label, text }: { label: string; text: string }) {
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
    const onKey = (event: globalThis.KeyboardEvent) => {
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
      className={`ind-term${open ? " is-open" : ""}${pinned ? " is-pinned" : ""}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className="ind-term__btn"
        aria-describedby={tipId}
        aria-expanded={open}
        onClick={() => setPinned((value) => !value)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        {label}
      </button>
      <span id={tipId} role="tooltip" className="ind-term__tip type-tooltip">
        {text}
      </span>
    </span>
  )
}

function InfoRuns({ runs }: { runs: readonly InfoRun[] }) {
  return runs.map((run, index) =>
    run.kind === "text" ? (
      <span key={`text-${index}`}>{run.value}</span>
    ) : (
      <IndTerm key={`${run.label}-${index}`} label={run.label} text={industriesTierNodesTip} />
    ),
  )
}

function InfoColumns({ columns }: { columns: readonly InfoColumn[] }) {
  return (
    <div className="industries__info-cols">
      {columns.map((column, index) => (
        <article key={column.title ?? `col-${index}`} className="industries__info-col">
          {column.title !== null ? (
            <h3 className="industries__info-title type-label">{column.title}</h3>
          ) : null}
          <p className="type-body-sm">
            <InfoRuns runs={column.runs} />
          </p>
        </article>
      ))}
    </div>
  )
}

function SynergyCards({ id }: { id: IndustryId }) {
  const [shownId, setShownId] = useState(id)
  const [previousId, setPreviousId] = useState<IndustryId | null>(null)
  const [on, setOn] = useState(true)
  const shownRef = useRef(id)

  useEffect(() => {
    if (id === shownRef.current) return
    let cancel = false
    const from = shownRef.current
    const ready = Promise.all(
      synergiesOf(id).map((row) => {
        const img = new Image()
        img.src = row.avatar
        return img.decode().catch(() => undefined)
      }),
    )
    void ready.then(() => {
      if (cancel) return
      shownRef.current = id
      setPreviousId(from)
      setShownId(id)
      setOn(false)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancel) setOn(true)
        })
      })
    })
    return () => {
      cancel = true
    }
  }, [id])

  useEffect(() => {
    if (!on || previousId === null) return
    const timer = window.setTimeout(() => setPreviousId(null), 240)
    return () => window.clearTimeout(timer)
  }, [on, previousId])

  const current = synergiesOf(shownId)
  const previous = previousId === null ? null : synergiesOf(previousId)
  return (
    <div className="industries__cards-hold">
      {previous !== null ? (
        <div className="industries__cards" aria-hidden="true" style={{ opacity: on ? 0 : 1 }}>
          {previous.map((row) => (
            <SynergyCard key={row.id} synergy={row} />
          ))}
        </div>
      ) : null}
      <div className="industries__cards" style={{ opacity: previous === null || on ? 1 : 0 }}>
        {current.map((row) => (
          <SynergyCard key={row.id} synergy={row} />
        ))}
      </div>
    </div>
  )
}

function captionLine(text: string): string {
  const end = text.indexOf(".")
  if (end < 0) return text
  return text.slice(0, end + 1)
}

function usePictureSwap(src: string): { readonly front: string; readonly back: string | null; readonly on: boolean } {
  const [front, setFront] = useState(src)
  const [back, setBack] = useState<string | null>(null)
  const [on, setOn] = useState(true)
  const frontRef = useRef(src)

  useEffect(() => {
    if (src === frontRef.current) return
    let cancel = false
    const from = frontRef.current
    const img = new Image()
    img.src = src
    const reveal = () => {
      if (cancel) return
      frontRef.current = src
      setBack(from)
      setFront(src)
      setOn(false)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancel) setOn(true)
        })
      })
    }
    if (img.complete && img.naturalWidth > 0) reveal()
    else void img.decode().then(reveal, reveal)
    return () => {
      cancel = true
    }
  }, [src])

  useEffect(() => {
    if (!on || back === null) return
    const id = window.setTimeout(() => setBack(null), 240)
    return () => window.clearTimeout(id)
  }, [on, back])

  return { front, back, on }
}

function BeaconImage({ industry }: { industry: Industry }) {
  const fade = usePictureSwap(industry.beacon)
  return (
    <>
      {fade.back !== null ? (
        <img
          className="industries__beacon-img"
          src={fade.back}
          alt=""
          width={industry.beaconWidth}
          height={industry.beaconHeight}
          aria-hidden="true"
          style={{ opacity: fade.on ? 0 : 1 }}
        />
      ) : null}
      <img
        className="industries__beacon-img"
        src={fade.front}
        alt={industry.beaconAlt}
        width={industry.beaconWidth}
        height={industry.beaconHeight}
        style={{ opacity: fade.on ? 1 : 0 }}
      />
    </>
  )
}

function SynergyCard({ synergy }: { synergy: Synergy }) {
  const left = industryById(synergy.requires[0])
  const right = industryById(synergy.requires[1])
  return (
    <Card variant="feature" className="ind-synergy">
      <div className="ind-synergy__art-slot">
        <img
          className="ind-synergy__art"
          src={synergy.avatar}
          alt={synergy.name}
          width={synergy.avatarWidth}
          height={synergy.avatarHeight}
          decoding="async"
        />
      </div>
      <div className="ind-synergy__copy">
        <h3 className="type-heading-3">{synergy.name}</h3>
        <p className="ind-synergy__pair">
          <span className="ind-chip ind-chip--pair" style={accentStyle(left.accent)}>
            <IndustryMark industry={left} />
          </span>
          <span className="ind-synergy__plus" aria-hidden="true">
            +
          </span>
          <span className="ind-chip ind-chip--pair" style={accentStyle(right.accent)}>
            <IndustryMark industry={right} />
          </span>
        </p>
        <p className="ind-synergy__role type-body-sm">{synergy.role}</p>
      </div>
    </Card>
  )
}

export function Industries() {
  const [activeId, setActiveId] = useState<IndustryId>(defaultIndustryId)
  const [shownId, setShownId] = useState<IndustryId>(defaultIndustryId)
  const [ringReady, setRingReady] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const tilesRef = useRef<HTMLDivElement>(null)
  const tileRefs = useRef<Partial<Record<IndustryId, HTMLButtonElement | null>>>({})
  const active = industryById(activeId)
  const shown = industryById(shownId)
  const partners = partnersOf(shownId)
  const activeIndex = industries.findIndex((row) => row.id === activeId)
  const ringEnd = activeIndex <= 0 ? "start" : activeIndex === industries.length - 1 ? "end" : "mid"

  useLayoutEffect(() => {
    const section = sectionRef.current
    if (section === null) return
    const sync = () => {
      const rule = section.querySelector<HTMLElement>(".industries__side > .industries__rule")
      if (rule === null) return
      const sectionTop = section.getBoundingClientRect().top
      const ruleBox = rule.getBoundingClientRect()
      const cut = ruleBox.top + ruleBox.height / 2 - sectionTop
      section.style.setProperty("--ind-sky-end", `${Math.round(cut)}px`)
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(section)
    window.addEventListener("resize", sync)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", sync)
    }
  }, [])

  useLayoutEffect(() => {
    const tiles = tilesRef.current
    const node = tileRefs.current[activeId]
    if (tiles === null || node == null) return
    const apply = () => {
      const tilesBox = tiles.getBoundingClientRect()
      const box = node.getBoundingClientRect()
      const x = Math.round(box.left - tilesBox.left)
      const w = Math.round(box.width)
      const prevX = Number.parseFloat(tiles.style.getPropertyValue("--ring-x"))
      const prevW = Number.parseFloat(tiles.style.getPropertyValue("--ring-w"))
      if (!Number.isFinite(prevX) || Math.abs(prevX - x) >= 1) tiles.style.setProperty("--ring-x", `${x}px`)
      if (!Number.isFinite(prevW) || Math.abs(prevW - w) >= 1) tiles.style.setProperty("--ring-w", `${w}px`)
    }
    apply()
    setRingReady(true)
    const observer = new ResizeObserver(apply)
    observer.observe(tiles)
    observer.observe(node)
    return () => observer.disconnect()
  }, [activeId])

  useEffect(() => {
    const reveal = () => {
      const scroller = scrollerRef.current
      const node = tileRefs.current[activeId]
      if (scroller === null || node == null) return
      const scrollerBox = scroller.getBoundingClientRect()
      const nodeBox = node.getBoundingClientRect()
      if (nodeBox.left < scrollerBox.left) {
        scroller.scrollLeft -= scrollerBox.left - nodeBox.left
      } else if (nodeBox.right > scrollerBox.right) {
        scroller.scrollLeft += nodeBox.right - scrollerBox.right
      }
    }
    reveal()
    const frame = window.requestAnimationFrame(reveal)
    window.addEventListener("resize", reveal)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("resize", reveal)
    }
  }, [activeId])

  function selectIndustry(id: IndustryId, focus = false) {
    setActiveId(id)
    setShownId(id)
    if (focus) tileRefs.current[id]?.focus()
  }

  function onTileKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index
    if (event.key === "ArrowRight") nextIndex = index + 1
    else if (event.key === "ArrowLeft") nextIndex = index - 1
    else if (event.key === "Home") nextIndex = 0
    else if (event.key === "End") nextIndex = industries.length - 1
    else return
    event.preventDefault()
    const next = industries[(nextIndex + industries.length) % industries.length]
    if (next === undefined) return
    selectIndustry(next.id, true)
  }

  return (
    <section
      ref={sectionRef}
      id="industries"
      className="site-section industries"
      data-theme="sky"
      style={
        {
          "--block-accent": `var(${shown.accent})`,
          "--ind-light": agentTextTone[shown.accent as AccentToken].light,
          "--ind-chroma": agentTextTone[shown.accent as AccentToken].chroma,
          "--ind-ink": industryInk[shown.accent as AccentToken],
        } as CSSProperties
      }
    >
      <svg className="industries__defs" aria-hidden="true" focusable="false">
        <filter id="ind-logo-key" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -4 -4 -4 8.8 0" />
        </filter>
      </svg>
      <img
        className="industries__sky"
        src={industriesSky.src}
        alt=""
        width={industriesSky.width}
        height={industriesSky.height}
        decoding="async"
      />
      <div className="site-container industries__layout">
        <div className="industries__intro">
          <h2 className="industries__title type-display-1">
            {industriesHeadingLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h2>
          <p className="industries__lead type-body-lg">
            {industriesLeadLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </p>
        </div>
        <div className="industries__beacon">
          <BeaconImage industry={shown} />
        </div>
        <div className="industries__selector">
          <div className="industries__bar">
          <div ref={scrollerRef} className="industries__scroller">
            <div ref={tilesRef} role="tablist" aria-label="Industries" className="industries__tiles">
              {industries.map((row, index) => {
                const selected = row.id === activeId
                return (
                  <button
                    key={row.id}
                    ref={(node) => {
                      tileRefs.current[row.id] = node
                    }}
                    type="button"
                    role="tab"
                    id={`industry-tab-${row.id}`}
                    className={selected ? "ind-tile is-selected" : "ind-tile"}
                    style={accentStyle(row.accent)}
                    aria-selected={selected}
                    aria-controls="industries-panel"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectIndustry(row.id)}
                    onKeyDown={(event) => onTileKey(event, index)}
                  >
                    <IndustryMark industry={row} />
                  </button>
                )
              })}
              {ringReady ? (
                <span
                  className="ind-tile__ring is-ready"
                  data-end={ringEnd}
                  aria-hidden="true"
                  style={accentStyle(active.accent)}
                />
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className="industries__chevron site-icon-button"
            aria-label="Show more industries"
            onClick={() => {
              scrollerRef.current?.scrollBy({
                left: scrollerRef.current.clientWidth / 2,
                behavior: "smooth",
              })
            }}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
          </div>
        </div>
        <div className="industries__sheet">
        <div id="industries-panel" role="tabpanel" aria-labelledby={`industry-tab-${activeId}`} className="industries__panel">
          <div className="industries__caption">
            <div className="industries__caption-copy">
              <p className="industries__caption-name type-label">{shown.name}</p>
              <p className="industries__caption-text type-body-sm">{captionLine(shown.cardText)}</p>
            </div>
          </div>
          <div className="industries__side">
            <p className="industries__rule type-label">{industriesMapKicker}</p>
            <h3 className="industries__map-title type-display-2">
              {industriesMapTitle.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </h3>
            <p className="industries__map-body type-body">{industriesMapBody}</p>
            <div className="industries__works">
              <p className="industries__kicker type-label">{industriesWorksKicker}</p>
              <div className="industries__swap">
                <ul className="industries__chips">
                  {partners.map((row) => (
                    <li key={row.id}>
                      <span className="ind-chip" style={accentStyle(row.accent)}>
                        <IndustryMark industry={row} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="industries__synergies">
            <p className="industries__rule type-label">{industriesExamplesKicker}</p>
            <SynergyCards id={shownId} />
          </div>
        </div>
        <div className="industries__info">
          <Tabs
            label="Industry details"
            tabs={industriesInfoTabs.map((tab) => ({
              id: tab.id,
              label: tab.label,
              panel: <InfoColumns columns={tab.columns} />,
            }))}
          />
        </div>
        </div>
      </div>
    </section>
  )
}
