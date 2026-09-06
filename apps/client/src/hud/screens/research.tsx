import type { ReactElement } from "react"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

export function ResearchScreen(props: ScreenProps): ReactElement {
  return (
    <ScreenFrame id="research" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <p data-research="1" />
    </ScreenFrame>
  )
}
