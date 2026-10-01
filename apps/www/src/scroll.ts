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
