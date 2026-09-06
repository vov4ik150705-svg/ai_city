import type { Dict } from "@corporator/engine"

export type Preview = { readonly [key: string]: unknown }

function freezeDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) {
    const xs: unknown[] = []
    for (const item of value) xs.push(freezeDeep(item))
    return Object.freeze(xs)
  }
  const src = value as { readonly [key: string]: unknown }
  const out: { [key: string]: unknown } = {}
  for (const key of Object.keys(src)) {
    out[key] = freezeDeep(src[key])
  }
  return Object.freeze(out)
}

/** Readonly projection. Does not run the tick. HUD.md §8; arch.packages.client.preview_only. */
export function preview(state: Dict): Preview {
  return freezeDeep(state) as Preview
}
