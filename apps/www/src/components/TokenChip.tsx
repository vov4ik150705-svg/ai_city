import { useEffect, useId, useRef, useState } from "react"
import { chipTooltip, contractStatus } from "../data/shell"

export function TokenChip() {
  const tipId = useId()
  const chipRef = useRef<HTMLSpanElement>(null)
  const status = contractStatus()
  const [pinned, setPinned] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!pinned) return
    function closeOnOutside(event: PointerEvent) {
      const chip = chipRef.current
      if (chip !== null && event.target instanceof Node && !chip.contains(event.target)) setPinned(false)
    }
    document.addEventListener("pointerdown", closeOnOutside)
    return () => document.removeEventListener("pointerdown", closeOnOutside)
  }, [pinned])

  async function copyAddress() {
    if (status.copyValue === null) return
    await navigator.clipboard.writeText(status.copyValue)
    setCopied(true)
  }

  return (
    <span
      ref={chipRef}
      className={pinned ? "site-chip type-metadata is-open" : "site-chip type-metadata"}
      tabIndex={0}
      onClick={() => setPinned((value) => !value)}
      aria-describedby={tipId}
    >
      <span className="site-chip__mark">$CORP</span>
      <span aria-hidden="true">·</span>
      {status.copyValue === null ? (
        <span>{status.label}</span>
      ) : (
        <button type="button" className="type-mono" onClick={() => void copyAddress()}>
          {status.label}
        </button>
      )}
      <span id={tipId} role="tooltip" className="site-tooltip type-tooltip">
        {copied ? "Copied." : chipTooltip}
      </span>
    </span>
  )
}
