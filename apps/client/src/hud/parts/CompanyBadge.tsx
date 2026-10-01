import type { ReactElement } from "react"
import { TickerMark } from "./TickerMark.js"

export function CompanyBadge(props: { readonly ticker: string; readonly districtId?: string; readonly mark?: boolean }): ReactElement {
  const districtId = props.districtId
  const showMark = props.mark !== false
  return (
    <span
      data-ticker={props.ticker}
      {...(districtId === undefined ? {} : { "data-role": districtId })}
      className="hud-co"
      title={props.ticker}
    >
      {showMark ? <TickerMark ticker={props.ticker} /> : null}
      {props.ticker}
    </span>
  )
}
