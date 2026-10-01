import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useLayoutEffect, type ReactNode } from "react"
import { isDocsPath } from "./docs/paths"
import { hashElementId, scrollToId } from "./scroll"

const pageEase = [0.22, 1, 0.36, 1] as [number, number, number, number]
const exitEase = [0.4, 0, 0.6, 1] as [number, number, number, number]
const ENTER_S = 0.32
const EXIT_S = 0.16
const CHAPTER_S = 0.32

const scrollMemory = new Map<string, number>()
let navKind: "push" | "pop" = "push"
let focusOnArrive = false

export function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/"
}

export function pageTransitionKey(path: string): string {
  if (path === "/docs") return "/docs"
  if (isDocsPath(path)) return "/docs/handbook"
  return path
}

export function notePageLeave(path: string, kind: "push" | "pop"): void {
  scrollMemory.set(path, window.scrollY)
  navKind = kind
  focusOnArrive = true
}

function consumeFocus(): boolean {
  const focus = focusOnArrive
  focusOnArrive = false
  return focus
}

function scrollArriving(path: string, target: "document" | "book"): void {
  if (target === "book") {
    window.scrollTo({ top: 0, behavior: "auto" })
    return
  }
  const id = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : ""
  if (id !== "" && document.getElementById(hashElementId(id)) !== null) {
    scrollToId(id, "auto")
    return
  }
  const top = navKind === "pop" ? (scrollMemory.get(path) ?? 0) : 0
  window.scrollTo({ top, behavior: "auto" })
}

function ArrivalScroll({ routeKey }: { routeKey: string }) {
  useLayoutEffect(() => {
    if (routeKey === "/docs/handbook") {
      if (document.querySelector(".hb-page") === null) {
        scrollArriving(normalizePath(window.location.pathname), "document")
        if (consumeFocus()) document.getElementById("main")?.focus({ preventScroll: true })
      }
      return
    }
    scrollArriving(routeKey, routeKey === "/docs" ? "book" : "document")
    if (consumeFocus()) document.getElementById("main")?.focus({ preventScroll: true })
  }, [routeKey])
  return null
}

function HandbookArrival({ slug }: { slug: string }) {
  useLayoutEffect(() => {
    scrollArriving(normalizePath(window.location.pathname), "document")
    if (consumeFocus()) document.getElementById("main")?.focus({ preventScroll: true })
  }, [slug])
  return null
}

function PageShell({
  routeKey,
  footer,
  children,
}: {
  routeKey: string
  footer: ReactNode
  children: ReactNode
}) {
  return (
    <>
      <ArrivalScroll routeKey={routeKey} />
      <main id="main" className="site-main" tabIndex={-1}>
        {children}
      </main>
      {footer}
    </>
  )
}

export function PageTransition({
  routeKey,
  footer,
  children,
}: {
  routeKey: string
  footer: ReactNode
  children: ReactNode
}) {
  const reduced = useReducedMotion() === true
  if (reduced) {
    return (
      <div className="site-page" data-route={routeKey}>
        <PageShell routeKey={routeKey} footer={footer}>
          {children}
        </PageShell>
      </div>
    )
  }
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        className="site-page"
        data-route={routeKey}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: EXIT_S, ease: exitEase } }}
        transition={{ duration: ENTER_S, ease: pageEase }}
      >
        <PageShell routeKey={routeKey} footer={footer}>
          {children}
        </PageShell>
      </motion.div>
    </AnimatePresence>
  )
}

export function ChapterSwap({ slug, children }: { slug: string; children: ReactNode }) {
  const reduced = useReducedMotion() === true
  if (reduced) {
    return (
      <article className="hb-page">
        <HandbookArrival slug={slug} />
        {children}
      </article>
    )
  }
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.article
        key={slug}
        className="hb-page"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: CHAPTER_S, ease: pageEase }}
      >
        <HandbookArrival slug={slug} />
        {children}
      </motion.article>
    </AnimatePresence>
  )
}
