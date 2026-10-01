import type { ReactNode } from "react"

type CardVariant = "glass" | "solid" | "dark" | "feature" | "media-row"

export function Card({
  variant = "solid",
  className = "",
  children,
}: {
  variant?: CardVariant
  className?: string
  children: ReactNode
}) {
  return <div className={`site-card site-card--${variant} ${className}`}>{children}</div>
}
