import { ChevronRight } from "lucide-react"
import { prizeFunnelCopy, prizeFunnelSteps } from "../data/prizeFunnel"
import "../styles/prize-funnel.css"

const allDots = prizeFunnelSteps[0].dots
const scatterStep = 7

function dotRank(index: number): number {
  return (index * scatterStep) % allDots
}

function DotField({ active, tone }: { active: number; tone: string }) {
  return (
    <span className={`pf-dots pf-dots--${tone}`} aria-hidden="true">
      {Array.from({ length: allDots }, (_, index) => (
        <span key={index} className={dotRank(index) < active ? "pf-dot is-in" : "pf-dot"} />
      ))}
    </span>
  )
}

export function PrizeFunnel({
  id,
  className = "",
  note = true,
}: {
  id: string
  className?: string
  note?: boolean
}) {
  const headingId = `${id}-title`
  return (
    <section id={id} className={`pf ${className}`} aria-labelledby={headingId}>
      <header className="pf__head">
        <p className="site-eyebrow type-eyebrow">{prizeFunnelCopy.eyebrow}</p>
        <h2 id={headingId} className="type-heading-3">
          {prizeFunnelCopy.title}
        </h2>
        <p className="type-body">{prizeFunnelCopy.lead}</p>
      </header>
      <ol className="pf__steps">
        {prizeFunnelSteps.map((step, index) => (
          <li key={step.id} className={`pf-step pf-step--${step.id}`}>
            <div className="pf-step__stage">
              <DotField active={step.dots} tone={step.id} />
              <span className="pf-step__count">
                {step.dots}
                <span className="pf-sr"> of {allDots} cities</span>
              </span>
            </div>
            {index < prizeFunnelSteps.length - 1 ? (
              <span className="pf-step__arrow" aria-hidden="true">
                <ChevronRight size={18} />
              </span>
            ) : null}
            <div className="pf-step__copy">
              <p className="type-label">{step.label}</p>
              <h3 className="type-heading-4">{step.title}</h3>
              <p className="type-body-sm">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      {note ? <p className="pf__note type-caption">{prizeFunnelCopy.note}</p> : null}
    </section>
  )
}
