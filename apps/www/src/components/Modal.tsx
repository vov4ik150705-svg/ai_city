import { useEffect, useRef, type ReactNode } from "react"
import { X } from "lucide-react"

const focusable = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const node = dialog.current
    if (node === null || node.open) return
    node.showModal()
  }, [])

  useEffect(() => {
    const node = dialog.current
    if (node === null) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return
      const list = Array.from(node.querySelectorAll<HTMLElement>(focusable))
      const first = list[0]
      const last = list[list.length - 1]
      if (first === undefined || last === undefined) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    node.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      node.removeEventListener("keydown", onKey)
    }
  }, [])

  return (
    <dialog
      ref={dialog}
      className="site-modal"
      aria-labelledby="site-modal-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <button type="button" className="site-icon-button site-modal__close" aria-label="Close" onClick={onClose}>
        <X size={20} aria-hidden="true" />
      </button>
      <h2 id="site-modal-title" className="type-heading-4">
        {title}
      </h2>
      {children}
    </dialog>
  )
}
