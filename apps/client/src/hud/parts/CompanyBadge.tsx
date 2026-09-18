import type { ReactElement } from "react"

export function CompanyBadge(props: { readonly ticker: string; readonly districtId?: string }): ReactElement {
  const districtId = props.districtId
  return (
    <span
      data-ticker={props.ticker}
      {...(districtId === undefined ? {} : { "data-role": districtId })}
      className="hud-co"
      title={props.ticker}
    >
      {props.ticker}
    </span>
  )
}
