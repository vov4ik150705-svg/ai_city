import { Modal } from "./Modal"

export function PreviewDialog({ kind, close }: { kind: string; close: () => void }) {
  const play = kind === "demo" || kind === "wallet" || kind === "game"
  return (
    <Modal title={play ? "Play" : "Link"} onClose={close}>
      <p className="type-body">
        {play
          ? "A verified game or demo destination has not been supplied. No wallet connects, funds move, or progress is recorded."
          : "The external documentation URL has not been supplied."}
      </p>
    </Modal>
  )
}
