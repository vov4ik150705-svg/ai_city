import { useEffect, useMemo, useState } from "react"
import { listenBind, listenPorts } from "../../../../packages/protocol/src/listen"
import { ratingRowsFromBody } from "../data/ratingBody"
import { ratingCopy, ratingSections, type RatingRow } from "../data/rating"
import { PhraseLink } from "../components/text"
import { Link } from "../site"
import { PrizeFunnel } from "./PrizeFunnel"
import { RatingBoard } from "./rating/Board"
import { Calendar } from "./rating/Calendar"
import { Climb } from "./rating/Climb"
import { Factors } from "./rating/Factors"
import { Influence } from "./rating/Influence"
import { Order } from "./rating/Order"
import "../styles/rating.css"
import "../styles/rating-sections.css"
import "../styles/rating-visuals.css"

type RatingLoad =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "empty" }
  | { readonly kind: "rows"; readonly rows: readonly RatingRow[] }

function ratingUrl(): string {
  const origin = import.meta.env.VITE_CORPORATOR_API_ORIGIN
  if (origin !== undefined && origin.trim() !== "") return `${origin.replace(/\/$/, "")}/rating`
  if (import.meta.env.DEV) return `http://${listenBind}:${listenPorts.api.toString()}/rating`
  return "/rating"
}

const previewHead: readonly RatingRow[] = [
  { rank: "1", wallet: "0x4c1a…11d2", influence: "188420", dayGdp: "6400", isYou: false },
  { rank: "2", wallet: "0x91b0…834b", influence: "151000", dayGdp: "5100", isYou: false },
  { rank: "3", wallet: "0x2e7d…6f08", influence: "120750", dayGdp: "4025", isYou: true },
  { rank: "4", wallet: "0x77aa…40c9", influence: "98000", dayGdp: "2800", isYou: false },
  { rank: "5", wallet: "0xa3f8…846a", influence: "64250", dayGdp: "1900", isYou: false },
  { rank: "6", wallet: "0x5b2c…03a7", influence: "31000", dayGdp: "750", isYou: false },
  { rank: "7", wallet: "0xc812…72ab", influence: "28450", dayGdp: "690", isYou: false },
  { rank: "8", wallet: "0x68f3…c910", influence: "24100", dayGdp: "580", isYou: false },
  { rank: "9", wallet: "0xd49e…19f2", influence: "20850", dayGdp: "510", isYou: false },
  { rank: "10", wallet: "0x0a76…e521", influence: "18200", dayGdp: "440", isYou: false },
]

/** Dev stand-in while GET /rating fails. First page matches the v2 mockup; the rest exist so the pager is real. */
function previewRows(): readonly RatingRow[] {
  const rest: RatingRow[] = []
  for (let rank = 11; rank <= 1280; rank += 1) {
    const body = rank.toString(16).padStart(36, "0")
    rest.push({
      rank: String(rank),
      wallet: `0x${body}`,
      influence: String(18200 - (rank - 10) * 12),
      dayGdp: String(Math.max(1, 440 - (rank - 10))),
      isYou: false,
    })
  }
  return [...previewHead, ...rest]
}

function SectionNav() {
  return (
    <nav className="rating-nav" aria-label="On this page">
      <ul>
        {ratingSections.map((section, index) => (
          <li key={section.id}>
            <Link to={`/rating#${section.id}`} className="rating-nav__link type-label">
              <span className="rating-nav__n">{index + 1}</span>
              {section.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function Rating() {
  const [load, setLoad] = useState<RatingLoad>({ kind: "loading" })
  useEffect(() => {
    const ctrl = new AbortController()
    let live = true
    const run = async (): Promise<void> => {
      try {
        const res = await fetch(ratingUrl(), { signal: ctrl.signal })
        if (!res.ok) throw new Error("rating")
        const rows = ratingRowsFromBody(await res.text())
        if (!live) return
        setLoad(rows.length === 0 ? { kind: "empty" } : { kind: "rows", rows })
      } catch {
        if (!live || ctrl.signal.aborted) return
        setLoad({ kind: "error" })
      }
    }
    void run()
    return () => {
      live = false
      ctrl.abort()
    }
  }, [])
  const example = import.meta.env.DEV && load.kind === "error"
  const status = load.kind === "loading" ? "loading" : load.kind === "error" && !example ? "error" : "ready"
  const rows = useMemo(() => (example ? previewRows() : load.kind === "rows" ? load.rows : []), [example, load])
  return (
    <article id="rating" className="rating">
      <div className="site-container rating__page">
        <header className="rating__intro-block">
          <h1 className="type-display-1">{ratingCopy.title}</h1>
          <p className="rating__intro type-body">
            <PhraseLink text={ratingCopy.intro} phrase="Leaderboard" to="/leaderboard" />
          </p>
          <SectionNav />
        </header>
        <div className="rating__table-block">
          <RatingBoard status={status} rows={rows} />
        </div>
        <Order />
        <Influence />
        <Factors />
        <Climb />
        <Calendar />
        <PrizeFunnel id="rating-prizes" className="rsec" note={false} />
      </div>
    </article>
  )
}
