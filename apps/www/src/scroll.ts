export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth"
}

export function hashElementId(id: string): string {
  try {
    return decodeURIComponent(id)
  } catch {
    return id
  }
}

export function scrollToId(id: string, behavior: ScrollBehavior = scrollBehavior()): void {
  document.getElementById(hashElementId(id))?.scrollIntoView({ behavior, block: "start" })
}

function hasDocumentHash(): boolean {
  return window.location.hash.length > 1
}

const HOLD_FRAMES = 45

// Reload restores the previous scroll offset before the module runs. On the
// homepage that offset is often the game section, so the first paint skips
// the hero. The head script opts out of restoration; this pulls a late
// restore back to the top until the visitor scrolls or the hold expires.
export function holdFreshDocumentTop(): void {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual"
  if (hasDocumentHash()) return

  let held = true
  const pin = (): void => {
    if (!held) return
    if (hasDocumentHash()) {
      release()
      return
    }
    if (window.scrollY !== 0) window.scrollTo(0, 0)
  }
  function release(): void {
    if (!held) return
    held = false
    window.removeEventListener("scroll", pin)
  }

  pin()
  window.addEventListener("scroll", pin, { passive: true })
  window.addEventListener("wheel", release, { capture: true, passive: true, once: true })
  window.addEventListener("touchstart", release, { capture: true, passive: true, once: true })
  window.addEventListener("pointerdown", release, { capture: true, passive: true, once: true })
  window.addEventListener("keydown", release, { capture: true, once: true })
  window.addEventListener("popstate", release, { once: true })

  let frames = 0
  const watch = (): void => {
    pin()
    frames += 1
    if (held && frames < HOLD_FRAMES) window.requestAnimationFrame(watch)
    else release()
  }
  window.requestAnimationFrame(watch)
}
