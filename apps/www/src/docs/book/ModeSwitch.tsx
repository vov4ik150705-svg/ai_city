import { useEffect, useRef } from "react"
import { Link } from "../../site"
import { chapterHref, INDEX_CHAPTER } from "../paths"
import { savedBookAnchor } from "./pages"
import "./book.css"

export function ModeSwitch({ mode }: { mode: "pictures" | "handbook" }) {
  const picturesHref = `/docs#${savedBookAnchor()}`
  const handbookHref = chapterHref(INDEX_CHAPTER)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const nav = navRef.current
    if (nav === null) return
    const query = window.matchMedia("(max-width: 900px)")
    let last = window.scrollY
    let acc = 0
    let frame = 0
    let revealed = false
    let shift = 0
    const showAfter = 48
    const place = (next: number, animate: boolean) => {
      const height = nav.offsetHeight
      const clamped = Math.max(0, Math.min(next, height))
      if (clamped === shift && nav.style.transition === (animate ? "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)" : "none")) return
      shift = clamped
      nav.style.transition = animate ? "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)" : "none"
      nav.style.transform = clamped === 0 ? "" : `translate3d(0, ${-clamped}px, 0)`
      nav.classList.toggle("is-concealed", clamped >= height - 1)
    }
    const clear = () => {
      shift = 0
      revealed = false
      acc = 0
      nav.style.transition = ""
      nav.style.transform = ""
      nav.classList.remove("is-concealed")
    }
    const onScroll = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        const y = window.scrollY
        const delta = y - last
        last = y
        if (!query.matches || document.documentElement.dataset.scrollLock === "1") {
          clear()
          return
        }
        const height = nav.offsetHeight
        if (y <= 1) {
          revealed = false
          acc = 0
          place(0, false)
          return
        }
        if (revealed) {
          if (delta > 0) {
            revealed = false
            acc = 0
            place(height, true)
          }
          return
        }
        place(Math.min(y, height), false)
        if (delta < 0 && y > height) {
          acc = acc < 0 ? acc + delta : delta
          if (acc <= -showAfter) {
            revealed = true
            acc = 0
            place(0, true)
          }
        } else if (delta >= 0) {
          acc = 0
        }
      })
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    query.addEventListener("change", onScroll)
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      query.removeEventListener("change", onScroll)
      clear()
    }
  }, [])

  return (
    <nav ref={navRef} className="book-modes" aria-label="Documentation mode">
      <Link to={picturesHref} className={mode === "pictures" ? "is-active" : ""} aria-current={mode === "pictures" ? "page" : undefined}>
        In pictures
      </Link>
      <Link to={handbookHref} className={mode === "handbook" ? "is-active" : ""} aria-current={mode === "handbook" ? "page" : undefined}>
        Handbook
      </Link>
    </nav>
  )
}
