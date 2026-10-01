import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import {
  ArrowLeftRight,
  ArrowRight,
  Bot,
  CircleDollarSign,
  CircleQuestionMark,
  Cloud,
  Cog,
  Cpu,
  Factory,
  Hexagon,
  Hotel,
  Landmark,
  Plane,
  Scale,
  Server,
  ShoppingBag,
  Store,
  Truck,
  Users,
  Warehouse,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react"
import {
  agentRoles,
  agentsDocsLabel,
  agentsHeading,
  agentsParagraphs,
  compatibilityRows,
  compatibilityTip,
  levelMarkCount,
  seatColumnLabels,
  type AgentId,
  type AgentRole,
  type SeatName,
} from "../data/agents"
import { Destination } from "../site"
import "../styles/agents.css"

const seatIcon: Record<SeatName, LucideIcon> = {
  Workshop: Wrench,
  "Power Node": Zap,
  "Energy Plant": Factory,
  "AI Research Center": Cpu,
  "Logistics Hub": Truck,
  "Robotics Lab": Bot,
  "Data Center": Server,
  "Fleet Yard": Warehouse,
  "Drone Depot": Plane,
  "Flagship Store": Store,
  "Retail Complex": ShoppingBag,
  Bank: CircleDollarSign,
  Exchange: ArrowLeftRight,
  "Finance Tower": Hotel,
  "Clearing House": Scale,
  "Agent Hub": Users,
  "Cloud Campus": Cloud,
  "City Hall": Landmark,
}

function prefersReduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function SeatLine({ name }: { name: SeatName }) {
  const Icon = seatIcon[name]
  return (
    <li className="agents__seat">
      <Icon size={16} aria-hidden="true" />
      <span className="type-body-sm">{name}</span>
    </li>
  )
}

function FitTip() {
  const tipId = useId()
  const root = useRef<HTMLSpanElement>(null)
  const [pinned, setPinned] = useState(false)
  const [hover, setHover] = useState(false)

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

  const classes = ["agents__tip"]
  if (hover) classes.push("is-hover")
  if (pinned) classes.push("is-pinned")

  return (
    <span
      ref={root}
      className={classes.join(" ")}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className="agents__help"
        aria-label="Compatibility values"
        aria-describedby={tipId}
        aria-expanded={hover || pinned}
        onClick={() => setPinned((value) => !value)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        <CircleQuestionMark size={16} aria-hidden="true" />
      </button>
      <span id={tipId} role="tooltip" className="agents__tip-bubble type-tooltip">
        {compatibilityTip}
      </span>
    </span>
  )
}

function CardPhoto({ role }: { role: AgentRole }) {
  return (
    <img
      className="agents__card-photo"
      src={role.portrait.src}
      alt=""
      width={role.portrait.width}
      height={role.portrait.height}
      decoding="sync"
    />
  )
}

function RolePanel({ role, active }: { role: AgentRole; active: boolean }) {
  return (
    <div
      className={active ? "agents__panel is-on" : "agents__panel"}
      {...(active
        ? { id: "agents-panel", role: "tabpanel" as const, "aria-labelledby": `agent-tab-${role.id}` }
        : { inert: true, "aria-hidden": true as const })}
    >
      <div className="agents__head">
        <span className="agents__mark" aria-hidden="true">
          <Hexagon strokeWidth={1.5} />
          <Cog strokeWidth={1.75} />
        </span>
        <h3 className="type-heading-3 agents__name">{role.name}</h3>
      </div>
      <p className="agents__label type-label">{role.label}</p>
      <div className="agents__rule" />
      <div className="agents__seats">
        <div>
          <p className="type-label">{seatColumnLabels.home}</p>
          <ul>
            {role.home.map((name) => (
              <SeatLine key={name} name={name} />
            ))}
          </ul>
        </div>
        <div className="agents__seat-rule" aria-hidden="true" />
        <div>
          <p className="type-label">{seatColumnLabels.neighboring}</p>
          <ul>
            {role.neighboring.map((name) => (
              <SeatLine key={name} name={name} />
            ))}
          </ul>
        </div>
      </div>
      <div className="agents__compat">
        <p className="type-label">Compatibility</p>
        <FitTip />
      </div>
      <ul className="agents__bars">
        {compatibilityRows.map((row) => (
          <li key={row.id} className="agents__bar">
            <span className="type-label">{row.label}</span>
            {row.fill === null ? (
              <span />
            ) : (
              <span className="agents__track" aria-hidden="true">
                <span className="agents__fill" style={{ width: `${row.fill}%` }} />
              </span>
            )}
            <span className="type-body-sm">{row.value}</span>
          </li>
        ))}
      </ul>
      <div className="agents__rule" />
      <div className="agents__meta">
        <div>
          <p className="type-label">Level</p>
          <div className="agents__level">
            <p className="type-numeric-lg">{role.level}</p>
            <span className="agents__segments" aria-hidden="true">
              {Array.from({ length: levelMarkCount }, (_, index) => (
                <span key={index} className={index < role.level ? "agents__segment is-lit" : "agents__segment"} />
              ))}
            </span>
          </div>
        </div>
        <div>
          <p className="type-label">Traits</p>
          <ul className="agents__traits">
            {role.traits.map((trait) => (
              <li key={trait} className="agents__chip type-metadata">
                {trait}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function Stage({ activeId }: { activeId: AgentId }) {
  return (
    <div className="agents__stage">
      {agentRoles.map((role) => {
        const on = role.id === activeId
        return (
          <img
            key={role.id}
            className={on ? "agents__portrait is-on" : "agents__portrait"}
            src={role.portrait.src}
            alt={on ? role.name : ""}
            width={role.portrait.width}
            height={role.portrait.height}
            decoding="sync"
            aria-hidden={on ? undefined : true}
          />
        )
      })}
    </div>
  )
}

export function Agents() {
  const [activeId, setActiveId] = useState<AgentId>("engineer")
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const active = agentRoles.find((role) => role.id === activeId) ?? agentRoles[0]

  useEffect(() => {
    const node = tabRefs.current[activeId]
    const scroller = node?.parentElement
    if (node === undefined || node === null || scroller === undefined || scroller === null) return
    if (scroller.scrollWidth <= scroller.clientWidth + 1) return
    const viewLeft = scroller.scrollLeft
    const viewRight = viewLeft + scroller.clientWidth
    const nodeLeft = node.offsetLeft
    const nodeRight = nodeLeft + node.offsetWidth
    let next = viewLeft
    if (nodeLeft < viewLeft) next = nodeLeft
    else if (nodeRight > viewRight) next = nodeRight - scroller.clientWidth
    if (next === viewLeft) return
    scroller.scrollTo({ left: next, behavior: prefersReduced() ? "auto" : "smooth" })
  }, [activeId])

  function onTabKey(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index
    if (event.key === "ArrowRight") nextIndex = index + 1
    else if (event.key === "ArrowLeft") nextIndex = index - 1
    else if (event.key === "Home") nextIndex = 0
    else if (event.key === "End") nextIndex = agentRoles.length - 1
    else return
    event.preventDefault()
    const next = agentRoles[(nextIndex + agentRoles.length) % agentRoles.length]
    if (next === undefined) return
    setActiveId(next.id)
    const button = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#agent-tab-${next.id}`)
    button?.focus()
  }

  if (active === undefined) return null

  const engineer = agentRoles.find((role) => role.id === "engineer")
  const engineerAspect =
    engineer !== undefined && engineer.portrait.height > 0
      ? engineer.portrait.width / engineer.portrait.height
      : undefined

  return (
    <section
      id="agents"
      className="site-section agents"
      data-theme="dark"
      data-role={active.id}
      style={
        engineerAspect === undefined
          ? undefined
          : ({ "--agents-engineer-aspect": engineerAspect } as CSSProperties)
      }
    >
      <div className="agents__showcase">
        <div className="agents__copy">
          <h2 className="type-display-1">{agentsHeading}</h2>
          {agentsParagraphs.map((paragraph) => (
            <p key={paragraph} className="type-body">
              {paragraph}
            </p>
          ))}
          <Destination kind="docs" className="site-arrow-link type-label">
            {agentsDocsLabel}
            <ArrowRight size={16} aria-hidden="true" />
          </Destination>
        </div>
        <Stage activeId={active.id} />
        <div className="agents__panels">
          {agentRoles.map((role) => (
            <RolePanel key={role.id} role={role} active={role.id === active.id} />
          ))}
        </div>
      </div>
      <div className="agents__selector" role="tablist" aria-label="Agents" aria-orientation="horizontal">
        {agentRoles.map((role, index) => {
          const selected = role.id === active.id
          return (
            <button
              key={role.id}
              ref={(node) => {
                tabRefs.current[role.id] = node
              }}
              type="button"
              role="tab"
              id={`agent-tab-${role.id}`}
              className="agents__card"
              aria-label={role.name}
              aria-selected={selected}
              aria-controls="agents-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(role.id)}
              onKeyDown={(event) => onTabKey(event, index)}
            >
              <span className="agents__card-inner">
                <span className="agents__card-crop">
                  <CardPhoto role={role} />
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
