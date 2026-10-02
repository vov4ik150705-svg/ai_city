import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react"
import brandUrl from "../../../../../docs/public/docs-design/book-reference/01-island-ready/brand-mark.png?url"
import { applyPageMeta } from "../../meta"
import { SITE_PAGE_ENTER_S, SITE_PAGE_EXIT_S, sitePageEase, sitePageExitEase } from "../../pageTransition"
import { Link, SiteContext } from "../../site"
import { resolveHref } from "../md/chapter"
import { chapterHref, INDEX_CHAPTER } from "../paths"
import { bookFacts } from "./facts"
import { ModeSwitch } from "./ModeSwitch"
import { artPlacement, BOOK_ART_SLOT, bookPages, readBookAnchor, rememberBookAnchor, type BookPage } from "./pages"
import { useArtSwipe } from "./useArtSwipe"

const artUrls = import.meta.glob<string>(
  "../../../../../docs/public/docs-design/book-reference/*/art.png",
  { query: "?url", import: "default", eager: true },
)

const ART_BY_DIR: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(artUrls).flatMap(([path, url]) => {
    const dir = path.split(/[/\\]/).at(-2)
    return dir === undefined ? [] : [[dir, url]]
  }),
)

function artOf(page: BookPage): string {
  const url = ART_BY_DIR[page.dir]
  if (url === undefined) throw new Error(`book: missing art for ${page.dir}`)
  return url
}

function Arrow({ direction }: { direction: "prev" | "next" }) {
  const d = direction === "prev" ? "M29 18H7M17 8 7 18l10 10" : "M7 18h22M19 8l10 10-10 10"
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

function ArtSlide({ page, labelled = false }: { readonly page: BookPage | undefined; readonly labelled?: boolean }) {
  if (page === undefined) return <div className="book-slide" aria-hidden="true" />
  const place = artPlacement(page)
  return (
    <div className="book-slide" aria-hidden={labelled ? undefined : true}>
      <img
        src={artOf(page)}
        alt={labelled ? page.alt : ""}
        width={page.width}
        height={page.height}
        draggable={false}
        style={{ left: `${place.left}%`, top: `${place.top}%`, width: `${place.width}%`, height: `${place.height}%` }}
      />
    </div>
  )
}

function BookPager({
  pages,
  page,
  show,
}: {
  readonly pages: readonly BookPage[]
  readonly page: BookPage
  readonly show: (anchor: string) => void
}) {
  return (
    <nav className="book-pager" aria-label="Book pages">
      <div className="book-dots">
        {pages.map((item) => (
          <button
            key={item.anchor}
            type="button"
            className="book-dot"
            aria-label={`Page ${item.n}: ${item.title.join(" ")}`}
            aria-current={item.anchor === page.anchor ? "page" : undefined}
            onClick={() => show(item.anchor)}
          />
        ))}
      </div>
      <span className="book-count">
        {page.n} / {pages.length}
      </span>
    </nav>
  )
}

export function Book() {
  const { open } = useContext(SiteContext)
  const reduced = useReducedMotion() === true
  const facts = bookFacts()
  const pages = bookPages(facts)
  const [anchor, setAnchor] = useState(readBookAnchor)
  const [railIndex, setRailIndex] = useState(() => {
    const initial = pages.findIndex((item) => item.anchor === readBookAnchor())
    return initial < 0 ? 0 : initial
  })
  const [zoom, setZoom] = useState(false)
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 900px)").matches)
  const frameRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const zoomScrollRef = useRef<HTMLDivElement>(null)
  const zoomImageRef = useRef<HTMLImageElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const suppressClick = useRef(false)
  const pagesRef = useRef(pages)
  pagesRef.current = pages
  const page = pages.find((item) => item.anchor === anchor) ?? pages[0]
  if (page === undefined) throw new Error("book: no pages")
  const index = pages.indexOf(page)
  const previous = pages[index - 1]
  const next = pages[index + 1]
  const handbook = resolveHref(page.ref, INDEX_CHAPTER)

  useEffect(() => {
    applyPageMeta(`${page.title.join(" ")} | Corporator`, "How the island works.")
  }, [page])

  useEffect(() => {
    const sync = () => {
      setZoom(false)
      const nextAnchor = readBookAnchor()
      setAnchor(nextAnchor)
      const index = pagesRef.current.findIndex((item) => item.anchor === nextAnchor)
      if (index >= 0) setRailIndex(index)
    }
    window.addEventListener("popstate", sync)
    window.addEventListener("corporator-nav", sync)
    return () => {
      window.removeEventListener("popstate", sync)
      window.removeEventListener("corporator-nav", sync)
    }
  }, [])

  useEffect(() => {
    if (window.location.hash !== `#${page.anchor}`) {
      history.replaceState(null, "", `/docs#${page.anchor}`)
    }
    rememberBookAnchor(page.anchor)
  }, [page.anchor])

  const previousDir = previous?.dir
  const nextDir = next?.dir
  useEffect(() => {
    for (const dir of [previousDir, nextDir]) {
      if (dir === undefined) continue
      const url = ART_BY_DIR[dir]
      if (url === undefined) continue
      const img = new Image()
      img.src = url
    }
  }, [previousDir, nextDir])

  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)")
    const apply = () => setNarrow(query.matches)
    query.addEventListener("change", apply)
    return () => query.removeEventListener("change", apply)
  }, [])

  useLayoutEffect(() => {
    const fit = () => {
      const frame = frameRef.current
      const host = hostRef.current
      if (frame === null || host === null) return
      if (window.innerWidth <= 900) {
        frame.style.transform = "none"
        frame.style.marginRight = ""
        frame.style.marginBottom = ""
        return
      }
      const box = getComputedStyle(host)
      const availW = host.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight)
      const availH = host.clientHeight - parseFloat(box.paddingTop) - parseFloat(box.paddingBottom)
      if (availW < 80 || availH < 80) return
      const k = Math.min(availW / 1400, availH / 860)
      frame.style.transform = `scale(${k})`
      frame.style.marginRight = `${(k - 1) * 1400}px`
      frame.style.marginBottom = `${(k - 1) * 860}px`
    }
    fit()
    const host = hostRef.current
    if (host === null) return
    const observer = new ResizeObserver(fit)
    observer.observe(host)
    window.addEventListener("resize", fit)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", fit)
    }
  }, [])

  useEffect(() => {
    const scroller = zoomScrollRef.current
    const image = zoomImageRef.current
    if (!zoom || scroller === null || image === null) return
    image.style.width = "1672px"
    let pinchStart = 0
    let pinchWidth = 1672
    const start = (event: TouchEvent) => {
      const first = event.touches[0]
      const second = event.touches[1]
      if (first === undefined || second === undefined) return
      pinchStart = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)
      pinchWidth = image.clientWidth
    }
    const move = (event: TouchEvent) => {
      const first = event.touches[0]
      const second = event.touches[1]
      if (first === undefined || second === undefined || pinchStart === 0) return
      event.preventDefault()
      const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)
      const nextWidth = Math.max(window.innerWidth, Math.min(3344, (pinchWidth * distance) / pinchStart))
      image.style.width = `${nextWidth}px`
    }
    scroller.addEventListener("touchstart", start, { passive: true })
    scroller.addEventListener("touchmove", move, { passive: false })
    return () => {
      scroller.removeEventListener("touchstart", start)
      scroller.removeEventListener("touchmove", move)
    }
  }, [zoom, page.anchor])

  function show(nextAnchor: string): void {
    setZoom(false)
    history.pushState(null, "", `/docs#${nextAnchor}`)
    setAnchor(nextAnchor)
    const nextIndex = pages.findIndex((item) => item.anchor === nextAnchor)
    if (nextIndex >= 0) setRailIndex(nextIndex)
  }

  useArtSwipe({
    enabled: narrow && !zoom,
    reduced,
    railIndex,
    pageCount: pages.length,
    stageRef,
    railRef,
    suppressClick,
    onCommit: (direction) => {
      const target = pagesRef.current[railIndex + direction]
      if (target !== undefined) show(target.anchor)
    },
  })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (zoom) {
        if (event.key === "Escape") setZoom(false)
        return
      }
      if (event.key === "ArrowLeft" && previous !== undefined) show(previous.anchor)
      if (event.key === "ArrowRight" && next !== undefined) show(next.anchor)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [zoom, previous, next])

  const art = artOf(page)
  const place = artPlacement(page)
  const picture = (
    <>
      <button
        type="button"
        className="book-art"
        aria-label="Enlarge illustration"
        onClick={() => {
          if (window.innerWidth <= 900) setZoom(true)
        }}
      >
        <img
          src={art}
          width={page.width}
          height={page.height}
          alt={page.alt}
          style={{ left: `${place.left}%`, top: `${place.top}%`, width: `${place.width}%`, height: `${place.height}%` }}
        />
      </button>
      <p className="book-eyebrow">{page.eyebrow}</p>
      <h1 className="book-title" id="book-title">
        {page.title.map((line, lineIndex) => (
          <span key={line}>
            {lineIndex === 0 ? null : <br />}
            {line}
          </span>
        ))}
      </h1>
      <p className="book-intro" style={{ top: page.introTop }}>
        {page.intro}
      </p>
      <p className="book-note">{page.note}</p>
      <Link className="book-more" to={handbook.kind === "internal" ? handbook.href : chapterHref(INDEX_CHAPTER)}>
        {page.linkLabel}
      </Link>
    </>
  )

  return (
    <div
      className="book"
      style={
        {
          "--book-slot-x": BOOK_ART_SLOT.x,
          "--book-slot-y": BOOK_ART_SLOT.y,
          "--book-slot-w": BOOK_ART_SLOT.w,
          "--book-slot-h": BOOK_ART_SLOT.h,
        } as CSSProperties
      }
    >
      <ModeSwitch mode="pictures" />
      <div className="book-fit" ref={hostRef}>
        <div className="book-frame" ref={frameRef}>
          <article className={page.n === pages.length ? "book-panel is-last" : "book-panel"} aria-labelledby="book-title">
            <div className="book-brand">
              <img src={brandUrl} alt="" />
              <span>CORPORATOR</span>
            </div>
            {narrow ? (
              <>
                <div className="book-lead">
                  {pages.map((item) => {
                    const current = item.anchor === page.anchor
                    return (
                      <div
                        key={item.anchor}
                        className={current ? "book-lead__page is-current" : "book-lead__page"}
                        aria-hidden={current ? undefined : true}
                        inert={current ? undefined : true}
                      >
                        <p className="book-eyebrow">{item.eyebrow}</p>
                        <h1 className="book-title" id={current ? "book-title" : undefined}>
                          {item.title.map((line, lineIndex) => (
                            <span key={line}>
                              {lineIndex === 0 ? null : <br />}
                              {line}
                            </span>
                          ))}
                        </h1>
                        <p className="book-intro">{item.intro}</p>
                      </div>
                    )
                  })}
                </div>
                <div
                  className="book-stage"
                  ref={stageRef}
                  role="button"
                  tabIndex={0}
                  aria-label="Enlarge illustration"
                  onClick={() => {
                    if (suppressClick.current) {
                      suppressClick.current = false
                      return
                    }
                    setZoom(true)
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return
                    event.preventDefault()
                    setZoom(true)
                  }}
                >
                  <div className="book-rail" ref={railRef}>
                    <ArtSlide page={railIndex > 0 ? pages[railIndex - 1] : undefined} />
                    <ArtSlide page={pages[railIndex] ?? page} labelled />
                    <ArtSlide page={pages[railIndex + 1]} />
                  </div>
                </div>
                <footer className="book-footer">
                  <BookPager pages={pages} page={page} show={show} />
                  {next === undefined ? (
                    <div className="book-end">
                      <button type="button" className="book-cta is-primary" onClick={() => open("demo")}>
                        Play the demo
                      </button>
                      <Link className="book-cta" to={chapterHref(INDEX_CHAPTER)}>
                        Read the handbook
                      </Link>
                    </div>
                  ) : null}
                </footer>
                <div className="book-tail">
                  <p className="book-note">{page.note}</p>
                  <Link className="book-more" to={handbook.kind === "internal" ? handbook.href : chapterHref(INDEX_CHAPTER)}>
                    {page.linkLabel}
                  </Link>
                </div>
              </>
            ) : (
              <>
                {reduced ? (
                  <div className="book-spread">{picture}</div>
                ) : (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={page.anchor}
                      className="book-spread"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: SITE_PAGE_EXIT_S, ease: sitePageExitEase } }}
                      transition={{ duration: SITE_PAGE_ENTER_S, ease: sitePageEase }}
                    >
                      {picture}
                    </motion.div>
                  </AnimatePresence>
                )}
                <footer className="book-footer">
                  <button
                    type="button"
                    className="book-arrow"
                    aria-label="Previous page"
                    disabled={previous === undefined}
                    onClick={() => {
                      if (previous !== undefined) show(previous.anchor)
                    }}
                  >
                    <Arrow direction="prev" />
                  </button>
                  <BookPager pages={pages} page={page} show={show} />
                  {next === undefined ? (
                    <div className="book-end">
                      <button type="button" className="book-cta is-primary" onClick={() => open("demo")}>
                        Play the demo
                      </button>
                      <Link className="book-cta" to={chapterHref(INDEX_CHAPTER)}>
                        Read the handbook
                      </Link>
                    </div>
                  ) : (
                    <button type="button" className="book-next" aria-label="Next page" onClick={() => show(next.anchor)}>
                      <span className="book-arrow">
                        <Arrow direction="next" />
                      </span>
                      <span className="book-next__label">Next</span>
                    </button>
                  )}
                </footer>
              </>
            )}
          </article>
        </div>
      </div>
      {zoom ? <div className="book-zoom" role="dialog" aria-modal="true" aria-label="Illustration enlarged">
        <header className="book-zoom__head">
          <span>Drag to explore · pinch to zoom</span>
          <button type="button" aria-label="Close illustration" onClick={() => setZoom(false)}>
            ×
          </button>
        </header>
        <div className="book-zoom__scroll" ref={zoomScrollRef}>
          <img ref={zoomImageRef} src={art} alt={page.alt} />
        </div>
      </div> : null}
    </div>
  )
}
