import { useEffect, useId, useRef, useState } from "react"
import { Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Crosshair, FileText, Info, Search, X } from "lucide-react"
import { filterRatingRows, ratingCopy, shortenWallet, type RatingRow } from "../../data/rating"

type BoardStatus = "loading" | "error" | "ready"
type PageSize = (typeof ratingCopy.pageSizes)[number]
type Notice = { readonly wallet: string; readonly kind: "copied" | "failed" }

const turnMs = 140

function groupInt(value: string): string {
  const neg = value.startsWith("-")
  const digits = neg ? value.slice(1) : value
  if (!/^\d+$/.test(digits)) return value
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return neg ? `-${grouped}` : grouped
}

function isPageSize(value: number): value is PageSize {
  return ratingCopy.pageSizes.some((size) => size === value)
}

function pageItems(current: number, total: number): readonly (number | "gap")[] {
  if (total <= 1) return [1]
  const wanted = new Set<number>([1, total, current])
  if (current <= 3) {
    wanted.add(2)
    wanted.add(3)
  } else {
    wanted.add(current - 1)
    wanted.add(current + 1)
  }
  if (current >= total - 2) {
    wanted.add(total - 1)
    wanted.add(total - 2)
  }
  const pages = [...wanted].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
  const out: (number | "gap")[] = []
  for (const n of pages) {
    const prev = out[out.length - 1]
    if (typeof prev === "number" && n - prev > 1) out.push("gap")
    out.push(n)
  }
  return out
}

function reduceMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function Tip({ text }: { text: string }) {
  const tipId = useId()
  return (
    <span className="rating-tip">
      <button type="button" className="rating-tip__button" aria-describedby={tipId} aria-label="About Day GDP">
        <Info size={13} aria-hidden="true" />
      </button>
      <span id={tipId} role="tooltip" className="rating-tip__bubble type-tooltip">
        {text}
      </span>
    </span>
  )
}

function SearchField({ query, onQuery }: { query: string; onQuery: (next: string) => void }) {
  return (
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
  )
}

export function RatingBoard({
  status,
  rows,
  example = false,
}: {
  status: BoardStatus
  rows: readonly RatingRow[]
  example?: boolean
}) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(ratingCopy.pageSizes[0])
  const [turning, setTurning] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const turnTimer = useRef<number | null>(null)
  const pendingWallet = useRef<string | null>(null)
  const noticeTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (turnTimer.current !== null) window.clearTimeout(turnTimer.current)
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    },
    [],
  )

  const filtered = status === "ready" ? filterRatingRows(rows, query) : []
  const pageCount = filtered.length === 0 ? 1 : Math.ceil(filtered.length / pageSize)
  const safePage = Math.min(page, pageCount)
  const start = (safePage - 1) * pageSize
  const visible = filtered.slice(start, start + pageSize)
  const youIndex = filtered.findIndex((row) => row.isYou)
  const showRank = youIndex >= 0
  const showRows = status === "ready" && rows.length > 0 && (query.trim() === "" || filtered.length > 0)
  const showPager = showRows

  useEffect(() => {
    const wallet = pendingWallet.current
    if (wallet === null) return
    const node = document.getElementById(`rating-row-${wallet}`)
    if (node === null) return
    pendingWallet.current = null
    node.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" })
  }, [safePage, pageSize, filtered])

  function go(next: number) {
    const target = Math.min(Math.max(next, 1), pageCount)
    if (target === safePage) return
    if (reduceMotion()) {
      setPage(target)
      return
    }
    setTurning(true)
    if (turnTimer.current !== null) window.clearTimeout(turnTimer.current)
    turnTimer.current = window.setTimeout(() => {
      setPage(target)
      setTurning(false)
      turnTimer.current = null
    }, turnMs)
  }

  function changeQuery(next: string) {
    setQuery(next)
    setPage(1)
  }

  function changeSize(next: PageSize) {
    setPageSize(next)
    setPage(1)
  }

  function findRank() {
    if (youIndex < 0) return
    const row = filtered[youIndex]
    if (row === undefined) return
    const next = Math.floor(youIndex / pageSize) + 1
    pendingWallet.current = row.wallet
    if (next === safePage) {
      document.getElementById(`rating-row-${row.wallet}`)?.scrollIntoView({
        block: "center",
        behavior: reduceMotion() ? "auto" : "smooth",
      })
      pendingWallet.current = null
      return
    }
    go(next)
  }

  async function copyWallet(wallet: string) {
    try {
      await navigator.clipboard.writeText(wallet)
      setNotice({ wallet, kind: "copied" })
    } catch {
      setNotice({ wallet, kind: "failed" })
    }
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 1600)
  }

  const from = filtered.length === 0 ? 0 : start + 1
  const to = start + visible.length
  const range = ratingCopy.range
    .replace("{from}", groupInt(String(from)))
    .replace("{to}", groupInt(String(to)))
    .replace("{total}", groupInt(String(filtered.length)))

  return (
    <div className="rating-board-wrap">
      <header className="rating-stand">
        <div className="rating-stand__copy">
          <p className="rating-stand__eyebrow">{ratingCopy.standEyebrow}</p>
          <h2 id="rating-board-title" className="rating-stand__title">
            {ratingCopy.standTitle}
          </h2>
          <p className="rating-stand__lead">{ratingCopy.standLead}</p>
        </div>
        {example && showRows ? <p className="rating-stand__example">{ratingCopy.example}</p> : null}
      </header>
      <section className="rating-board" aria-labelledby="rating-board-title">
        <form
          className="rating-board__bar"
          role="search"
          onSubmit={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key === "Escape") changeQuery("")
          }}
        >
          <SearchField query={query} onQuery={changeQuery} />
          {showRank ? (
            <button type="button" className="rating-rank" onClick={findRank}>
              <Crosshair size={16} aria-hidden="true" />
              {ratingCopy.findRank}
            </button>
          ) : null}
        </form>
        <div className="rating-table-wrap">
          <table id="rating-board" className="rating-table" aria-busy={status === "loading" ? true : undefined}>
            <colgroup>
              <col className="rating-table__col-rank" />
              <col className="rating-table__col-wallet" />
              <col className="rating-table__col-influence" />
              <col className="rating-table__col-gdp" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="type-label">
                  {ratingCopy.columns[0]}
                </th>
                <th scope="col" className="type-label">
                  {ratingCopy.columns[1]}
                </th>
                <th scope="col" className="type-label rating-table__num" aria-sort="descending">
                  <span className="rating-table__head">
                    {ratingCopy.columns[2]}
                    <ChevronDown size={12} aria-hidden="true" />
                  </span>
                </th>
                <th scope="col" className="type-label rating-table__num">
                  <span className="rating-table__head">
                    {ratingCopy.columns[3]}
                    <Tip text={ratingCopy.dayGdpTip} />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className={turning ? "is-turning" : undefined}>
              {status === "loading" ? (
                <tr>
                  <td colSpan={4}>
                    <div className="rating-table__state" aria-hidden="true">
                      <span className="rating-skel" />
                      <span className="rating-skel" />
                      <span className="rating-skel" />
                      <span className="rating-skel" />
                    </div>
                  </td>
                </tr>
              ) : status === "error" ? (
                <tr>
                  <td colSpan={4}>
                    <div className="rating-table__state rating-table__state--empty" role="status">
                      <FileText size={32} aria-hidden="true" />
                      <p className="type-body">{ratingCopy.unavailable}</p>
                    </div>
                  </td>
                </tr>
              ) : !showRows ? (
                <tr>
                  <td colSpan={4}>
                    <div className="rating-table__state rating-table__state--empty" role="status">
                      {rows.length > 0 ? <Search size={32} aria-hidden="true" /> : <FileText size={32} aria-hidden="true" />}
                      <p className="type-body">{rows.length > 0 ? ratingCopy.noMatch : ratingCopy.empty}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                visible.map((row) => (
                  <tr id={`rating-row-${row.wallet}`} key={row.wallet} className={row.isYou ? "rating-table__you" : undefined}>
                    <td className="type-numeric">
                      <span className="rating-rank-n">{row.rank}</span>
                    </td>
                    <td>
                      <span className="rating-table__wallet">
                        <span className="rating-table__addr type-mono" title={row.wallet}>
                          <span aria-hidden="true">{shortenWallet(row.wallet)}</span>
                          <span className="rating-sr">{row.wallet}</span>
                        </span>
                        <button
                          type="button"
                          className="rating-copy"
                          aria-label={
                            notice?.wallet === row.wallet && notice.kind === "copied" ? ratingCopy.copied : ratingCopy.copyLabel
                          }
                          onClick={() => void copyWallet(row.wallet)}
                        >
                          {notice?.wallet === row.wallet && notice.kind === "copied" ? (
                            <Check size={14} aria-hidden="true" />
                          ) : (
                            <Copy size={14} aria-hidden="true" />
                          )}
                        </button>
                        {row.isYou ? <span className="rating-you">You</span> : null}
                      </span>
                    </td>
                    <td className="type-numeric rating-table__num rating-table__influence">{groupInt(row.influence)}</td>
                    <td className="type-numeric rating-table__num">{groupInt(row.dayGdp)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {showPager ? (
          <div className="rating-board__foot">
            <p className="rating-board__range type-body-sm">{range}</p>
            <label className="rating-rows">
              <span>{ratingCopy.rowsLabel}</span>
              <span className="rating-rows__box">
                <select
                  value={pageSize}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    if (isPageSize(next)) changeSize(next)
                  }}
                >
                  {ratingCopy.pageSizes.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </span>
            </label>
            <nav className="rating-pager" aria-label="Pages">
              <button type="button" className="rating-pager__step" disabled={safePage <= 1} onClick={() => go(safePage - 1)}>
                <ChevronLeft size={16} aria-hidden="true" />
                {ratingCopy.previous}
              </button>
              <span className="rating-pager__pages">
                {pageCount <= 1 ? (
                  <button type="button" className="rating-pager__n is-current" aria-current="page">
                    1
                  </button>
                ) : (
                  pageItems(safePage, pageCount).map((item, index) =>
                    item === "gap" ? (
                      <span key={`gap-${index}`} className="rating-pager__gap" aria-hidden="true">
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        className={item === safePage ? "rating-pager__n is-current" : "rating-pager__n"}
                        aria-current={item === safePage ? "page" : undefined}
                        onClick={() => go(item)}
                      >
                        {item}
                      </button>
                    ),
                  )
                )}
              </span>
              <button type="button" className="rating-pager__step" disabled={safePage >= pageCount} onClick={() => go(safePage + 1)}>
                {ratingCopy.next}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          </div>
        ) : null}
        <p className="rating-sr" role="status">
          {notice === null ? "" : notice.kind === "copied" ? ratingCopy.copied : ratingCopy.copyFailed}
        </p>
      </section>
      {showRows ? <p className="rating-board__note type-caption">{ratingCopy.rowTip}</p> : null}
    </div>
  )
}
