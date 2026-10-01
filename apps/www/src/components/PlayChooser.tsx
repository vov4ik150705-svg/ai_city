import { playHint } from "../data/shell"
import { Destination } from "../site"
import { Modal } from "./Modal"

export function PlayChooser({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How do you want to play?" onClose={onClose}>
      <p className="type-caption">{playHint}</p>
      <div className="site-button-row">
        <Destination kind="demo" className="site-button type-button site-button--lg site-button--primary">
          Try the demo
        </Destination>
        <Destination kind="wallet" className="site-button type-button site-button--lg site-button--secondary">
          Connect wallet
        </Destination>
      </div>
    </Modal>
  )
}
