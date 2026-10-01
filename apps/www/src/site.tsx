import { createContext, useContext, type AnchorHTMLAttributes, type ReactNode } from "react"
import { destinations, type DestinationKind } from "./data/shell"

export type SiteContextValue = {
  navigate: (path: string) => void
  open: (kind: string) => void
  openPlay: () => void
}

export const SiteContext = createContext<SiteContextValue>({
  navigate: () => undefined,
  open: () => undefined,
  openPlay: () => undefined,
})

export function Link({
  to,
  children,
  className,
  onClick,
  ...rest
}: { to: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useContext(SiteContext)
  return (
    <a
      href={to}
      className={className}
      {...rest}
      onClick={(event) => {
        onClick?.(event)
        if (
          !event.defaultPrevented &&
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault()
          navigate(to)
        }
      }}
    >
      {children}
    </a>
  )
}

export function Destination({
  kind,
  className,
  children,
}: {
  kind: DestinationKind
  className?: string
  children: ReactNode
}) {
  const { open } = useContext(SiteContext)
  const url = destinations[kind]
  if (url !== null) {
    return (
      <a href={url} className={className} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  }
  return (
    <button type="button" className={className} onClick={() => open(kind)}>
      {children}
    </button>
  )
}
