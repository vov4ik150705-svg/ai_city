import type { ReactNode } from "react"
import { ArrowRight } from "lucide-react"
import { Link } from "../site"
import { footerCopy } from "../data/shell"

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="site-eyebrow type-eyebrow">{children}</p>
}

export function Section({
  id,
  theme = "light",
  children,
}: {
  id?: string
  theme?: "light" | "sky" | "dark"
  children: ReactNode
}) {
  return (
    <section id={id} className="site-section" data-theme={theme}>
      <div className="site-container">{children}</div>
    </section>
  )
}

const headingClass = {
  "display-hero": "type-display-hero",
  "display-1": "type-display-1",
  "display-2": "type-display-2",
  "heading-3": "type-heading-3",
  "heading-4": "type-heading-4",
} as const

export function Heading({
  level,
  role,
  children,
}: {
  level: 1 | 2 | 3 | 4
  role: keyof typeof headingClass
  children: ReactNode
}) {
  const className = headingClass[role]
  if (level === 1) return <h1 className={className}>{children}</h1>
  if (level === 2) return <h2 className={className}>{children}</h2>
  if (level === 3) return <h3 className={className}>{children}</h3>
  return <h4 className={className}>{children}</h4>
}

export function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="type-display-1">{title}</h2>
      {description !== undefined ? <p className="type-body">{description}</p> : null}
    </div>
  )
}

export function PageIntro({
  label,
  title,
  description,
}: {
  label: string
  title: string
  description: string
}) {
  return (
    <section className="site-section" data-theme="light">
      <div className="site-container">
        <p className="site-eyebrow type-eyebrow">
          <Link to="/">Corporator</Link>
          <span aria-hidden="true"> / </span>
          {label}
        </p>
        <h1 className="type-display-1">{title}</h1>
        <p className="type-body-lg">{description}</p>
      </div>
    </section>
  )
}

export function RiskNote() {
  return <p className="type-caption">{footerCopy.disclaimer}</p>
}

export function ArrowLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="site-arrow-link type-label">
      {children}
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  )
}
