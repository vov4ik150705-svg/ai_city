import { ChevronDown } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { Link } from "../site"
import type { Chapter, Heading } from "./md/chapter"
import { ModeSwitch } from "./book/ModeSwitch"
import { ChapterSwap } from "../pageTransition"
import { chapterHref } from "./paths"
import { HandbookFooter } from "./HandbookFooter"
import { HandRule, HandVRule } from "./sketch/Sketch"
import { chapterNumber, chapters } from "./source"

export const HANDBOOK_NAME = "Corporator Handbook"

function sectionsOf(chapter: Chapter): readonly Heading[] {
  return chapter.headings.filter((heading) => heading.depth === 2)
}

function useReadingSection(ids: readonly string[]): string {
  const [active, setActive] = useState("")
  const key = ids.join("\n")

  useEffect(() => {
    const idList = key === "" ? [] : key.split("\n")
    let frame = 0
    let stopped = false
    // Chapter swap waits out the exit animation before the next headings exist.
    // A one-shot query at effect time misses them and then never listens again.
    const pick = () => {
      if (stopped || frame !== 0) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        if (stopped) return
        const nodes = idList
          .map((id) => document.getElementById(id))
          .filter((node): node is HTMLElement => node !== null)
        const first = nodes[0]
        if (first === undefined) {
          setActive((prev) => (prev === "" ? prev : ""))
          return
        }
        const line = Math.min(window.innerHeight * 0.32, 220)
        let current = first.id
        for (const node of nodes) {
          if (node.getBoundingClientRect().top <= line) current = node.id
        }
        setActive((prev) => (prev === current ? prev : current))
      })
    }
    pick()
    window.addEventListener("scroll", pick, { passive: true })
    window.addEventListener("resize", pick)
    const stage = document.querySelector(".hb-stage")
    const observer = new MutationObserver(pick)
    if (stage !== null) observer.observe(stage, { childList: true, subtree: true })
    return () => {
      stopped = true
      if (frame !== 0) window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", pick)
      window.removeEventListener("resize", pick)
      observer.disconnect()
    }
  }, [key])

  return active
}

function Toc({ chapter }: { chapter: Chapter }) {
  const sections = sectionsOf(chapter)
  if (sections.length === 0) return null
  return (
    <aside className="hb-toc" aria-label="On this page">
      <p className="hb-toc__label">On this page</p>
      <ol className="hb-toc__list">
        {sections.map((heading) => (
          <li key={heading.id}>
            <Link to={`${chapterHref(chapter.slug)}#${heading.id}`} className="hb-toc__link">
              {heading.text}
            </Link>
          </li>
        ))}
      </ol>
    </aside>
  )
}

export function HandbookLayout({ chapter, children }: { chapter: Chapter | undefined; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const slug = chapter?.slug
  const sections = chapter === undefined ? [] : sectionsOf(chapter)
  const reading = useReadingSection(sections.map((heading) => heading.id))

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <div className="hb">
      <ModeSwitch mode="handbook" />
      <div className="hb-shell">
        <div className="hb-nav-col">
          <nav className={open ? "hb-nav is-open" : "hb-nav"} aria-label="Handbook chapters">
            <button
              type="button"
              className="hb-nav__toggle"
              aria-expanded={open}
              aria-controls="hb-nav-list"
              onClick={() => setOpen((value) => !value)}
            >
              <span className="hb-nav__copy">
                <span className="hb-nav__label">{HANDBOOK_NAME}</span>
                <span className="hb-nav__current">
                  {chapter === undefined ? "Chapters" : `${chapterNumber(chapter)} — ${chapter.title}`}
                </span>
              </span>
              <span className={open ? "hb-nav__chevron is-open" : "hb-nav__chevron"} aria-hidden="true">
                <ChevronDown size={18} strokeWidth={2.25} />
              </span>
            </button>
            <p className="hb-nav__label hb-nav__heading">{HANDBOOK_NAME}</p>
            <ol id="hb-nav-list" className="hb-nav__list">
              {chapters.map((item) => {
                const selected = item.slug === slug
                const itemSections = sectionsOf(item)
                return (
                  <li key={item.slug}>
                    <Link
                      to={chapterHref(item.slug)}
                      className="hb-nav__link"
                      data-chapter={item.slug}
                      aria-current={selected ? "page" : undefined}
                    >
                      <span className="hb-nav__num">{chapterNumber(item)}</span>
                      <span className="hb-nav__title">
                        {item.title}
                        {selected ? (
                          <span className="hb-nav__rule">
                            <HandRule seed={`nav:${item.slug}`} />
                          </span>
                        ) : null}
                      </span>
                    </Link>
                    {itemSections.length > 0 ? (
                      <div
                        className={selected ? "hb-nav__sections-wrap is-open" : "hb-nav__sections-wrap"}
                        {...(selected ? {} : { inert: true, "aria-hidden": true as const })}
                      >
                        <div className="hb-nav__sections-clip">
                          <div className="hb-nav__sec-spine" aria-hidden="true">
                            <HandVRule seed={`nav-sec:${item.slug}`} />
                          </div>
                          <ol className="hb-nav__sections">
                            {itemSections.map((heading) => {
                              const here = selected && heading.id === reading
                              return (
                                <li key={heading.id}>
                                  <Link
                                    to={`${chapterHref(item.slug)}#${heading.id}`}
                                    className="hb-nav__section"
                                    aria-current={here ? "location" : undefined}
                                  >
                                    <span className="hb-nav__section-text">{heading.text}</span>
                                  </Link>
                                </li>
                              )
                            })}
                          </ol>
                        </div>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ol>
          </nav>
        </div>
        <div className="hb-stage">
          <ChapterSwap slug={slug ?? "missing"}>{children}</ChapterSwap>
        </div>
        {chapter === undefined ? null : <Toc chapter={chapter} />}
      </div>
      <HandbookFooter />
    </div>
  )
}
