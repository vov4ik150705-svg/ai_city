import { useEffect, useId, useState } from "react"
import { FileText, Info, Search, X } from "lucide-react"
import { listenBind, listenPorts } from "../../../../packages/protocol/src/listen"
import { ratingRowsFromBody } from "../data/ratingBody"
import { filterRatingRows, ratingCopy, ratingSections, shortenWallet, type RatingRow } from "../data/rating"
import { docsLinks } from "../data/docsLinks"
import { PhraseLink } from "../components/text"
import { Link } from "../site"
import { PrizeFunnel } from "./PrizeFunnel"
import { Calendar } from "./rating/Calendar"
import { Climb } from "./rating/Climb"
import { Factors } from "./rating/Factors"
import { Influence } from "./rating/Influence"
import { Order } from "./rating/Order"
import "../styles/rating.css"
import "../styles/rating-sections.css"
import "../styles/rating-visuals.css"

type TablePhase = "empty" | "nomatch" | "rows" | "loading" | "error"
type RatingLoad = { readonly kind: "loading" } | { readonly kind: "error" } | { readonly kind: "empty" } | { readonly kind: "rows"; readonly rows: readonly RatingRow[] }

function ratingUrl(): string {
  const origin = import.meta.env.VITE_CORPORATOR_API_ORIGIN
  if (origin !== undefined && origin.trim() !== "") return `${origin.replace(/\/$/, "")}/rating`
  if (import.meta.env.DEV) return `http://${listenBind}:${listenPorts.api.toString()}/rating`
  return "/rating"
}

function viewPhase(load: RatingLoad, query: string, shown: readonly RatingRow[]): TablePhase {
  if (load.kind === "loading") return "loading"
  if (load.kind === "error") return "error"
  const total = load.kind === "rows" ? load.rows.length : 0
  if (query.trim() === "" && total === 0) return "empty"
  if (shown.length === 0) return "nomatch"
  return "rows"
}

function Tip({ text }: { text: string }) {
  const tipId = useId()
  return (
    <span className="rating-tip">
      <button type="button" className="rating-tip__button" aria-describedby={tipId} aria-label="About Day GDP">
        <Info size={14} aria-hidden="true" />
      </button>
      <span id={tipId} role="tooltip" className="rating-tip__bubble type-tooltip">
        {text}
      </span>
    </span>
  )
}

function SearchRow({ query, onQuery }: { query: string; onQuery: (next: string) => void }) {
  return (
    <form
      className="rating-find"
      role="search"
      onSubmit={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "Escape") onQuery("")
      }}
    >
      <label className="rating-find__field">
        <Search size={16} aria-hidden="true" />
        <span className="rating-sr">{ratingCopy.searchPlaceholder}</span>
        <input
          type="search"
          value={query}
          placeholder={ratingCopy.searchPlaceholder}
          autoComplete="off"
          spellCheck={false}
          aria-controls="rating-board"
          onChange={(event) => onQuery(event.target.value)}
        />
        {query.length > 0 ? (
          <button type="button" className="rating-find__clear" aria-label="Clear" onClick={() => onQuery("")}>
            <X size={14} aria-hidden="true" />
          </button>
        ) : null}
      </label>
    </form>
  )
}

function RatingTable({ phase, rows }: { phase: TablePhase; rows: readonly RatingRow[] }) {
  return (
    <div className="rating-table-wrap">
      <table id="rating-board" className="rating-table" aria-busy={phase === "loading" ? true : undefined}>
        <colgroup>
          <col className="rating-table__col-rank" />
          <col className="rating-table__col-wallet" />
          <col className="rating-table__col-influence" />
          <col className="rating-table__col-gdp" />
        </colgroup>
        <thead>
          <tr>
            {ratingCopy.columns.map((column) => (
              <th key={column} scope="col" className="type-label">
                {column === "Day GDP" ? (
                  <span className="rating-table__head">
                    {column}
                    <Tip text={ratingCopy.dayGdpTip} />
                  </span>
                ) : (
                  column
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {phase === "loading" ? (
            <tr>
              <td colSpan={ratingCopy.columns.length}>
                <div className="rating-table__state" aria-hidden="true">
                  <span className="rating-skel" />
                  <span className="rating-skel" />
                  <span className="rating-skel" />
                  <span className="rating-skel" />
                </div>
              </td>
            </tr>
          ) : phase === "error" ? (
            <tr>
              <td colSpan={ratingCopy.columns.length}>
                <div className="rating-table__state rating-table__state--empty" role="status">
                  <FileText size={32} aria-hidden="true" />
                  <p className="type-body">{ratingCopy.unavailable}</p>
                </div>
              </td>
            </tr>
          ) : phase === "rows" ? (
            rows.map((row) => (
              <tr key={row.wallet} className={row.isYou ? "rating-table__you" : undefined}>
                <td className="type-numeric">{row.rank}</td>
                <td className="type-mono">
                  <span className="rating-table__addr" title={row.wallet}>
                    <span aria-hidden="true">{shortenWallet(row.wallet)}</span>
                    <span className="rating-sr">{row.wallet}</span>
                  </span>
                  {row.isYou ? <span className="rating-you">You</span> : null}
                </td>
                <td className="type-numeric">{row.influence}</td>
                <td className="type-numeric">{row.dayGdp}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={ratingCopy.columns.length}>
                <div className="rating-table__state rating-table__state--empty" role="status">
                  {phase === "nomatch" ? <Search size={32} aria-hidden="true" /> : <FileText size={32} aria-hidden="true" />}
                  <p className="type-body">{phase === "nomatch" ? ratingCopy.noMatch : ratingCopy.empty}</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
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
  const [query, setQuery] = useState("")
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
  const source = load.kind === "rows" ? load.rows : []
  const rows = filterRatingRows(source, query)
  return (
    <article id="rating" className="rating">
      <div className="site-container rating__page">
        <header className="rating__intro-block">
          <h1 className="type-display-1">{ratingCopy.title}</h1>
          <p className="rating__intro type-body">
            <PhraseLink text={ratingCopy.intro} phrase="Leaderboard" to="/leaderboard" />
          </p>
          <Link to={docsLinks.influence} className="site-link type-body">
            {ratingCopy.docsLink}
          </Link>
          <SectionNav />
        </header>
        <div className="rating__table-block">
          <SearchRow query={query} onQuery={setQuery} />
          <RatingTable phase={viewPhase(load, query, rows)} rows={rows} />
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
