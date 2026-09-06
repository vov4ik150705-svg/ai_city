import { Container, Rectangle, Sprite, Texture } from "pixi.js"

export type GlyphMetric = {
  readonly x: bigint
  readonly y: bigint
  readonly w: bigint
  readonly h: bigint
  readonly advance: bigint
}

export function measureGlyphs(
  text: string,
  glyphs: { readonly [ch: string]: GlyphMetric | undefined },
): bigint {
  let w = 0n
  for (const ch of text) {
    const g = glyphs[ch]
    if (g === undefined) continue
    w += g.advance
  }
  return w
}

export function joinLabel(name: string, ticker: string, level: bigint): string {
  const parts: string[] = []
  if (name.length > 0) parts.push(name)
  if (ticker.length > 0) parts.push(ticker)
  if (level > 0n) parts.push(level.toString())
  if (parts.length === 0) return ""
  let out = parts[0] ?? ""
  let i = 1
  while (i < parts.length) {
    const next = parts[i]
    if (next !== undefined) out = `${out} ${next}`
    i += 1
  }
  return out
}

export function blitGlyphs(
  parent: Container,
  text: string,
  originX: bigint,
  originY: bigint,
  font: Texture,
  glyphs: { readonly [ch: string]: GlyphMetric | undefined },
): void {
  let x = originX
  for (const ch of text) {
    const g = glyphs[ch]
    if (g === undefined) continue
    if (g.w > 0n && g.h > 0n) {
      const slice = new Texture({
        source: font.source,
        frame: new Rectangle(Number(g.x), Number(g.y), Number(g.w), Number(g.h)),
      })
      const sprite = new Sprite(slice)
      sprite.roundPixels = true
      sprite.x = Number(x)
      sprite.y = Number(originY)
      parent.addChild(sprite)
    }
    x += g.advance
  }
}
