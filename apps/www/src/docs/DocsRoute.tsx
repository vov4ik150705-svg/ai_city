import "katex/dist/katex.min.css"
import "./handbook/fonts.css"
import "./handbook/handbook.css"
import { useEffect } from "react"
import { applyPageMeta } from "../meta"
import { Link } from "../site"
import { HANDBOOK_NAME, HandbookLayout } from "./HandbookLayout"
import type { Chapter } from "./md/chapter"
import { Book } from "./book/Book"
import { chapterHref, chapterSlugOf, DOCS_ROOT, INDEX_CHAPTER } from "./paths"
import { InlineNodes } from "./render/Inline"
import { Blocks } from "./render/Blocks"
import { HandRule } from "./sketch/Sketch"
import { chapterBySlug, chapterNumber, chapters, sourceProblems } from "./source"

function Pager({ chapter }: { chapter: Chapter }) {
  const index = chapters.indexOf(chapter)
  const prev = chapters[index - 1]
  const next = chapters[index + 1]
  return (
    <nav className="hb-pager" aria-label="Chapters">
      {prev === undefined ? <span /> : (
        <Link to={chapterHref(prev.slug)} className="hb-pager__link">
          <span className="hb-pager__dir">Previous</span>
          <span className="hb-pager__title">{prev.title}</span>
        </Link>
      )}
      {next === undefined ? <span /> : (
        <Link to={chapterHref(next.slug)} className="hb-pager__link hb-pager__link--next">
          <span className="hb-pager__dir">Next</span>
          <span className="hb-pager__title">{next.title}</span>
        </Link>
      )}
    </nav>
  )
}

function ChapterPage({ chapter }: { chapter: Chapter }) {
  const [title, ...rest] = chapter.blocks
  const leadBlock = rest[0]
  const lead = leadBlock?.kind === "paragraph" ? leadBlock : null
  const body = lead === null ? rest : rest.slice(1)
  return (
    <>
      <header className="hb-header">
        <p className="hb-kicker">
          {chapterNumber(chapter)} — {HANDBOOK_NAME}
        </p>
        <h1 className="hb-title" id={title?.kind === "heading" ? title.id : undefined}>
          <span className="hb-title__text">
            {chapter.title}
            <HandRule seed={`${chapter.slug}:title`} className="hb-title__rule" />
          </span>
        </h1>
        {lead === null ? null : (
          <p className="hb-lead">
            <InlineNodes nodes={lead.children} chapter={chapter.slug} />
            {chapter.slug === INDEX_CHAPTER ? (
              <>
                {" "}
                Rather look than read? <Link to={`${DOCS_ROOT}#island`} className="hb-link">See the island in pictures →</Link>
              </>
            ) : null}
          </p>
        )}
      </header>
      <div className="hb-body">
        <Blocks blocks={body} chapter={chapter.slug} />
      </div>
      <Pager chapter={chapter} />
    </>
  )
}

export default function DocsRoute({ path }: { path: string }) {
  if (path === DOCS_ROOT) return <Book />
  return <HandbookRoute path={path} />
}

function HandbookRoute({ path }: { path: string }) {
  const slug = chapterSlugOf(path)
  const chapter = slug === null ? undefined : chapterBySlug(slug)

  useEffect(() => {
    if (import.meta.env.DEV && sourceProblems.length > 0) console.warn("[handbook] source problems:", sourceProblems)
  }, [])

  useEffect(() => {
    applyPageMeta(
      chapter === undefined ? "Page not found — Corporator" : `${chapter.title} | Corporator`,
      chapter?.description ?? "",
    )
  }, [chapter])

  return (
    <HandbookLayout chapter={chapter}>
      {chapter === undefined ? (
        <header className="hb-header">
          <h1 className="hb-title">
            <span className="hb-title__text">
              Page not found
              <HandRule seed="missing:title" className="hb-title__rule" />
            </span>
          </h1>
          <p className="hb-lead">
            This chapter isn't in the handbook. <Link to={chapterHref(INDEX_CHAPTER)} className="hb-link">Start from the beginning</Link>.
          </p>
        </header>
      ) : (
        <ChapterPage chapter={chapter} />
      )}
    </HandbookLayout>
  )
}
