const SMOOTH_MS = 200
const MAX_FRAME_MS = 48
const SETTLE_PX = 0.5
const SNAP_PX = 1
const LINE_HEIGHT_PX = 16

// A late frame must not spend the whole stall as one ease step: that leap is
// the picture jumping. A missed vsync still counts in full.
export function easeScroll(current: number, aim: number, dtMs: number): number {
  const dt = dtMs > MAX_FRAME_MS ? MAX_FRAME_MS : dtMs
  const blend = 1 - Math.exp(-dt / SMOOTH_MS)
  return current + (aim - current) * blend
}

// Chrome snaps scrollY to device pixels. Copying that snap back into the
// animation every frame eats any step smaller than a pixel, so the page
// sticks and then jumps. Keep a sub-pixel lead. A full pixel or more means
// the browser actually rejected the position (end of the page, or something
// else moved it) — follow that, or the stored gap becomes a teleport.
// A fast flick reaches the page edge in the target before the eased position
// does. The rest of that flick is the speed dying off. Those events must still
// be taken: if they fall through, the browser scrolls natively and the next
// eased frame yanks the picture back.
export function pageWheel(
  scrolling: boolean,
  scrollY: number,
  target: number,
  limit: number,
  delta: number,
): { readonly prevent: true; readonly moved: boolean; readonly target: number } {
  const origin = scrolling ? clamp(target, 0, limit) : scrollY
  const next = Math.max(0, origin + delta)
  const moved = Math.abs(clamp(next, 0, limit) - origin) >= SETTLE_PX
  return { prevent: true, moved, target: moved ? next : target }
}

export function followScroll(
  animated: number,
  applied: number,
  target: number,
  limit: number,
): { readonly current: number; readonly target: number } {
  const ahead = animated - applied
  if (ahead > SETTLE_PX && limit <= applied + SETTLE_PX) {
    return { current: applied, target: Math.min(target, limit) }
  }
  if (applied > animated || ahead >= SNAP_PX) return { current: applied, target }
  return { current: animated, target }
}

let started = false

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function readLimit(): number {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function scrollLocked(): boolean {
  const body = document.body
  return body.style.position === "fixed" || body.style.overflow === "hidden"
}

function wheelPixels(event: WheelEvent): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * LINE_HEIGHT_PX
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * window.innerHeight
  return event.deltaY
}

const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "])

export function startSmoothScroll(): void {
  if (started) return
  started = true

  let frame = 0
  let last = 0
  let epoch = 0
  let current = window.scrollY
  let target = current
  let limit = readLimit()
  let scrollers = new Set<HTMLElement>()
  let collectTimer = 0

  const collectScrollers = (): void => {
    const next = new Set<HTMLElement>()
    const nodes = document.body.querySelectorAll<HTMLElement>(
      ".buildings__rail-list, .industries__scroller, .hb-nav, .book-zoom__scroll, .hb-figure__scroll",
    )
    for (const node of nodes) {
      const style = getComputedStyle(node)
      const overflowY = style.overflowY
      const overflowX = style.overflowX
      if (overflowY === "auto" || overflowY === "scroll" || overflowX === "auto" || overflowX === "scroll") {
        next.add(node)
      }
    }
    scrollers = next
    limit = readLimit()
  }

  const scheduleCollect = (): void => {
    if (collectTimer !== 0) window.clearTimeout(collectTimer)
    collectTimer = window.setTimeout(() => {
      collectTimer = 0
      if (frame !== 0) {
        scheduleCollect()
        return
      }
      collectScrollers()
    }, 240)
  }

  const write = (y: number): void => {
    window.scrollTo(0, y)
    const next = followScroll(y, window.scrollY, target, limit)
    current = next.current
    target = next.target
  }

  const halt = (): void => {
    epoch += 1
    if (frame !== 0) cancelAnimationFrame(frame)
    frame = 0
    last = 0
    current = window.scrollY
    target = current
    limit = readLimit()
  }

  const tick = (now: number): void => {
    const mine = epoch
    if (scrollLocked()) {
      halt()
      return
    }
    const dt = last === 0 ? 16 : now - last
    last = now
    limit = readLimit()
    const aim = clamp(target, 0, limit)
    current = easeScroll(current, aim, dt)
    if (Math.abs(aim - current) < SETTLE_PX) {
      current = aim
      write(current)
      if (epoch !== mine) return
      frame = 0
      last = 0
      return
    }
    write(current)
    if (epoch !== mine) return
    frame = requestAnimationFrame(tick)
  }

  const canTake = (node: HTMLElement, axis: "x" | "y", delta: number): boolean => {
    const span = axis === "y" ? node.scrollHeight - node.clientHeight : node.scrollWidth - node.clientWidth
    if (span <= 1) return false
    const pos = axis === "y" ? node.scrollTop : node.scrollLeft
    if (delta > 0) return pos + 1 < span
    if (delta < 0) return pos > 1
    return false
  }

  const nestedScrolls = (event: WheelEvent, axis: "x" | "y"): boolean => {
    const delta = axis === "y" ? event.deltaY : event.deltaX
    for (const node of event.composedPath()) {
      if (node === document.body || node === document.documentElement) return false
      if (node instanceof HTMLElement && scrollers.has(node) && canTake(node, axis, delta)) return true
    }
    return false
  }

  const onWheel = (event: WheelEvent): void => {
    if (scrollLocked()) return
    if (event.ctrlKey || event.metaKey) return
    if (!event.cancelable || event.deltaY === 0) return
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) && nestedScrolls(event, "x")) return
    if (nestedScrolls(event, "y")) return
    if (frame === 0) limit = readLimit()
    const step = pageWheel(frame !== 0, window.scrollY, target, limit, wheelPixels(event))
    event.preventDefault()
    if (!step.moved) return
    if (frame === 0) current = window.scrollY
    target = step.target
    if (frame === 0) frame = requestAnimationFrame(tick)
  }

  const onPointerDown = (): void => {
    if (frame !== 0) halt()
  }

  const onKey = (event: KeyboardEvent): void => {
    if (frame === 0) return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (!SCROLL_KEYS.has(event.key)) return
    halt()
  }

  const arm = (): void => {
    collectScrollers()
    window.addEventListener("wheel", onWheel, { passive: false, capture: true })
    window.addEventListener("pointerdown", onPointerDown, { capture: true })
    window.addEventListener("touchstart", onPointerDown, { capture: true, passive: true })
    window.addEventListener("keydown", onKey)
  }

  const disarm = (): void => {
    window.removeEventListener("wheel", onWheel, { capture: true })
    window.removeEventListener("pointerdown", onPointerDown, { capture: true })
    window.removeEventListener("touchstart", onPointerDown, { capture: true })
    window.removeEventListener("keydown", onKey)
    halt()
  }

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
  const onMotion = (): void => {
    disarm()
    if (!prefersReducedMotion()) arm()
  }
  onMotion()
  motion.addEventListener("change", onMotion)
  window.addEventListener("resize", scheduleCollect)
  const mutations = new MutationObserver(scheduleCollect)
  mutations.observe(document.body, { childList: true, subtree: true })
}
