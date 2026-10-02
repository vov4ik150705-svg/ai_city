import { useEffect, useState } from "react"
import { Calendar, CircleCheck, Gift, Lock } from "lucide-react"
import { PhraseLink } from "../components/text"
import { docsLinks } from "../data/docsLinks"
import {
  leaderboardCopy,
  leaderboardOpensAt,
  leaderboardPanels,
  leaderboardPhase,
  leaderboardRows,
  type LeaderboardPhase,
} from "../data/leaderboard"
import { Link } from "../site"
import "../styles/leaderboard.css"

function useNow(live: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!live) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [live])
  return now
}

function LockBadge() {
  return (
    <span className="lb-lock__badge">
      <svg className="lb-lock__hex" viewBox="0 0 64 58" aria-hidden="true">
        <polygon points="32,1 61,16.5 61,41.5 32,57 3,41.5 3,16.5" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
      </svg>
      <Lock size={18} aria-hidden="true" />
    </span>
  )
}

function CountCell({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="lb-count__cell">
      <span className="type-numeric-lg">{value}</span>
      <span className="type-label">{unit}</span>
    </div>
  )
}

function Countdown({ phase }: { phase: Extract<LeaderboardPhase, { kind: "countdown" }> }) {
  const spoken = `${phase.days} days, ${phase.hours} hours, ${phase.minutes} minutes, ${phase.seconds} seconds`
  const [days, hours, minutes, seconds] = leaderboardCopy.units
  return (
    <div className="lb-count" aria-live="off" aria-label={spoken}>
      <CountCell value={phase.days} unit={days} />
      <CountCell value={phase.hours} unit={hours} />
      <CountCell value={phase.minutes} unit={minutes} />
      <CountCell value={phase.seconds} unit={seconds} />
    </div>
  )
}

function Weights({ phase }: { phase: LeaderboardPhase }) {
  const locked = phase.kind !== "open"
  return (
    <div className="lb-anchor">
      <div className={locked ? "lb-stage is-locked" : "lb-stage"} data-leaderboard-phase={phase.kind}>
        <div className="lb-stage__sheet">
          <table className="lb-table">
            <colgroup>
              <col className="lb-col-place" />
              <col className="lb-col-pic" />
              <col className="lb-col-weight" />
              <col className="lb-col-share" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="type-label">
                  {leaderboardCopy.place}
                </th>
                <th scope="col">
                  <span className="lb-sr">{leaderboardCopy.picture}</span>
                </th>
                <th scope="col" className="type-label lb-num">
                  {leaderboardCopy.weight}
                </th>
                <th scope="col" className="type-label lb-num">
                  {leaderboardCopy.share}
                </th>
              </tr>
            </thead>
            <tbody>
              {leaderboardRows.map((row) => (
                <tr key={row.place}>
                  <td className="type-numeric">{row.place}</td>
                  <td>
                    <span className="lb-pic" aria-hidden="true" />
                  </td>
                  <td className="type-numeric lb-num">{row.weight}</td>
                  <td className="type-numeric lb-num">{row.share}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="lb-lock">
          <span className="lb-lock__mark">
            <span className="lb-lock__rule" aria-hidden="true" />
            <LockBadge />
            <span className="lb-lock__rule" aria-hidden="true" />
          </span>
          <p className="lb-lock__label type-label">{leaderboardCopy.opens}</p>
          {phase.kind === "countdown" ? <Countdown phase={phase} /> : null}
        </div>
      </div>
    </div>
  )
}

function PanelIcon({ icon }: { icon: (typeof leaderboardPanels)[number]["icon"] }) {
  switch (icon) {
    case "check":
      return <CircleCheck size={18} />
    case "calendar":
      return <Calendar size={18} />
    case "gift":
      return <Gift size={18} />
    default: {
      const unexpected: never = icon
      return unexpected
    }
  }
}

function Panels() {
  return (
    <section className="lb-panels" aria-label="How prizes work">
      {leaderboardPanels.map((panel) => (
        <article key={panel.id} className="lb-panel">
          <span className="lb-panel__hex" aria-hidden="true">
            <svg viewBox="0 0 64 58">
              <polygon points="32,1 61,16.5 61,41.5 32,57 3,41.5 3,16.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <PanelIcon icon={panel.icon} />
          </span>
          <div className="lb-panel__copy">
            <p className="type-label">{panel.mark}</p>
            <h2 className="type-heading-3">{panel.title}</h2>
            <p className="type-body-sm">{panel.text}</p>
          </div>
        </article>
      ))}
    </section>
  )
}

export function Leaderboard() {
  const now = useNow(leaderboardOpensAt !== null)
  const phase = leaderboardPhase(leaderboardOpensAt, now)
  return (
    <article id="leaderboard" className="lb">
      <div className="site-container lb__page">
        <header className="lb__intro">
          <h1 className="type-display-1">
            {leaderboardCopy.titleLines.map((line) => (
              <span key={line} className="lb__title-line">
                {line}
              </span>
            ))}
          </h1>
          <p className="lb__lead type-body-lg">
            <PhraseLink text={leaderboardCopy.intro} phrase="Rating" to="/rating" />
          </p>
          <Link to={docsLinks.monthly} className="site-link type-body">
            {leaderboardCopy.docsLink}
          </Link>
        </header>
        <Weights phase={phase} />
        <Panels />
      </div>
    </article>
  )
}
