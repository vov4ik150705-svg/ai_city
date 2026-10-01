import { useState, type ReactElement } from "react"
import { AgentsStage, type AgentStageRole } from "./AgentsStage.js"
import { FontFaces } from "./FontFaces.js"
import "./agents-showcase.css"

const ROSTER: readonly { readonly id: AgentStageRole; readonly label: string; readonly portrait: string }[] = [
  { id: "engineer", label: "ENGINEER", portrait: "/assets/agents/roster/engineer.png" },
  { id: "logistician", label: "LOGISTICIAN", portrait: "/assets/agents/roster/logistician.png" },
  { id: "trader", label: "TRADER", portrait: "/assets/agents/roster/trader.png" },
  { id: "scientist", label: "SCIENTIST", portrait: "/assets/agents/roster/scientist.png" },
  { id: "manager", label: "MANAGER", portrait: "/assets/agents/roster/manager.png" },
]

const ROLE_COPY: { readonly [K in AgentStageRole]: { readonly title: string; readonly line: string } } = {
  engineer: { title: "ENGINEER", line: "PRODUCTION" },
  logistician: { title: "LOGISTICIAN", line: "LOGISTICS" },
  trader: { title: "TRADER", line: "FINANCE & RETAIL" },
  scientist: { title: "SCIENTIST", line: "RESEARCH & COMPUTE" },
  manager: { title: "MANAGER", line: "ADMINISTRATION" },
}
const HOME = ["Workshop", "Power Node", "Energy Plant"] as const
const NEIGHBOR = ["AI Research Center", "Data Center", "Logistics Hub", "Fleet Yard"] as const

export function AgentsShowcase(): ReactElement {
  const [role, setRole] = useState<AgentStageRole>("engineer")
  return (
    <div className="agents-page">
      <FontFaces />
      <AgentsStage role={role} className="agents-page__stage" />
      <header className="agents-page__copy">
        <p className="agents-page__eyebrow">06 — AGENTS</p>
        <h1>
          THE RIGHT AGENT.
          <br />
          THE RIGHT SEAT.
        </h1>
        <p className="agents-page__lead">
          You assign the work.
          <br />
          The rules settle the result.
        </p>
        <p className="agents-page__sub">Five roles. Different strengths. One workforce.</p>
        <a className="agents-page__meet" href="#roster">
          MEET THE AGENTS <span aria-hidden="true">→</span>
        </a>
      </header>
      <aside className="agents-page__dossier" aria-label={ROLE_COPY[role].title}>
        <div className="agents-page__identity">
          <HexMark />
          <div>
            <h2>{ROLE_COPY[role].title}</h2>
            <p>{ROLE_COPY[role].line}</p>
          </div>
        </div>
        {role === "engineer" ? (
          <>
            <div className="agents-page__seats">
              <SeatColumn title="HOME SEAT" glyph="home" rows={HOME} />
              <SeatColumn title="NEIGHBORING" glyph="neighbor" rows={NEIGHBOR} />
            </div>
            <div className="agents-page__capability">
              <div className="agents-page__cap-label">
                <span>COMPATIBILITY</span>
                <i aria-hidden="true">i</i>
              </div>
              <Meter label="HOME" value="100%" width="100%" tone="gold" />
              <Meter label="NEIGHBOR" value="60%" width="60%" tone="blue" />
              <Meter label="OTHER" value="—" width="0%" tone="muted" />
            </div>
            <div className="agents-page__meta">
              <div>
                <span className="agents-page__meta-label">LEVEL</span>
                <strong>04</strong>
                <span className="agents-page__pips" aria-hidden="true">
                  <i /><i /><i /><i /><i />
                </span>
              </div>
              <div>
                <span className="agents-page__meta-label">TRAITS</span>
                <span className="agents-page__traits">
                  <span>Specialist</span>
                  <span>Steady</span>
                </span>
              </div>
            </div>
          </>
        ) : null}
      </aside>
      <nav id="roster" className="agents-page__roster" aria-label="Roles">
        {ROSTER.map((row) => {
          const selected = row.id === role
          return (
            <button
              key={row.id}
              type="button"
              className={selected ? "agents-page__card is-selected" : "agents-page__card"}
              aria-pressed={selected}
              onClick={() => setRole(row.id)}
            >
              <img src={row.portrait} alt="" draggable={false} />
              <span>{row.label}</span>
            </button>
          )
        })}
      </nav>
      <p className="agents-page__note">Home seats use the full specialty. Neighboring seats use 60%. Incompatible seats cannot work.</p>
    </div>
  )
}

function SeatColumn(props: {
  readonly title: string
  readonly glyph: "home" | "neighbor"
  readonly rows: readonly string[]
}): ReactElement {
  return (
    <div>
      <h3>
        {props.glyph === "home" ? <HomeIcon /> : <NeighborIcon />}
        {props.title}
      </h3>
      <ul>
        {props.rows.map((row) => (
          <li key={row}>
            <SeatIcon name={row} />
            {row}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Meter(props: {
  readonly label: string
  readonly value: string
  readonly width: string
  readonly tone: "gold" | "blue" | "muted"
}): ReactElement {
  return (
    <div className={`agents-page__meter agents-page__meter--${props.tone}`}>
      <span>{props.label}</span>
      <span className="agents-page__track">
        <span style={{ width: props.width }} />
      </span>
      <b>{props.value}</b>
    </div>
  )
}

function HexMark(): ReactElement {
  return (
    <svg className="agents-page__hex" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 3.5 42 14v20L24 44.5 6 34V14Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="24" cy="24" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M24 15.2v2.4M24 30.4v2.4M15.2 24h2.4M30.4 24h2.4M17.8 17.8l1.7 1.7M28.5 28.5l1.7 1.7M30.2 17.8l-1.7 1.7M19.5 28.5l-1.7 1.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function HomeIcon(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.5 7.2 8 2.8l5.5 4.4V13H9.4V9.4H6.6V13H2.5Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function NeighborIcon(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="3.2" cy="4.2" r="1.3" fill="currentColor" />
      <circle cx="12.8" cy="4.2" r="1.3" fill="currentColor" />
      <circle cx="3.2" cy="11.8" r="1.3" fill="currentColor" />
      <circle cx="12.8" cy="11.8" r="1.3" fill="currentColor" />
    </svg>
  )
}

function SeatIcon(props: { readonly name: string }): ReactElement {
  const name = props.name
  if (name === "Workshop" || name === "Energy Plant") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 9.2 8 4.2l5 5M5 8.2V12h6V8.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    )
  }
  if (name === "Power Node" || name === "Data Center") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6 2.8v3.2L4.2 9.6h3l-1 3.6 5.6-6.2H8.6l1.2-4.2Z" fill="none" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    )
  }
  if (name === "AI Research Center" || name === "Fleet Yard") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="3" y="3" width="4.2" height="4.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
        <rect x="8.8" y="3" width="4.2" height="4.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
        <rect x="3" y="8.8" width="4.2" height="4.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
        <rect x="8.8" y="8.8" width="4.2" height="4.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.8 11.2h10.4M4 11.2V6.2h8v5M6.2 6.2V4h3.6v2.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  )
}
