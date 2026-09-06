import type { ReactElement } from "react"
import { ActionButton } from "../parts/ActionButton.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

export function LeaderboardScreen(props: ScreenProps): ReactElement {
  const empty = props.view.basket.length === 0
  return (
    <ScreenFrame id="leaderboard" view={props.view} loading={props.loading} empty={empty} onClose={props.onClose}>
      <p data-period={props.view.periodHours}>{props.view.periodHours}</p>
      <ul className="hud-list">
        {props.view.basket.map((row) => (
          <li key={row.ticker} data-ticker={row.ticker}>
            {row.ticker}
          </li>
        ))}
      </ul>
      <ActionButton {...props} actionId="leaderboard_claim" />
    </ScreenFrame>
  )
}
