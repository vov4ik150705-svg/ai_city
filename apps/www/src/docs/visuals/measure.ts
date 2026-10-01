/**
 * SVG text can't be measured before layout, so sheets place text on estimates taken in the browser:
 * the widest per-glyph advance of a line at each sheet size.
 */
export const ADVANCE = {
  /** Caveat 500 at 18px, `.sk-note` / `.sk-sub`. */
  note: 7.3,
  /** Plex Mono 400 at 13.5px, `.sk-mono`: 0.6 em. */
  mono: 8.1,
  /** Caveat 600 at 21px, uppercase with 0.04 em tracking, `.sk-node`. */
  node: 12.3,
} as const

export type TextFace = keyof typeof ADVANCE

export function estimateWidth(text: string, face: TextFace): number {
  return text.length * ADVANCE[face]
}
