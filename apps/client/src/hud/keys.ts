export function isTypingTarget(target: EventTarget | null): boolean {
  if (target === null || !(target instanceof Element)) return false
  const hit = target.closest("input, textarea, select, [contenteditable='true']")
  return hit !== null
}

export type HudEscapeTarget = "hold" | "workspace" | "selection" | "none"

/** Escape closes the topmost visible overlay; an in-flight txn is not dismissible. */
export function hudEscapeTarget(args: {
  readonly txnInFlight: boolean
  readonly workspaceOpen: boolean
  readonly selected: boolean
}): HudEscapeTarget {
  if (args.txnInFlight) return "hold"
  if (args.workspaceOpen) return "workspace"
  if (args.selected) return "selection"
  return "none"
}

type FocusSource = {
  readonly closest: (selector: string) => FocusSource | null
  readonly getAttribute: (name: string) => string | null
}

export type HudFocusReturn = {
  readonly node: HTMLElement
  readonly relocate: string
}

function attrOf(el: FocusSource | null, name: string): string {
  if (el === null) return ""
  const value = el.getAttribute(name)
  return value === null ? "" : value
}

function cssAttr(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

/** Selector that can find a remounted trigger after island chrome unmounts. */
export function hudFocusRelocate(el: FocusSource): string {
  const fnId = attrOf(el.closest("[data-function]"), "data-function")
  if (fnId.length > 0) return `[data-function="${cssAttr(fnId)}"] button`
  const keyed = el.closest("[data-key]")
  const key = attrOf(keyed, "data-key")
  const scope = el.closest("[data-surface],[data-id]")
  const surface = attrOf(scope, "data-surface")
  const scopedId = attrOf(scope, "data-id")
  if (key.length > 0 && surface.length > 0) return `[data-surface="${cssAttr(surface)}"] [data-key="${cssAttr(key)}"]`
  if (key.length > 0 && scopedId.length > 0) return `[data-id="${cssAttr(scopedId)}"] [data-key="${cssAttr(key)}"]`
  if (key.length > 0) return `[data-key="${cssAttr(key)}"]`
  if (scopedId.length > 0) return `[data-id="${cssAttr(scopedId)}"] button, [data-id="${cssAttr(scopedId)}"] [role="button"]`
  if (surface.length > 0) return `[data-surface="${cssAttr(surface)}"] button`
  return ""
}

/** Root chrome is a tab stop for scene focus, not a workspace return target. */
export function isHudFocusShell(el: { readonly getAttribute: (name: string) => string | null }): boolean {
  const value = el.getAttribute("data-app")
  return value === "corporator"
}

export function captureHudFocus(active: EventTarget | null): HudFocusReturn | undefined {
  if (!(active instanceof HTMLElement)) return undefined
  if (active === active.ownerDocument.body) return undefined
  if (isHudFocusShell(active)) return undefined
  return { node: active, relocate: hudFocusRelocate(active) }
}

export function resolveHudFocusReturn(args: {
  readonly saved: HudFocusReturn | undefined
  readonly contains: (node: Node) => boolean
  readonly query: (selector: string) => HTMLElement | undefined
  readonly fallback: HTMLElement | undefined
}): HTMLElement | undefined {
  const saved = args.saved
  if (saved !== undefined && args.contains(saved.node)) return saved.node
  if (saved !== undefined && saved.relocate.length > 0) {
    const hit = args.query(saved.relocate)
    if (hit !== undefined) return hit
  }
  return args.fallback
}
