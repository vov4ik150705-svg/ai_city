import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react"
import { useContext, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react"
import { Menu, X } from "lucide-react"
import { navItems } from "../data/shell"
import { Link, SiteContext } from "../site"
import { HandRule } from "../docs/sketch/Sketch"
import { Button } from "./Button"
import { Logo } from "./Logo"

const headerEase = [0.22, 1, 0.36, 1] as [number, number, number, number]
const HEADER_S = 0.45

function currentNav(path: string, id: string): boolean {
  if (id === "game") return path === "/"
  return path === `/${id}`
}

function HeaderFace({
  docs,
  path,
  menu,
  concealed,
  setMenu,
  openPlay,
  toggleRef,
  menuRef,
  instant,
}: {
  docs: boolean
  path: string
  menu: boolean
  concealed: boolean
  setMenu: Dispatch<SetStateAction<boolean>>
  openPlay: () => void
  toggleRef: RefObject<HTMLButtonElement | null>
  menuRef: RefObject<HTMLElement | null>
  instant: boolean
}) {
  const present = useIsPresent()
  const headerClass = ["site-header", concealed && !menu ? "is-concealed" : "", docs ? "site-header--docs" : ""]
    .filter((part) => part !== "")
    .join(" ")

  return (
    <motion.header
      className={headerClass}
      data-leaving={present ? "0" : "1"}
      aria-hidden={!present}
      inert={!present}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: instant ? 0 : HEADER_S, ease: headerEase }}
    >
      <div className="site-container site-header__inner">
        <Logo />
        <nav className="site-nav" aria-label="Main">
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.href}
              className="site-nav__link type-nav"
              aria-current={currentNav(path, item.id) ? "page" : undefined}
            >
              {item.label}
              {docs ? <HandRule seed={`header-${item.id}`} className="site-header__ink" /> : null}
            </Link>
          ))}
          <Link to="/docs" className="site-nav__link type-nav" aria-current={docs ? "page" : undefined}>
            Docs
            {docs ? <HandRule seed="header-docs" className="site-header__ink" /> : null}
          </Link>
        </nav>
        <div className="site-header__actions">
          <Button size="sm" trailingIcon={!docs} className="site-header__play" onClick={openPlay}>
            Play now
            {docs ? <HandRule seed="header-play" className="site-header__ink" /> : null}
          </Button>
          <button
            ref={present ? toggleRef : null}
            type="button"
            className="site-icon-button site-header__menu"
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            aria-controls="site-menu"
            onClick={() => setMenu((open) => !open)}
          >
            {menu ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {docs ? (
        <svg className="site-header__rule" viewBox="0 0 1200 16" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path
            d="M1 8.2 C 54 5.4, 96 11.6, 168 7.4 C 232 3.8, 286 12.4, 372 8.6 C 454 5.1, 498 12.8, 590 7.2 C 668 2.8, 724 11.2, 812 8.4 C 892 5.6, 948 12.6, 1046 7.6 C 1118 4.2, 1162 10.4, 1199 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
      {present && menu ? (
        <nav ref={menuRef} id="site-menu" className="site-menu" aria-label="Main">
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.href}
              className="type-heading-4"
              aria-current={currentNav(path, item.id) ? "page" : undefined}
              onClick={() => setMenu(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link to="/docs" className="type-heading-4" aria-current={docs ? "page" : undefined} onClick={() => setMenu(false)}>
            Docs
          </Link>
        </nav>
      ) : null}
    </motion.header>
  )
}

export function Header({ path }: { path: string }) {
  const { openPlay } = useContext(SiteContext)
  const [menu, setMenu] = useState(false)
  const [concealed, setConcealed] = useState(false)
  const menuRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const onDocs = path.startsWith("/docs")
  const instant = useReducedMotion() === true

  useLayoutEffect(() => {
    document.documentElement.dataset.header = onDocs ? "docs" : "site"
  }, [onDocs])

  useEffect(() => {
    document.documentElement.dataset.headerReady = "1"
  }, [])

  useEffect(() => setMenu(false), [path])

  useEffect(() => {
    let last = window.scrollY
    let acc = 0
    const edge = 8
    const trip = 24
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - last
      last = y
      if (y <= edge) {
        acc = 0
        setConcealed(false)
        return
      }
      if (delta === 0) return
      acc += delta
      if (acc > trip) {
        acc = 0
        setConcealed(true)
      } else if (acc < -trip) {
        acc = 0
        setConcealed(false)
      }
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (!menu) return
    const root = menuRef.current
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const focusable = root?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")
    focusable?.item(0)?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(false)
        toggleRef.current?.focus()
        return
      }
      if (event.key !== "Tab" || root === null) return
      const list = Array.from(root.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"))
      const first = list[0]
      const last = list[list.length - 1]
      if (first === undefined || last === undefined) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener("keydown", onKey)
    }
  }, [menu])

  return (
    <div className="site-header-dock">
      <span className="site-header-font-warm" aria-hidden="true">
        Corporator
      </span>
      <AnimatePresence initial={false}>
        <HeaderFace
          key={onDocs ? "docs" : "site"}
          docs={onDocs}
          path={path}
          menu={menu}
          concealed={concealed}
          setMenu={setMenu}
          openPlay={openPlay}
          toggleRef={toggleRef}
          menuRef={menuRef}
          instant={instant}
        />
      </AnimatePresence>
    </div>
  )
}
