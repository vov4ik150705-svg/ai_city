import type { ButtonHTMLAttributes, ReactNode } from "react"
import { ArrowRight } from "lucide-react"

type ButtonProps = {
  size?: "sm" | "md" | "lg"
  variant?: "primary" | "secondary" | "on-dark"
  trailingIcon?: boolean
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

export function Button({
  size = "md",
  variant = "primary",
  trailingIcon = false,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = `site-button type-button site-button--${size} site-button--${variant} ${className}`
  return (
    <button type={type} className={classes} {...rest}>
      {children}
      {trailingIcon ? <ArrowRight size={16} aria-hidden="true" /> : null}
    </button>
  )
}
