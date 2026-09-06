import { Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js"
import type { AtlasFrame } from "./sprites.js"

export function textureOf(
  base: Texture,
  frames: { readonly [id: string]: AtlasFrame },
  id: string,
): Texture | undefined {
  const fr = frames[id]
  if (fr === undefined) return undefined
  return new Texture({
    source: base.source,
    frame: new Rectangle(Number(fr.x), Number(fr.y), Number(fr.w), Number(fr.h)),
  })
}

export function placeCube(
  parent: Container,
  tex: Texture,
  fr: AtlasFrame,
  originX: bigint,
  originY: bigint,
  tileW: bigint,
  lift: bigint,
): Sprite {
  const two = 1n + 1n
  const halfW = tileW / two
  const sprite = new Sprite(tex)
  sprite.roundPixels = true
  sprite.x = Number(originX + halfW) - Number(fr.w) / Number(two)
  sprite.y = Number(originY - lift)
  parent.addChild(sprite)
  return sprite
}

export function placeWaterPlane(
  parent: Container,
  color: number,
  a: { readonly x: bigint; readonly y: bigint },
  b: { readonly x: bigint; readonly y: bigint },
  c: { readonly x: bigint; readonly y: bigint },
  d: { readonly x: bigint; readonly y: bigint },
  cubeH: bigint,
  pad: bigint,
): Graphics {
  let minX = a.x
  let maxX = a.x
  let minY = a.y
  let maxY = a.y
  for (const p of [b, c, d]) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const g = new Graphics()
  g.rect(
    Number(minX - pad),
    Number(minY + cubeH),
    Number(maxX - minX + pad + pad),
    Number(maxY - minY + pad),
  )
  g.fill({ color })
  parent.addChildAt(g, 0)
  return g
}
