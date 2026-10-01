import type { CSSProperties, ReactElement } from "react"
import { BRAND_MARK_URL } from "./hudArtUrls.js"

/** Flat hex "C" from the brand mark, tinted to the accent. The 3D token coin
 * stays on money rows; this is the chip and wallet-card mark from frames 16/17. */
export function CorpMark(props: { readonly kind: "chip" | "balance" }): ReactElement {
  const mask = `url("${BRAND_MARK_URL}")`
  const style: CSSProperties = { maskImage: mask, WebkitMaskImage: mask }
  return (
    <span className={`hud-corp-mark hud-corp-mark--${props.kind}`} aria-hidden="true">
      <span className="hud-corp-mark__glyph" style={style} />
    </span>
  )
}
