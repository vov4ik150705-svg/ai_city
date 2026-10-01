import katex from "katex"

const cache = new Map<string, string | null>()

/** KaTeX markup for `tex`, or null when KaTeX refuses it. Never a picture of a formula. */
export function renderTex(tex: string, display: boolean): string | null {
  const key = `${display ? "block" : "inline"}:${tex}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  let html: string | null
  try {
    html = katex.renderToString(tex, { displayMode: display, throwOnError: true, strict: "error", output: "htmlAndMathml" })
  } catch {
    html = null
  }
  cache.set(key, html)
  return html
}
