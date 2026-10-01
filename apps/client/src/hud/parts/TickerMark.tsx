import type { ReactElement } from "react"
import { tickerMarkUrl } from "./hudArtUrls.js"

/** Company mark from hud/corp_logos. Same artwork as the season prize basket. */
export function TickerMark(props: { readonly ticker: string; readonly className?: string }): ReactElement {
  const src = tickerMarkUrl(props.ticker)
  const className = props.className === undefined ? "hud-ticker-mark" : `hud-ticker-mark ${props.className}`
  if (src === undefined) return <span className={className} />
  return <img className={className} src={src} alt="" data-ticker-mark={props.ticker} />
}
