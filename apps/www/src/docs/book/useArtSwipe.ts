import { useEffect, useLayoutEffect, useRef, type RefObject } from "react"
import { flushSync } from "react-dom"

const FLICK_PX_PER_MS = 0.45
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)"

/** 1 = next picture, -1 = previous, 0 = stay. Offset is pixels from the settled picture; positive offset reveals the previous one. */
export function swipeDecision(
  offset: number,
  velocity: number,
  width: number,
  hasPrev: boolean,
  hasNext: boolean,
): -1 | 0 | 1 {
  if (!Number.isFinite(offset) || !Number.isFinite(velocity) || !Number.isFinite(width) || width <= 0) return 0
  const distance = Math.min(Math.max(width * 0.22, 36), 88)
  if (offset < 0 && hasNext && (offset <= -distance || velocity <= -FLICK_PX_PER_MS)) return 1
  if (offset > 0 && hasPrev && (offset >= distance || velocity >= FLICK_PX_PER_MS)) return -1
  return 0
}

type RailRefs = {
  readonly stageRef: RefObject<HTMLElement | null>
  readonly railRef: RefObject<HTMLElement | null>
  readonly suppressClick: { current: boolean }
}

type SwipeArgs = RailRefs & {
  readonly enabled: boolean
  readonly reduced: boolean
  readonly railIndex: number
  readonly pageCount: number
  readonly onCommit: (direction: -1 | 1) => void
}

/**
 * Three-slide rail. Resting translate is one stage wide, so the middle slide is in view.
 * The finger drives that translate; a committed swipe eases the neighbor into place, then the page changes.
 */
export function useArtSwipe({
  enabled,
  reduced,
  railIndex,
  pageCount,
  stageRef,
  railRef,
  suppressClick,
  onCommit,
}: SwipeArgs): void {
  const onCommitRef = useRef(onCommit)
  onCommitRef.current = onCommit
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced
  const indexRef = useRef(railIndex)
  indexRef.current = railIndex
  const countRef = useRef(pageCount)
  countRef.current = pageCount
  const token = useRef(0)
  const gesture = useRef<"idle" | "pending" | "dragging" | "settling">("idle")

  useLayoutEffect(() => {
    if (!enabled) return
    token.current += 1
    gesture.current = "idle"
    const stage = stageRef.current
    const rail = railRef.current
    if (stage === null || rail === null) return
    rail.style.transition = "none"
    rail.style.transform = `translate3d(${-stage.clientWidth}px,0,0)`
  }, [enabled, railIndex, stageRef, railRef])

  useEffect(() => {
    if (!enabled) return
    const stage = stageRef.current
    const rail = railRef.current
    if (stage === null || rail === null) return

    const rest = (): number => -stage.clientWidth
    const place = (x: number, ms: number): void => {
      rail.style.transition = ms > 0 ? `transform ${ms}ms ${EASE}` : "none"
      rail.style.transform = `translate3d(${x}px,0,0)`
    }
    const currentX = (): number => {
      const raw = getComputedStyle(rail).transform
      if (raw === "none") return rest()
      return new DOMMatrix(raw).m41
    }
    const slideMs = (distance: number): number => {
      const width = stage.clientWidth
      const ratio = width <= 0 ? 1 : Math.abs(distance) / width
      return Math.round(Math.min(380, Math.max(180, ratio * 380)))
    }

    type Session = {
      readonly x: number
      readonly y: number
      readonly origin: number
      lastX: number
      lastT: number
      locked: "x" | "y" | null
    }
    let session: Session | null = null

    const begin = (x: number, y: number, t: number): void => {
      token.current += 1
      suppressClick.current = false
      const origin = currentX()
      session = { x, y, origin, lastX: x, lastT: t, locked: null }
      gesture.current = "pending"
      place(origin, 0)
    }

    const move = (x: number, y: number, t: number, prevent: () => void): void => {
      if (session === null) return
      const dx = x - session.x
      const dy = y - session.y
      if (Math.hypot(dx, dy) > 10) suppressClick.current = true
      if (session.locked === null) {
        if (Math.hypot(dx, dy) < 8) return
        session.locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y"
      }
      if (session.locked === "y") {
        gesture.current = "idle"
        return
      }
      prevent()
      gesture.current = "dragging"
      session.lastX = x
      session.lastT = t
      if (reducedRef.current) return
      const width = stage.clientWidth
      const index = indexRef.current
      const count = countRef.current
      let offset = session.origin - rest() + dx
      const maxOffset = index > 0 ? width : 0
      const minOffset = index < count - 1 ? -width : 0
      if (offset > maxOffset) offset = maxOffset + (offset - maxOffset) * 0.32
      if (offset < minOffset) offset = minOffset + (offset - minOffset) * 0.32
      place(rest() + offset, 0)
    }

    const finish = (x: number, t: number): void => {
      if (session === null) return
      const ended = session
      session = null
      if (ended.locked !== "x") {
        gesture.current = "idle"
        return
      }
      const width = stage.clientWidth
      const visual = currentX() - rest()
      const offset = reducedRef.current ? x - ended.x : visual
      const dt = t - ended.lastT
      const velocity = dt > 0 && dt < 120 ? (x - ended.lastX) / dt : 0
      const index = indexRef.current
      const count = countRef.current
      const direction = swipeDecision(offset, velocity, width, index > 0, index < count - 1)
      if (direction === 0 || reducedRef.current) {
        gesture.current = "idle"
        if (!reducedRef.current) place(rest(), slideMs(offset))
        if (direction !== 0) onCommitRef.current(direction)
        return
      }
      const target = rest() + (direction === 1 ? -width : width)
      const remaining = target - currentX()
      if (Math.abs(remaining) < 1) {
        gesture.current = "idle"
        flushSync(() => onCommitRef.current(direction))
        return
      }
      const id = ++token.current
      gesture.current = "settling"
      const ms = slideMs(target - currentX())
      let timer = 0
      const commit = (): void => {
        if (id !== token.current) return
        token.current += 1
        window.clearTimeout(timer)
        rail.removeEventListener("transitionend", done)
        gesture.current = "idle"
        // The neighbor is already in view. Commit in this frame, and the layout
        // effect recenters the rail before the browser paints.
        flushSync(() => onCommitRef.current(direction))
      }
      const done = (event: TransitionEvent): void => {
        if (event.propertyName !== "transform") return
        commit()
      }
      timer = window.setTimeout(commit, ms + 80)
      rail.addEventListener("transitionend", done)
      place(target, ms)
    }

    const onTouchStart = (event: TouchEvent): void => {
      if (event.touches.length !== 1) return
      const touch = event.touches[0]
      if (touch === undefined) return
      begin(touch.clientX, touch.clientY, event.timeStamp)
    }
    const onTouchMove = (event: TouchEvent): void => {
      if (event.touches.length !== 1) return
      const touch = event.touches[0]
      if (touch === undefined) return
      move(touch.clientX, touch.clientY, event.timeStamp, () => event.preventDefault())
    }
    const onTouchEnd = (event: TouchEvent): void => {
      const touch = event.changedTouches[0]
      if (touch === undefined) return
      finish(touch.clientX, event.timeStamp)
    }
    const onTouchCancel = (): void => {
      session = null
      token.current += 1
      gesture.current = "idle"
      place(rest(), 180)
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (event.pointerType === "touch" || event.button !== 0) return
      try {
        stage.setPointerCapture(event.pointerId)
      } catch {
        // A synthetic event has no pointer to capture. The move still arrives on the stage.
      }
      begin(event.clientX, event.clientY, event.timeStamp)
    }
    const onPointerMove = (event: PointerEvent): void => {
      if (event.pointerType === "touch") return
      move(event.clientX, event.clientY, event.timeStamp, () => event.preventDefault())
    }
    const onPointerUp = (event: PointerEvent): void => {
      if (event.pointerType === "touch") return
      finish(event.clientX, event.timeStamp)
    }

    const observer = new ResizeObserver(() => {
      if (gesture.current !== "idle") return
      place(rest(), 0)
    })
    observer.observe(stage)
    stage.addEventListener("touchstart", onTouchStart, { passive: true })
    stage.addEventListener("touchmove", onTouchMove, { passive: false })
    stage.addEventListener("touchend", onTouchEnd)
    stage.addEventListener("touchcancel", onTouchCancel)
    stage.addEventListener("pointerdown", onPointerDown)
    stage.addEventListener("pointermove", onPointerMove)
    stage.addEventListener("pointerup", onPointerUp)
    stage.addEventListener("pointercancel", onPointerUp)
    return () => {
      token.current += 1
      observer.disconnect()
      stage.removeEventListener("touchstart", onTouchStart)
      stage.removeEventListener("touchmove", onTouchMove)
      stage.removeEventListener("touchend", onTouchEnd)
      stage.removeEventListener("touchcancel", onTouchCancel)
      stage.removeEventListener("pointerdown", onPointerDown)
      stage.removeEventListener("pointermove", onPointerMove)
      stage.removeEventListener("pointerup", onPointerUp)
      stage.removeEventListener("pointercancel", onPointerUp)
    }
  }, [enabled, stageRef, railRef, suppressClick])
}
