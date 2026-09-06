import type { ReactElement } from "react"
import { ActionButton } from "../parts/ActionButton.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

export function OnboardingDemoScreen(props: ScreenProps): ReactElement {
  return (
    <ScreenFrame id="onboarding_demo" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <ol data-onboard="1">
        {props.pack.onboardSteps.map((step) => (
          <li key={step.id} data-step={step.step.toString()} data-onboard-id={step.id}>
            {step.codes.map((code) => (
              <span key={code} data-code={code} />
            ))}
          </li>
        ))}
      </ol>
      <ActionButton {...props} actionId="onboard_next" />
      <ActionButton {...props} actionId="onboard_wallet_offer" />
    </ScreenFrame>
  )
}
