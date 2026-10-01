import { useEffect, useId, useRef, useState } from "react"
import { ArrowDown, X } from "lucide-react"
import { Card } from "../components/Card"
import {
  gameHeading,
  gameHud,
  gameParagraphs,
  gameSteps,
  gameTooltips,
  type GameRun,
} from "../data/game"
import "../styles/game.css"

function GameTerm({ label, text }: { label: string; text: string }) {
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  const tipId = useId()
  const open = hover || pinned

  useEffect(() => {
    if (!pinned) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && root.current?.contains(target) === false) setPinned(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinned(false)
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [pinned])

  return (
    <span
      ref={root}
      className={`game-term${open ? " is-open" : ""}${pinned ? " is-pinned" : ""}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className="game-term__btn"
        aria-describedby={tipId}
        aria-expanded={open}
        onClick={() => setPinned((value) => !value)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        {label}
      </button>
      <span id={tipId} role="tooltip" className="game-term__tip type-tooltip">
        {text}
      </span>
    </span>
  )
}

function GameRuns({ runs }: { runs: readonly GameRun[] }) {
  return runs.map((run, index) =>
    run.kind === "text" ? (
      run.value
    ) : (
      <GameTerm key={`${run.term}-${index}`} label={run.label} text={gameTooltips[run.term]} />
    ),
  )
}

function GameHudDialog({ name, src, onClose }: { name: string; src: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  const finished = useRef(false)
  const closing = useRef(false)
  onCloseRef.current = onClose

  useEffect(() => {
    const node = dialog.current
    if (node === null) return
    const y = window.scrollY
    if (!node.open) node.showModal()
    const body = document.body
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    }
    body.style.position = "fixed"
    body.style.top = `${-y}px`
    body.style.left = "0"
    body.style.right = "0"
    body.style.width = "100%"
    body.style.overflow = "hidden"
    return () => {
      body.style.overflow = previous.overflow
      body.style.position = previous.position
      body.style.top = previous.top
      body.style.left = previous.left
      body.style.right = previous.right
      body.style.width = previous.width
      window.scrollTo(0, y)
    }
  }, [])

  function requestClose() {
    const node = dialog.current
    if (node === null || finished.current || closing.current) return
    const finish = () => {
      if (finished.current) return
      finished.current = true
      onCloseRef.current()
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) {
      finish()
      return
    }
    closing.current = true
    const onEnd = (event: TransitionEvent) => {
      if (event.target !== node || event.propertyName !== "opacity") return
      finish()
    }
    node.addEventListener("transitionend", onEnd)
    window.setTimeout(finish, 280)
    if (node.open) node.close()
  }

  return (
    <dialog
      ref={dialog}
      className="game-hud__dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        requestClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <h2 id={titleId} className="game-hud__dialog-title">
        {name}
      </h2>
      <div className="site-card site-card--solid game-hud__card game-hud__dialog-card">
        <span className="game-hud__chrome">
          <span className="game-hud__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="game-hud__dialog-end">
            <p className="type-heading-4">{name}</p>
            <button type="button" className="site-icon-button game-hud__dialog-close" aria-label="Close" onClick={requestClose}>
              <X size={18} aria-hidden="true" />
            </button>
          </span>
        </span>
        <span className="game-hud__dialog-shot">
          <img src={src} alt="" />
        </span>
      </div>
    </dialog>
  )
}

function GameHudFrame({ name, shot }: { name: string; shot: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" className="game-hud__shot" aria-label={`Open ${name}`} onClick={() => setOpen(true)}>
        <img src={shot} alt="" decoding="async" />
      </button>
      {open ? <GameHudDialog name={name} src={shot} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

export function Game() {
  return (
    <section id="game" className="site-section game" data-theme="light">
      <div className="site-container">
        <div className="game__lead">
          <h2 className="game__title type-display-1">{gameHeading}</h2>
          {/* Game contract says body. type-body-lg is the instructed deviation. */}
          <div className="game__paras">
            {gameParagraphs.map((runs, index) => (
              <p key={index} className="type-body-lg">
                <GameRuns runs={runs} />
              </p>
            ))}
          </div>
        </div>
        <ol className="game-steps">
          {gameSteps.map((step, index) => (
            <li key={step.n} className="game-step">
              <Card variant="feature" className="game-step__card">
                <img
                  className={
                    step.n === "04"
                      ? "game-step__art game-step__art--bank"
                      : step.n === "03"
                        ? "game-step__art game-step__art--supply"
                        : step.n === "01"
                          ? "game-step__art game-step__art--coin"
                          : "game-step__art"
                  }
                  src={step.art}
                  alt={step.alt}
                  width={step.artWidth}
                  height={step.artHeight}
                  loading="lazy"
                  decoding="async"
                />
                <div className="game-step__copy">
                  <div className="game-step__head">
                    <span className="game-step__num type-label">{step.n}</span>
                    <h3 className="type-heading-4">{step.title}</h3>
                  </div>
                  <p className="game-step__text type-body-sm">
                    <GameRuns runs={step.runs} />
                  </p>
                </div>
              </Card>
              {index < gameSteps.length - 1 ? (
                <span className="game-step__arrow" aria-hidden="true">
                  <svg className="game-step__arrow-right" viewBox="0 0 28 10" width="28" height="10">
                    <path
                      d="M1 5h22M18 1.5 25 5l-7 3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <ArrowDown className="game-step__arrow-down" size={16} strokeWidth={1.25} />
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <ul className="game-hud">
          {gameHud.map((panel) => (
            <li key={panel.name}>
              <Card variant="solid" className="game-hud__card">
                <span className="game-hud__chrome">
                  <span className="game-hud__dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <p className="type-heading-4">{panel.name}</p>
                </span>
                <GameHudFrame name={panel.name} shot={panel.shot} />
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
