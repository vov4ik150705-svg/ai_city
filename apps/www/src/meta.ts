export function applyPageMeta(title: string, description: string): void {
  document.title = title
  for (const [key, value] of [
    ["description", description],
    ["og:title", title],
    ["og:description", description],
  ] as const) {
    const attr = key.startsWith("og:") ? "property" : "name"
    let el = document.querySelector(`meta[${attr}="${key}"]`)
    if (el === null) {
      el = document.createElement("meta")
      el.setAttribute(attr, key)
      document.head.appendChild(el)
    }
    el.setAttribute("content", value)
  }
}
