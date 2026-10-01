import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react"
import { Footer } from "./components/Footer"
import { Header } from "./components/Header"
import { PlayChooser } from "./components/PlayChooser"
import { PreviewDialog } from "./components/PreviewDialog"
import { pageMeta } from "./data/shell"
import { isDocsPath } from "./docs/paths"
import { applyPageMeta } from "./meta"
import { notePageLeave, normalizePath, PageTransition, pageTransitionKey } from "./pageTransition"
import { Landing, LeaderboardPage, NotFound, RatingPage } from "./pages/routes"
import { scrollToId } from "./scroll"
import { SiteContext } from "./site"

const DocsRoute = lazy(() => import("./docs/DocsRoute"))

function currentPath(): string {
  return normalizePath(window.location.pathname)
}

function locationHash(): string {
  return window.location.hash.replace(/^#/, "")
}

export default function App() {
  const [path, setPath] = useState(currentPath)
  const [dialog, setDialog] = useState<string | null>(null)
  const [chooser, setChooser] = useState(false)
  const pathRef = useRef(path)
  pathRef.current = path

  const navigate = useCallback((to: string) => {
    const [pathname, hash] = to.split("#")
    const next = normalizePath(pathname || "/")
    const samePage = next === currentPath()
    if (!samePage) notePageLeave(currentPath(), "push")
    history.pushState(null, "", to)
    setPath(next)
    window.dispatchEvent(new Event("corporator-nav"))
    setDialog(null)
    setChooser(false)
    if (samePage) {
      if (hash) scrollToId(hash)
      else window.scrollTo({ top: 0, behavior: "auto" })
      requestAnimationFrame(() => {
        document.getElementById("main")?.focus({ preventScroll: true })
      })
    }
  }, [])

  const open = useCallback((kind: string) => {
    setChooser(false)
    setDialog(kind)
  }, [])

  const openPlay = useCallback(() => {
    setDialog(null)
    setChooser(true)
  }, [])

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual"
    const update = () => {
      const next = currentPath()
      if (next !== pathRef.current) notePageLeave(pathRef.current, "pop")
      else {
        const id = locationHash()
        if (id !== "") scrollToId(id, "auto")
      }
      setPath(next)
      setDialog(null)
      setChooser(false)
    }
    window.addEventListener("popstate", update)
    return () => window.removeEventListener("popstate", update)
  }, [])

  useEffect(() => {
    if (isDocsPath(path)) return
    const meta = pageMeta[path]
    const title = meta?.title ?? (path === "/" ? "Corporator" : "Page not found — Corporator")
    applyPageMeta(title, meta?.description ?? "")
  }, [path])

  let page = <NotFound />
  if (path === "/") page = <Landing />
  else if (path === "/rating") page = <RatingPage />
  else if (path === "/leaderboard") page = <LeaderboardPage />
  else if (isDocsPath(path)) {
    page = (
      <Suspense fallback={<div className="hb-loading" />}>
        <DocsRoute path={path} />
      </Suspense>
    )
  }

  return (
    <SiteContext.Provider value={{ navigate, open, openPlay }}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header path={path} />
      <PageTransition routeKey={pageTransitionKey(path)} footer={isDocsPath(path) ? null : <Footer />}>
        {page}
      </PageTransition>
      {chooser ? <PlayChooser onClose={() => setChooser(false)} /> : null}
      {dialog !== null ? <PreviewDialog kind={dialog} close={() => setDialog(null)} /> : null}
    </SiteContext.Provider>
  )
}
