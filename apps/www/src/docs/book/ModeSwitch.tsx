import { Link } from "../../site"
import { chapterHref, INDEX_CHAPTER } from "../paths"
import { savedBookAnchor } from "./pages"
import "./book.css"

export function ModeSwitch({ mode }: { mode: "pictures" | "handbook" }) {
  const picturesHref = `/docs#${savedBookAnchor()}`
  const handbookHref = chapterHref(INDEX_CHAPTER)
  return (
    <nav className="book-modes" aria-label="Documentation mode">
      <Link to={picturesHref} className={mode === "pictures" ? "is-active" : ""} aria-current={mode === "pictures" ? "page" : undefined}>
        In pictures
      </Link>
      <Link to={handbookHref} className={mode === "handbook" ? "is-active" : ""} aria-current={mode === "handbook" ? "page" : undefined}>
        Handbook
      </Link>
    </nav>
  )
}
