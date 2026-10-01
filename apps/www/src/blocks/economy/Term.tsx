import { useEffect, useId, useRef, useState, type ReactNode } from "react"

function placeTip(root: HTMLSpanElement) {
  const tip = root.querySelector(".site-tooltip")
  if (!(tip instanceof HTMLElement)) return
  tip.style.left = "0px"
  const pad = 12
  const rect = tip.getBoundingClientRect()
  let shift = 0
  const overflowRight = rect.right - (window.innerWidth - pad)
  if (overflowRight > 0) shift -= overflowRight
  const nextLeft = rect.left + shift
  if (nextLeft < pad) shift += pad - nextLeft
  tip.style.left = `${shift}px`
}

export function Term({ tip, children }: { tip: string; children: ReactNode }) {
  const tipId = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    if (root === null) return
    function place() {
      if (root !== null) placeTip(root)
    }
    place()
    window.addEventListener("resize", place)
    return () => window.removeEventListener("resize", place)
  }, [pinned])

  useEffect(() => {
    if (!pinned) return
    function onPointer(event: PointerEvent) {
      const root = rootRef.current
      if (root !== null && event.target instanceof Node && !root.contains(event.target)) setPinned(false)
    }
    function onKey(event: KeyboardEvent) {
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
    <span ref={rootRef} className={pinned ? "economy-term is-open" : "economy-term"}>
      <button
        type="button"
        className="economy-term__button"
        aria-describedby={tipId}
        onClick={() => setPinned((value) => !value)}
      >
        {children}
      </button>
      <span id={tipId} role="tooltip" className="site-tooltip type-tooltip">
        {tip}
      </span>
    </span>
  )
}

export function withWord(text: string, word: string, tip: string): ReactNode {
  const at = text.indexOf(word)
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <Term tip={tip}>{word}</Term>
      {text.slice(at + word.length)}
    </>
  )
}
